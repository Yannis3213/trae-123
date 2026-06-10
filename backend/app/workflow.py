from datetime import datetime, timedelta
from typing import Optional

STAGES = {
    "customer_manager": "客户经理",
    "trade_specialist": "交易专员",
    "risk_manager": "风控经理",
    "completed": "已完成",
    "closed": "已关闭",
}

STATUS_FLOW = {
    "待提交": {
        "submit": "待审核",
        "return": "已退回",
    },
    "待审核": {
        "approve": "待复核",
        "reject": "已退回",
    },
    "待复核": {
        "finalize": "已完成",
        "reject": "重新提交",
    },
    "已退回": {
        "resubmit": "待审核",
        "return": "已退回",
    },
    "重新提交": {
        "submit": "待复核",
        "return": "重新提交",
    },
    "已完成": {},
}

STAGE_STATUS_ALLOWED = {
    "customer_manager": ["待提交", "已退回", "重新提交"],
    "trade_specialist": ["待审核"],
    "risk_manager": ["待复核"],
}

REQUIRED_EVIDENCE = {
    "customer_manager": {
        "submit": ["contract_scan", "customer_authorization"],
        "resubmit": ["supplementary_material"],
    },
    "trade_specialist": {
        "approve": ["trade_confirmation", "price_check_report"],
    },
    "risk_manager": {
        "finalize": ["risk_assessment", "compliance_check"],
    },
}

REQUIRED_CUSTOMER_FIELDS = ["customer_name", "contact_person", "contact_phone", "address", "voltage_level"]
REQUIRED_PRICING_FIELDS = ["base_price", "contract_term_months"]


class WorkflowException(Exception):
    def __init__(self, message: str, code: str, exc_type: str = "状态问题", detail: Optional[dict] = None):
        super().__init__(message)
        self.code = code
        self.exc_type = exc_type
        self.detail = detail or {}


def check_role_access(role: str, stage: str, action: str) -> None:
    role_stage_map = {
        "customer_manager": "customer_manager",
        "trade_specialist": "trade_specialist",
        "risk_manager": "risk_manager",
    }
    required_stage = role_stage_map.get(role)
    if not required_stage:
        raise WorkflowException("角色不存在或无任何流程权限", "E_ROLE_UNKNOWN", "权限问题")
    if stage != required_stage:
        raise WorkflowException(
            f"当前角色为{role}，不能在{STAGES.get(stage, stage)}环节操作",
            "E_ROLE_STAGE_MISMATCH",
            "权限问题",
        )


def check_status_transition(status: str, action: str) -> tuple[str, str]:
    transitions = STATUS_FLOW.get(status, {})
    if action not in transitions:
        raise WorkflowException(
            f"状态[{status}]不允许动作[{action}]",
            "E_STATUS_ACTION_INVALID",
            "状态问题",
        )
    return status, transitions[action]


def check_handler_match(user_id: int, current_handler_id: Optional[int]) -> None:
    if current_handler_id and current_handler_id != user_id:
        raise WorkflowException(
            "当前处理人与登录用户不一致，越权操作已拦截",
            "E_HANDLER_MISMATCH",
            "权限问题",
        )


def check_version(submitted_version: int, current_version: int) -> None:
    if submitted_version < current_version:
        raise WorkflowException(
            f"提交的版本{submitted_version}已过期（当前版本{current_version}），请刷新后重试",
            "E_VERSION_OLD",
            "状态问题",
        )
    if submitted_version > current_version:
        raise WorkflowException(
            f"提交版本异常：请求版本{submitted_version}高于当前版本{current_version}",
            "E_VERSION_AHEAD",
            "状态问题",
        )


def check_evidence(stage: str, action: str, evidence: Optional[dict]) -> None:
    req = REQUIRED_EVIDENCE.get(stage, {}).get(action)
    if not req:
        return
    evidence = evidence or {}
    missing = [k for k in req if not evidence.get(k)]
    if missing:
        raise WorkflowException(
            f"缺少必填证据：{', '.join(missing)}",
            "E_EVIDENCE_MISSING",
            "材料问题",
            {"missing_evidence": missing},
        )


def check_customer_complete(customer: dict) -> list[str]:
    missing = [f for f in REQUIRED_CUSTOMER_FIELDS if not customer.get(f)]
    return missing


def check_pricing_complete(pricing: Optional[dict]) -> list[str]:
    if not pricing:
        return ["报价测算未关联"]
    missing = [f for f in REQUIRED_PRICING_FIELDS if pricing.get(f) in (None, "")]
    return missing


def check_deadline(deadline_str: str) -> tuple[str, int]:
    try:
        deadline = datetime.strptime(deadline_str, "%Y-%m-%d").date()
    except ValueError:
        return "unknown", 0
    today = datetime.now().date()
    delta = (deadline - today).days
    if delta < 0:
        return "overdue", -delta
    if delta <= 3:
        return "warning", delta
    return "normal", delta


def check_deadline_not_overdue(deadline_str: str, strict: bool = False) -> None:
    level, days = check_deadline(deadline_str)
    if level == "overdue":
        raise WorkflowException(
            f"合同单已逾期 {days} 天，按时限问题拦截，请先处理到期预警",
            "E_DEADLINE_OVERDUE",
            "时限问题",
            {"overdue_days": days},
        )
    if strict and level == "warning":
        raise WorkflowException(
            f"合同单将在 {days} 天内到期（临期），请确认后再推进",
            "E_DEADLINE_WARNING",
            "时限问题",
            {"remaining_days": days},
        )


def next_stage_and_status(action: str, from_status: str) -> tuple[str, str]:
    from_status, to_status = check_status_transition(from_status, action)
    stage = next_stage_after(action, to_status)
    return stage, to_status


def next_stage_after(action: str, to_status: str) -> str:
    if to_status == "待审核":
        return "trade_specialist"
    if to_status == "待复核":
        return "risk_manager"
    if to_status == "已完成":
        return "completed"
    if to_status == "已退回":
        return "customer_manager"
    if to_status == "重新提交":
        return "customer_manager"
    return "customer_manager"
