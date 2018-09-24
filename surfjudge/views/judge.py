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
    # Active judges
    ###########################

    @view_config(route_name='active_judges', request_method='GET', permission='view_active_judges', renderer='json')
    @view_config(route_name='active_judges:heat_id', request_method='GET', permission='view_active_judges', renderer='json')
    def get_active_judges(self):
        log.info('----- GET all judges -----')
        query = model.gen_query_expression(self.all_params, model.JudgeActivity)
        res = self.db.query(model.JudgeActivity).filter(*query).all()

        return res

    @view_config(route_name='active_judges:batch', request_method='POST', renderer='json', permission='edit_active_judges')
    def add_active_judges_batch(self):
        log.info('----- POST adding judge activities in BATCH -----')
        heat_id = self.all_params['heat_id']
        json_data = self.all_params.get('json_data', '[]')
        data = json.loads(json_data)
        # add multiple judges to database
        for params in data:
            # update existing element, if it exists
            elem = self.db.merge(model.JudgeActivity(**params))
            self.db.add(elem)
        return {}


    ###########################
    # Page endpoints
    ###########################

    @view_config(route_name='edit_judges', permission='view_judge', renderer='tournament_admin/edit_judges.jinja2')
    def edit_judges(self):
        return self.tplcontext()
