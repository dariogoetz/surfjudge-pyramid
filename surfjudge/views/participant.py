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
        log.info('GET participants')
        query = model.gen_query_expression(self.all_params, model.Participation)
        res = self.db.query(model.Participation).filter(*query).all()
        for p in res:
            # ensure surfer and heat fields are filled (lazily loaded by db)
            p.surfer
            p.heat
        return res

    # TODO: find a way to not send data in "participants", but directly ?
    @view_config(route_name='participants:heat_id', request_method='POST', permission='edit_participants', renderer='json')
    @view_config(route_name='participants:heat_id', request_method='PUT', permission='edit_participants', renderer='json')
    def set_participants(self):
        """Add participants

        If request method is "PUT", all participants for the heat are overwritten. If "POST"
        is used, the participants are appended.
        """
        log.info('%s setting participants', self.request.method)

        heat_id = self.all_params['heat_id']
        upload_ids = set([p['surfer_id'] for p in self.request.json_body])
        if self.request.method == 'PUT':
            # delete participants for given heat_id
            log.info('Removing participants from heat {}'.format(heat_id))
            participants = self.db.query(model.Participation)\
                                  .filter(model.Participation.heat_id == heat_id).all()
            for p in participants:
                if p.surfer_id not in upload_ids:
                    # only delete those existing participants that will not be there afterwards
                    # because cascading would delete corresponding scores
                    self.db.delete(p)

        colors = lycra_colors.read_lycra_colors()
        # add multiple participants to database
        for params in self.request.json_body:
            log.info('Adding participant {surfer_id} to heat {heat_id}'.format(**params))
            # update existing element, if it exists
            params['surfer_color_hex'] = colors.get(params['surfer_color'], {}).get('HEX', '#aaaaaa')
            elem = self.db.merge(model.Participation(**params))
            self.db.add(elem)
        return {}

    @view_config(route_name='participants:heat_id:surfer_id', request_method='DELETE', permission='edit_participants', renderer='json')
    def delete_participants(self):
        log.info('DELETE participant {surfer_id} in heat {heat_id}'.format(**self.all_params))
        params = {'heat_id': self.all_params['heat_id'], 'surfer_id': self.all_params['surfer_id']}
        query = model.gen_query_expression(params, model.Participation)
        res = self.db.query(model.Participation).filter(*query).all()
        for elem in res:
            self.db.delete(elem)
        return {}
