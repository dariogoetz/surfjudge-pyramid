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

    def _query_db(self, params):
        query = model.gen_query_expression(params, model.Heat)
        res = self.db.query(model.Heat).filter(*query).all()
        for elem in res:
            # ensure category and tournament corresponding to heat are available
            elem.category.tournament
        return res

    @view_config(route_name='heats', request_method='GET', permission='view_heat', renderer='json')
    def get_heats(self):
        log.info('----- GET all heats -----')
        res = self._query_db(self.all_params)
        return res

    @view_config(route_name='heats:id', request_method='GET', permission='view_heat', renderer='json')
    def get_heat(self):
        id = self.request.matchdict.get('id')
        log.info('----- GET heat {id} -----'.format(id=id))
        res = self._query_db(self.all_params)
        if res:
            return res[0]
        else:
            return None

    # a post is allowed without specifying an id; a new id is generated in this case
    @view_config(route_name='heats', request_method='POST', permission='edit_heat', renderer='json')
    @view_config(route_name='heats:id', request_method='POST', permission='edit_heat', renderer='json')
    def add_heat(self):
        id = self.all_params.get('id')
        if id == '':
            id = None
        log.info('----- POST heat {id} -----'.format(id=id or "new"))
        params = {}
        params.update(self.all_params)
        params['id'] = id

        # parse datetime
        if 'start_time' in params and params['start_time']:
            params['start_datetime'] = datetime.strptime(params['start_datetime'], self.DTS_FORMAT)
        else:
            params['start_datetime'] = datetime.now()

        # set defaults
        params.setdefault('duration', 15)
        params.setdefault('number_of_waves', 10)

        # generate db object
        elem = self.db.merge(model.Heat(**params))
        self.db.add(elem)

        # update element from db (now with new id, if none was specified before)
        self.db.flush()
        self.db.refresh(elem)
        return elem

    @view_config(route_name='heats:id', request_method='DELETE', permission='edit_heat', renderer='json')
    def delete_heat(self):
        id = self.all_params.get('id')
        log.info('----- DELETE heat {id} -----'.format(id=id))
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
        log.info('----- GET active heats -----')
        heat_ids = list(self.request.state_manager.get_active_heats())
        if heat_ids:
            heats = self._query_db({'id': heat_ids})
        else:
            heats = []
        return heats

    @view_config(route_name='start_heat', request_method='POST', permission='edit_active_heats', renderer='json')
    def start_heat(self):
        log.info('----- POST start heat -----')
        heats = self._query_db({'id': self.all_params['heat_id']})
        if not heats:
            return None
        else:
            heat = heats[0]
        data = {}
        data['start_datetime'] = datetime.now()
        data['end_datetime'] = data['start_datetime'] + timedelta(minutes=heat.duration)
        self.request.state_manager.start_heat(int(self.all_params['heat_id']), data)
        return {}

    @view_config(route_name='stop_heat', request_method='POST', permission='edit_active_heats', renderer='json')
    def stop_heat(self):
        log.info('----- POST stop heat -----')
        self.request.state_manager.stop_heat(int(self.all_params['heat_id']))
        return {}

    @view_config(route_name='remaining_heat_time', request_method='GET', permission='view_active_heats', renderer='json')
    @view_config(route_name='remaining_heat_time:heat_id', request_method='GET', permission='view_active_heats', renderer='json')
    def get_remaining_heat_time(self):
        id = self.all_params.get('heat_id')
        if id is None or id == '':
            return None
        active_heat = self.request.state_manager.get_active_heat(int(id))
        if active_heat is None:
            return None
            heats = self._query_db({'id': id})
            if heats:
                return heats[0].duration * 60
            return None
        remaining_seconds = (active_heat['end_datetime'] - datetime.now()).total_seconds()
        return max(0, remaining_seconds)


    ###########################
    # HTML endpoints
    ###########################

    @view_config(route_name='heat_overview', permission='view_heat_overview', renderer='tournament_admin/heat_overview.jinja2')
    def heat_overview(self):
        return self.tplcontext()
