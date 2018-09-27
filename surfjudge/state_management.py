# -*- coding: utf-8 -*-
"""
    Copyright (c) 2018 Dario Götz and Jörg Christian Reiher.
    All rights reserved.
"""
import threading

class StateManager(object):
    '''
    Handles the (non-persistent) state of the application, e.g. currently active heats.
    '''
    def __init__(self):
        self._lock = threading.Lock()
        self._active_heats = set()

    def start_heat(self, heat_id):
        '''Set a heat with given heat_id as active'''
        with self._lock:
            self._active_heats.add(heat_id)
        return

    def stop_heat(self, heat_id):
        '''Set a heat with given heat_id as inactive'''
        with self._lock():
            if heat_id in self._active_heats:
                self._active_heats.discard(heat_id)
        return

    def get_active_heats(self):
        '''Returns all currently running heats'''
        return list(self._active_heats)

def includeme(config):
    '''Add state_manager to requests object. This function gets called on include in __init__.py'''
    state_manager = StateManager()
    config.add_request_method(lambda r: state_manager, 'state_manager', reify=True)
