class Roles:
    REGISTRAR = "registrar"
    AUDIT_SUPERVISOR = "audit_supervisor"
    REVIEW_LEADER = "review_leader"

    ROLE_NAMES = {
        REGISTRAR: "展商登记员",
        AUDIT_SUPERVISOR: "展商审核主管",
        REVIEW_LEADER: "展会主办方复核负责人"
    }

    QUEUES = {
        REGISTRAR: "material_supplement",
        AUDIT_SUPERVISOR: "construction_audit",
        REVIEW_LEADER: "project_closure"
    }

    QUEUE_NAMES = {
        "material_supplement": "展商服务补齐材料",
        "construction_audit": "搭建审核办理",
        "project_closure": "项目负责人收口"
    }


class ApplicationStatus:
    DRAFT = "draft"
    PENDING_SUBMIT = "pending_submit"
    PENDING_AUDIT = "pending_audit"
    PENDING_REVIEW = "pending_review"
    PENDING_BOOTH_CONFIRM = "pending_booth_confirm"
    CORRECTION_REQUIRED = "correction_required"
    REJECTED = "rejected"
    AUDIT_PASSED = "audit_passed"
    BOOTH_CONFIRMED = "booth_confirmed"
    ARCHIVED = "archived"
    SYNCED = "synced"

    STATUS_NAMES = {
        DRAFT: "草稿",
        PENDING_SUBMIT: "待提交",
        PENDING_AUDIT: "待审核",
        PENDING_REVIEW: "待复核",
        PENDING_BOOTH_CONFIRM: "待展位确认",
        CORRECTION_REQUIRED: "需补正",
        REJECTED: "已拒绝",
        AUDIT_PASSED: "审核通过",
        BOOTH_CONFIRMED: "展位已确认",
        ARCHIVED: "已归档",
        SYNCED: "已同步"
    }

    STAT_GROUPS = {
        "pending": [PENDING_AUDIT, PENDING_REVIEW, PENDING_BOOTH_CONFIRM, CORRECTION_REQUIRED],
        "passed": [AUDIT_PASSED, BOOTH_CONFIRMED, ARCHIVED],
        "synced": [SYNCED]
    }

    GROUP_NAMES = {
        "pending": "待审核",
        "passed": "审核通过",
        "synced": "已同步"
    }


class WarningLevel:
    NORMAL = "normal"
    APPROACHING = "approaching"
    OVERDUE = "overdue"

    LEVEL_NAMES = {
        NORMAL: "正常",
        APPROACHING: "临期",
        OVERDUE: "逾期"
    }


class SyncStatus:
    PENDING = "pending"
    SYNCED = "synced"
    FAILED = "failed"


class Actions:
    SUBMIT = "submit"
    CORRECT = "correct"
    APPROVE_AUDIT = "approve_audit"
    REJECT_AUDIT = "reject_audit"
    RETURN_FOR_CORRECTION = "return_for_correction"
    APPROVE_REVIEW = "approve_review"
    CONFIRM_BOOTH = "confirm_booth"
    ARCHIVE = "archive"
    SYNC = "sync"
    ADD_NOTE = "add_note"
