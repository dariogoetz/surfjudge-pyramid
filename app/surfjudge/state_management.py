# -*- coding: utf-8 -*-
"""
    Copyright (c) 2018 Dario Götz and Jörg Christian Reiher.
    All rights reserved.
"""
import threading
from datetime import datetime, timedelta
import logging
log = logging.getLogger(__name__)

class StateManager(object):
    '''
    Handles the (non-persistent) state of the application, e.g. currently active heats.
    '''
    def __init__(self):
        self._lock = threading.Lock()
        self._active_heats = {}
        self._paused_heats = {}

    def start_heat(self, heat_id, duration_m,
                   additional_data=None):
        '''Set a heat with given heat_id as active and set its duration in minutes.
        Additional data may be provided and is then available via get_active_heat(s).
        "start_datetime" and "end_datetime" are set automativally.
        If the corresponding heat is already active, only additional data will be updated.
        '''
        if additional_data is None:
            additional_data = {}
        with self._lock:
            if heat_id in self._active_heats:
                self._active_heats[heat_id].update(additional_data)
            else:
                data = {}
                data.update(additional_data)
                data['start_datetime'] = datetime.now()
                if not duration_m:
                    # in case this is '' due to some previous error
                    duration_m = 0
                data['end_datetime'] = data['start_datetime'] + timedelta(minutes=duration_m)
                self._active_heats[heat_id] = data
        return

    def stop_heat(self, heat_id):
        '''Set a heat with given heat_id as inactive'''
        with self._lock:
            if heat_id in self._paused_heats:
                del self._paused_heats[heat_id]
            if heat_id in self._active_heats:
                del self._active_heats[heat_id]
            else:
                log.warning('state_management: Can not stop inactive heat %s.', heat_id)
        return

    def pause_heat(self, heat_id):
        '''Set a heat with given heat_id as paused'''
        with self._lock:
            if heat_id in self._active_heats:
                if heat_id not in self._paused_heats:
                    self._paused_heats[heat_id] = {
                        'pause_datetime': datetime.now(),
                        'remaining_timedelta': self._active_heats[heat_id]['end_datetime'] - datetime.now(),
                    }
                    log.info('state_management: Pause heat %s', heat_id)
                else:
                    log.warning('state_management: Can not pause already paused heat %s.', heat_id)
            else:
                log.warning('state_management: Can not pause inactive heat %s.', heat_id)
        return

    def unpause_heat(self, heat_id):
        '''Set a heat with given heat_id as not paused.
        Returns total time heat was paused in seconds.
        '''
        with self._lock:
            if heat_id in self._paused_heats:
                paused_heat = self._paused_heats[heat_id]
                # determine total time the heat was paused and add to end_datetime
                # paused_time = (datetime.now() - paused_heat['pause_datetime'])
                # self._active_heats[heat_id]['end_datetime'] += paused_time
                self._active_heats[heat_id]['end_datetime'] = datetime.now() + paused_heat['remaining_timedelta']
                del self._paused_heats[heat_id]
            else:
                log.warning('state_management: Can not unpause heat %s. It is inactive or not paused.', heat_id)
        return

    def toggle_pause(self, heat_id):
        '''Pauses an active unpaused heat and unpauses a paused heat'''
        if heat_id in self._paused_heats:
            # needs to be first as a paused heat is also in self._active_heats
            self.unpause_heat(heat_id)
            return True
        elif heat_id in self._active_heats:
            self.pause_heat(heat_id)
            return True
        return False

    def get_remaining_heat_time_s(self, heat_id):
        if heat_id not in self._active_heats:
            return None
        remaining_timedelta = self._active_heats[heat_id]['end_datetime'] - datetime.now()
        if heat_id in self._paused_heats:
            remaining_timedelta = self._paused_heats[heat_id]['remaining_timedelta']
        return max(0, remaining_timedelta.total_seconds())

    def get_active_heats(self):
        '''Returns all currently running (and paused) heats'''
        res = {}
        for heat_id, data in self._active_heats.items():
            d = {}
            d.update(data)
            res[heat_id] = d
        return res

    def get_active_heat(self, heat_id, default=None):
        '''Returns the info about a given heat_id or a default value'''
        return self._active_heats.get(heat_id, default)

    def get_heat_state(self, heat_id):
        '''Returns the state of a given heat_id. May return "active", "inactive" or "paused".'''
        if heat_id in self._paused_heats:
            return 'paused'
        elif heat_id in self._active_heats:
            return 'active'
        else:
            return 'inactive'

def includeme(config):
    '''Add state_manager to requests object. This function gets called on include in __init__.py'''
    state_manager = StateManager()
    config.add_request_method(lambda r: state_manager, 'state_manager', reify=True)
