# -*- coding: utf-8 -*-
"""
    Copyright (c) 2018 Dario Götz and Jörg Christian Reiher.
    All rights reserved.
"""

import os
import json

import logging
log = logging.getLogger(__name__)

from ..models import model

WEBSOCKET_URL = json.dumps(os.environ.get('WEBSOCKET_URL', 'ws://localhost:6544'))

class SurfjudgeView(object):
    """Base class for surfjudge views. Provides functionality common to all views."""

    T_FORMAT = '%H:%M:%S'  # isoformat
    D_FORMAT = '%Y-%m-%d'  # isoformat
    DT_FORMAT = '%Y-%m-%dT%H:%M'
    DTS_FORMAT = '%Y-%m-%dT%H:%M:%S' # isoformat

    def __init__(self, context, request):
        """Constructor setting request object and userid"""
        self.context = context
        self.request = request
        self.user = self.request.user_manager.get_user_by_id(request.authenticated_userid)
        self.groups = []
        if self.user is not None:
            self.groups = [str(p.permission.name) for p in self.user.permissions]
        self.db = request.db

        self._all_params = {}

    @property
    def all_params(self):
        self._all_params = {}
        self._all_params.update(self.request.matchdict)
        self._all_params.update(self.request.params)
        try:
            json_body = self.request.json_body
            if isinstance(json_body, dict):
                self._all_params.update(json_body)
        except:
            pass
        return self._all_params

    @property
    def is_admin(self):
        return 'ac_admin' in self.request.effective_principals


    def _check_judge_id_permissions(self):
        """Check whether logged in user has permissions to access the requested route.

        Assumes that "judge_id" is in self.all_params.
        """
        # check if the requesting user is an admin
        if self.is_admin:
            # admin is allowed to view all scores
            return True

        # check if a judge_id was specified in request
        judge_id = self.all_params.get('judge_id')
        if judge_id is None:
            # a judge is only allowed to view scores with a given judge_id
            log.info('Prevented request without judge_id by %s', self.user.id)
            return False
        judge_id = int(judge_id)

        # check if the requesting user is valid
        if self.user is None:
            log.info('Prevented request for non-logged-in user')
            return False

        # check if the requesting user is a judge
        if "ac_judge" not in self.groups:
            # only logged in judges may view scores
            log.info('Prevented request for non-judge user')
            return False

        # check if requested judge_id is the one by the requester
        allowed = (self.user.id == judge_id)
        if not allowed:
            log.info('Prevented request for judge_id %s by %s (judge_id %s)',
                     judge_id, self.user.username, self.user.id)
        return allowed

    def tplcontext(self, d=None):
        """Generate default template context required for base template, such as whether the user
        is logged in, whether he is the admin, etc.
        """
        d = d or {}
        tplcontext = dict()
        tplcontext['global_username'] = ""
        if self.user is not None:
            tplcontext['global_username'] = self.user.username
        tplcontext['global_logged_in'] = self.user is not None

        # annotate some roles
        tplcontext['global_is_admin'] = 'ac_admin' in self.groups
        tplcontext['global_is_judge'] = 'ac_judge' in self.groups
        tplcontext['global_is_commentator'] = 'ac_commentator' in self.groups
        tplcontext['websocket_url'] = WEBSOCKET_URL
        tplcontext['show_navbar'] = True
        tplcontext.update(d)
        return tplcontext

    def send_channel(self, channel, msg):
        def send(_):
            self.request.websockets.send_channel(channel, json.dumps(msg))
        self.request.tm.get().addAfterCommitHook(send)
