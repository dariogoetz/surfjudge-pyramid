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

class ParticipationViews(base.SurfjudgeView):

    @view_config(route_name='participants', request_method='GET', permission='view_participants', renderer='json')
    def get_participants(self):
        log.info('----- GET participants -----')
        query = model.gen_query_expression(self.all_params, model.Participation)
        res = self.db.query(model.Participation).filter(*query).all()
        return res

    @view_config(route_name='participants:batch', request_method='POST', renderer='json')
    def add_participants_batch(self):
        log.info('----- POST adding participants in BATCH -----')
        json_data = self.all_params.get('json_data', '[]')
        data = json.loads(json_data)
        # add multiple participants to database
        for params in data:
            # update existing element, if it exists
            elem = self.db.merge(model.Participation(**params))
            self.db.add(elem)
        return {}

    # TODO: delete function
