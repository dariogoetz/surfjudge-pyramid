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
    config.add_route('home', '/')  # views/default.py

    # admin page routes
    config.add_route('edit_tournaments', '/edit_tournaments')  # views/tournament.py
    config.add_route('edit_categories', '/edit_categories')  # views/category.py
    config.add_route('edit_surfers', '/edit_surfers')  # views/surfer.py
    config.add_route('edit_judges', '/edit_judges')  # views/surfer.py
    config.add_route('heat_overview', '/heat_overview')  # views/heat.py
    config.add_route('judge_sheet', '/judge_sheet') # views/judge.py

    # REST routes
    # views/heat.py
    config.add_route('heats', '/rest/heats')
    config.add_route('heats:id', '/rest/heats/{id}')

    config.add_route('active_heats', '/rest/active_heats')
    config.add_route('start_heat', '/rest/start_heat')
    config.add_route('stop_heat', '/rest/stop_heat')
    config.add_route('remaining_heat_time', '/rest/remaining_heat_time')
    config.add_route('remaining_heat_time:heat_id', '/rest/remaining_heat_time/{heat_id}')

    # views/tournament.py
    config.add_route('tournaments', '/rest/tournaments')
    config.add_route('tournaments:id', '/rest/tournaments/{id}')

    # views/category.py
    config.add_route('categories', '/rest/categories')
    config.add_route('categories:id', '/rest/categories/{id}')

    # views/advancement.py
    config.add_route('advancements', '/rest/advancements')
    config.add_route('advancements:category_id', '/rest/advancements/{category_id}')
    config.add_route('advancements:batch', '/rest/advancements_batch')  # upload in batch

    config.add_route('advancing_surfers', '/rest/advancing_surfers')
    config.add_route('advancing_surfers:heat_id', '/rest/advancing_surfers/{heat_id}')

    # views/surfer.py
    config.add_route('surfers', '/rest/surfers')
    config.add_route('surfers:id', '/rest/surfers/{id}')
    config.add_route('surfers:batch', '/rest/surfers_batch')  # upload in batch

    # views/judge.py
    config.add_route('judges', '/rest/judges')
    config.add_route('judges:id', '/rest/judges/{id}')

    config.add_route('judge_assignments', '/rest/judge_assignments')
    config.add_route('judge_assignments:heat_id', '/rest/judge_assignments/{heat_id}')
    config.add_route('judge_assignments:heat_id:judge_id', '/rest/judge_assignments/{heat_id}/{judge_id}')
    config.add_route('judge_assignments:batch', '/rest/judge_assignments_batch')  # upload in batch

    config.add_route('judging_requests', '/rest/judging_requests')

    # views/participant.py
    config.add_route('participants', '/rest/participants')
    config.add_route('participants:heat_id', '/rest/participants/{heat_id}')
    config.add_route('participants:heat_id:surfer_id', '/rest/participants/{heat_id}/{surfer_id}')
    config.add_route('participants:batch', '/rest/participants_batch')  # upload in batch

    # views/result.py
    config.add_route('results', '/rest/results')
    config.add_route('results:heat_id', '/rest/results/{heat_id}')
    config.add_route('results:batch', '/rest/results_batch')

    # views/score.py
    config.add_route('scores', '/rest/scores')
    config.add_route('scores:heat_id:judge_id:surfer_id:wave', '/rest/scores/{heat_id}/{judge_id}/{surfer_id}/{wave}')

    # views/util.py
    config.add_route('lycra_colors', '/rest/lycra_colors')
