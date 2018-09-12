# -*- coding: utf-8 -*-
"""
    Copyright (c) 2018 Dario Götz and Jörg Christian Reiher.
    All rights reserved.
"""

from pyramid.httpexceptions import HTTPFound
from pyramid.security import (
    remember,
    forget,
    )

from pyramid.view import (
    view_config,
    view_defaults
    )

from . import base


class DefaultViews(base.SurfjudgeView):

    @view_config(route_name='home', renderer='index.jinja2')
    def home(self):
        return self.tplcontext({'message': 'Home View'})
