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

    @view_config(route_name='surfers:id', request_method='GET', permission='view_surfers', renderer='json')
    def get_surfer(self):
        id = self.request.matchdict.get('id')
        log.info('GET surfer %s', id)
        res = self.db.query(model.Surfer).filter(model.Surfer.id == id).first()
        res.name = self._gen_name(res)
        return res

    @view_config(route_name='surfers', request_method='GET', permission='view_surfers', renderer='json')
    def get_surfers(self):
        log.info('GET surfers')
        query = model.gen_query_expression(self.all_params, model.Surfer)
        res = self.db.query(model.Surfer).filter(*query).all()
        for r in res:
            r.name = self._gen_name(r)
        return res


    def _add_surfer(self, params):
        # find existing surfer with same first and last name
        if params.get('id') is None or params.get('id') == '':
            params = self._update_with_existing_id(params)
        # generate db object
        elem = self.db.merge(model.Surfer(**params))
        self.db.add(elem)
        return elem

    # a post is allowed without specifying an id; a new id is generated in this case
    @view_config(route_name='surfers:id', request_method='POST', permission='edit_surfers', renderer='json')
    def add_surfer(self):
        log.info('POST add surfer')
        params = {}
        params.update(self.all_params)
        if params['id'] == 'new':
            params['id'] = None
        elem = self._add_surfer(params)

        # update element from db (now with new id, if none was specified before)
        self.db.flush()
        self.db.refresh(elem)
        return elem

    # don't use json_data, but body directly
    @view_config(route_name='surfers', request_method='POST', permission='edit_surfers', renderer='json')
    def add_surfers(self):
        log.info('POST add surfers')
        for params in self.request.json_body:
            elem = self._add_surfer(params)
        return {}

    @view_config(route_name='surfers:id', request_method='DELETE', permission='edit_surfers', renderer='json')
    def delete_surfer(self):
        id = self.all_params.get('id')
        log.info('DELETE surfer %s', id)
        if id is not None:
            elems = self.db.query(model.Surfer).filter(model.Surfer.id == id).all()
            for elem in elems:
                self.db.delete(elem)
        return {}

    @view_config(route_name='edit_surfers', permission='view_edit_surfers_page', renderer='tournament_admin/edit_surfers.jinja2')
    def edit_surfers(self):
        return self.tplcontext()
