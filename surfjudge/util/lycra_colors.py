# -*- coding: utf-8 -*-
"""
    Copyright (c) 2018 Dario Götz and Jörg Christian Reiher.
    All rights reserved.
"""
import csv

def read_lycra_colors(filename='lycra_colors.csv'):
    res = {}
    with open(filename, 'r') as fp:
        colors = csv.DictReader(fp, delimiter=';')
        for row in colors:
            res.setdefault(row['COLOR'], row)
    return res
