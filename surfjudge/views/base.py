# -*- coding: utf-8 -*-
"""
    Copyright (c) 2018 Dario Götz and Jörg Christian Reiher.
    All rights reserved.
"""

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
        self.userid = request.authenticated_userid
        self.db = request.db

        self._all_params = {}

    @property
    def all_params(self):
        self._all_params = {}
        self._all_params.update(self.request.matchdict)
        self._all_params.update(self.request.params)
        try:
            self._all_params.update(self.request.json_body)
        except:
            pass
        return self._all_params

    def tplcontext(self, d=None):
        """Generate default template context required for base template, such as whether the user
        is logged in, whether he is the admin, etc.
        """
        d = d or {}
        tplcontext = dict()
        tplcontext['global_username'] = self.userid
        tplcontext['global_logged_in'] = self.userid is not None

        groups = []
        if self.request.user is not None:
            # user is logged in
            groups = set(self.request.user['groups'])

        # annotate some roles
        tplcontext['global_is_admin'] = 'ac_admin' in groups
        tplcontext['global_is_judge'] = 'ac_judge' in groups
        tplcontext['global_is_commentator'] = 'ac_commentator' in groups
        tplcontext.update(d)
        return tplcontext
