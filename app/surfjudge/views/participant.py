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

    def _get_color(self, seed, all_colors_by_id, available_color_ids, preference=None):
        # check preference and return desired color, if available
        if preference is not None and preference in available_color_ids:
            return all_colors_by_id[preference]

        # if no color is available, take any color
        if not available_color_ids:
            # try preference
            c = all_colors_by_id.get(preference)
            if c is not None:
                return c
            sorted_colors = sorted(all_colors_by_id.values(), key=lambda c: c.seed)
            return sorted_colors[seed % len(sorted_colors)]

        sorted_available_colors = sorted([all_colors_by_id[i] for i in available_color_ids], key=lambda c: c.seed)

        # find first color starting from seed
        for c in sorted_available_colors:
            if c is None or c.seed < seed:
                continue
            return c

        # no matching color found, take first available one
        return sorted_available_colors[0]

    @view_config(route_name='participants:heat_id:seed', request_method='GET', permission='view_participants', renderer='json')
    @view_config(route_name='participants:heat_id', request_method='GET', permission='view_participants', renderer='json')
    @view_config(route_name='participants', request_method='GET', permission='view_participants', renderer='json')
    def get_participants(self):
        log.info('GET participants')
        query = model.gen_query_expression(self.all_params, model.Participation)
        res = self.db.query(model.Participation).filter(*query).all()
        for p in res:
            # ensure surfer and lycra color fields are filled (lazily loaded by db)
            p.surfer
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

        all_colors = {c.id: c for c in self.db.query(model.LycraColor).all()}
        participants = self.db.query(model.Participation)\
            .filter(model.Participation.heat_id == heat_id).all()
        used_color_ids = set([p.lycra_color.id for p in participants])

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
                else:
                    # when we do not delete them, the color would be taken as well when determining new colors
                    used_color_ids.discard(p.lycra_color.id)
            self.db.flush()

        free_color_ids = set(all_colors) - used_color_ids

        # add multiple participants to database
        for params in sorted(self.request.json_body, key=lambda p: p['seed']):
            log.info('Adding participant {surfer_id} to heat {heat_id}'.format(**params))
            # determine free color
            params['lycra_color_id'] = self._get_color(int(params['seed']), all_colors, free_color_ids,
                                                       preference=params.get('lycra_color_id')).id
            free_color_ids.discard(params['lycra_color_id'])

            # update existing element, if it exists
            elem = self.db.merge(model.Participation(**params))
            self.db.add(elem)

        # send a "changed" signal to the "participants" channel
        self.send_channel(
            'participants',
            {"heat_id": heat_id}
        )
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
                if p.seed >= seed:
                    p.seed -= 1

        # send a "changed" signal to the "participants" channel
        self.send_channel(
            'participants',
            {"heat_id": heat_id}
        )
        return {}

    @view_config(route_name='participants:heat_id:seed', request_method='POST', permission='edit_participants', renderer='json')
    def add_participant(self):
        log.info('POST inserting/updating a participant')
        heat_id = int(self.request.matchdict['heat_id'])
        seed = int(self.request.matchdict['seed'])
        params = self.request.json_body
        params['seed'] = seed
        params['heat_id'] = heat_id

        all_colors = {c.id: c for c in self.db.query(model.LycraColor).all()}
        participants = self.db.query(model.Participation)\
            .filter(model.Participation.heat_id == heat_id).all()
        used_color_ids = set([p.lycra_color.id for p in participants])
        free_color_ids = set(all_colors) - used_color_ids

        params['lycra_color_id'] = self._get_color(seed, all_colors, free_color_ids,
                                                   preference=params.get('lycra_color_id')).id

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
        self.send_channel(
            'participants',
            {"heat_id": heat_id}
        )

