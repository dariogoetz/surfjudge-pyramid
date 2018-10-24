# -*- coding: utf-8 -*-
"""
    Copyright (c) 2018 Dario Götz and Jörg Christian Reiher.
    All rights reserved.
"""

from pyramid.view import view_config

import logging
log = logging.getLogger(__name__)

from . import base

from ..models import model

class ScoreViews(base.SurfjudgeView):

    def _check_permissions(self):
        """Check whether logged in user has permissions to read this score."""
        # check if the requesting user is an admin
        if self.is_admin:
            # admin is allowed to view all scores
            return True

        # check if a judge_id was specified in request
        judge_id = self.all_params.get('judge_id')
        if judge_id is None:
            # a judge is only allowed to view scores with a given judge_id
            log.info('Prevented score request without judge_id by %s', self.logged_in_judge.username)
            return False
        judge_id = int(judge_id)

        # check if the requesting user is a judge (there is a judge_id for the login)
        if self.logged_in_judge is None:
            # only logged in judges may view scores
            log.info('Prevented score request for non-logged-in user by %s', self.authenticated_userid)
            return False

        # check if requested judge_id is the one by the requester
        res = (self.logged_in_judge.id == judge_id)
        log.info('Prevented score request for judge_id %s by %s (judge_id %s)',
                 judge_id, self.logged_in_judge.username, self.logged_in_judge.id)
        return res

    @view_config(route_name='scores', request_method='GET', permission='view_scores', renderer='json')
    def get_scores(self):
        log.info('GET scores')
        if not self._check_permissions():
            self.request.status_code = 403
            return []

        query = model.gen_query_expression(self.all_params, model.Score)
        res = self.db.query(model.Score).filter(*query).all()
        return res


    @view_config(route_name='scores', request_method='POST', permission='edit_scores', renderer='json')
    def add_score(self):
        log.info('POST score for heat {heat_id}, judge {judge_id}, surfer {surfer_id}'.format(**self.all_params))
        if not self._check_permissions():
            self.request.status_code = 403
            return {}

        params = {}
        params.update(self.all_params)

        # generate db object
        elem = self.db.merge(model.Score(**params))
        self.db.add(elem)

        return {}

    @view_config(route_name='scores:heat_id:judge_id:surfer_id:wave', request_method='DELETE', permission='edit_scores', renderer='json')
    def delete_score(self):
        log.info('DELETE score for heat {heat_id}, judge {judge_id}, surfer {surfer_id}'.format(**self.all_params))
        if not self._check_permissions():
            self.request.status_code = 403
            return {}
        elems = self.db.query(model.Score) \
            .filter(model.Score.heat_id == self.all_params['heat_id'],
                    model.Score.judge_id == self.all_params['judge_id'],
                    model.Score.surfer_id == self.all_params['surfer_id'],
                    model.Score.wave == self.all_params['wave']).all()
        for elem in elems:
            self.db.delete(elem)
        return {}


    ###########################
    # HTML endpoints
    ###########################

    @view_config(route_name='edit_scores', permission='view_edit_scores_page', renderer='tournament_admin/edit_scores.jinja2')
    def edit_scores(self):
        return self.tplcontext()
