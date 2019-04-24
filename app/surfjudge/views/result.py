# -*- coding: utf-8 -*-
"""
    Copyright (c) 2018 Dario Götz and Jörg Christian Reiher.
    All rights reserved.
"""
from datetime import datetime
import json
import re

from pyramid.view import view_config
from pyramid.response import FileResponse

import logging
log = logging.getLogger(__name__)

from . import base

from ..models import model
from ..util import excel_export


class ResultViews(base.SurfjudgeView):

    @view_config(route_name='home', renderer='results.jinja2')
    @view_config(route_name='live_results', renderer='results.jinja2')
    def home(self):
        return self.tplcontext({
            'results_url': '/rest/results/{heatid}',
            'heatchart_results_url': '/rest/results/{heatid}',
            'websocket_channels_heatchart': json.dumps([]),
            'websocket_channels_results': json.dumps(['results']),
            'nav_item': '#nav_item_live_results',
            })

    @view_config(route_name='commentator', permission="view_commentator_panel", renderer='results.jinja2')
    def commentator(self):
        return self.tplcontext({
            'results_url': '/rest/preliminary_results/{heatid}',
            'heatchart_results_url': '/rest/results/{heatid}',
            'websocket_channels_heatchart': json.dumps([]),
            'websocket_channels_results': json.dumps(['results', 'scores']),
            'nav_item': '#nav_item_commentator_panel',
            })

    @view_config(route_name='heatcharts', renderer='heatcharts.jinja2')
    def heatcharts(self):
        return self.tplcontext({
            'results_url': '/rest/results/{heatid}',
        })


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

    def _get_scores_by_surfer_and_judge_ids(self, heat_id):
        """Collects scores for all judges and participands of the heat"""

        # get judges for heat
        judges = self.db.query(model.JudgeAssignment)\
            .filter(model.JudgeAssignment.heat_id == heat_id).all()
        judge_ids = set([s.judge_id for s in judges])

        # get scores for heat and judges
        scores = self.db.query(model.Score)\
            .filter(model.Score.heat_id == heat_id,
                    model.Score.judge_id.in_(judge_ids)).all()

        # compile scores per sufer and wave
        scores_by_surfer = {}
        for s in scores:
            scores_by_surfer.setdefault(s.surfer_id, {}).setdefault(s.wave, []).append(s)
        return scores_by_surfer, judge_ids

    def _determine_results_for_heat(self, heat_id, n_best_waves=2):
        """
        Collects scores for all judges and participants of the heat and computes
        the averaged results
        """
        scores_by_surfer, judge_ids = self._get_scores_by_surfer_and_judge_ids(heat_id)

        # compute average scores
        resulting_scores = self._compute_resulting_scores(scores_by_surfer, judge_ids, heat_id)

        # determine final scores (best_waves and surfer_id are added for secondary sort arguments)
        total_scores = {}
        for surfer_id, average_scores in resulting_scores.items():
            sorted_scores = sorted(average_scores, key=lambda s: s['score'], reverse=True)
            sorted_scores = [s['score'] for s in sorted_scores if s['score'] >= 0]
            best_waves = sorted_scores[:n_best_waves]
            total_score = sum(best_waves)
            total_scores[surfer_id] = (total_score, best_waves, surfer_id)

        # add participants without scores
        participants = self.db.query(model.Participation)\
            .filter(model.Participation.heat_id == heat_id).all()
        for participant in participants:
            total_scores.setdefault(participant.surfer_id, (0, [0] * n_best_waves, participant.surfer_id))

        # determine placings
        results = []
        sorted_total_scores = sorted(total_scores.items(), key=lambda s: s[1], reverse=True)
        previous_place = 0
        previous_total_score = None
        previous_best_waves = None
        precision = 5
        for idx, (surfer_id, (score, best_waves, _)) in enumerate(sorted_total_scores):
            place = idx
            if idx == 0:
                same_total = False
                same_bw = False
            else:
                same_total = (round(score, precision) == round(previous_total_score, precision))
                same_bw = ([round(s, precision) for s in best_waves] == [round(s, precision) for s in previous_best_waves])
            if same_total and same_bw:
                place = previous_place
            else:
                previous_place = place
                previous_total_score = score
                previous_best_waves = best_waves

            d = {}
            d['surfer_id'] = surfer_id
            d['heat_id'] = heat_id
            d['total_score'] = score
            d['place'] = place
            d['wave_scores'] = resulting_scores.get(surfer_id, [])
            results.append(d)
        return results

    @view_config(route_name='preliminary_results', request_method='GET', permission='view_preliminary_results', renderer='json')
    @view_config(route_name='preliminary_results:heat_id', request_method='GET', permission='view_preliminary_results', renderer='json')
    def get_preliminary_results(self):
        heat_id = int(self.all_params['heat_id'])
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

    @staticmethod
    def get_valid_filename(s):
        """
        Taken from django framework.
        Return the given string converted to a string that can be used for a clean
        filename. Remove leading and trailing spaces; convert other spaces to
        underscores; and remove anything that is not an alphanumeric, dash,
        underscore, or dot.
        >>> get_valid_filename("john's portrait in 2004.jpg")
        'johns_portrait_in_2004.jpg'
        """
        s = str(s).strip().replace(' ', '_')
        return re.sub(r'(?u)[^-\w.]', '', s)

    @view_config(route_name='export_results:heat_id', request_method='GET', permission='export_results')
    def export_scores(self):
        # export data to temporary file
        heat_id = self.request.matchdict['heat_id']
        heat = self.db.query(model.Heat).filter(model.Heat.id == heat_id).first()

        scores_by_surfer, judge_ids = self._get_scores_by_surfer_and_judge_ids(heat_id)
        average_scores = self._compute_resulting_scores(scores_by_surfer, judge_ids, heat_id)

        n_best_waves = 2
        tmpfile = excel_export.export_scores(heat, judge_ids, scores_by_surfer, average_scores, n_best_waves)

        response = FileResponse(tmpfile.name, request=self.request)
        export_filename = u'{}_{}_{}.xlsx'.format(heat.category.tournament.name, heat.category.name, heat.name)
        export_filename = self.get_valid_filename(export_filename)

        log.info(export_filename)
        response.headers['Content-Disposition'] = ("attachment; filename={}".format(export_filename))
        return response

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
                resulting_scores.setdefault(surfer_id, []).append({'surfer_id': surfer_id, 'wave': wave, 'score': final_average})
        return resulting_scores
