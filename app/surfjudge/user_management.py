# -*- coding: utf-8 -*-
"""
    Copyright (c) 2018 Dario Götz and Jörg Christian Reiher.
    All rights reserved.
"""

import bcrypt
import threading
import json
import os

from .models import model

import logging
log = logging.getLogger(__name__)


class UserManager(object):
    '''
    Provides the user management including check for passwords,
    their roles, etc.
    '''
    def __init__(self, request):
        self.request = request

    @staticmethod
    def generate_hashed_pw(password):
        return bcrypt.hashpw(password.encode('utf-8'),
                             bcrypt.gensalt()).decode('utf-8')

    def get_users(self):
        '''
        Get a list of all users.
        '''
        users = self.request.db.query(model.User).all()
        return users

    def get_user_by_id(self, uid):
        '''
        Get all info for a user.
        If the user is not logged in, "None" is returned.
        '''
        if uid is None:
            return None
        return self.request.db.query(
            model.User).filter(model.User.id == uid).first()

    def get_user(self, username):
        '''
        Get all info for a user.
        If the user is not logged in, "None" is returned.
        '''
        if username is None:
            return None
        return self.request.db.query(
            model.User).filter(model.User.username == username).first()

    def rename_user(self, uid, username):
        user = self.request.db.query(
            model.User).filter(model.User.id == uid).first()
        if user is None:
            return None
        new_user = self.request.db.query(
            model.User).filter(model.User.username == username).first()
        if username is None or new_user is not None:
            return None

        user.username = username
        self.request.db.add(user)
        return True

    def get_groups(self, uid):
        '''
        Get the roles for a userself.
        If the user does not exist, returns None.
        '''
        user = self.request.db.query(
            model.User).filter(model.User.id == uid).first()
        if user is None:
            return None
        return [str(p.permission.name) for p in user.permissions]

    def set_groups(self, uid, groups):
        user = self.request.db.query(
            model.User).filter(model.User.id == uid).first()
        if user is None:
            return None
        user.permissions = []
        for group in groups:
            p = model.Permission(user_id=user.id, permission=group)
            self.request.db.add(p)
        return True

    def set_password(self, uid, password):
        user = self.request.db.query(
            model.User).filter(model.User.id == uid).first()
        if user is None:
            return None
        user.password_hash = self.generate_hashed_pw(password)
        return True

    def check_credentials(self, username, password):
        '''
        Check given password using bcrypt method.

        Returns True if password is correct and False otherwise.
        '''

        if username is None or password is None:
            return False

        user = self.request.db.query(
            model.User).filter(model.User.username == username).first()
        if user is None:
            return False

        return bcrypt.checkpw(password.encode('utf-8'),
                              user.password_hash.encode('utf-8'))

    def register_user(self,
                      username,
                      password,
                      groups=None,
                      first_name=None,
                      last_name=None,
                      additional_info=None):
        '''
        Generates a hashed password and stores
        the username with the hashed password.
        '''

        if username is None or password is None:
            return False

        user = self.request.db.query(
            model.User).filter(model.User.username == username).first()
        if user is not None:
            log.warning('Trying to register existing user %s. Aborting.',
                        username)
            return False

        groups = sorted(groups) or []
        if not self.request.db.query(model.User.id).count():
            # first registered user is admin
            groups = sorted(set(groups) | set([model.PermissionType.ac_admin]))
        password_hash = self.generate_hashed_pw(password)
        user = model.User(username=username,
                          password_hash=password_hash,
                          first_name=first_name,
                          last_name=last_name,
                          additional_info=additional_info)

        self.request.db.add(user)
        self.request.db.flush()

        for group in groups:
            p = model.Permission(user_id=user.id, permission=group)
            self.request.db.add(p)
        return True

    def set_name(self, uid, first_name, last_name):
        user = self.request.db.query(
            model.User).filter(model.User.id == uid).first()
        if user is None:
            return True
        if first_name is not None:
            user.first_name = first_name
        if last_name is not None:
            user.last_name = last_name
        self.request.db.add(user)
        return True

    def delete_user(self, uid):
        user = self.request.db.query(
            model.User).filter(model.User.id == uid).first()
        if user is None:
            return True
        self.request.db.delete(user)
        return True


def includeme(config):
    settings = config.get_settings()
    config.add_request_method(lambda r: UserManager(r),
                              'user_manager',
                              reify=True)
