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

    @view_config(route_name='judges:id', request_method='GET', permission='view_judges', renderer='json')
    def get_judge(self):
        id = self.request.matchdict.get('id')
        log.info('GET judge {id}'.format(id=id))
        res = self.db.query(model.Judge).filter(model.Judge.id == id).first()
        return res

    @view_config(route_name='judges', request_method='GET', permission='view_judges', renderer='json')
    def get_judges(self):
        log.info('GET judges')
        query = model.gen_query_expression(self.all_params, model.Judge)
        res = self.db.query(model.Judge).filter(*query).all()
        return res


    def _add_judge(self, orig_params):
        params = {}
        params.update(orig_params)
        if params.get('id') == '' or params.get('id') == 'new':
            params['id'] = None

        # generate db object
        elem = self.db.merge(model.Judge(**params))
        self.db.add(elem)
        return elem

    @view_config(route_name='judges', request_method='POST', permission='edit_judge', renderer='json')
    def add_judges(self):
        log.info('POST judges')
        for params in self.request.json_body:
            self._add_judge(params)

    @view_config(route_name='judges:id', request_method='POST', permission='edit_judge', renderer='json')
    def add_judge(self):
        log.info('POST judge')
        elem = self._add_judge(self.all_params)

        # update element from db (now with new id, if none was specified before)
        self.db.flush()
        self.db.refresh(elem)
        return elem

    @view_config(route_name='judges:id', request_method='DELETE', permission='edit_judge', renderer='json')
    def delete_judge(self):
        id = self.all_params.get('id')
        log.info('DELETE judge {id}'.format(id=id))
        if id is not None:
            elems = self.db.query(model.Judge).filter(model.Judge.id == id).all()
            for elem in elems:
                self.db.delete(elem)
        return {}


    ###########################
    # Judge assignments
    ###########################

    @view_config(route_name='judge_assignments', request_method='GET', permission='view_assigned_judges', renderer='json')
    @view_config(route_name='judge_assignments:heat_id', request_method='GET', permission='view_assigned_judges', renderer='json')
    def get_assigned_judges(self):
        log.info('GET assigned judges')
        query = model.gen_query_expression(self.all_params, model.JudgeAssignment)
        res = self.db.query(model.JudgeAssignment).filter(*query).all()
        for elem in res:
            # ensure judge and heat fields are filled (lazily loaded by db)
            elem.judge
            elem.heat

        return res

    @view_config(route_name='judge_assignments:heat_id', request_method='POST', permission='edit_assigned_judges', renderer='json')
    @view_config(route_name='judge_assignments:heat_id', request_method='PUT', permission='edit_assigned_judges', renderer='json')
    def set_assigned_judges(self):
        """Add judge assignments

        If request method is "PUT", all participants for the heat are overwritten. If "POST"
        is used, the participants are appended.
        """
        log.info('%s assigned judges', self.request.method)

        heat_id = self.all_params['heat_id']
        upload_ids = set([p['judge_id'] for p in self.request.json_body])
        # delete judges for given heat_id
        if self.request.method == 'PUT':
            log.info('Removing old assigned judges for heat {}'.format(heat_id))
            assignments = self.db.query(model.JudgeAssignment)\
                .filter(model.JudgeAssignment.heat_id == heat_id).all()
            for a in assignments:
                if a.judge_id not in upload_ids:
                    self.db.delete(a)

        # add multiple judges to database
        for params in self.request.json_body:
            # update existing element, if it exists
            elem = self.db.merge(model.JudgeAssignment(**params))
            self.db.add(elem)
        return {}

    @view_config(route_name='judge_assignments:heat_id:judge_id', renderer='json', permission='edit_assigned_judges', request_method='DELETE')
    def delete_assigned_judge(self):
        log.info('DELETE assigned judge {judge_id} in heat {heat_id}'.format(**self.all_params))
        elems = self.db.query(model.JudgeAssignment) \
            .filter(model.JudgeAssignment.heat_id == self.all_params['heat_id'],
                    model.JudgeAssignment.judge_id == self.all_params['judge_id']).all()
        for elem in elems:
            self.db.delete(elem)
        return {}

    @view_config(route_name='active_judge_assignments:judge_id', request_method='GET', permission='view_assigned_active_heats', renderer='json')
    def get_assigned_active_heats(self):
        log.info('GET active judge_assignments for judge {judge_id}'.format(**self.all_params))

        judge_id = int(self.request.matchdict['judge_id'])
        if self.logged_in_judge.id != judge_id and not self.is_admin:
            log.info('Prevented active judge assignment request for judge_id %s by %s', judge_id, self.logged_in_judge.username)
            self.request.status_code = 403
            return []

        judge_id = int(self.all_params['judge_id'])
        active_heats = list(self.request.state_manager.get_active_heats())
        if not active_heats:
            return []
        query = model.gen_query_expression({'heat_id': active_heats,
                                            'judge_id': judge_id}, model.JudgeAssignment)
        res = self.db.query(model.JudgeAssignment).filter(*query).all()
        for elem in res:
            # ensure judge and heat fields are filled (lazily loaded by db)
            elem.judge
            elem.heat
        return res

    ###########################
    # Judging Requests
    ###########################

    @view_config(route_name='judging_requests', request_method='GET', permission='view_judging_requests', renderer='json')
    def get_judging_requests(self):
        log.info('GET judging requests')
        requests = self.request.judging_manager.get_judging_requests()
        params = {'judge_id': [elem['judge_id'] for elem in requests]}
        query = model.gen_query_expression(params, model.Judge)
        judges = self.db.query(model.Judge).filter(*query).all()
        judges_dict = {j.id: j for j in judges}
        res = []
        for req in requests:
            d = {}
            d.update(req)
            d['judge'] = judges_dict.get(req['judge_id'], {})
            res.append(d)

        return res

    @view_config(route_name='judging_requests', request_method='POST', permission='edit_judging_requests', renderer='json')
    def add_judging_request(self):
        log.info('POST judging request for judge {judge_id}'.format(**self.all_params))
        judge_id = self.all_params['judge_id']
        expire_s = self.all_params.get('expire_s', 20)
        self.request.judging_manager.register_judging_request(judge_id,
                                                              expire_s=expire_s)
        return {}




    ###########################
    # HTML endpoints
    ###########################

    @view_config(route_name='edit_judges', permission='view_judge', renderer='tournament_admin/edit_judges.jinja2')
    def edit_judges(self):
        return self.tplcontext()


    @view_config(route_name='judge_sheet', permission='view_judge_sheet', renderer='judge_sheet.jinja2')
    def judge_sheet(self):
        context = self.tplcontext()
        if self.userid is not None:
            judge = self.db.query(model.Judge).filter(model.Judge.username==self.userid).first()
            if judge:
                context['judge_id'] = judge.id
        return context
