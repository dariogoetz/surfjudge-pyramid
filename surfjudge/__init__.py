# -*- coding: utf-8 -*-
"""
    Copyright (c) 2018 Dario Götz and Jörg Christian Reiher.
    All rights reserved.
"""

from pyramid.config import Configurator

from .util.jsonhelpers import custom_json_renderer
from . import models

def main(global_config, **settings):
    """
    This function returns a Pyramid WSGI application.
    """
    config = Configurator(settings=settings, root_factory='.resources.DefaultACL')
    # include renderers
    config.include('pyramid_jinja2')

    # add custom json renderer for e.g. datetime objects
    config.add_renderer('json', custom_json_renderer())

    # set authentication and authorization policies
    config.include('.security')

    # load database
    config.include('.models')

    # add routes
    config.include('.routes')

    # add user management to requests
    config.include('.user_management')

    # add state management to requests
    config.include('.state_management')

    # add all views
    config.scan('.views')

    # initialize tables
    engine = models.get_engine(settings)
    models.initialize_sql(engine)
    return config.make_wsgi_app()
