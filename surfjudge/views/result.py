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

    @view_config(route_name='results:heat_id', request_method='GET', permission='view_results', renderer='json')
    @view_config(route_name='results', request_method='GET', permission='view_results', renderer='json')
    def get_results(self):
        log.info('----- GET results -----')
        query = model.gen_query_expression(self.all_params, model.Participation)
        res = self.db.query(model.Participation).filter(*query).all()
        for p in res:
            # ensure surfer and heat fields are filled (lazily loaded by db)
            p.surfer
            p.heat
        return res

    @view_config(route_name='results:batch', request_method='POST', renderer='json')
    def set_results_batch(self):
        log.info('----- POST setting results in BATCH -----')
        json_data = self.all_params.get('json_data', '[]')
        data = json.loads(json_data)

        # delete results for given heat_id
        results = self.db.query(model.Result).filter(model.Result.heat_id == self.all_params['heat_id']).all()
        for p in results:
            self.db.delete(p)

        # add multiple results to database
        for params in data:
            # update existing element, if it exists
            elem = self.db.merge(model.Result(**params))
            self.db.add(elem)
        return {}

    # TODO: delete function
