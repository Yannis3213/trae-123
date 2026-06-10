import os
from datetime import timedelta

BASE_DIR = os.path.abspath(os.path.dirname(__file__))


class Config:
    SQLALCHEMY_DATABASE_URI = 'sqlite:///' + os.path.join(BASE_DIR, '..', 'team_booking.db')
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SECRET_KEY = os.environ.get('SECRET_KEY', 'dev-secret-key-change-in-production')

    BACKEND_PORT = int(os.environ.get('BACKEND_PORT', 5000))
    FRONTEND_PORT = int(os.environ.get('FRONTEND_PORT', 5173))

    PROCESSING_DEADLINE_HOURS = 24
    APPROACHING_DEADLINE_HOURS = 4

    ROLE_PERMISSIONS = {
        'dispatcher': ['view', 'submit_booking', 'process', 'batch_process', 'return'],
        'ticketing': ['view', 'verify_ticket', 'process'],
        'manager': ['view', 'review', 'archive', 'return']
    }

    STATUS_FLOW = {
        '待审核': ['审核通过', '退回补正'],
        '审核通过': ['已同步', '退回补正'],
        '退回补正': ['待审核'],
        '已同步': []
    }

    ROLE_STATUS_MAP = {
        'dispatcher': {
            'process': '待审核',
            'next': '审核通过'
        },
        'ticketing': {
            'process': '待审核',
            'next': '审核通过'
        },
        'manager': {
            'process': '审核通过',
            'next': '已同步'
        }
    }

    REQUIRED_MODULES = ['team_booking_info', 'ticket_verification', 'entry_statistics']
