# -*- coding: utf-8 -*-
"""
    Copyright (c) 2018 Dario Götz and Jörg Christian Reiher.
    All rights reserved.
"""

import logging
log = logging.getLogger(__name__)

from pyramid.httpexceptions import HTTPFound, HTTPForbidden
from pyramid.security import (
    remember,
    forget,
    )

from pyramid.view import (
    view_config,
    forbidden_view_config,
    )

from . import base

class AuthenticationViews(base.SurfjudgeView):
    """Endpoints for user authentication"""

    @view_config(route_name='login', renderer='authentication/login.jinja2')
    @forbidden_view_config(renderer='authentication/login.jinja2')
    def login(self):
        """
        Provide login page for user and log in userself.
        Dual use:
            1. Show login page if the field "form.submitted" is not provided.
            2. Log in user and send to "came_from"/referrer if "form.submitted" is provided.
        """
        request = self.request
        login_url = request.route_url('login')

        # prepare route where to return to after successful login
        referrer = request.url
        if referrer == login_url:
            referrer = '/'  # never use login form itself as came_from
        came_from = request.params.get('came_from', referrer)

        if isinstance(request.exception, HTTPForbidden):
            # in case login was called due to a HTTPForbidden exception, give a proper message
            message = 'Insufficient rights for requested resource!'
            self.request.response.status_code = 403
        else:
            message = ''
        # log in user if "form.submitted" is a field in the request params
        if 'form.submitted' in request.params:
            login = request.params['login']
            password = request.params['password']
            if request.user_manager.check_credentials(login, password):
                user = request.user_manager.get_user(login)

                # remember stores the cookie, that later determines the authenticated_userid
                headers = remember(request, user.id)
                return HTTPFound(location=came_from,
                                 headers=headers)
            message = 'Wrong credentials.'

        # show login page (potentially again, if login was unsuccessful)
        login = ''
        password = ''
        return self.tplcontext(dict(
            name='Login',
            message=message,
            url=request.application_url + '/auth/login',
            came_from=came_from,
            login=login,
            password=password,
        ))

    @view_config(route_name='logout')
    def logout(self):
        """Log out user (let browser forget the cookies)."""
        request = self.request
        headers = forget(request)
        home_url = request.route_url('home')
        headers = forget(request)
        return HTTPFound(location=home_url,
                         headers=headers)


    @view_config(route_name='register', permission='register', renderer='authentication/register.jinja2')
    def register(self):
        """
        Register a new user.

        Dual use:
            1. Show registration page if the field "form.submitted" is not provided.
            2. Register user and send to home page if "form.submitted" is provided.
        """
        request = self.request

        # register new user if "form.submitted" is in request params
        if 'form.submitted' in request.params:
            login = request.params['login']
            password = request.params['password']
            first_name = request.params.get('first_name')
            last_name = request.params.get('last_name')
            groups = []
            if 'as_admin' in request.params:
                groups = ['ac_admin']
            if login and password:
                request.user_manager.register_user(login, password, groups=groups, first_name=first_name, last_name=last_names)
            return HTTPFound(location=request.application_url)

        # show registration page
        return self.tplcontext(dict(
            url=request.application_url + '/auth/register',
        ))

    @view_config(route_name='logins:id', request_method='GET', permission='edit_logins', renderer='json')
    def get_login(self):
        log.info('GET login')
        uid = self.request.matchdict['id']
        login = self.request.user_manager.get_user_by_id(uid)
        d = {}
        d['id'] = login.id
        d['username'] = login.username
        d['first_name'] = login.first_name
        d['last_name'] = login.last_name
        d['groups'] = [p.permission.name for p in login.permissions]
        return d

    @view_config(route_name='logins', request_method='GET', permission='view_logins', renderer='json')
    def get_logins(self):
        logins = self.request.user_manager.get_users()
        log.info('GET logins')
        # remove password
        res = []
        for login in logins:
            d = {}
            d['id'] = login.id
            d['username'] = login.username
            d['first_name'] = login.first_name
            d['last_name'] = login.last_name
            d['groups'] = [p.permission.name for p in login.permissions]
            res.append(d)
        return res

    @view_config(route_name='logins:id', request_method='POST', permission='edit_logins', renderer='json')
    def set_login(self):
        log.info('POST login')
        # rename user if necessary
        uid = self.request.matchdict['id']
        username = self.request.json_body.get('username')
        groups = self.request.json_body.get('groups')
        password = self.request.json_body.get('password')
        first_name = self.request.json_body.get('first_name')
        last_name = self.request.json_body.get('last_name')

        if uid == 'new':
            password = self.request.json_body.get('password')
            if not username:
                log.warning('No username given for new user')
                self.request.status_code = 400
                return
            if not password:
                log.warning('No password given for new user "%s"', username)
                self.request.status_code = 400
                return

            login = self.request.user_manager.get_user(username)
            if login is not None:
                log.warning('Username "%s" already taken.', username)
                return

            log.info('Registering new user "%s"', username)
            success = self.request.user_manager.register_user(username, password, groups=groups, first_name=first_name, last_name=last_name)
            login = self.request.user_manager.get_user(username)
            return login

        login = self.request.user_manager.get_user_by_id(uid)
        if username != login.username:
            log.info('Renaming login %s to %s', login.username, username)
            self.request.user_manager.rename_user(uid, username)

        # update groups if necessary
        if groups is not None:
            log.info('Setting groups %s for user %s', ', '.join(groups), login.username)
            self.request.user_manager.set_groups(uid, groups)

        if first_name is not None or last_name is not None:
            log.info('Setting name for %s to %s %s', login.username, first_name, last_name)
            self.request.user_manager.set_name(uid, first_name, last_name)

        if password is not None:
            password = password.strip()
            if password:
                # only update password if it is not empty
                log.info('Updating password for user %s', login.username)
                self.request.user_manager.set_password(uid, password)
        return login

    @view_config(route_name='logins:id', request_method='DELETE', permission='edit_logins', renderer='json')
    def delete_login(self):
        log.info('DELETE login')
        self.request.user_manager.delete_user(self.all_params['id'])
        return

    ###########################
    # HTML endpoints
    ###########################

    @view_config(route_name='edit_logins', permission='edit_logins', renderer='tournament_admin/edit_logins.jinja2')
    def edit_logins(self):
        return self.tplcontext()
