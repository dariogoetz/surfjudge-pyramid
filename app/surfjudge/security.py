# -*- coding: utf-8 -*-
"""
    Copyright (c) 2018 Dario Götz and Jörg Christian Reiher.
    All rights reserved.
"""

from pyramid.authorization import ACLAuthorizationPolicy


def includeme(config):
    settings = config.get_settings()
    config.set_authorization_policy(ACLAuthorizationPolicy())

    config.include('pyramid_jwt')
    config.set_jwt_cookie_authentication_policy(
        settings['auth.secret'],
        callback=lambda uid, r: r.jwt_claims.get('groups', []),
        reissue_time=3600,  # time after which the cookie will be updated, e.g. for new roles
        # expiration=7200,
        https_only=False,
        cookie_name="surfjudge_auth",
        cookie_path="/",
    )
