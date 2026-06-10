from enum import Enum


class Role(str, Enum):
    REGISTRAR = "registrar"
    SUPERVISOR = "supervisor"
    REVIEWER = "reviewer"


ROLE_NAMES = {
    Role.REGISTRAR: "报修登记员",
    Role.SUPERVISOR: "报修审核主管",
    Role.REVIEWER: "物业服务中心复核负责人",
}

ROLE_HANDLER_RESPONSIBILITY = {
    Role.REGISTRAR: "客服管家（初始队列）",
    Role.SUPERVISOR: "维修主管（处理中段）",
    Role.REVIEWER: "项目经理（最终意见）",
}


class OrderStatus(str, Enum):
    PENDING_DISPATCH = "pending_dispatch"
    DISPATCHED = "dispatched"
    IN_PROGRESS = "in_progress"
    TRANSFERRED = "transferred"
    RETURNED_FOR_CORRECTION = "returned_for_correction"
    CORRECTED = "corrected"
    COMPLETED = "completed"
    VISITED = "visited"
    REVIEWING = "reviewing"
    ARCHIVED = "archived"


STATUS_NAMES = {
    OrderStatus.PENDING_DISPATCH: "待分派",
    OrderStatus.DISPATCHED: "已派单",
    OrderStatus.IN_PROGRESS: "处理中",
    OrderStatus.TRANSFERRED: "已转办",
    OrderStatus.RETURNED_FOR_CORRECTION: "退回补正",
    OrderStatus.CORRECTED: "已补正",
    OrderStatus.COMPLETED: "已完成",
    OrderStatus.VISITED: "已回访",
    OrderStatus.REVIEWING: "复核中",
    OrderStatus.ARCHIVED: "已归档",
}

STATUS_LIST_GROUPS = {
    "待分派": [OrderStatus.PENDING_DISPATCH, OrderStatus.RETURNED_FOR_CORRECTION],
    "已转办": [OrderStatus.DISPATCHED, OrderStatus.IN_PROGRESS, OrderStatus.TRANSFERRED, OrderStatus.CORRECTED],
    "已回访": [OrderStatus.COMPLETED, OrderStatus.VISITED, OrderStatus.REVIEWING, OrderStatus.ARCHIVED],
}


class SourceModule(str, Enum):
    OWNER_REPORT = "owner_report"
    DISPATCH = "dispatch"
    REGISTRATION = "registration"


SOURCE_MODULE_NAMES = {
    SourceModule.OWNER_REPORT: "业主报修",
    SourceModule.DISPATCH: "维修派单",
    SourceModule.REGISTRATION: "报修工单登记",
}


class Action(str, Enum):
    CREATE = "create"
    DISPATCH = "dispatch"
    START_PROCESS = "start_process"
    TRANSFER = "transfer"
    COMPLETE = "complete"
    RETURN_FOR_CORRECTION = "return_for_correction"
    CORRECT = "correct"
    VISIT = "visit"
    SUBMIT_REVIEW = "submit_review"
    REVIEW_APPROVE = "review_approve"
    REVIEW_REJECT = "review_reject"
    ARCHIVE = "archive"
    BATCH_PROCESS = "batch_process"
    UPLOAD_ATTACHMENT = "upload_attachment"


ACTION_NAMES = {
    Action.CREATE: "创建工单",
    Action.DISPATCH: "派单",
    Action.START_PROCESS: "开始处理",
    Action.TRANSFER: "转办",
    Action.COMPLETE: "完成维修",
    Action.RETURN_FOR_CORRECTION: "退回补正",
    Action.CORRECT: "补正",
    Action.VISIT: "回访确认",
    Action.SUBMIT_REVIEW: "提交复核",
    Action.REVIEW_APPROVE: "复核通过",
    Action.REVIEW_REJECT: "复核驳回",
    Action.ARCHIVE: "归档",
    Action.BATCH_PROCESS: "批量处理",
    Action.UPLOAD_ATTACHMENT: "上传附件",
}


class ExceptionCode(str, Enum):
    MISSING_OWNER_INFO = "missing_owner_info"
    MISSING_ADDRESS = "missing_address"
    MISSING_DESCRIPTION = "missing_description"
    MISSING_EVIDENCE = "missing_evidence"
    OVERDUE = "overdue"
    STATUS_CONFLICT = "status_conflict"
    DUPLICATE_SUBMIT = "duplicate_submit"
    VERSION_CONFLICT = "version_conflict"
    ROLE_VIOLATION = "role_violation"
    INVALID_TRANSITION = "invalid_transition"
    ATTACHMENT_BLOCKED = "attachment_blocked"


EXCEPTION_NAMES = {
    ExceptionCode.MISSING_OWNER_INFO: "缺少业主信息",
    ExceptionCode.MISSING_ADDRESS: "缺少地址信息",
    ExceptionCode.MISSING_DESCRIPTION: "缺少报修描述",
    ExceptionCode.MISSING_EVIDENCE: "缺少必要证据",
    ExceptionCode.OVERDUE: "已超期",
    ExceptionCode.STATUS_CONFLICT: "状态冲突",
    ExceptionCode.DUPLICATE_SUBMIT: "重复提交",
    ExceptionCode.VERSION_CONFLICT: "版本冲突（数据已被修改）",
    ExceptionCode.ROLE_VIOLATION: "越权操作",
    ExceptionCode.INVALID_TRANSITION: "非法状态流转",
    ExceptionCode.ATTACHMENT_BLOCKED: "附件上传被拦截",
}


ROLE_ALLOWED_ACTIONS = {
    Role.REGISTRAR: {
        Action.CREATE,
        Action.CORRECT,
        Action.DISPATCH,
        Action.SUBMIT_REVIEW,
        Action.UPLOAD_ATTACHMENT,
    },
    Role.SUPERVISOR: {
        Action.START_PROCESS,
        Action.TRANSFER,
        Action.RETURN_FOR_CORRECTION,
        Action.COMPLETE,
        Action.VISIT,
        Action.UPLOAD_ATTACHMENT,
    },
    Role.REVIEWER: {
        Action.REVIEW_APPROVE,
        Action.REVIEW_REJECT,
        Action.ARCHIVE,
        Action.UPLOAD_ATTACHMENT,
    },
}


STATUS_TRANSITIONS = {
    OrderStatus.PENDING_DISPATCH: [OrderStatus.DISPATCHED, OrderStatus.RETURNED_FOR_CORRECTION],
    OrderStatus.DISPATCHED: [OrderStatus.IN_PROGRESS, OrderStatus.TRANSFERRED, OrderStatus.RETURNED_FOR_CORRECTION],
    OrderStatus.IN_PROGRESS: [OrderStatus.TRANSFERRED, OrderStatus.COMPLETED, OrderStatus.RETURNED_FOR_CORRECTION],
    OrderStatus.TRANSFERRED: [OrderStatus.IN_PROGRESS, OrderStatus.RETURNED_FOR_CORRECTION],
    OrderStatus.RETURNED_FOR_CORRECTION: [OrderStatus.CORRECTED, OrderStatus.PENDING_DISPATCH],
    OrderStatus.CORRECTED: [OrderStatus.DISPATCHED, OrderStatus.IN_PROGRESS],
    OrderStatus.COMPLETED: [OrderStatus.VISITED, OrderStatus.RETURNED_FOR_CORRECTION],
    OrderStatus.VISITED: [OrderStatus.REVIEWING, OrderStatus.RETURNED_FOR_CORRECTION],
    OrderStatus.REVIEWING: [OrderStatus.ARCHIVED, OrderStatus.RETURNED_FOR_CORRECTION],
    OrderStatus.ARCHIVED: [],
}


REQUIRED_EVIDENCE_STATUSES = {
    OrderStatus.COMPLETED,
    OrderStatus.VISITED,
    OrderStatus.ARCHIVED,
}
