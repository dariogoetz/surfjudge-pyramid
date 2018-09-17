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

    @view_config(route_name='categories', request_method='GET', permission='view_category', renderer='json')
    def get_categories(self):
        log.info('----- GET all categories -----')
        query = model.gen_query_expression(self.all_params, model.Category)
        res = self.db.query(model.Category).filter(*query).all()
        return res

    @view_config(route_name='categories:id', request_method='GET', permission='view_category', renderer='json')
    def get_category(self):
        id = self.request.matchdict.get('id')
        log.info('----- GET category {id} -----'.format(id=id))
        res = self.db.query(model.Category).filter(model.Category.id == id).first()
        return res

    # a post is allowed without specifying an id; a new id is generated in this case
    @view_config(route_name='categories', request_method='POST', permission='edit_category', renderer='json')
    @view_config(route_name='categories:id', request_method='POST', permission='edit_category', renderer='json')
    def add_category(self):
        id = self.all_params.get('id')
        log.info('----- POST category {id} -----'.format(id=id or "new"))
        params = {}
        params.update(self.all_params)
        params['id'] = params['id'] or None

        # generate db object
        elem = self.db.merge(model.Category(**params))
        self.db.add(elem)

        # update element from db (now with new id, if none was specified before)
        self.db.flush()
        self.db.refresh(elem)
        return elem

    @view_config(route_name='categories:id', request_method='DELETE', permission='edit_category', renderer='json')
    def delete_category(self):
        id = self.all_params.get('id')
        log.info('----- DELETE category {id} -----'.format(id=id))
        if id is not None:
            elems = self.db.query(model.Category).filter(model.Category.id == id).all()
            for elem in elems:
                self.db.delete(elem)
        return {}

    @view_config(route_name='edit_categories', permission='view_category', renderer='tournament_admin/edit_categories.jinja2')
    def edit_categories(self):
        return self.tplcontext()
