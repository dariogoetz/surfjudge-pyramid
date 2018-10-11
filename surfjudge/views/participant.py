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

from ..util import lycra_colors

class ParticipationViews(base.SurfjudgeView):

    @view_config(route_name='participants:heat_id', request_method='GET', permission='view_participants', renderer='json')
    @view_config(route_name='participants', request_method='GET', permission='view_participants', renderer='json')
    def get_participants(self):
        log.info('----- GET participants -----')
        query = model.gen_query_expression(self.all_params, model.Participation)
        res = self.db.query(model.Participation).filter(*query).all()
        for p in res:
            # ensure surfer and heat fields are filled (lazily loaded by db)
            p.surfer
            p.heat
        return res

    @view_config(route_name='participants:batch', request_method='POST', renderer='json')
    def set_participants_batch(self):
        log.info('----- POST setting participants in BATCH -----')

        # delete participants for given heat_id
        participants = self.db.query(model.Participation).filter(model.Participation.heat_id == self.all_params['heat_id']).all()
        for p in participants:
            self.db.delete(p)

        colors = lycra_colors.read_lycra_colors()
        # add multiple participants to database
        for params in self.all_params['participants']:
            # update existing element, if it exists
            params['surfer_color_hex'] = colors.get(params['surfer_color'], {}).get('HEX', '#aaaaaa')
            elem = self.db.merge(model.Participation(**params))
            self.db.add(elem)
        return {}

    # TODO: delete function
