# -*- coding: utf-8 -*-
"""
    Copyright (c) 2018 Dario Götz and Jörg Christian Reiher.
    All rights reserved.
"""

from pyramid.security import Allow, Everyone, ALL_PERMISSIONS


class DefaultACL(object):
    """
    Serves as context for default views. Sets user permissions by groups
    """
    __acl__ = [(Allow, Everyone, 'view'),
               (Allow, 'ac_admin', ALL_PERMISSIONS)]

    def __init__(self, request):
        pass
