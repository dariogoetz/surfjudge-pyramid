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
            # TODO: find free color if no color was provided
            if params.get('surfer_color') is None:
                c = self._find_free_color(heat_id, params['seed'])
                params['surfer_color'] = c['COLOR']
                params['surfer_color_hex'] = c['HEX']
            else:
                params['surfer_color_hex'] = colors.get(params['surfer_color'], {}).get('HEX', '#aaaaaa')
            elem = self.db.merge(model.Participation(**params))
            self.db.add(elem)
        return {}

    # is this method used?? inserted assert False to find out
    @view_config(route_name='participants:heat_id:seed', request_method='DELETE', permission='edit_participants', renderer='json')
    def delete_participants(self):
        log.info('DELETE participant with seed {seed} in heat {heat_id}'.format(**self.all_params))
        params = {'heat_id': self.all_params['heat_id'], 'seed': self.all_params['seed']}
        query = model.gen_query_expression(params, model.Participation)
        res = self.db.query(model.Participation).filter(*query).all()
        for elem in res:
            self.db.delete(elem)
        return {}

    def _find_free_color(self, heat_id, seed):
        colors = lycra_colors.read_lycra_colors()
        participants = self.db.query(model.Participation)\
            .filter(model.Participation.heat_id == heat_id).all()
        used_colors = set([p.surfer_color for p in participants])
        print("used")
        print(used_colors)
        
        # find first color seed after
        for c in sorted(colors.values(), key=lambda c: c['SEEDING']):
            if int(c['SEEDING']) > seed or c['COLOR'] in used_colors:
                print('not using', c['COLOR'])
                continue
            return c

        # no matching color found, take some free color
        free_colors = list(set(colors) - used_colors)
        print('free colors')
        print(free_colors)
        if free_colors:
            return colors[free_colors[0]]
        # no free colors, take grey
        print('found no suitable color')
        return {'SEEDING': -1, 'COLOR': 'grey', 'HEX': '#aaaaaa'}




    @view_config(route_name='participants:heat_id:seed', request_method='POST', permission='edit_participants', renderer='json')
    def add_participant(self):
        log.info('POST inserting/updating a participant')
        heat_id = self.all_params['heat_id']
        seed = self.all_params['seed']
        params = self.request.json_body

        # TODO: find free color
        c = self._find_free_color(heat_id, seed)    
        params.setdefault('surfer_color', c['COLOR'])
        params.setdefault('surfer_color_hex', c['HEX'])
        
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

