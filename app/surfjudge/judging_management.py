# -*- coding: utf-8 -*-
"""
    Copyright (c) 2018 Dario Götz and Jörg Christian Reiher.
    All rights reserved.
"""
import datetime
import logging

from .models import model

log = logging.getLogger(__name__)

class JudgingManager(object):
    '''
    Provides the judging management responsible for keeping track of
    which judge requests to judge currently
    '''

    def __init__(self, request):
        self.request = request


    def expire_judging_requests(self):
        for r in self.request.db.query(model.JudgingRequest).filter(model.JudgingRequest.expire_date < datetime.datetime.now()).all():
            self.request.db.delete(r)
        self.request.db.flush()
        return

    def register_judging_request(self, judge_id, expire_s=None):
        if expire_s:
            expire_date = datetime.datetime.now() + datetime.timedelta(seconds=expire_s)
        else:
            expire_date = None
        r = model.JudgingRequest(judge_id=judge_id, expire_date=expire_date)
        self.request.db.merge(r)
        return True


    def unregister_judging_request(self, judge_id):
        for r in self.request.db.query(model.JudgingRequest).filter(model.JudgingRequest.judge_id == judge_id).all():
            self.request.db.delete(r)
        return True


    def get_judging_requests(self):
        self.expire_judging_requests()
        res = self.request.db.query(model.JudgingRequest).all()
        return res


def includeme(config):
    '''Add judging_manager to requests object. This function gets called on include in __init__.py'''
    config.add_request_method(lambda r: JudgingManager(r), 'judging_manager', reify=True)
