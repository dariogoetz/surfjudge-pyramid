# -*- coding: utf-8 -*-
"""
    Copyright (c) 2018 Dario Götz and Jörg Christian Reiher.
    All rights reserved.
"""

import bcrypt
import threading
import json
import os


class UserManager(object):
    '''
    Provides the user management including check for passwords,
    currently logged in users, their roles, etc.
    '''

    def __init__(self, filename):
        self._fs_lock = threading.RLock()
        self._mem_lock = threading.RLock()
        self.__users = {}
        self.__filename = filename
        self._read_from_disk()
        return

    def _read_from_disk(self):
        if os.path.isfile(self.__filename):
            with self._fs_lock:
                self.__users = json.load(open(self.__filename))

    def _write_to_disk(self):
        with self._fs_lock:
            json.dump(self.__users, open(self.__filename, 'w'))

    def get_user(self, username):
        '''
        Get all info for a user.
        If the user is not logged in, "None" is returned.
        '''
        if username is None:
            return None
        return self.__users.get(username)

    def get_groups(self, username):
        '''
        Get the roles for a userself.
        If the user does not exist, returns None.
        '''
        if username is None or username not in self.__users:
            return None
        return self.__users[username].get('groups', [])


    def check_credentials(self, username, password):
        '''
        Check given password using bcrypt method.

        Returns True if password is correct and False otherwise.
        '''

        if username is None or password is None:
            return False

        hashed_pw = self.__users.get(username, {}).get('password')
        if hashed_pw is None:
            return False
        return bcrypt.checkpw(password.encode('utf-8'), hashed_pw.encode('utf-8'))

    def register_user(self, username, password, groups=None):
        '''
        Generates a hashed password and stores
        the username with the hashed password.
        '''

        if username is None or password is None:
            return False

        groups = groups or []

        user_record = self.__users.get(username, {})
        user_record['id'] = username
        user_record['groups'] = sorted(set(user_record.get('groups', [])) | set(groups))
        user_record['password'] = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

        if not self.__users:
            # first registered user is admin
            user_record['groups'] = sorted(set(user_record['groups']) | set(['ac_admin']))

        with self._mem_lock:
            self.__users[username] = user_record
        self._write_to_disk()
        return True

def includeme(config):
    settings = config.get_settings()
    filename = settings['user_manager.filename']
    user_manager = UserManager(filename)
    config.add_request_method(lambda r: user_manager, 'user_manager', reify=True)
    config.add_request_method(lambda r: user_manager.get_user(r.authenticated_userid), 'user', reify=True)
