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

    ROLE_LABEL = {
        'dispatcher': '现场调度',
        'ticketing': '票务专员',
        'manager': '景区经理',
        'archived': '已归档',
        'system': '系统'
    }

    ROLE_PERMISSIONS = {
        'dispatcher': ['view', 'submit_booking', 'process', 'batch_process', 'return', 'resubmit',
                       'update_booking_info', 'update_ticket', 'update_entry'],
        'ticketing': ['view', 'verify_ticket', 'process', 'update_ticket'],
        'manager': ['view', 'review', 'archive', 'return', 'batch_process', 'advance_overdue']
    }

    STATUS_FLOW = {
        '待审核': ['审核通过', '退回补正'],
        '审核通过': ['已同步', '退回补正'],
        '退回补正': ['待审核'],
        '已同步': []
    }

    ROLE_STATUS_MAP = {
        'dispatcher': {'process': '待审核', 'next': '审核通过'},
        'ticketing': {'process': '待审核', 'next': '审核通过'},
        'manager': {'process': '审核通过', 'next': '已同步'}
    }

    HANDLER_ROLE_MAP = {
        'dispatcher': '现场调度',
        'ticketing': '票务专员',
        'manager': '景区经理',
        'archived': '已归档'
    }

    MODULES = {
        'team_booking_info': {
            'label': '团队预约',
            'owner_role': 'dispatcher',
            'owner_label': '现场调度'
        },
        'ticket_verification': {
            'label': '票务核销',
            'owner_role': 'ticketing',
            'owner_label': '票务专员'
        },
        'entry_statistics': {
            'label': '入园统计',
            'owner_role': 'dispatcher',
            'owner_label': '现场调度'
        }
    }

    REQUIRED_MODULE_KEYS = ['team_booking_info', 'ticket_verification', 'entry_statistics']

    ERROR_CODES = {
        'MISSING_ROLE': 'MISSING_ROLE',
        'PERMISSION_DENIED': 'PERMISSION_DENIED',
        'NOT_FOUND': 'NOT_FOUND',
        'VERSION_CONFLICT': 'VERSION_CONFLICT',
        'STATUS_CONFLICT': 'STATUS_CONFLICT',
        'WRONG_HANDLER': 'WRONG_HANDLER',
        'MISSING_MODULES': 'MISSING_MODULES',
        'INVALID_ACTION': 'INVALID_ACTION',
        'EMPTY_IDS': 'EMPTY_IDS',
        'INVALID_MODULE': 'INVALID_MODULE',
        'MISSING_FIELDS': 'MISSING_FIELDS',
        'EMPTY_NOTE': 'EMPTY_NOTE',
        'DUPLICATE_ACTION': 'DUPLICATE_ACTION'
    }
