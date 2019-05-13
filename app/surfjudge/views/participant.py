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

    def _find_free_color(self, heat_id, seed):
        participants = self.db.query(model.Participation)\
            .filter(model.Participation.heat_id == heat_id).all()
        used_colors = set([p.lycra_color.id for p in participants])
        used_colors.discard(None)

        # find first color starting from seed
        lycra_colors = self.db.query(model.LycraColor).all()
        sorted_colors = sorted(lycra_colors, key=lambda c: c.seed)
        for c in sorted_colors:
            if c.seed < seed or c.name in used_colors:
                continue
            return c

        # no matching color found, take some free color
        free_colors = list(set([c.id for c in lycra_colors]) - used_colors)
        if free_colors:
            return self.request.lycra_colors[free_colors[0]]
        # no free colors, take grey
        return sorted_colors[seed % len(sorted_colors)]



    @view_config(route_name='participants:heat_id:seed', request_method='GET', permission='view_participants', renderer='json')
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
            p.lycra_color
        return res

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

        # add multiple participants to database
        for params in sorted(self.request.json_body, key=lambda p: p['seed']):
            log.info('Adding participant {surfer_id} to heat {heat_id}'.format(**params))
            # update existing element, if it exists
            if params.get('lycra_color_id') is None:
                c = self._find_free_color(heat_id, params['seed'])
                params['lycra_color_id'] = c.id

            elem = self.db.merge(model.Participation(**params))
            self.db.add(elem)

        # send a "changed" signal to the "participants" channel
        self.request.websockets.send_channel('participants', 'changed')
        return {}

    # is this method used?? inserted assert False to find out
    @view_config(route_name='participants:heat_id:seed', request_method='DELETE', permission='edit_participants', renderer='json')
    def delete_participants(self):
        heat_id = int(self.request.matchdict['heat_id'])
        seed = int(self.request.matchdict['seed'])
        log.info('DELETE participant with seed %d in heat %d', heat_id, seed)
        elem = self.db.query(model.Participation) \
            .filter(model.Participation.heat_id==heat_id,
                    model.Participation.seed==seed).first()
        self.db.delete(elem)

        if self.all_params.get('action') == 'compress':
            log.info('Compressing participants in %d after seed %d', heat_id, seed)
            participants = self.db.query(model.Participation)\
                .filter(model.Participation.heat_id == heat_id).all()
            for p in participants:
                # TODO: decrease color as well
                if p.seed >= seed:
                    p.seed -= 1

        # send a "changed" signal to the "participants" channel
        self.request.websockets.send_channel('participants', 'changed')
        return {}

    @view_config(route_name='participants:heat_id:seed', request_method='POST', permission='edit_participants', renderer='json')
    def add_participant(self):
        log.info('POST inserting/updating a participant')
        heat_id = int(self.request.matchdict['heat_id'])
        seed = int(self.request.matchdict['seed'])
        params = self.request.json_body
        params['seed'] = seed
        params['heat_id'] = heat_id

        c = self._find_free_color(heat_id, seed)
        params.setdefault('lycra_color_id', c.id)

        if self.all_params.get('action') == 'insert':
            log.info('Inserting participant in heat %d at seed %d', heat_id, seed)
            participants = self.db.query(model.Participation)\
                .filter(model.Participation.heat_id == heat_id).all()
            for p in participants:
                # TODO: increase color as well
                if p.seed >= seed:
                    p.seed += 1
        elem = self.db.merge(model.Participation(**params))
        self.db.add(elem)
        # send a "changed" signal to the "participants" channel
        self.request.websockets.send_channel('participants', 'changed')

