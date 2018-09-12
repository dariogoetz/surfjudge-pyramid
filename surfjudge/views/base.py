# -*- coding: utf-8 -*-
"""
    Copyright (c) 2018 Dario Götz and Jörg Christian Reiher.
    All rights reserved.
"""

class SurfjudgeView(object):
    """Base class for surfjudge views. Provides functionality common to all views."""

    def __init__(self, context, request):
        """Constructor setting request object and userid"""
        self.context = context
        self.request = request
        self.userid = request.authenticated_userid

    def tplcontext(self, d=None):
        """Generate default template context required for base template, such as whether the user
        is logged in, whether he is the admin, etc.
        """
        d = d or {}
        tplcontext = dict()
        tplcontext['global_logged_in'] = self.userid is not None
        if self.request.user is not None:
            # user is logged in
            tplcontext['global_is_admin'] = 'ac_admin' in self.request.user['groups']
        tplcontext.update(d)
        return tplcontext
