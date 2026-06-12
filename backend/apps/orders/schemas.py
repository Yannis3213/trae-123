from datetime import datetime
from typing import Optional, List, Any
from pydantic import BaseModel, Field


class RoleInfo(BaseModel):
    code: str
    name: str


class OrderListQuery(BaseModel):
    status: Optional[str] = None
    stage: Optional[str] = None
    priority: Optional[str] = None
    warning_level: Optional[str] = None
    keyword: Optional[str] = None
    is_exception: Optional[bool] = None


class OrderCreate(BaseModel):
    customer_name: str = Field(..., min_length=1, max_length=200)
    product_name: str = Field(..., min_length=1, max_length=200)
    quantity: float = 0
    amount: float = 0
    country: str = ''
    inquiry_content: str = ''
    priority: str = 'medium'
    responsible_person: str = ''
    due_time: Optional[datetime] = None


class OrderUpdate(BaseModel):
    version: int
    customer_name: Optional[str] = None
    product_name: Optional[str] = None
    quantity: Optional[float] = None
    amount: Optional[float] = None
    country: Optional[str] = None
    inquiry_content: Optional[str] = None
    quote_content: Optional[str] = None
    order_content: Optional[str] = None
    quote_confirmed: Optional[bool] = None
    order_signed: Optional[bool] = None
    priority: Optional[str] = None
    responsible_person: Optional[str] = None
    due_time: Optional[datetime] = None
    result: Optional[str] = None
    return_reason: Optional[str] = None


class ProcessAction(BaseModel):
    version: int
    action: str
    comment: str = ''
    dispatch_to_role: Optional[str] = None
    evidence_provided: bool = False
    corrective_action: str = ''


class BatchProcessItem(BaseModel):
    order_id: int
    version: int
    action: str
    comment: str = ''
    dispatch_to_role: Optional[str] = None
    evidence_provided: bool = False
    corrective_action: str = ''


class BatchProcessRequest(BaseModel):
    items: List[BatchProcessItem]
    comment: str = ''


class AttachmentInfo(BaseModel):
    id: int
    file_name: str
    file_path: str
    file_type: str
    file_size: int
    uploaded_by: str
    uploaded_by_role: str
    upload_time: datetime
    description: str
    stage: str


class ProcessingRecordInfo(BaseModel):
    id: int
    action: str
    action_display: str
    operator: str
    operator_role: str
    operate_time: datetime
    from_status: str
    to_status: str
    from_stage: str
    to_stage: str
    comment: str
    evidence_required: bool
    evidence_provided: bool
    version_before: int
    version_after: int


class AuditNoteInfo(BaseModel):
    id: int
    note: str
    noted_by: str
    noted_by_role: str
    note_time: datetime


class ExceptionReasonInfo(BaseModel):
    id: int
    reason_type: str
    reason_detail: str
    corrective_action: str
    recorded_by: str
    recorded_by_role: str
    record_time: datetime
    resolved: bool
    resolve_time: Optional[datetime]


class OrderDetail(BaseModel):
    id: int
    order_no: str
    customer_name: str
    product_name: str
    quantity: float
    amount: float
    country: str
    inquiry_content: str
    quote_content: str
    order_content: str
    quote_confirmed: bool
    order_signed: bool
    status: str
    status_display: str
    stage: str
    stage_display: str
    priority: str
    priority_display: str
    responsible_person: str
    current_handler: str
    current_handler_role: str
    create_time: datetime
    update_time: datetime
    due_time: Optional[datetime]
    version: int
    is_exception: bool
    exception_tags: List[str]
    result: str
    return_reason: str
    warning_level: str
    warning_level_display: str
    can_process: bool
    attachments: List[AttachmentInfo]
    processing_records: List[ProcessingRecordInfo]
    audit_notes: List[AuditNoteInfo]
    exception_reasons: List[ExceptionReasonInfo]


class OrderListItem(BaseModel):
    id: int
    order_no: str
    customer_name: str
    product_name: str
    amount: float
    status: str
    status_display: str
    stage: str
    stage_display: str
    priority: str
    priority_display: str
    responsible_person: str
    current_handler: str
    current_handler_role: str
    create_time: datetime
    update_time: datetime
    due_time: Optional[datetime]
    is_exception: bool
    exception_tags: List[str]
    warning_level: str
    warning_level_display: str
    can_process: bool


class OrderListResponse(BaseModel):
    total: int
    items: List[OrderListItem]
    stats: dict


class BatchProcessResult(BaseModel):
    order_id: int
    order_no: str
    success: bool
    error_code: str = ''
    error_message: str = ''
    new_status: str = ''
    new_stage: str = ''
    new_version: int = 0


class BatchProcessResponse(BaseModel):
    total: int
    success_count: int
    failed_count: int
    results: List[BatchProcessResult]


class AuditNoteCreate(BaseModel):
    note: str = Field(..., min_length=1)


class ExceptionReasonCreate(BaseModel):
    reason_type: str = Field(..., min_length=1)
    reason_detail: str = Field(..., min_length=1)
    corrective_action: str = ''
