# -*- coding: utf-8 -*-
"""
    Copyright (c) 2018 Dario Götz and Jörg Christian Reiher.
    All rights reserved.
"""

def includeme(config):
    """Add routes to views."""

    config.add_static_view('static', 'static', cache_max_age=3600)
    config.add_route('home', '/')
    config.add_route('login', '/auth/login')
    config.add_route('logout', '/auth/logout')
    config.add_route('register', '/auth/register')
    config.add_route('test_forbidden', '/auth/test_forbidden')
