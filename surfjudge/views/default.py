# -*- coding: utf-8 -*-
"""
    Copyright (c) 2018 Dario Götz and Jörg Christian Reiher.
    All rights reserved.
"""

import json

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
        return self.tplcontext({'results_url': '/rest/results/{heatid}', 'websocket_channels': json.dumps(['results'])})

    @view_config(route_name='commentator', permission="view_commentator_panel", renderer='index.jinja2')
    def commentator(self):
        return self.tplcontext({'results_url': '/rest/preliminary_results/{heatid}', 'websocket_channels': json.dumps(['results', 'scores'])})
