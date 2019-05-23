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
        return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

    def get_users(self):
        '''
        Get a list of all users.
        '''
        users = self.request.db.query(model.User).all()
        return users


    def get_user(self, username):
        '''
        Get all info for a user.
        If the user is not logged in, "None" is returned.
        '''
        if username is None:
            return None
        return self.request.db.query(model.User).filter(model.User.id == username).first()

    def rename_user(self, username, new_username):
        user = self.request.db.query(model.User).filter(model.User.id == username).first()
        if user is None:
            return None
        new_user = self.request.db.query(model.User).filter(model.User.id == new_username).first()
        if new_username is None or new_user is not None:
            return None

        new_user = model.User(id=new_username, permissions=user.permissions)
        self.request.db.add(new_user)
        self.request.db.delete(user)
        return True

    def get_groups(self, username):
        '''
        Get the roles for a userself.
        If the user does not exist, returns None.
        '''
        user = self.request.db.query(model.User).filter(model.User.id == username).first()
        if user is None:
            return None
        return [str(p.permission.name) for p in  user.permissions]

    def set_groups(self, username, groups):
        user = self.request.db.query(model.User).filter(model.User.id == username).first()
        if user is None:
            return None
        user.permissions = []
        for group in groups:
            p = model.Permission(user_id=username, permission=group)
            self.request.db.add(p)
        return True

    def set_password(self, username, password):
        user = self.request.db.query(model.User).filter(model.User.id == username).first()
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

        user = self.request.db.query(model.User).filter(model.User.id == username).first()
        if user is None:
            return False

        return bcrypt.checkpw(password.encode('utf-8'), user.password_hash.encode('utf-8'))

    def register_user(self, username, password, groups=None):
        '''
        Generates a hashed password and stores
        the username with the hashed password.
        '''

        if username is None or password is None:
            return False

        user = self.request.db.query(model.User).filter(model.User.id == username).first()
        if user is not None:
            log.warning('Trying to register existing user %s. Aborting.', username)
            return False

        groups = sorted(groups) or []
        if not self.request.db.query(model.User.id).count():
            # first registered user is admin
            groups = sorted(set(groups) | set([model.PermissionType.ac_admin]))
        password_hash = self.generate_hashed_pw(password)
        user = model.User(id=username, password_hash=password_hash)

        self.request.db.add(user)
        for group in groups:
            p = model.Permission(user_id=username, permission=group)
            self.request.db.add(p)
        return True

    def delete_user(self, username):
        user = self.request.db.query(model.User).filter(model.User.id == username).first()
        if user is None:
            return True
        self.request.db.delete(user)
        return True

def includeme(config):
    settings = config.get_settings()
    config.add_request_method(lambda r: UserManager(r), 'user_manager', reify=True)
