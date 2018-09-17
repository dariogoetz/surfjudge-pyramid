# -*- coding: utf-8 -*-
"""
    Copyright (c) 2018 Dario Götz and Jörg Christian Reiher.
    All rights reserved.
"""

from pyramid.view import view_config

import logging
log = logging.getLogger(__name__)

from . import base

from ..models import model

class AdvancementViews(base.SurfjudgeView):

    @view_config(route_name='advancements:category_id', request_method='GET', permission='view_advancement', renderer='json')
    @view_config(route_name='advancements', request_method='GET', permission='view_advancement', renderer='json')
    def get_advancements(self):
        log.info('----- GET advancements for category %s -----', self.all_params.get('category_id'))
        orm = model.HeatAdvancement
        query = model.gen_query_expression(self.all_params, orm)
        res = self.db.query(orm).filter(*query).all()
        return res
