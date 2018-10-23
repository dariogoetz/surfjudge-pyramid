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

class TournamentViews(base.SurfjudgeView):

    @view_config(route_name='tournaments', request_method='GET', permission='view_tournaments', renderer='json')
    def get_tournaments(self):
        log.info('----- GET all tournaments -----')
        print(self.all_params)
        query = model.gen_query_expression(self.all_params, model.Tournament)
        res = self.db.query(model.Tournament).filter(*query).all()
        print(res)
        return res

    @view_config(route_name='tournaments:id', request_method='GET', permission='view_tournaments', renderer='json')
    def get_tournament(self):
        id = self.request.matchdict.get('id')
        log.info('----- GET tournament {id} -----'.format(id=id))
        res = self.db.query(model.Tournament).filter(model.Tournament.id == id).first()
        return res

    def _add_tournament(self, orig_params):
        params = {}
        params.update(orig_params)
        if params.get('id') == '' or params.get('id') == 'new':
            params['id'] = None

        ## parse datetimes
        params['start_date'] = datetime.strptime(params['start_date'], self.D_FORMAT)
        params['end_date'] = datetime.strptime(params['end_date'], self.D_FORMAT)

        # generate db object
        elem = self.db.merge(model.Tournament(**params))
        self.db.add(elem)
        return elem

    @view_config(route_name='tournaments:id', request_method='POST', permission='edit_tournaments', renderer='json')
    def add_tournament(self):
        log.info('POST tournament')
        elem = self._add_tournament(self.all_params)

        # update element from db (now with new id, if none was specified before)
        self.db.flush()
        self.db.refresh(elem)
        return elem

    @view_config(route_name='tournaments', request_method='POST', permission='edit_tournaments', renderer='json')
    def add_tournaments(self):
        log.info('POST tournaments')
        for params in self.request.json_body:
            self._add_tournament(params)
        return

    @view_config(route_name='tournaments:id', request_method='DELETE', permission='edit_tournaments', renderer='json')
    def delete_tournament(self):
        id = self.all_params.get('id')
        log.info('----- DELETE tournament {id} -----'.format(id=id))
        if id is not None:
            elems = self.db.query(model.Tournament).filter(model.Tournament.id == id).all()
            for elem in elems:
                self.db.delete(elem)
        return {}

    @view_config(route_name='edit_tournaments', permission='edit_tournaments', renderer='tournament_admin/edit_tournaments.jinja2')
    def edit_tournaments(self):
        return self.tplcontext()
