# -*- coding: utf-8 -*-
"""
    Copyright (c) 2018 Dario Götz and Jörg Christian Reiher.
    All rights reserved.
"""

from pyramid.view import (
    view_config,
    )

from . import base

class TestAuthViews(base.SurfjudgeView):

    @view_config(route_name='test_forbidden', permission='forbidden', renderer='index.jinja2')
    def forbidden(self):
        return self.tplcontext()
