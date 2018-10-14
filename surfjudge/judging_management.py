# -*- coding: utf-8 -*-
"""
    Copyright (c) 2018 Dario Götz and Jörg Christian Reiher.
    All rights reserved.
"""
import threading
import datetime
import copy
import logging
log = logging.getLogger(__name__)

class JudgingManager(object):
    '''
    Provides the judging management responsible for keeping track of
    which judge requests to judge currently
    '''

    def __init__(self):
        self._lock = threading.RLock()

        self.__judging_requests = {}


    def expire_judging_requests(self):
        with self._lock:
            for judge_id in list(self.__judging_requests):
                data = self.__judging_requests[judge_id]
                now = datetime.datetime.now()
                expire_date = data['expire_date']
                if expire_date and expire_date < now:
                    del self.__judging_requests[judge_id]
        return

    def register_judging_request(self, judge_id, expire_s=None):
        if expire_s:
            expire_date = datetime.datetime.now() + datetime.timedelta(seconds=expire_s)
        else:
            expire_date = None
        data = {
            'judge_id': int(judge_id),
            'expire_date': expire_date
        }
        with self._lock:
            self.__judging_requests[judge_id] = data
        return True


    def unregister_judging_request(self, judge_id):
        with self._lock:
            try:
                del self.__judging_requests[judge_id]
            except:
                log.warning('judging_manager: Cannot unregister judging request by Judge {}'.format(judge_id))
                return False
        return True


    def get_judging_requests(self):
        self.expire_judging_requests()
        res = [copy.copy(d) for d in self.__judging_requests.values()]
        return res


def includeme(config):
    '''Add judging_manager to requests object. This function gets called on include in __init__.py'''
    judging_manager = JudgingManager()
    config.add_request_method(lambda r: judging_manager, 'judging_manager', reify=True)
