# -*- coding: utf-8 -*-
"""
    Copyright (c) 2018 Dario Götz and Jörg Christian Reiher.
    All rights reserved.
"""
import datetime
from pyramid.renderers import JSON

def custom_json_renderer():
    """
    Return a custom json renderer that can deal with some datetime objects.
    """
    def datetime_adapter(obj, request):
        return obj.isoformat()

    def time_adapter(obj, request):
        return obj.isoformat()

    def date_adapter(obj, request):
        return obj.isoformat()

    json_renderer = JSON()
    json_renderer.add_adapter(datetime.datetime, datetime_adapter)
    json_renderer.add_adapter(datetime.time, time_adapter)
    json_renderer.add_adapter(datetime.date, date_adapter)
    return json_renderer
