# -*- coding: utf-8 -*-
"""
    Copyright (c) 2018 Dario Götz and Jörg Christian Reiher.
    All rights reserved.
"""

from sqlalchemy import Column, String, Integer, Float, ForeignKey, DateTime, Date, Time
from sqlalchemy.orm import relationship
from sqlalchemy.ext import declarative

from . import meta

def gen_query_expression(query_info, orm_class):
    """Generates a sqlalchemy query expression from dictionary"""
    keys = set(orm_class.__table__.columns.keys())
    expr = []
    for key in keys & set(query_info.keys()):
        val = query_info.get(key)
        orm_attr = getattr(orm_class, key)
        if isinstance(val, list) or isinstance(val, set) or isinstance(val, tuple):
            if not val:
                continue
            expr.append(orm_attr.in_(val))
        else:
            expr.append(orm_attr == val)
    return expr

class Score(meta.Base):
    __tablename__ = 'scores'

    wave = Column(Integer, primary_key=True)
    score = Column(Float)
    interference = Column(Integer)
    missed = Column(Integer)
    surfer_id = Column(Integer, ForeignKey('surfers.id'), primary_key=True)
    judge_id = Column(Integer, ForeignKey('judges.id'), primary_key=True)
    heat_id = Column(Integer, ForeignKey('heats.id'), primary_key=True)
    additional_info = Column(String)

    # surfer: backref from Surfer
    # judge: backref from Judge
    # heat: backref from Heat


class Surfer(meta.Base):
    __tablename__ = 'surfers'

    id = Column(Integer, primary_key=True)
    first_name = Column(String)
    last_name = Column(String)
    # name = Column(String)
    country = Column(String)
    additional_info = Column(String)

    # relationships
    scores = relationship('Score', backref='surfer', cascade='all, delete-orphan')
    results = relationship('Result', backref='surfer', cascade='all, delete-orphan')


    # heats: backref from Heat via secondary Participation
    # heats = relationship('Heat', secondary='participants')
    participations =  relationship('Participation', cascade='all, delete-orphan') # make sure, participations are deleted on surfer deletion (viewonly secondary relationship cannot do that)



class Judge(meta.Base):
    __tablename__ = 'judges'

    id = Column(Integer, primary_key=True)
    first_name = Column(String)
    last_name = Column(String)
    username = Column(String)
    additional_info = Column(String)

    # relationships
    scores = relationship('Score', backref='judge', cascade='all') # no delete-orphan; if a judge is removed, the scores should remain

    # heats: backref from Heat via secondary JudgeActivity
    # heats = relationship('Heat', secondary='judge_activities')


class JudgeActivity(meta.Base):
    __tablename__ = 'judge_activities'

    judge_id = Column(Integer, ForeignKey('judges.id'), primary_key=True)
    heat_id = Column(Integer, ForeignKey('heats.id'), primary_key=True)


class Participation(meta.Base):
    __tablename__ = 'participants'

    surfer_id = Column(Integer, ForeignKey('surfers.id'), primary_key=True)
    heat_id = Column(Integer, ForeignKey('heats.id'), primary_key=True)
    surfer_color = Column(String)
    seed = Column(Integer)

    heat = relationship('Heat')
    surfer = relationship('Surfer')


class Result(meta.Base):
    __tablename__ = 'results'

    heat_id = Column(Integer, ForeignKey('heats.id'), primary_key=True)
    surfer_id = Column(Integer, ForeignKey('surfers.id'), primary_key=True)
    total_score = Column(Float)
    place = Column(Integer)
    wave_scores = Column(String)

    # heat: backref from Heat
    # surfer: backref from Surfer


class Tournament(meta.Base):
    __tablename__ = 'tournaments'

    id = Column(Integer, primary_key=True)
    name = Column(String)
    start_date = Column(Date)
    end_date = Column(Date)
    additional_info = Column(String)

    # relationships
    categories = relationship('Category', backref='tournament', cascade='all, delete-orphan' )


class Category(meta.Base):
    __tablename__ = 'categories'

    id = Column(Integer, primary_key=True)
    tournament_id = Column(Integer, ForeignKey('tournaments.id'))
    name = Column(String)
    additional_info = Column(String)

    # relationships
    heats = relationship('Heat', backref='category', cascade='all, delete-orphan')

    # tournament: backref from Tournament


class Heat(meta.Base):
    __tablename__ = 'heats'

    id = Column(Integer, primary_key=True)
    category_id = Column(Integer, ForeignKey('categories.id'))
    name = Column(String)
    start_datetime = Column(DateTime)
    number_of_waves = Column(Integer)
    duration = Column(Integer)
    additional_info = Column(String)

    # relationships
    scores = relationship('Score', backref='heat', cascade='all, delete-orphan')
    results = relationship('Result', backref='heat', cascade='all, delete-orphan')
    judges = relationship('Judge', secondary='judge_activities', backref='heats') # deletion of judge_activites happens automatically since this here, there is no viewonly

    participants = relationship('Surfer', secondary='participants', backref='heats', viewonly=True) # only here for convenience; participations need to be added directly to the corresponding table (because heat participation has more data in assosiation table)
    participations =  relationship('Participation', cascade='all, delete-orphan') # make sure, participations are deleted on heat deletion (viewonly secondary relationship cannot do that)


    # category: backref from Category

    advances_from_heat = relationship('HeatAdvancement', foreign_keys='HeatAdvancement.to_heat_id', cascade='all, delete-orphan')
    advances_to_heat = relationship('HeatAdvancement', foreign_keys='HeatAdvancement.from_heat_id', cascade='all, delete-orphan')


class HeatAdvancement(meta.Base):
    __tablename__ = 'heat_advancements'

    to_heat_id = Column(Integer, ForeignKey('heats.id'), primary_key=True)
    seed = Column(Integer, primary_key=True)

    from_heat_id = Column(Integer, ForeignKey('heats.id'))
    from_place = Column(Integer)
