# -*- coding: utf-8 -*-
"""
    Copyright (c) 2018 Dario Götz and Jörg Christian Reiher.
    All rights reserved.
"""

from pyramid.view import view_config
import json

import logging
log = logging.getLogger(__name__)

from . import base

from ..models import model

class AdvancementViews(base.SurfjudgeView):

    @view_config(route_name='advancements:category_id', request_method='GET', permission='view_advancement', renderer='json')
    @view_config(route_name='advancements', request_method='GET', permission='view_advancement', renderer='json')
    def get_advancements(self):
        log.info('GET advancements')
        orm = model.HeatAdvancement
        query = model.gen_query_expression(self.all_params, orm)
        res = self.db.query(orm).filter(*query).all()
        for elem in res:
            elem.from_heat
            elem.to_heat
        return res

    @view_config(route_name='advancements', request_method='POST', renderer='json')
    def add_advancements(self):
        log.info('POST adding advancement rules')
        # add multiple participants to database
        for params in self.all_params['advancements']:
            # update existing element, if it exists
            elem = self.db.merge(model.HeatAdvancement(**params))
            self.db.add(elem)
        return {}


    @view_config(route_name='advancing_surfers:to_heat_id', request_method='GET', permission='view_advancement', renderer='json')
    @view_config(route_name='advancing_surfers', request_method='GET', permission='view_advancement', renderer='json')
    def get_advancing_surfers(self):
        """
        For a given heat id give for each seed the surfer that would advance to this Seed
        given the published results
        """
        log.info('GET advancing surfers')
        # get advancements to this heat
        orm = model.HeatAdvancement
        query = model.gen_query_expression(self.all_params, orm)
        advancements = self.db.query(model.HeatAdvancement).filter(*query).all()

        # TODO
        # for each advancement, get the corresponding results/placing for the source heat and place

        # if a placing is available, return corresponding surfer
        return []
