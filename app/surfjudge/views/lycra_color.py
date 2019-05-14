# -*- coding: utf-8 -*-
"""
    Copyright (c) 2018 Dario Götz and Jörg Christian Reiher.
    All rights reserved.
"""
from pyramid.view import view_config

from . import base
from ..models import model

import logging
log = logging.getLogger(__name__)

class UtilViews(base.SurfjudgeView):

    @view_config(route_name='lycra_colors', request_method='GET', permission='view_lycra_colors', renderer='json')
    def get_lycra_colors(self):
        colors = self.db.query(model.LycraColor).all()
        return sorted(colors, key=lambda c: c.seed)

    @view_config(route_name='lycra_colors:id', request_method='GET', permission='view_lycra_colors', renderer='json')
    def get_lycra_color(self):
        cid = self.request.matchdict['id']
        color = self.db.query(model.LycraColor).filter(model.LycraColor.id == cid).first()
        return color

    @view_config(route_name='lycra_colors:id', request_method='POST', permission='edit_lycra_colors', renderer='json')
    def set_lycra_color(self):
        log.info('POST lycra color')

        params = {}
        params.update(self.all_params)
        if params.get('id') == '' or params.get('id') == 'new':
            params['id'] = None
        if params.get('seed') is None:
            log.warning('No seed given for lycra color. Aborting.')
            self.request.status_code = 403
            return
        seed = int(params['seed'])

        # remove old variant of the color
        old_seed = None
        if params['id'] is not None:
            old_seed = self.db.query(model.LycraColor).filter(model.LycraColor.id == params['id']).first().seed

        # check for duplicate seed
        colors = self.db.query(model.LycraColor).all()
        seeds = set([c.seed for c in colors])
        seeds.discard(old_seed)
        if seed in seeds:
            log.warning('Seed %d for lycra color %s already used.', seed, params['name'])
            self.request.status_code = 403
            return

        # generate db object
        elem = self.db.merge(model.LycraColor(**params))
        self.db.add(elem)
        self.db.flush()
        self.db.refresh(elem)
        return elem

    @view_config(route_name='lycra_colors:id', request_method='DELETE', permission='edit_lycra_colors', renderer='json')
    def delete_lycra_color(self):
        id = self.all_params.get('id')
        log.info('DELETE lycra color {id}'.format(id=id))
        if id is not None:
            elems = self.db.query(model.LycraColor).filter(model.LycraColor.id == id).all()
            for elem in elems:
                self.db.delete(elem)
        return {}


    @view_config(route_name='edit_lycra_colors', permission='view_edit_lycra_colors_page', renderer='tournament_admin/edit_lycra_colors.jinja2')
    def edit_tournaments(self):
        return self.tplcontext()