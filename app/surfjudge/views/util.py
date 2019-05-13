# -*- coding: utf-8 -*-
"""
    Copyright (c) 2018 Dario Götz and Jörg Christian Reiher.
    All rights reserved.
"""
from pyramid.view import view_config

from . import base
from ..models import model


class UtilViews(base.SurfjudgeView):

    @view_config(route_name='lycra_colors', request_method='GET', permission='view_lycra_colors', renderer='json')
    def get_lycra_colors(self):
        colors = self.db.query(model.LycraColor).all()
        return sorted(colors, key=lambda c: c.seed)
