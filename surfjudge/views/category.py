# -*- coding: utf-8 -*-
"""
    Copyright (c) 2018 Dario Götz and Jörg Christian Reiher.
    All rights reserved.
"""
from datetime import datetime
import transaction

from pyramid.view import view_config

import logging
log = logging.getLogger(__name__)

from ..models import model

from . import base

class CategoryViews(base.SurfjudgeView):

    def _query_db(self, params):
        query = model.gen_query_expression(params, model.Category)
        res = self.db.query(model.Category).filter(*query).all()
        for elem in res:
            # ensure tournament corresponding to category are available
            elem.tournament
        return res

    @view_config(route_name='categories', request_method='GET', permission='view_categories', renderer='json')
    def get_categories(self):
        log.info('GET categories')
        res = self._query_db(self.all_params)
        return res

    @view_config(route_name='categories:id', request_method='GET', permission='view_categories', renderer='json')
    def get_category(self):
        id = self.request.matchdict.get('id')
        log.info('GET category %s', id)
        res = self._query_db(self.all_params)
        if res:
            return res[0]
        else:
            return None

    def _add_category(self, orig_params):
        params = {}
        params.update(orig_params)
        if params.get('id') == '' or params.get('id') == 'new':
            params['id'] = None

        # generate db object
        elem = self.db.merge(model.Category(**params))
        self.db.add(elem)
        return elem

    @view_config(route_name='categories:id', request_method='POST', permission='edit_categories', renderer='json')
    def add_category(self):
        log.info('POST category')
        elem = self._add_category(self.all_params)

        # update element from db (now with new id, if none was specified before)
        self.db.flush()
        self.db.refresh(elem)
        return elem

    @view_config(route_name='categories', request_method='POST', permission='edit_categories', renderer='json')
    def add_categories(self):
        log.info('POST categories')
        for params in self.request.json_body:
            self._add_category(params)
        return

    @view_config(route_name='categories:id', request_method='DELETE', permission='edit_categories', renderer='json')
    def delete_category(self):
        id = self.all_params.get('id')
        log.info('DELETE category %s', id)
        if id is not None:
            elems = self.db.query(model.Category).filter(model.Category.id == id).all()
            for elem in elems:
                self.db.delete(elem)
        return {}

    @view_config(route_name='edit_categories', permission='edit_categories', renderer='tournament_admin/edit_categories.jinja2')
    def edit_categories(self):
        return self.tplcontext()
