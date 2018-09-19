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

class SurferViews(base.SurfjudgeView):

    def _update_with_existing_id(self, params):
        new_params = {}
        new_params.update(params)
        # find existing surfer with same first and last name
        res = self.db.query(model.Surfer).filter(model.Surfer.first_name == params.get('first_name'),
                                                 model.Surfer.last_name == params.get('last_name')).first()
        if res is None:
            new_params['id'] = None
        else:
            new_params['id'] = res.id
        return new_params

    @staticmethod
    def _gen_name(obj):
        return '{} {}'.format(obj.first_name, obj.last_name)


    @view_config(route_name='surfers', request_method='GET', permission='view_surfers', renderer='json')
    def get_surfers(self):
        log.info('----- GET all surfers -----')
        query = model.gen_query_expression(self.all_params, model.Surfer)
        res = self.db.query(model.Surfer).filter(*query).all()
        for r in res:
            r.name = self._gen_name(r)
        return res

    @view_config(route_name='surfers:id', request_method='GET', permission='view_surfers', renderer='json')
    def get_surfer(self):
        id = self.request.matchdict.get('id')
        log.info('----- GET surfer {id} -----'.format(id=id))
        res = self.db.query(model.Surfer).filter(model.Surfer.id == id).first()
        res.name = self._gen_name(res)
        return res

    # a post is allowed without specifying an id; a new id is generated in this case
    @view_config(route_name='surfers', request_method='POST', permission='edit_surfer', renderer='json')
    @view_config(route_name='surfers:id', request_method='POST', permission='edit_surfer', renderer='json')
    def add_surfer(self):
        id = self.all_params.get('id')
        log.info('----- POST surfer {id} -----'.format(id=id or "new"))
        params = {}
        params.update(self.all_params)
        # find existing surfer with same first and last name
        if params.get('id') is None or params['id'] == '':
            params = self._update_with_existing_id(self.all_params)

        # generate db object
        elem = self.db.merge(model.Surfer(**params))
        self.db.add(elem)

        # update element from db (now with new id, if none was specified before)
        self.db.flush()
        self.db.refresh(elem)
        return elem

    @view_config(route_name='surfers:batch', request_method='POST', renderer='json')
    def add_surfers_batch(self):
        log.info('----- POST adding surfers in BATCH -----')
        json_data = self.all_params.get('json_data', '[]')
        data = json.loads(json_data)
        # add multiple surfers to database
        for params in data:
            # find existing surfer with same first and last name
            if params.get('id') is None or params['id'] == '':
                params = self._update_with_existing_id(params)

            # update existing element, if it exists
            elem = self.db.merge(model.Surfer(**params))
            self.db.add(elem)
        return {}

    @view_config(route_name='surfers:id', request_method='DELETE', permission='edit_surfer', renderer='json')
    def delete_surfer(self):
        id = self.all_params.get('id')
        log.info('----- DELETE surfer {id} -----'.format(id=id))
        if id is not None:
            elems = self.db.query(model.Surfer).filter(model.Surfer.id == id).all()
            for elem in elems:
                self.db.delete(elem)
        return {}

    @view_config(route_name='edit_surfers', permission='view_surfer', renderer='tournament_admin/edit_surfers.jinja2')
    def edit_surfers(self):
        return self.tplcontext()
