# -*- coding: utf-8 -*-
"""
    Copyright (c) 2018 Dario Götz and Jörg Christian Reiher.
    All rights reserved.
"""

import os
from sqlalchemy import engine_from_config
from sqlalchemy.orm import sessionmaker
from sqlalchemy.orm import configure_mappers
import zope.sqlalchemy
import sqlalchemy.event as sqlevent

# import or define all models here to ensure they are attached to the
# Base.metadata prior to any initialization routines
from . import model, meta  # flake8: noqa

from ..util import lycra_colors

from .. import user_management

import logging
log = logging.getLogger(__name__)

# run configure_mappers after defining all of the models to ensure
# all relationships can be setup
configure_mappers()


def get_engine(settings, prefix='sqlalchemy.'):
    """Get the sqlalchemy engine"""
    engine = engine_from_config(settings, prefix)

    if settings['{prefix}url'.format(prefix=prefix)].startswith('sqlite'):
        # ensure that cascaded deletion for foreign key constraints works with sqlite
        sqlevent.listen(engine, 'connect',
            lambda conn, rec: conn.execute('PRAGMA foreign_keys=ON;'))

    return engine


def get_session_factory(engine):
    """Generate a sqlalchemy session factory for a given engine"""
    factory = sessionmaker()
    factory.configure(bind=engine)
    return factory


def get_tm_session(session_factory, transaction_manager):
    """
    Get a ``sqlalchemy.orm.Session`` instance backed by a transaction.

    This function will hook the session to the transaction manager which
    will take care of committing any changes.

    - When using pyramid_tm it will automatically be committed or aborted
      depending on whether an exception is raised.

    - When using scripts you should wrap the session in a manager yourself.
      For example::

          import transaction

          engine = get_engine(settings)
          session_factory = get_session_factory(engine)
          with transaction.manager:
              dbsession = get_tm_session(session_factory, transaction.manager)

    """
    dbsession = session_factory()
    zope.sqlalchemy.register(
        dbsession, transaction_manager=transaction_manager)
    return dbsession


def initialize_sql(engine):
    """
    Initializes database corresponding to models in sqlalchemy_orm_objects.
    A one-time session is created for this (better sessions are received by get_tm_session,
    but the transaction manager is not yet available in this state).
    """
    # make a session only for table creation
    while True:
        try:
            session = get_session_factory(engine)()
            meta.Base.metadata.bind = engine
            meta.Base.metadata.create_all(engine)
            break
        except:
            log.warning('No database connection possible. Sleeping for 1 sec.')
            import time
            time.sleep(1)


def initialize_lycra_colors(settings, engine):
    session = get_session_factory(engine)()
    colors = session.query(model.LycraColor.id).count()
    if not colors:
        log.info('Initializing lycra colors from csv.')
        try:
            lc = lycra_colors.read_lycra_colors(settings['lycra_colors.filename'])
            for c in lc.values():
                session.add(model.LycraColor(**c))
            session.commit()
        except:
            log.error('Error while filling database with lycra colors from csv.')
    session.close()

def initialize_default_user(settings, engine):
    session = get_session_factory(engine)()
    users = session.query(model.User.id).count()
    if not users:
        log.info('Initializing default user')
        username = os.environ.get('SURFJUDGE_DEFAULT_USER', settings['user_management.default_user'])
        password = os.environ.get('SURFJUDGE_DEFAULT_PASSWORD', settings['user_management.default_password'])
        password_hash = user_management.UserManager.generate_hashed_pw(password)

        user = model.User(username=username, password_hash=password_hash)
        session.add(user)

        # flush session to retrieve user.id
        session.flush()

        permission = model.Permission(user_id=user.id, permission=model.PermissionType.ac_admin)
        session.add(permission)

        session.commit()
    session.close()



def includeme(config):
    """
    Initialize the model for a Pyramid app.

    Activate this setup using ``config.include('surfjudge.models')``.

    """
    settings = config.get_settings()
    settings['tm.manager_hook'] = 'pyramid_tm.explicit_manager'

    # use pyramid_tm to hook the transaction lifecycle to the request
    config.include('pyramid_tm')

    # use pyramid_retry to retry a request when transient exceptions occur
    config.include('pyramid_retry')

    session_factory = get_session_factory(get_engine(settings))
    config.registry['dbsession_factory'] = session_factory

    # make request.db available for use in Pyramid
    config.add_request_method(
        # r.tm is the transaction manager used by pyramid_tm
        lambda r: get_tm_session(session_factory, r.tm),
        'db',
        reify=True
    )

    # initialize tables
    engine = get_engine(settings)
    initialize_sql(engine)
    initialize_lycra_colors(settings, engine)
    initialize_default_user(settings, engine)
