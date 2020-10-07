# -*- coding: utf-8 -*-
"""
    Copyright (c) 2018 Dario Götz and Jörg Christian Reiher.
    All rights reserved.
"""
import enum

from sqlalchemy import Column, String, Integer, Float, Boolean, JSON, ForeignKey, DateTime, Date, Time, Enum, ForeignKeyConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.ext import declarative

from . import meta


import sqlalchemy.types as types
import json


class StringyJSON(types.TypeDecorator):
    """Stores and retrieves JSON as TEXT."""

    impl = types.TEXT

    def process_bind_param(self, value, dialect):
        if value is not None:
            value = json.dumps(value)
        return value

    def process_result_value(self, value, dialect):
        if value is not None:
            value = json.loads(value)
        return value


# TypeEngine.with_variant says "use StringyJSON instead when
# connecting to 'sqlite'"
MagicJSON = types.JSON().with_variant(StringyJSON, 'sqlite')


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

    # A score belongs to a triple of surfer, judge and heat, but only if the necessary
    # judge assignment and participations are _available
    # Therefore, the following foreign key constraints are put here.
    __table_args__ = (ForeignKeyConstraint(
        ['surfer_id', 'heat_id'],
        ['participations.surfer_id', 'participations.heat_id'],
        ondelete='CASCADE', onupdate='CASCADE'
    ), ForeignKeyConstraint(
        ['judge_id', 'heat_id'],
        ['judge_assignments.judge_id', 'judge_assignments.heat_id'],
        ondelete='CASCADE', onupdate='CASCADE'
    ),)

    wave = Column(Integer, primary_key=True, nullable=False)
    score = Column(Float, nullable=False)
    interference = Column(Boolean)
    missed = Column(Boolean)

    # primary key is made up from surfer, judge, heat and wave
    surfer_id = Column(Integer, ForeignKey('surfers.id'), primary_key=True, nullable=False)
    judge_id = Column(Integer, ForeignKey('users.id'), primary_key=True, nullable=False)
    heat_id = Column(Integer, ForeignKey('heats.id'), primary_key=True, nullable=False)
    additional_info = Column(String)

    # relationships
    # surfer: backref from Surfer
    # judge: backref from Users
    # heat: backref from Heat


class Surfer(meta.Base):
    __tablename__ = 'surfers'

    id = Column(Integer, primary_key=True, nullable=False)
    first_name = Column(String, nullable=False)
    last_name = Column(String, nullable=False)
    country = Column(String)
    additional_info = Column(String)

    # relationships
    scores = relationship('Score', backref='surfer', cascade='all, delete-orphan')
    results = relationship('Result', backref='surfer', cascade='all, delete-orphan')

    # heats: backref from Heat via secondary Participation
    # heats = relationship('Heat', secondary='participations')

    participations = relationship('Participation', backref='surfer', cascade='all, delete-orphan') # make sure, participations are deleted on surfer deletion (viewonly secondary relationship cannot do that)


class JudgeAssignment(meta.Base):
    __tablename__ = 'judge_assignments'

    judge_id = Column(Integer, ForeignKey('users.id'), primary_key=True, nullable=False)
    heat_id = Column(Integer, ForeignKey('heats.id'), primary_key=True, nullable=False)

    # relationships
    # heat: backref from Heat
    # judge: backref from JudgeAssignment


class Participation(meta.Base):
    __tablename__ = 'participations'

    surfer_id = Column(Integer, ForeignKey('surfers.id'), primary_key=True, nullable=False)
    heat_id = Column(Integer, ForeignKey('heats.id'), primary_key=True, nullable=False)
    lycra_color_id = Column(Integer, ForeignKey('lycra_colors.id'), nullable=False)
    seed = Column(Integer, nullable=False)

    # relationships
    # heat: backref from Heat
    # surfer: backref from Surfer
    # lycra_color: backref from LycraColor


class Result(meta.Base):
    __tablename__ = 'results'

    heat_id = Column(Integer, ForeignKey('heats.id'), primary_key=True, nullable=False)
    surfer_id = Column(Integer, ForeignKey('surfers.id'), primary_key=True, nullable=False)
    total_score = Column(Float, nullable=False)
    place = Column(Integer, nullable=False)
    wave_scores = Column(MagicJSON, nullable=False)

    # relationships
    # heat: backref from Heat
    # surfer: backref from Surfer


class Tournament(meta.Base):
    __tablename__ = 'tournaments'

    id = Column(Integer, primary_key=True, nullable=False)
    name = Column(String, nullable=False)
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False)
    additional_info = Column(String)

    # relationships
    categories = relationship('Category', backref='tournament', cascade='all, delete-orphan')


class Category(meta.Base):
    __tablename__ = 'categories'

    id = Column(Integer, primary_key=True, nullable=False)
    tournament_id = Column(Integer, ForeignKey('tournaments.id'), nullable=False)
    name = Column(String, nullable=False)
    additional_info = Column(String)

    # relationships
    heats = relationship('Heat', backref='category', cascade='all, delete-orphan')

    # tournament: backref from Tournament


# the enum is subclassed of str so that JSON encoding of its values works
class HeatType(str, enum.Enum):
    standard = 'standard'
    call = 'call'

class Heat(meta.Base):
    __tablename__ = 'heats'

    id = Column(Integer, primary_key=True, nullable=False)
    category_id = Column(Integer, ForeignKey('categories.id'), nullable=False)
    name = Column(String, nullable=False)
    round = Column(Integer, nullable=False)
    number_in_round = Column(Integer, nullable=False)
    start_datetime = Column(DateTime, nullable=False)
    number_of_waves = Column(Integer, nullable=False)
    duration = Column(Float, nullable=False)
    heat_type = Column(Enum(HeatType), nullable=False)
    additional_info = Column(String)

    # relationships
    # primary
    scores = relationship('Score', backref='heat', cascade='all, delete-orphan')
    results = relationship('Result', backref='heat', cascade='all, delete-orphan')

    participations =  relationship('Participation', backref='heat', cascade='all, delete-orphan') # make sure, participations are deleted on heat deletion (viewonly secondary relationship cannot do that)
    judge_assignments = relationship('JudgeAssignment', backref='heat', cascade='all, delete-orphan') # make sure, judge_assignments are deleted on heat deletion (viewonly secondary relationship cannot do that)

    advances_from_heat = relationship('HeatAdvancement', foreign_keys='HeatAdvancement.to_heat_id', cascade='all, delete-orphan', backref='to_heat')
    advances_to_heat = relationship('HeatAdvancement', foreign_keys='HeatAdvancement.from_heat_id', cascade='all, delete-orphan', backref='from_heat')

    # secondary
    judges = relationship('User', secondary='judge_assignments', backref='heats') # deletion of judge_assigments happens automatically since this here, there is no viewonly

    participants = relationship('Surfer', secondary='participations', backref='heats', viewonly=True) # only here for convenience; participations need to be added directly to the corresponding table (because heat participation has more data in assosiation table)

    # category: backref from Category


class HeatAdvancement(meta.Base):
    __tablename__ = 'heat_advancements'

    to_heat_id = Column(Integer, ForeignKey('heats.id'), primary_key=True, nullable=False)
    seed = Column(Integer, primary_key=True, nullable=False)

    from_heat_id = Column(Integer, ForeignKey('heats.id'), nullable=False)
    place = Column(Integer, nullable=False)


class LycraColor(meta.Base):
    __tablename__ = 'lycra_colors'

    id = Column(Integer, primary_key=True, nullable=False)
    seed = Column(Integer, nullable=False)
    name = Column(String, nullable=False)
    hex = Column(String, nullable=False)

    participations = relationship('Participation', backref='lycra_color', cascade='all, delete-orphan')


class HeatStateType(str, enum.Enum):
    active = 'active'
    paused = 'paused'

class HeatState(meta.Base):
    __tablename__ = 'heat_state'

    # autoincrement is set to True because nullable is false and it is a primary key
    # it actually is supposed to hold values from heats.id
    heat_id = Column(Integer, ForeignKey('heats.id'), primary_key=True, nullable=False, autoincrement=True)
    start_datetime = Column(DateTime)
    end_datetime = Column(DateTime)
    pause_datetime = Column(DateTime)
    remaining_time_s = Column(Float)
    state = Column(Enum(HeatStateType))
    duration_m = Column(Float)
    additional_data = Column(String)


class User(meta.Base):
    __tablename__ = 'users'

    id = Column(Integer, primary_key=True, nullable=False, autoincrement=True)
    username = Column(String, nullable=False)
    password_hash = Column(String, nullable=False)

    first_name = Column(String)
    last_name = Column(String)
    additional_info = Column(String)

    # relationships
    scores = relationship('Score', backref='judge', cascade='all') # no delete-orphan; if a judge is removed, the scores should remain

    assignments = relationship('JudgeAssignment', backref='judge', cascade='all, delete-orphan')

    # heats: backref from Heat via secondary JudgeAssignment
    # heats = relationship('Heat', secondary='judge_assignments')

    permissions = relationship('Permission', backref='user', cascade='all, delete-orphan')


class PermissionType(str, enum.Enum):
    ac_judge = 'ac_judge'
    ac_commentator = 'ac_commentator'
    ac_admin = 'ac_admin'

class Permission(meta.Base):
    __tablename__ = 'permissions'

    id = Column(Integer, primary_key=True, nullable=False)
    user_id = Column(Integer, ForeignKey('users.id'))
    permission = Column(Enum(PermissionType))

class JudgingRequest(meta.Base):
    __tablename__ = 'judging_requests'

    judge_id = Column(Integer, ForeignKey('users.id'), primary_key=True, nullable=False)
    expire_date = Column(DateTime, nullable=False)
