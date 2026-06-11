REPAIR_ORDER_CREATE_FIELDS = [
    "title", "description", "enterprise_name", "contact_person",
    "contact_phone", "category", "urgency", "deadline",
    "created_by", "created_by_role",
]

REPAIR_ORDER_UPDATE_FIELDS = [
    "title", "description", "enterprise_name", "contact_person",
    "contact_phone", "category", "urgency", "deadline",
]

CATEGORY_MAP = {
    "electrical": "电气",
    "plumbing": "管道",
    "hvac": "空调",
    "elevator": "电梯",
    "fire": "消防",
    "decoration": "装修",
    "other": "其他",
}

STATUS_ACTION_MAP = {
    "pending_submit": "submit",
    "pending_process": "process",
    "processing": "verify",
    "pending_review": "review",
    "pending_archive": "archive",
}

STATUS_LABELS = {
    "pending_submit": "待提交",
    "pending_process": "待处理",
    "processing": "处理中",
    "pending_verify": "待核验",
    "pending_review": "待复核",
    "pending_archive": "待归档",
    "archived": "已归档",
    "returned": "已退回",
    "resubmitted": "重新提交",
}

VALID_STATUSES = set(STATUS_LABELS.keys())

ROLE_LABELS = {
    "enterprise_service": "企业客服",
    "engineering_supervisor": "工程主管",
    "park_manager": "园区经理",
}

VALID_ROLES = set(ROLE_LABELS.keys())

DEADLINE_GROUPS = {"normal", "approaching", "overdue"}

DISPATCH_STATUS_MAP = {
    "pending_submit": "未派单",
    "pending_process": "未派单",
    "processing": "已派单",
    "pending_verify": "已派单",
    "pending_review": "已完成",
    "pending_archive": "已完成",
    "archived": "已完成",
    "returned": "未派单",
    "resubmitted": "未派单",
}

CONFIRMATION_STATUS_MAP = {
    "pending_submit": "未确认",
    "pending_process": "未确认",
    "processing": "未确认",
    "pending_verify": "未确认",
    "pending_review": "未确认",
    "pending_archive": "未确认",
    "archived": "已确认",
    "returned": "未确认",
    "resubmitted": "未确认",
}
