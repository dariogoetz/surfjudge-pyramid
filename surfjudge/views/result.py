# -*- coding: utf-8 -*-
"""
    Copyright (c) 2018 Dario Götz and Jörg Christian Reiher.
    All rights reserved.
"""
from datetime import datetime
import json

from pyramid.view import view_config

import logging
log = logging.getLogger(__name__)

from . import base

from ..models import model

class ResultViews(base.SurfjudgeView):

    def _delete_results_for_heat(self, heat_id):
        results = self.db.query(model.Result).filter(model.Result.heat_id == heat_id).all()
        for p in results:
            self.db.delete(p)

    @view_config(route_name='results:heat_id', request_method='GET', permission='view_results', renderer='json')
    @view_config(route_name='results', request_method='GET', permission='view_results', renderer='json')
    def get_results(self):
        log.info('GET results')
        query = model.gen_query_expression(self.all_params, model.Result)
        res = self.db.query(model.Result).filter(*query).all()
        for p in res:
            # ensure surfer and heat fields are filled (lazily loaded by db)
            p.surfer
            p.heat
        return res

    @view_config(route_name='results:heat_id', request_method='POST', permission='edit_results', renderer='json')
    def set_results(self):
        log.info('POST results for heat %s', self.all_params['heat_id'])
        json_data = self.all_params.get('json_data', '[]')
        data = json.loads(json_data)

        # delete results for given heat_id
        self._delete_results_for_heat(self.all_params['heat_id'])

        # add multiple results to database
        for params in data:
            # update existing element, if it exists
            elem = self.db.merge(model.Result(**params))
            self.db.add(elem)

        # send a "changed" signal to the "results" channel
        self.request.websockets.send_channel('results', 'changed')

        return {}


    @view_config(route_name='results:heat_id', request_method='DELETE', permission='edit_results', renderer='json')
    def delete_results(self):
        log.info('DELETE results for heat %s', self.all_params['heat_id'])
        self._delete_results_for_heat(self.all_params['heat_id'])

        # send a "changed" signal to the "results" channel
        self.request.websockets.send_channel('results', 'changed')


    def _determine_results_for_heat(self, heat_id, n_best_waves=2):
        """
        Collects scores for all judges and participants of the heat and computes
        the averaged results
        """
        # get scores for heat
        scores = self.db.query(model.Score)\
            .filter(model.Score.heat_id == heat_id).all()

        # get judges for heat
        judges = self.db.query(model.JudgeAssignment)\
            .filter(model.JudgeAssignment.heat_id == heat_id).all()
        judge_ids = set([s.judge_id for s in judges])

        # compile scores per sufer and wave
        scores_by_surfer = {}
        for s in scores:
            scores_by_surfer.setdefault(s.surfer_id, {}).setdefault(s.wave, []).append(s)

        # compute average scores
        resulting_scores = self._compute_resulting_scores(scores_by_surfer, judge_ids, heat_id)

        # determine final scores
        total_scores = {}
        for surfer_id, average_scores in resulting_scores.items():
            sorted_scores = sorted(average_scores, key=lambda s: s['score'], reverse=True)
            sorted_scores = [s['score'] for s in sorted_scores if s['score'] >= 0]
            total_score = sum(sorted_scores[:n_best_waves])
            total_scores[surfer_id] = total_score

        # determine placings
        results = []
        sorted_total_scores = sorted(total_scores.items(), key=lambda s: s[1], reverse=True)
        for place, (surfer_id, score) in enumerate(sorted_total_scores):
            d = {}
            d['surfer_id'] = surfer_id
            d['heat_id'] = heat_id
            d['total_score'] = score
            d['place'] = place
            d['wave_scores'] = resulting_scores[surfer_id]
            results.append(d)
        return results

    @view_config(route_name='preliminary_results', request_method='GET', permission='view_preliminary_results', renderer='json')
    @view_config(route_name='preliminary_results:heat_id', request_method='GET', permission='view_preliminary_results', renderer='json')
    def get_preliminary_results(self):
        heat_id = self.all_params['heat_id']
        log.info('GET preliminary results for heat %s', heat_id)
        prelim_results = self._determine_results_for_heat(heat_id)
        published_results = self.db.query(model.Result).filter(model.Result.heat_id==heat_id).all()

        # determine all published scores (triple: surfer, wave, score)
        published_keys = set()
        for r in published_results:
            published_keys |= set([(r.surfer_id, s['wave'], s['score']) for s in r.wave_scores])

        # annotate preliminary results
        for r in prelim_results:
            # make sure, the surfer is available in the results objects
            surfer = self.db.query(model.Surfer).filter(model.Surfer.id==r['surfer_id']).first()
            r['surfer'] = surfer

            # make sure, the heat is available in the results objects
            heat = self.db.query(model.Heat).filter(model.Heat.id==r['heat_id']).first()
            r['heat'] = heat

            # add "unpublished" field for all fields that are not yet published or differ in values
            for s in r['wave_scores']:
                if (r['surfer_id'], s['wave'], s['score']) not in published_keys:
                    s['unpublished'] = True
        return prelim_results


    @view_config(route_name='publish_results:heat_id', request_method='POST', permission='edit_results', renderer='json')
    def publish_results(self):
        heat_id = self.all_params['heat_id']
        log.info('POST publish results for heat %s', heat_id)

        # delete existing results for heat
        self._delete_results_for_heat(heat_id)

        # compute results
        results = self._determine_results_for_heat(heat_id)
        for d in results:
            # insert results into db
            result = model.Result(**d)
            self.db.add(result)

        # send a "changed" signal to the "results" channel
        self.request.websockets.send_channel('results', 'changed')

        return results


    def _compute_resulting_scores(self, scores_by_surfer, judge_ids, heat_id):
        resulting_scores = {}
        for surfer_id, surfer_scores in scores_by_surfer.items():
            for wave, wave_scores in surfer_scores.items():
                # assert that all registered judges gave a score, else ignore (?)
                if set([s.judge_id for s in wave_scores]) != judge_ids:
                    log.warning('Not all judges provided a score for wave %d of surfer %d' % (wave, surfer_id))
                    continue

                # collect scores and count misses
                n_missed = 0
                s = []
                for score in wave_scores:
                    if score.missed:
                        n_missed += 1
                    else:
                        s.append(score.score)

                # fill missed scores with average, if required
                if n_missed > 0:
                    # check if everyone missed
                    if len(s) == 0:
                        log.warning('Every judge in heat %s missed wave %s' % (heat_id, wave))
                        s = [-5] * n_missed
                    else:
                        # compute average score without misses and put to missed values (so that sufficient number of scores is available for deleting best and worst ones)
                        pre_average = float(sum(s)) / len(s)
                        s.extend([pre_average] * n_missed)

                # remove best and worst scores, if at least four judges are present
                if len(s) > 4:
                    s = sorted(s)[1:-1]

                # compute average
                final_average = float(sum(s)) / len(s)
                resulting_scores.setdefault(surfer_id, []).append({'wave': wave, 'score': final_average})
        return resulting_scores
