# -*- coding: utf-8 -*-
"""
    Copyright (c) 2018 Dario Götz and Jörg Christian Reiher.
    All rights reserved.
"""
from datetime import datetime

from pyramid.view import view_config

import logging
log = logging.getLogger(__name__)

from . import base

from ..models import model

class HeatViews(base.SurfjudgeView):

    @view_config(route_name='heats', request_method='GET', permission='view_heat', renderer='json')
    def get_heats(self):
        log.info('----- GET all heats -----')
        query = model.gen_query_expression(self.all_params, model.Heat)
        res = self.db.query(model.Heat).filter(*query).all()
        return res

    @view_config(route_name='heats:id', request_method='GET', permission='view_heat', renderer='json')
    def get_heat(self):
        id = self.request.matchdict.get('id')
        log.info('----- GET heat {id} -----'.format(id=id))
        res = self.db.query(model.Heat).filter(model.Heat.id == id).first()
        return res

    # a post is allowed without specifying an id; a new id is generated in this case
    @view_config(route_name='heats', request_method='POST', permission='edit_heat', renderer='json')
    @view_config(route_name='heats:id', request_method='POST', permission='edit_heat', renderer='json')
    def add_heat(self):
        id = self.all_params.get('id')
        log.info('----- POST heat {id} -----'.format(id=id or "new"))
        params = {}
        params.update(self.all_params)
        params['id'] = id

        # parse datetime
        if 'start_time' in params:
            params['start_datetime'] = datetime.strptime(params['start_datetime'], self.DTS_FORMAT)
        else:
            params['start_datetime'] = datetime.now()

        # generate db object
        elem = self.db.merge(model.Heat(**params))
        self.db.add(elem)

        # update element from db (now with new id, if none was specified before)
        self.db.flush()
        self.db.refresh(elem)
        return elem

    @view_config(route_name='heats:id', request_method='DELETE', permission='edit_heat', renderer='json')
    def delete_heat(self):
        id = self.all_params.get('id')
        log.info('----- DELETE heat {id} -----'.format(id=id))
        if id is not None:
            elems = self.db.query(model.Heat).filter(model.Heat.id == id).all()
            for elem in elems:
                self.db.delete(elem)
        return {}
