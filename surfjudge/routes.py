# -*- coding: utf-8 -*-
"""
    Copyright (c) 2018 Dario Götz and Jörg Christian Reiher.
    All rights reserved.
"""

def includeme(config):
    """Add routes to views."""
    # static routes
    config.add_static_view('static', 'static', cache_max_age=3600)

    # authentication routes
    config.add_route('login', '/auth/login')
    config.add_route('logout', '/auth/logout')
    config.add_route('register', '/auth/register')

    # testing routes
    config.add_route('test_forbidden', '/auth/test_forbidden')

    # public page routes
    config.add_route('home', '/')

    # admin page routes
    config.add_route('edit_tournaments', '/edit_tournaments')
    config.add_route('edit_categories', '/edit_categories')
    config.add_route('edit_surfers', '/edit_surfers')

    # REST routes
    config.add_route('heats', '/rest/heats')
    config.add_route('heats:id', '/rest/heats/{id}')

    config.add_route('tournaments', '/rest/tournaments')
    config.add_route('tournaments:id', '/rest/tournaments/{id}')

    config.add_route('categories', '/rest/categories')
    config.add_route('categories:id', '/rest/categories/{id}')

    config.add_route('advancements', '/rest/advancements')
    config.add_route('advancements:category_id', '/rest/advancements/{category_id}')
    config.add_route('advancements:batch', '/rest/advancements_batch')

    config.add_route('advancing_surfers', '/rest/advancing_surfers')
    config.add_route('advancing_surfers:heat_id', '/rest/advancing_surfers/{heat_id}')

    config.add_route('surfers', '/rest/surfers')
    config.add_route('surfers:id', '/rest/surfers/{id}')
    config.add_route('surfers:batch', '/rest/surfers_batch')

    config.add_route('participants', '/rest/participants')
    config.add_route('participants:heat_id', '/rest/participants/{heat_id}')
    config.add_route('participants:batch', '/rest/participants_batch')

    config.add_route('lycra_colors', '/rest/lycra_colors')
