# -*- coding: utf-8 -*-
"""
    Copyright (c) 2018 Dario Götz and Jörg Christian Reiher.
    All rights reserved.
"""
from datetime import datetime, timedelta

from pyramid.view import view_config

import logging
log = logging.getLogger(__name__)

from . import base

from ..models import model

class HeatViews(base.SurfjudgeView):

    DEFAULTS ={
        duration: 15,
        number_of_waves: 10,
    }

    def _query_db(self, params):
        query = model.gen_query_expression(params, model.Heat)
        res = self.db.query(model.Heat).filter(*query).all()
        for elem in res:
            # ensure category and tournament corresponding to heat are available
            elem.category.tournament
            # elem.judges  # TODO: is this a security issue?
            [p.surfer for p in elem.participations]
        return res

    @view_config(route_name='heat_types', request_method='GET', permission='view_heat_types', renderer='json')
    def get_heat_types(self):
        return [t.name for t in model.HeatType]

    @view_config(route_name='heats', request_method='GET', permission='view_heats', renderer='json')
    @view_config(route_name='categories:category_id:heats', request_method='GET', permission='view_heats', renderer='json')
    def get_heats(self):
        log.info('GET heats')
        res = self._query_db(self.all_params)
        return res

    @view_config(route_name='heats:id', request_method='GET', permission='view_heats', renderer='json')
    def get_heat(self):
        log.info('GET heat {id}'.format(**self.all_params))
        res = self._query_db(self.all_params)
        if res:
            return res[0]
        else:
            return None

    def _add_heat(self, orig_params):
        params = {}
        params.update(orig_params)
        if params.get('id') == '' or params.get('id') == 'new':
            params['id'] = None

        # parse datetime
        if 'start_time' in params and params['start_time']:
            params['start_datetime'] = datetime.strptime(params['start_datetime'], self.DTS_FORMAT)
        else:
            params['start_datetime'] = datetime.now()

        # set defaults
        params['duration'] = params.get('duration', self.DEFAULTS['duration']) or self.DEFAULTS['duration']
        params['number_of_waves'] = params.get('number_of_waves', self.DEFAULTS['number_of_waves']) or self.DEFAULTS['number_of_waves']
        params['type'] = params.get('type', model.HeatType.standard) or model.HeatType.standard

        # generate db object
        elem = self.db.merge(model.Heat(**params))
        self.db.add(elem)

        return elem


    @view_config(route_name='heats:id', request_method='POST', permission='edit_heats', renderer='json')
    def add_heat(self):
        log.info('POST heat')
        elem = self._add_heat(self.all_params)

        # update element from db (now with new id, if none was specified before)
        self.db.flush()
        self.db.refresh(elem)
        return elem

    @view_config(route_name='heats', request_method='POST', permission='edit_heats', renderer='json')
    def add_heats(self):
        log.info('POST heat')
        for params in self.request.json_body:
            self._add_heat(params)
        return

    @view_config(route_name='heats:id', request_method='DELETE', permission='edit_heats', renderer='json')
    def delete_heat(self):
        id = self.all_params.get('id')
        log.info('DELETE heat {id}'.format(id=id))
        if id is not None:
            elems = self._query_db({'id': id})  #self.db.query(model.Heat).filter(model.Heat.id == id).all()
            for elem in elems:
                self.db.delete(elem)
        return {}

    ###########################
    # Active Heats REST
    ###########################

    @view_config(route_name='active_heats', request_method='GET', permission='view_active_heats', renderer='json')
    def get_active_heats(self):
        log.info('GET active heats')
        heat_ids = list(self.request.state_manager.get_active_heats())
        if heat_ids:
            heats = self._query_db({'id': heat_ids})
        else:
            heats = []
        return heats

    @view_config(route_name='active_heats:tournament_id', request_method='GET', permission='view_active_heats', renderer='json')
    def get_active_heats_for_tournament(self):
        log.info('GET active heats')
        tournament_id = int(self.request.matchdict['tournament_id'])
        heat_ids = list(self.request.state_manager.get_active_heats())
        if heat_ids:
            heats = self._query_db({'id': heat_ids})
            heats = [h for h in heats if h.category.tournament_id == tournament_id]
        else:
            heats = []
        return heats

    @view_config(route_name='start_heat', request_method='POST', permission='edit_active_heats', renderer='json')
    def start_heat(self):
        log.info('POST start heat {heat_id}'.format(**self.all_params))
        heats = self._query_db({'id': self.all_params['heat_id']})
        if not heats:
            return None
        else:
            heat = heats[0]
        duration_m = heat.duration or self.DEFAULTS['duration']
        self.request.state_manager.start_heat(int(self.all_params['heat_id']), duration_m)

        # send "changed" message to "active_heats" channel
        self.request.websockets.send_channel('active_heats', 'changed')
        return {}

    @view_config(route_name='stop_heat', request_method='POST', permission='edit_active_heats', renderer='json')
    def stop_heat(self):
        log.info('POST stop heat {heat_id}'.format(**self.all_params))
        self.request.state_manager.stop_heat(int(self.all_params['heat_id']))

        # send "changed" message to "active_heats" channel
        self.request.websockets.send_channel('active_heats', 'changed')
        return {}

    @view_config(route_name='toggle_heat_pause:heat_id', request_method='POST', permission='edit_active_heats', renderer='json')
    def toggle_heat_pause(self):
        log.info('POST toggle heat pause {heat_id}'.format(**self.all_params))
        changed = self.request.state_manager.toggle_pause(int(self.all_params['heat_id']))

        if changed:
            # send "changed" message to "active_heats" channel
            self.request.websockets.send_channel('active_heats', 'changed')
        return {}


    @view_config(route_name='remaining_heat_time', request_method='GET', permission='view_remaining_heat_time', renderer='json')
    @view_config(route_name='remaining_heat_time:heat_id', request_method='GET', permission='view_remaining_heat_time', renderer='json')
    def get_remaining_heat_time(self):
        heat_id = self.all_params.get('heat_id')
        if heat_id is None or heat_id == '':
            return None
        log.info('GET remaining heat time %s', heat_id)
        remaining_seconds = self.request.state_manager.get_remaining_heat_time_s(int(heat_id))
        if remaining_seconds is None:
            heats = self._query_db({'id': heat_id})
            if heats:
                return heats[0].duration * 60
            return None
        return remaining_seconds


    @view_config(route_name='heat_state:heat_id', request_method='GET', permission='view_heat_state', renderer='json')
    def get_heat_state(self):
        heat_id = self.all_params.get('heat_id')
        if heat_id is None or heat_id == '':
            return None
        log.info('GET heat state %s', heat_id)
        heat_state = self.request.state_manager.get_heat_state(int(heat_id))
        return {'state': heat_state}

    ###########################
    # HTML endpoints
    ###########################

    @view_config(route_name='heat_overview', permission='view_heat_overview', renderer='tournament_admin/heat_overview.jinja2')
    def heat_overview(self):
        log.info('GET heat overview page')
        return self.tplcontext()
