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

    @view_config(route_name='live_results', renderer='results.jinja2')
    def home(self):
        return self.tplcontext({
            'results_url': '/rest/results/{heatid}',
            'websocket_channels_heatchart': json.dumps([]),
            'websocket_channels_results': json.dumps(['results']),
            'nav_item': '#nav_item_live_results',
            })

    @view_config(route_name='commentator', permission="view_commentator_panel", renderer='results.jinja2')
    def commentator(self):
        return self.tplcontext({
            'results_url': '/rest/preliminary_results/{heatid}',
            'websocket_channels_heatchart': json.dumps([]),
            'websocket_channels_results': json.dumps(['results', 'scores']),
            'nav_item': '#nav_item_commentator_panel',
            })

    @view_config(route_name='heatcharts', renderer='heatcharts.jinja2')
    def heatcharts(self):
        return self.tplcontext({
            'results_url': '/rest/results/{heatid}',

        })
