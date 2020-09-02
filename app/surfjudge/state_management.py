# -*- coding: utf-8 -*-
"""
    Copyright (c) 2018 Dario Götz and Jörg Christian Reiher.
    All rights reserved.
"""
from datetime import datetime, timedelta
from .models import model
import logging
log = logging.getLogger(__name__)

class StateManager(object):
    '''
    Handles the (non-persistent) state of the application, e.g. currently active heats.
    '''
    def __init__(self, request):
        self.request = request

    def _get_state(self, heat_id):
        return self.request.db.query(model.HeatState).filter(model.HeatState.heat_id==heat_id).first()

    def reset_heat_time(self, heat_id):
        existing_state = self._get_state(heat_id)

        if existing_state is not None:
            existing_state.end_datetime = datetime.now() + timedelta(minutes=existing_state.duration_m)
            existing_state.remaining_time_s = 60 * existing_state.duration_m
            self.request.db.merge(existing_state)

    def start_heat(self, heat_id, duration_m,
                   additional_data=None):
        '''Set a heat with given heat_id as active and set its duration in minutes.
        Additional data may be provided and is then available via get_active_heat(s).
        "start_datetime" and "end_datetime" are set automativally.
        If the corresponding heat is already active, only additional data will be updated.
        '''
        existing_state = self._get_state(heat_id)
        if existing_state is None:
            state = {}
            state['heat_id'] = heat_id
            start_datetime = datetime.now()
            state['state'] = model.HeatStateType.active
            state['start_datetime'] = start_datetime
            state['end_datetime'] = start_datetime + timedelta(minutes=duration_m)
            state['duration_m'] = duration_m
            state['additional_data'] = additional_data
            h = model.HeatState(**state)
            self.request.db.add(h)
        else:
            existing_state.additional_data = additional_data
            self.request.db.merge(existing_state)

    def stop_heat(self, heat_id):
        '''Set a heat with given heat_id as inactive'''
        existing_state = self._get_state(heat_id)
        self.request.db.delete(existing_state)
        return

    def pause_heat(self, heat_id):
        '''Set a heat with given heat_id as paused'''
        existing_state = self._get_state(heat_id)
        if existing_state is None:
            log.warning('state_management: Can not pause inactive heat %s.', heat_id)
        elif existing_state.state == model.HeatStateType.paused:
            log.warning('state_management: Can not pause already paused heat %s.', heat_id)
        else:
            log.info('state_management: Pause heat %s', heat_id)
            now = datetime.now()
            existing_state.pause_datetime = now
            existing_state.remaining_time_s = (existing_state.end_datetime - now).total_seconds()
            existing_state.state = model.HeatStateType.paused
            self.request.db.merge(existing_state)
        return

    def unpause_heat(self, heat_id):
        '''Set a heat with given heat_id as not paused.
        Returns total time heat was paused in seconds.
        '''
        existing_state = self._get_state(heat_id)
        if existing_state is None:
            log.warning('state_management: Can not unpause heat %s. It is inactive.', heat_id)
        elif existing_state.state != model.HeatStateType.paused:
            log.warning('state_management: Can not unpause heat %s. It is not paused.', heat_id)
        else:
            existing_state.end_datetime = datetime.now() + timedelta(seconds=existing_state.remaining_time_s)
            existing_state.state = model.HeatStateType.active
        return

    def toggle_pause(self, heat_id):
        '''Pauses an active unpaused heat and unpauses a paused heat'''
        existing_state = self._get_state(heat_id)
        if existing_state is None:
            return False
        elif existing_state.state == model.HeatStateType.paused:
            # needs to be first as a paused heat is also in self._active_heats
            self.unpause_heat(heat_id)
            return True
        else:
            self.pause_heat(heat_id)
            return True
        return False

    def get_remaining_heat_time_s(self, heat_id):
        existing_state = self._get_state(heat_id)
        if existing_state is None:
            return None
        if existing_state.state == model.HeatStateType.paused:
            return existing_state.remaining_time_s

        return max(0, (existing_state.end_datetime - datetime.now()).total_seconds())

    def get_active_heats(self):
        '''Returns all currently running (and paused) heats'''
        states = self.request.db.query(model.HeatState).filter(model.HeatState.state.in_([model.HeatStateType.active, model.HeatStateType.paused])).all()
        res = {}
        for state in states:
            res[state.heat_id] = state
        return res

    def get_active_heat(self, heat_id, default=None):
        '''Returns the info about a given heat_id or a default value'''
        existing_state = self._get_state(heat_id)
        if existing_state is None:
            return default
        return dict(existing_state)

    def get_heat_state(self, heat_id):
        '''Returns the state of a given heat_id. May return "active", "inactive" or "paused".'''
        existing_state = self._get_state(heat_id)
        if existing_state is None:
            return 'inactive'
        return existing_state.state

def includeme(config):
    '''Add state_manager to requests object. This function gets called on include in __init__.py'''
    #state_manager = StateManager()
    config.add_request_method(lambda r: StateManager(r), 'state_manager', reify=True)
