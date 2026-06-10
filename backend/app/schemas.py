from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime


class UserOut(BaseModel):
    username: str
    name: str
    role: str


class OrderCreate(BaseModel):
    title: str
    owner_name: Optional[str] = None
    owner_phone: Optional[str] = None
    address: Optional[str] = None
    repair_type: Optional[str] = None
    description: Optional[str] = None
    priority: str = "normal"
    source_module: str = "owner_report"
    deadline: Optional[str] = None


class OrderCorrection(BaseModel):
    title: Optional[str] = None
    owner_name: Optional[str] = None
    owner_phone: Optional[str] = None
    address: Optional[str] = None
    repair_type: Optional[str] = None
    description: Optional[str] = None
    priority: Optional[str] = None
    deadline: Optional[str] = None
    version: int
    correction_opinion: Optional[str] = None


class OrderAction(BaseModel):
    action: str
    version: int
    opinion: Optional[str] = None
    target_handler: Optional[str] = None


class BatchAction(BaseModel):
    action: str
    order_ids: List[int]
    opinion: Optional[str] = None


class OrderOut(BaseModel):
    id: int
    order_no: str
    title: str
    owner_name: Optional[str]
    owner_phone: Optional[str]
    address: Optional[str]
    repair_type: Optional[str]
    description: Optional[str]
    status: str
    priority: str
    current_handler: Optional[str]
    current_handler_role: Optional[str]
    deadline: Optional[str]
    source_module: str
    version: int
    created_by: Optional[str]
    created_by_role: Optional[str]
    created_at: str
    updated_at: str
    last_opinion: Optional[str]
    is_overdue: int
    is_near_deadline: int
    evidence_required: int


class ProcessingRecordOut(BaseModel):
    id: int
    order_id: int
    action: str
    from_status: Optional[str]
    to_status: Optional[str]
    handler: str
    handler_role: str
    opinion: Optional[str]
    evidence_provided: int
    version: int
    created_at: str


class AttachmentOut(BaseModel):
    id: int
    order_id: int
    file_name: str
    file_path: Optional[str] = None
    uploaded_by: Optional[str]
    uploaded_by_role: Optional[str]
    uploaded_at: str


class AuditNoteOut(BaseModel):
    id: int
    order_id: int
    note_type: str
    content: str
    operator: Optional[str]
    operator_role: Optional[str]
    created_at: str


class ExceptionReasonOut(BaseModel):
    id: int
    order_id: int
    reason_code: str
    reason_text: str
    field_name: Optional[str]
    detected_by: Optional[str]
    detected_by_role: Optional[str]
    resolved: int
    resolved_by: Optional[str]
    resolved_at: Optional[str]
    created_at: str


class BatchResultItem(BaseModel):
    order_id: int
    order_no: str
    success: bool
    message: str
    error_code: Optional[str] = None


class BatchResult(BaseModel):
    total: int
    success_count: int
    failed_count: int
    items: List[BatchResultItem]
