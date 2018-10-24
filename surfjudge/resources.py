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
    __acl__ = [
        # permissions required for viewing the index page
        (Allow, Everyone, ('view_tournaments',
                           'view_heats',  # includes category, tournament, participantions, surfers
                           'view_active_heats',
                           'view_participants',
                           'view_advancements',
                           'view_results')),

        # permissions required for using the judge sheet
        (Allow, 'ac_judge', ('view_judge_sheet',
                             'view_assigned_active_heats',
                             'view_scores',
                             'edit_scores')),

        (Allow, 'ac_admin', ALL_PERMISSIONS),
    ]

    def __init__(self, request):
        pass
