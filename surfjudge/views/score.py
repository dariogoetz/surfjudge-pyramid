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

    @view_config(route_name='scores', request_method='GET', permission='view_score', renderer='json')
    def get_scores(self):
        log.info('GET scores')
        query = model.gen_query_expression(self.all_params, model.Score)
        res = self.db.query(model.Score).filter(*query).all()
        return res


    @view_config(route_name='scores', request_method='POST', permission='edit_score', renderer='json')
    def add_score(self):
        log.info('POST score for heat {heat_id}, judge {judge_id}, surfer {surfer_id}'.format(**self.all_params))
        params = {}
        params.update(self.all_params)

        # generate db object
        elem = self.db.merge(model.Score(**params))
        self.db.add(elem)

        return {}

    @view_config(route_name='scores:heat_id:judge_id:surfer_id:wave', request_method='DELETE', permission='edit_score', renderer='json')
    def delete_score(self):
        log.info('DELETE score for heat {heat_id}, judge {judge_id}, surfer {surfer_id}'.format(**self.all_params))
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

    @view_config(route_name='edit_scores', permission='edit_scores', renderer='tournament_admin/edit_scores.jinja2')
    def edit_scores(self):
        return self.tplcontext()
