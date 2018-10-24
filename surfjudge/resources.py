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
        (Allow, Everyone, 'view_tournaments'),
        (Allow, Everyone, 'view_categories'),
        (Allow, Everyone, 'view_heats'),  # contains category, tournament and participants
        (Allow, Everyone, 'view_active_heats'),  # contains category, tournament and participants
        (Allow, Everyone, 'view_surfers'),
        (Allow, Everyone, 'view_participants'),
        (Allow, Everyone, 'view_advancements'),
        (Allow, Everyone, 'view_results'),
        # (Allow, Everyone, 'view_preliminary_results'),

        (Allow, 'ac_judge', 'view_judge_sheet'),
        (Allow, 'ac_judge', 'view_assigned_active_heats'),  # contains heat, judge for given judge
        (Allow, 'ac_judge', 'view_scores'),
        (Allow, 'ac_judge', 'edit_scores'),

        (Allow, 'ac_admin', ALL_PERMISSIONS),
    ]

    def __init__(self, request):
        pass
