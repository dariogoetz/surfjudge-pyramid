# -*- coding: utf-8 -*-
"""
    Copyright (c) 2018 Dario Götz and Jörg Christian Reiher.
    All rights reserved.
"""
from pyramid.view import view_config

from . import base

class UtilViews(base.SurfjudgeView):

    @view_config(route_name='lycra_colors', request_method='GET', permission='view_lycra_colors', renderer='json')
    def get_lycra_colors(self):
        return [c for c in sorted(self.request.lycra_colors.values(), key=lambda c: c['SEEDING'])]
