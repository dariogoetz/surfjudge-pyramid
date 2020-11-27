# -*- coding: utf-8 -*-
"""
    Copyright (c) 2018 Dario Götz and Jörg Christian Reiher.
    All rights reserved.
"""
import os
from datetime import datetime
import json
import re
import tempfile

from pyramid.view import view_config
from pyramid.response import FileResponse
from pyramid.httpexceptions import HTTPFound

import logging
log = logging.getLogger(__name__)

from . import base

from ..models import model
from ..util import excel_export


class ResultViews(base.SurfjudgeView):
    @view_config(route_name='home', renderer='live_results.jinja2')
    @view_config(route_name='live_results', renderer='live_results.jinja2')
    def live_results(self):
        if (self.request.matched_route.name == 'home'
                and 'ac_judge' in self.request.effective_principals):
            log.info('Redirecting judge from start page to judge sheet')
            return HTTPFound(self.request.route_url("judge_sheet"))

        return self.tplcontext({
            'results_url':
            '/rest/results/{heatid}',
            'websocket_channels_heatchart':
            json.dumps([]),
            'websocket_channels_results':
            json.dumps(['results']),
            'nav_item':
            '#nav_item_live_results',
        })

    @view_config(route_name='live_results_tv',
                 renderer='live_results_tv.jinja2')
    def live_results_tv(self):
        return self.tplcontext({
            'results_url':
            '/rest/results/{heatid}',
            'websocket_channels_heatchart':
            json.dumps([]),
            'websocket_channels_results':
            json.dumps(['results']),
            'nav_item':
            '#nav_item_live_results',
            'show_navbar':
            False,
        })

    @view_config(route_name='live_results_big_screen',
                 renderer='live_results_big_screen.jinja2')
    def live_results_big_screen(self):
        return self.tplcontext({
            'results_url':
            '/rest/results/{heatid}',
            'websocket_channels_heatchart':
            json.dumps([]),
            'websocket_channels_results':
            json.dumps(['results']),
            'nav_item':
            '#nav_item_live_results',
            'show_navbar':
            False,
        })

    @view_config(route_name='commentator',
                 permission="view_commentator_panel",
                 renderer='live_results.jinja2')
    def commentator(self):
        return self.tplcontext({
            'results_url':
            '/rest/preliminary_results/{heatid}',
            'websocket_channels_heatchart':
            json.dumps([]),
            'websocket_channels_results':
            json.dumps(['results', 'scores']),
            'nav_item':
            '#nav_item_commentator_panel',
        })

    @view_config(route_name='show_results', renderer='results.jinja2')
    def results(self):
        return self.tplcontext({
            'results_url':
            '/rest/results/{heatid}',
            'websocket_channels_heatchart':
            json.dumps([]),
            'websocket_channels_results':
            json.dumps(['results']),
            'nav_item':
            '#nav_item_results',
            'show_details':
            False
        })

    @view_config(route_name='show_results_details', renderer='results.jinja2')
    def results_details(self):
        return self.tplcontext({
            'results_url':
            '/rest/results/{heatid}',
            'websocket_channels_heatchart':
            json.dumps([]),
            'websocket_channels_results':
            json.dumps(['results']),
            'nav_item':
            '#nav_item_results_details',
            'show_details':
            True
        })

    @view_config(route_name='show_results_finals', renderer='finals.jinja2')
    def finals(self):
        return self.tplcontext({
            'results_url':
            '/rest/results/{heatid}',
            'websocket_channels_heatchart':
            json.dumps([]),
            'websocket_channels_results':
            json.dumps(['results']),
            'nav_item':
            '#nav_item_results_finals',
            'show_details':
            False
        })

    @view_config(route_name='heatcharts', renderer='heatcharts.jinja2')
    def heatcharts(self):
        return self.tplcontext({
            'results_url': '/rest/results/{heatid}',
        })

    def _delete_results_for_heat(self, heat_id):
        results = self.db.query(
            model.Result).filter(model.Result.heat_id == heat_id).all()
        for p in results:
            self.db.delete(p)

    @view_config(route_name='results:heat_id',
                 request_method='GET',
                 permission='view_results',
                 renderer='json')
    @view_config(route_name='results',
                 request_method='GET',
                 permission='view_results',
                 renderer='json')
    def get_results(self):
        log.info('GET results')
        query = model.gen_query_expression(self.all_params, model.Result)
        res = self.db.query(model.Result).filter(*query).all()
        for p in res:
            # ensure surfer field is filled (lazily loaded by db)
            p.surfer
        return res

    @view_config(route_name='results:heat_id',
                 request_method='POST',
                 permission='edit_results',
                 renderer='json')
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
        self.send_channel(
            'results',
            {"heat_id": self.all_params["heat_id"]}
        )

        return {}

    @view_config(route_name='results:heat_id',
                 request_method='DELETE',
                 permission='edit_results',
                 renderer='json')
    def delete_results(self):
        log.info('DELETE results for heat %s', self.all_params['heat_id'])
        self._delete_results_for_heat(self.all_params['heat_id'])

        # send a "changed" signal to the "results" channel
        self.send_channel(
            'results',
            {"heat_id": self.all_params['heat_id']}
        )

    @view_config(route_name='preliminary_results',
                 request_method='GET',
                 permission='view_preliminary_results',
                 renderer='json')
    @view_config(route_name='preliminary_results:heat_id',
                 request_method='GET',
                 permission='view_preliminary_results',
                 renderer='json')
    def get_preliminary_results(self):
        heat_id = int(self.all_params['heat_id'])
        log.info('GET preliminary results for heat %s', heat_id)

        heat = self.db.query(
            model.Heat).filter(model.Heat.id == heat_id).first()
        if heat.heat_type == model.HeatType.call:
            result_generator = CallHeatResults(heat_id, self.db)
        else:
            result_generator = StandardHeatResults(heat_id,
                                                   self.db,
                                                   n_best_waves=2)
        prelim_results = result_generator.get_results()
        published_results = self.db.query(
            model.Result).filter(model.Result.heat_id == heat_id).all()

        # determine all published scores (triple: surfer, wave, score)
        published_keys = set()
        for r in published_results:
            published_keys |= set([(r.surfer_id, s['wave'], s['score'])
                                   for s in r.wave_scores])

        # annotate preliminary results
        for r in prelim_results:
            # make sure, the surfer is available in the results objects
            surfer = self.db.query(model.Surfer).filter(
                model.Surfer.id == r['surfer_id']).first()
            r['surfer'] = surfer

            # make sure, the heat is available in the results objects
            heat = self.db.query(
                model.Heat).filter(model.Heat.id == r['heat_id']).first()
            r['heat'] = heat

            # add "unpublished" field for all fields that are not yet published or differ in values
            has_unpublished = False
            for s in r['wave_scores']:
                if (r['surfer_id'], s['wave'],
                        s['score']) not in published_keys:
                    s['unpublished'] = True
                    has_unpublished = True
            if has_unpublished:
                r['unpublished'] = True
        return prelim_results

    @view_config(route_name='publish_results:heat_id',
                 request_method='POST',
                 permission='edit_results',
                 renderer='json')
    def publish_results(self):
        heat_id = self.all_params['heat_id']
        log.info('POST publish results for heat %s', heat_id)

        # delete existing results for heat
        self._delete_results_for_heat(heat_id)

        # compute results
        heat = self.db.query(
            model.Heat).filter(model.Heat.id == heat_id).first()
        if heat.heat_type == model.HeatType.call:
            result_generator = CallHeatResults(heat_id, self.db)
        else:
            result_generator = StandardHeatResults(heat_id,
                                                   self.db,
                                                   n_best_waves=2)

        results = result_generator.get_results()
        for d in results:
            # insert results into db
            result = model.Result(**d)
            self.db.add(result)

        # send a "changed" signal to the "results" channel
        self.send_channel(
            'results',
            {"heat_id": heat_id}
        )

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

    def _generate_score_sheet(self, heat, filename):
        result_generator = StandardHeatResults(heat.id,
                                               self.db,
                                               n_best_waves=2)
        tmpfile = excel_export.export_scores(
            heat, result_generator.judge_ids,
            result_generator.scores_by_surfer,
            result_generator.averaged_scores_by_surfer,
            result_generator.n_best_waves, filename)
        return tmpfile

    @view_config(route_name='export_results:heat_id',
                 request_method='GET',
                 permission='export_results')
    def export_scores(self):
        # export data to temporary file
        heat_id = self.request.matchdict['heat_id']
        heat = self.db.query(
            model.Heat).filter(model.Heat.id == heat_id).first()

        tmp = tempfile.NamedTemporaryFile()
        tmpfile = self._generate_score_sheet(heat, tmp.name)

        response = FileResponse(tmpfile, request=self.request)
        export_filename = u'{}_{}_{}.xlsx'.format(
            heat.category.tournament.name, heat.category.name, heat.name)
        export_filename = self.get_valid_filename(export_filename)

        log.info(export_filename)
        response.headers['Content-Disposition'] = (
            "attachment; filename={}".format(export_filename))
        return response

    @view_config(route_name="export_results:tournament_id",
                 request_method='GET',
                 permission='export_results')
    def export_all_results_for_tournament(self):
        # get tournament object from db
        tournament_id = self.request.matchdict['tournament_id']
        tournament = self.db.query(model.Tournament).filter(
            model.Tournament.id == tournament_id).first()

        # find out all heats for tournament
        with tempfile.TemporaryDirectory() as tmpdir:
            tmpfiles = []
            for category in tournament.categories:
                for heat in category.heats:
                    results = self.db.query(model.Result).filter(
                        model.Result.heat_id == heat.id).all()
                    if not results:
                        # do not export excel file if no results are available
                        log.info(
                            "No results to export for heat {} in category {}",
                            heat.name, category.name)
                        continue
                    # call export_scores for each heat
                    fn = u'{}_{}_{}.xlsx'.format(heat.category.tournament.name,
                                                 heat.category.name, heat.name)
                    fn = self.get_valid_filename(fn)
                    tmpfile = self._generate_score_sheet(
                        heat, os.path.join(tmpdir, fn))
                    tmpfiles.append(tmpfile)

            # create zip file for all saved excel files
            res_tmpfile = tempfile.NamedTemporaryFile(suffix=".zip")
            res_tmpfile.close()
            os.system('zip -j {} "{}"'.format(res_tmpfile.name,
                                              '" "'.join(tmpfiles)))

        # return response
        response = FileResponse(res_tmpfile.name, request=self.request)
        export_filename = "results_{}_{}.zip".format(
            tournament.name,
            datetime.now().strftime("%Y-%m-%d %H:%M:%S"))
        export_filename = self.get_valid_filename(export_filename)

        log.info("Exporting all results for tournament %s: Filename %s",
                 tournament.name, export_filename)
        response.headers['Content-Disposition'] = (
            "attachment; filename={}".format(export_filename))
        return response


class BaseHeatResults():
    def __init__(self, heat_id, db):
        self.heat_id = heat_id
        self.db = db

        self._judge_ids = None
        self._scores_by_surfer = None
        self._averaged_scores_by_surfer = None
        self._results = None

    @property
    def results(self):
        if self._results is None:
            self._results = self.get_results()
        return self._results

    def get_results(self):
        pass

    @property
    def judge_ids(self):
        if self._judge_ids is None:
            # get judges for heat
            judges = self.db.query(model.JudgeAssignment)\
                .filter(model.JudgeAssignment.heat_id == self.heat_id).all()
            self._judge_ids = set([s.judge_id for s in judges])
        return self._judge_ids

    @property
    def scores_by_surfer(self):
        if self._scores_by_surfer is None:
            # get scores for heat and judges
            scores = self.db.query(model.Score)\
                .filter(model.Score.heat_id == self.heat_id,
                        model.Score.judge_id.in_(self.judge_ids)).all()

            # compile scores per sufer and wave
            self._scores_by_surfer = {}
            for s in scores:
                self._scores_by_surfer.setdefault(s.surfer_id,
                                                  {}).setdefault(s.wave,
                                                                 []).append(s)
        return self._scores_by_surfer

    @property
    def averaged_scores_by_surfer(self):
        """Computes score averages for each wave of each surfer after removing best and worst score if 5 or more judges are involved."""
        if self._averaged_scores_by_surfer is None:
            self._averaged_scores_by_surfer = {}
            for surfer_id, surfer_scores in self.scores_by_surfer.items():
                for wave, wave_scores in surfer_scores.items():
                    # assert that all registered judges gave a score, else ignore (?)
                    if set([s.judge_id
                            for s in wave_scores]) != self.judge_ids:
                        log.info(
                            'Not all judges provided a score for wave %d of surfer %d'
                            % (wave, surfer_id))
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
                            log.warning(
                                'Every judge in heat %s missed wave %s' %
                                (heat_id, wave))
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
                    self._averaged_scores_by_surfer.setdefault(
                        surfer_id, []).append({
                            'surfer_id': surfer_id,
                            'wave': wave,
                            'score': final_average
                        })
        return self._averaged_scores_by_surfer


class StandardHeatResults(BaseHeatResults):
    def __init__(self, heat_id, db, n_best_waves=2):
        super().__init__(heat_id, db)

        self.n_best_waves = n_best_waves

    def get_results(self):
        """
        Total scores and placing for a participant are determined by sum of n best waves.
        """
        precision = 5

        # determine final scores (best_waves and surfer_id are added for secondary sort arguments)
        total_scores = {}
        for surfer_id, average_scores in self.averaged_scores_by_surfer.items(
        ):
            sorted_scores = sorted(average_scores,
                                   key=lambda s: s['score'],
                                   reverse=True)
            sorted_scores = [
                s['score'] for s in sorted_scores if s['score'] >= 0
            ]
            total_score = round(sum(sorted_scores[:self.n_best_waves]),
                                precision)
            other_scores = [
                round(s, precision) for s in sorted_scores[self.n_best_waves:]
            ]
            total_scores[surfer_id] = (total_score, other_scores, surfer_id)

        # add participants without scores
        participants = self.db.query(model.Participation)\
            .filter(model.Participation.heat_id == self.heat_id).all()
        for participant in participants:
            total_scores.setdefault(
                participant.surfer_id,
                (0, [0] * self.n_best_waves, participant.surfer_id))

        # determine placings
        results = []
        sorted_total_scores = sorted(total_scores.items(),
                                     key=lambda s: s[1],
                                     reverse=True)
        previous_place = 0
        previous_total_score = None
        previous_other_scores = None
        for idx, (surfer_id, (score, other_scores,
                              _)) in enumerate(sorted_total_scores):
            place = idx
            if idx == 0:
                same_total = False
                same_bw = False
            else:
                same_total = (score == previous_total_score)
                same_bw = (other_scores == previous_other_scores)
            if same_total and same_bw:
                place = previous_place
            else:
                previous_place = place
                previous_total_score = score
                previous_other_scores = other_scores

            d = {}
            d['surfer_id'] = surfer_id
            d['heat_id'] = self.heat_id
            d['total_score'] = score
            d['place'] = place
            d['wave_scores'] = sorted(self.averaged_scores_by_surfer.get(
                surfer_id, []),
                                      key=lambda v: v['wave'])
            results.append(d)
        return results


class CallHeatResults(BaseHeatResults):
    def get_results(self):
        """For each wave only the best score receives a point"""
        precision = 5

        scores_by_wave = {}
        for scores in self.averaged_scores_by_surfer.values():
            for score in scores:
                scores_by_wave.setdefault(score['wave'], []).append(score)

        # initialize
        participants = self.db.query(model.Participation)\
            .filter(model.Participation.heat_id == self.heat_id).all()

        winner_scores = {}
        for wave, scores in scores_by_wave.items():
            best_score = max(scores, key=lambda s: s['score'])

            # get all surfer_ids that scored the best score
            def cmp(s1, s2):
                return round(s1, precision) == round(s2, precision)

            best_surfer_ids = set([
                s['surfer_id'] for s in filter(
                    lambda s: cmp(s['score'], best_score['score']), scores)
            ])

            for p in participants:
                surfer_id = p.surfer_id
                val = 1 if surfer_id in best_surfer_ids else 0
                winner_scores.setdefault(surfer_id, []).append({
                    'surfer_id': surfer_id,
                    'wave': wave,
                    'score': val
                })

        total_scores = {}
        # initialize with zero scores
        for participant in participants:
            total_scores[participant.surfer_id] = 0.0

        for surfer_id, scores in winner_scores.items():
            total_scores[surfer_id] = sum([s['score'] for s in scores])

        results = []
        previous_place = 0
        previous_total_score = None
        for idx, (surfer_id, score) in enumerate(
                sorted(total_scores.items(), key=lambda s: s[1],
                       reverse=True)):
            place = idx
            if idx == 0:
                same_total = False
            else:
                same_total = (previous_total_score == score)
            if same_total:
                place = previous_place
            else:
                previous_place = place
                previous_total_score = score

            d = {}
            d['surfer_id'] = surfer_id
            d['heat_id'] = self.heat_id
            d['total_score'] = score
            d['place'] = place
            d['wave_scores'] = sorted(
                self.averaged_scores_by_surfer.get(surfer_id, []),
                key=lambda v: v['wave'])  # winner_scores.get(surfer_id, [])
            results.append(d)
        return results
