# -*- coding: utf-8 -*-
"""
    Copyright (c) 2018 Dario Götz and Jörg Christian Reiher.
    All rights reserved.
"""

from pyramid.view import notfound_view_config

from . import base

class NotFoundViews(base.SurfjudgeView):
    @notfound_view_config(renderer='404.jinja2')
    def notfound_view(self):
        """View to show if no route was found for a given url"""
        self.request.response.status = 404
        return self.tplcontext()
