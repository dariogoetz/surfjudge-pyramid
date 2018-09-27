# -*- coding: utf-8 -*-
"""
    Copyright (c) 2018 Dario Götz and Jörg Christian Reiher.
    All rights reserved.
"""
from datetime import datetime
import json

from pyramid.view import view_config

import logging
log = logging.getLogger(__name__)

from . import base

from ..models import model

class JudgeViews(base.SurfjudgeView):

    @view_config(route_name='judges', request_method='GET', permission='view_judges', renderer='json')
    def get_judges(self):
        log.info('----- GET all judges -----')
        query = model.gen_query_expression(self.all_params, model.Judge)
        res = self.db.query(model.Judge).filter(*query).all()

        return res

    @view_config(route_name='judges:id', request_method='GET', permission='view_judges', renderer='json')
    def get_judge(self):
        id = self.request.matchdict.get('id')
        log.info('----- GET judge {id} -----'.format(id=id))
        res = self.db.query(model.Judge).filter(model.Judge.id == id).first()
        return res

    # a post is allowed without specifying an id; a new id is generated in this case
    @view_config(route_name='judges', request_method='POST', permission='edit_judge', renderer='json')
    @view_config(route_name='judges:id', request_method='POST', permission='edit_judge', renderer='json')
    def add_judge(self):
        id = self.all_params.get('id')
        log.info('----- POST judge {id} -----'.format(id=id or "new"))
        params = {}
        params.update(self.all_params)

        # generate db object
        elem = self.db.merge(model.Judge(**params))
        self.db.add(elem)

        # update element from db (now with new id, if none was specified before)
        self.db.flush()
        self.db.refresh(elem)
        return elem

    @view_config(route_name='judges:id', request_method='DELETE', permission='edit_judge', renderer='json')
    def delete_judge(self):
        id = self.all_params.get('id')
        log.info('----- DELETE judge {id} -----'.format(id=id))
        if id is not None:
            elems = self.db.query(model.Judge).filter(model.Judge.id == id).all()
            for elem in elems:
                self.db.delete(elem)
        return {}


    ###########################
    # Judge assignments
    ###########################

    @view_config(route_name='judge_assigments', request_method='GET', permission='view_assigned_judges', renderer='json')
    @view_config(route_name='judge_assigments:heat_id', request_method='GET', permission='view_assigned_judges', renderer='json')
    def get_assigned_judges(self):
        log.info('----- GET assigned judges -----')
        query = model.gen_query_expression(self.all_params, model.JudgeAssignment)
        res = self.db.query(model.JudgeAssignment).filter(*query).all()
        for elem in res:
            # ensure judge and heat fields are filled (lazily loaded by db)
            elem.judge
            elem.heat

        return res

    @view_config(route_name='judge_assigments:batch', request_method='POST', renderer='json', permission='edit_assigned_judges')
    def set_assigned_judges_batch(self):
        log.info('----- POST adding judge assignments in BATCH -----')
        json_data = self.all_params.get('json_data', '[]')
        data = json.loads(json_data)

        # delete judges for given heat_id
        assignments = self.db.query(model.JudgeAssignment).filter(model.JudgeAssignment.heat_id == self.all_params['heat_id']).all()
        for a in assignments:
            self.db.delete(a)

        # add multiple judges to database
        for params in data:
            # update existing element, if it exists
            elem = self.db.merge(model.JudgeAssignment(**params))
            self.db.add(elem)
        return {}


    ###########################
    # HTML endpoints
    ###########################

    @view_config(route_name='edit_judges', permission='view_judge', renderer='tournament_admin/edit_judges.jinja2')
    def edit_judges(self):
        return self.tplcontext()
