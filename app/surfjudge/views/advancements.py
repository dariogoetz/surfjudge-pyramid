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

    @view_config(route_name='advancements:category_id', request_method='GET', permission='view_advancements', renderer='json')
    @view_config(route_name='advancements', request_method='GET', permission='view_advancements', renderer='json')
    def get_advancements(self):
        log.info('GET advancements')
        orm = model.HeatAdvancement
        query = model.gen_query_expression(self.all_params, orm)
        res = self.db.query(orm).filter(*query).all()
        for elem in res:
            elem.from_heat
            elem.to_heat
        return res

    @view_config(route_name='advancements', request_method='POST', permission='edit_advancements', renderer='json')
    def add_advancements(self):
        # add multiple participants to database
        for params in self.request.json_body:
            # update existing element, if it exists
            log.info('POST adding advancement rule: to heat %s, seed %s', params['to_heat_id'], params['seed'])
            elem = self.db.merge(model.HeatAdvancement(**params))
            self.db.add(elem)
        return {}

    @view_config(route_name='advancements:to_heat_id:seed', request_method='DELETE', permission='edit_advancements', renderer='json')
    def delete_advancements(self):
        to_heat_id = self.request.matchdict.get('to_heat_id')
        seed = self.request.matchdict.get('seed')
        log.info('DELETE advancement rule: to heat %s, seed %s', to_heat_id, seed)
        if to_heat_id is not None and seed is not None:
            orm = model.HeatAdvancement
            query = model.gen_query_expression(self.request.matchdict, orm)
            elems = self.db.query(orm).filter(*query).all()
            for elem in elems:
                self.db.delete(elem)
        return {}


    @view_config(route_name='advancing_surfers:to_heat_id', request_method='GET', permission='view_advancements', renderer='json')
    @view_config(route_name='advancing_surfers', request_method='GET', permission='view_advancements', renderer='json')
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

        # for each advancement, get the corresponding results/placing for the source heat and place
        # if a placing is available, return corresponding surfer
        advancing_surfers = []
        for advancement in advancements:
            result = self.db.query(model.Result).filter(model.Result.heat_id == advancement.from_heat_id,
                                                        model.Result.place == advancement.place).first()
            if result is not None:
                # the return value shall look similar to a participant,
                # hence requires fields surfer_id, heat_id, seed
                # surfer colors will be set by the frontend
                advancing_surfers.append({
                    'surfer_id': result.surfer.id,
                    'surfer': result.surfer,
                    'heat_id': advancement.to_heat_id,
                    'heat': result.heat,
                    'seed': advancement.seed,
                })

        return advancing_surfers
