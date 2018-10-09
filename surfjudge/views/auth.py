# -*- coding: utf-8 -*-
"""
    Copyright (c) 2018 Dario Götz and Jörg Christian Reiher.
    All rights reserved.
"""

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
            message = 'Requested forbidden resource!'
        else:
            message = ''
        # log in user if "form.submitted" is a field in the request params
        if 'form.submitted' in request.params:
            login = request.params['login']
            password = request.params['password']
            if request.user_manager.check_credentials(login, password):
                headers = remember(request, login)
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


    @view_config(route_name='register', renderer='authentication/register.jinja2')
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
            groups = []
            if 'as_admin' in request.params:
                groups = ['ac_admin']
            if login and password:
                request.user_manager.register_user(login, password, groups=groups)
            return HTTPFound(location=request.application_url)

        # show registration page
        return self.tplcontext(dict(
            url=request.application_url + '/auth/register',
        ))
