# -*- coding: utf-8 -*-
"""
    Copyright (c) 2018 Dario Götz and Jörg Christian Reiher.
    All rights reserved.
"""
from datetime import datetime, timedelta
import json

from pyramid.view import view_config

import logging
log = logging.getLogger(__name__)

from . import base

from ..models import model

class HeatViews(base.SurfjudgeView):

    DEFAULTS = {
        'duration': 15,
        'number_of_waves': 10,
        'heat_type': model.HeatType.standard,
        'round': 0,
    }

    def _query_db(self, params):
        query = model.gen_query_expression(params, model.Heat)
        res = self.db.query(model.Heat).filter(*query).all()
        for elem in res:
            # ensure category and tournament corresponding to heat are available
            elem.category.tournament
            # elem.judges  # TODO: is this a security issue?
            [(p.surfer, p.lycra_color) for p in elem.participations]
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

    def _update_numbers_in_rounds(self, params):
        other_heats_in_target_round = self.db.query(model.Heat).filter(model.Heat.category_id == params['category_id'],
                                                                       model.Heat.round == params['round'],
                                                                       model.Heat.id != params['id']).all()
        # if heat already existed, compress empty space appearing after taking out heat
        if params['id'] is not None:
            current_heat = self.db.query(model.Heat).filter(model.Heat.id == params['id']).first()
            if current_heat.round == int(params['round']):
                other_heats_in_source_round = other_heats_in_target_round
            else:
                other_heats_in_source_round = self.db.query(model.Heat).filter(model.Heat.category_id == current_heat.category_id,
                                                                               model.Heat.round == current_heat.round,
                                                                               model.Heat.id != current_heat.id).all()
            # first decrease all heat number_in_rounds after current heat
            for heat in other_heats_in_source_round:
                if heat.number_in_round > current_heat.number_in_round:
                    heat.number_in_round -= 1

        # determine target number_in_round or make space for it, if it is already taken
        existing_numbers = set([h.number_in_round for h in other_heats_in_target_round])
        maximum = -1
        if existing_numbers:
            maximum = max(existing_numbers)

        # default target
        if params.get('number_in_round') is None or params.get('number_in_round') == '':
            target_number = maximum + 1
        else:
            target_number = int(params['number_in_round'])
            free_numbers = set(range(maximum + 2)) - existing_numbers
            if target_number not in free_numbers:
                for heat in other_heats_in_target_round:
                    if heat.number_in_round >= target_number:
                        heat.number_in_round += 1

        return target_number


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
        for key, value in self.DEFAULTS.items():
            if params.get(key) is None or params.get(key) == '':
                params[key] = value

        params['number_in_round'] = self._update_numbers_in_rounds(params)

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
        self.send_channel(
            "heats",
            {"heat_id": self.all_params['id'], "msg": "edit_heat"}
        )
        return elem

    @view_config(route_name='heats', request_method='POST', permission='edit_heats', renderer='json')
    def add_heats(self):
        log.info('POST heat')
        for params in self.request.json_body:
            self._add_heat(params)
            self.send_channel(
                "heats",
                {"heat_id": params['id'], "msg": "edit_heat"}
            )
        return

    @view_config(route_name='heats:id', request_method='DELETE', permission='edit_heats', renderer='json')
    def delete_heat(self):
        id = self.all_params.get('id')
        log.info('DELETE heat {id}'.format(id=id))
        if id is not None:
            elems = self._query_db({'id': id})  #self.db.query(model.Heat).filter(model.Heat.id == id).all()
            for elem in elems:
                self.db.delete(elem)

            # shift all following heats one back
            elem = elems[0]
            other_heats_in_source_round = self.db.query(model.Heat).filter(model.Heat.category_id == elem.category_id,
                                                                           model.Heat.round == elem.round,
                                                                           model.Heat.id != elem.id).all()
            # first decrease all heat number_in_rounds after current heat
            for heat in other_heats_in_source_round:
                if heat.number_in_round > elem.number_in_round:
                    heat.number_in_round -= 1
            self.send_channel(
                "heats",
                {"heat_id": id, "msg": "edit_heat"}
            )
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
        self.send_channel(
            "active_heats",
            {"heat_id": self.all_params['heat_id'], "msg": "start_heat"}
        )

        return {}

    @view_config(route_name='stop_heat', request_method='POST', permission='edit_active_heats', renderer='json')
    def stop_heat(self):
        log.info('POST stop heat {heat_id}'.format(**self.all_params))
        self.request.state_manager.stop_heat(int(self.all_params['heat_id']))

        # send "changed" message to "active_heats" channel
        self.send_channel(
            "active_heats",
            {"heat_id": self.all_params['heat_id'], "msg": "stop_heat"}
        )

        return {}

    @view_config(route_name='reset_heat_time', request_method='POST', permission='edit_active_heats', renderer='json')
    def reset_heat_time(self):
        log.info('POST reset heat time for {heat_id}'.format(**self.all_params))
        self.request.state_manager.reset_heat_time(int(self.all_params['heat_id']))

        # send "changed" message to "active_heats" channel
        self.send_channel(
            "active_heats",
            {"heat_id": self.all_params['heat_id'], "msg": "reset_heat_time"}
        )

        return {}

    @view_config(route_name='toggle_heat_pause:heat_id', request_method='POST', permission='edit_active_heats', renderer='json')
    def toggle_heat_pause(self):
        log.info('POST toggle heat pause {heat_id}'.format(**self.all_params))
        changed = self.request.state_manager.toggle_pause(int(self.all_params['heat_id']))

        if changed:
            # send "changed" message to "active_heats" channel
            self.send_channel(
                "active_heats",
                {"heat_id": self.all_params['heat_id'], "msg": "toggle_heat_pause"}
            )

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
