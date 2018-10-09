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
        log.info('----- GET scores -----')
        query = model.gen_query_expression(self.all_params, model.Score)
        res = self.db.query(model.Score).filter(*query).all()
        return res


    @view_config(route_name='scores', request_method='POST', permission='edit_score', renderer='json')
    def add_score(self):
        log.info('----- POST score -----')
        params = {}
        params.update(self.all_params)
        params['heat_id'] = int(params['heat_id'])
        params['judge_id'] = int(params['judge_id'])
        print(self.all_params)

        # generate db object
        elem = self.db.merge(model.Score(**self.all_params))
        self.db.add(elem)

        return {}
