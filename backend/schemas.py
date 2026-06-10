from datetime import date
from pydantic import BaseModel, Field
from typing import Optional, List


class LoginRequest(BaseModel):
    username: str
    password: str


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: dict


class ApplicationListItem(BaseModel):
    id: int
    application_no: str
    customer_name: str
    account_type: str
    status: str
    current_handler: Optional[str]
    customer_manager: str
    due_date: str
    due_status: str
    branch: str
    version: int
    created_at: str


class ApplicationDetail(BaseModel):
    id: int
    application_no: str
    customer_name: str
    id_card_no: str
    phone: str
    address: Optional[str]
    account_type: str
    amount: float
    status: str
    current_handler: Optional[str]
    current_role: Optional[str]
    customer_manager: str
    branch: str
    version: int
    due_date: str
    due_status: str
    created_at: str
    updated_at: str


class ProcessRequest(BaseModel):
    action: str
    remark: Optional[str] = ""
    evidence: Optional[str] = ""
    version: int
    exception_reason: Optional[str] = ""
    exception_type: Optional[str] = ""


class BatchProcessItem(BaseModel):
    application_id: int
    version: int


class BatchProcessRequest(BaseModel):
    action: str
    items: List[BatchProcessItem]
    remark: Optional[str] = ""
    evidence: Optional[str] = ""


class BatchResultItem(BaseModel):
    application_id: int
    application_no: str
    success: bool
    message: str
    new_status: Optional[str] = None


class ProcessingRecord(BaseModel):
    id: int
    action: str
    from_status: Optional[str]
    to_status: Optional[str]
    operator: str
    operator_role: str
    remark: Optional[str]
    evidence_required: Optional[str]
    evidence_provided: Optional[str]
    version_before: Optional[int]
    version_after: Optional[int]
    created_at: str


class ExceptionReason(BaseModel):
    id: int
    reason_type: str
    description: str
    reported_by: str
    reported_by_role: str
    is_resolved: bool
    resolved_by: Optional[str]
    resolved_at: Optional[str]
    created_at: str


class AuditNote(BaseModel):
    id: int
    note: str
    noted_by: str
    noted_by_role: str
    created_at: str


class StatsResponse(BaseModel):
    total: int
    pending: int
    normal: int
    approaching: int
    overdue: int
    exception: int
    completed: int
