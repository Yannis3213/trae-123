from datetime import datetime
from typing import Optional, List, Any
from pydantic import BaseModel, Field


class UserSchema(BaseModel):
    id: int
    username: str
    role: str
    role_name: str
    department: Optional[str] = None

    class Config:
        from_attributes = True


class LoginSchema(BaseModel):
    username: str
    password: str


class AttachmentSchema(BaseModel):
    id: int
    file_name: str
    file_type: str
    evidence_type: str
    is_required: bool
    uploaded_by: str
    created_at: datetime

    class Config:
        from_attributes = True


class ProcessingRecordSchema(BaseModel):
    id: int
    node: str
    node_name: str
    action: str
    operator: str
    previous_status: Optional[str] = None
    new_status: str
    comment: Optional[str] = None
    processing_time: datetime
    version: int

    class Config:
        from_attributes = True


class AuditNoteSchema(BaseModel):
    id: int
    node: str
    node_name: str
    note_type: str
    content: str
    operator: str
    created_at: datetime

    class Config:
        from_attributes = True


class ExceptionLogSchema(BaseModel):
    id: int
    application_no: Optional[str] = None
    exception_type: str
    error_code: str
    error_message: str
    operator: str
    resolved: bool
    created_at: datetime

    class Config:
        from_attributes = True


class ApplicationListSchema(BaseModel):
    id: int
    application_no: str
    applicant_name: str
    community: str
    difficulty_type: str
    current_node: str
    current_node_name: str
    status: str
    status_name: str
    warning_status: str
    warning_status_name: str
    current_handler: Optional[str] = None
    creator: str
    node_deadline: Optional[datetime] = None
    created_at: datetime
    version: int

    class Config:
        from_attributes = True


class ApplicationDetailSchema(BaseModel):
    id: int
    application_no: str
    applicant_name: str
    applicant_id_card: str
    applicant_phone: str
    community: str
    address: str
    family_situation: str
    difficulty_type: str
    application_reason: str
    apply_amount: Optional[float] = None
    current_node: str
    current_node_name: str
    status: str
    status_name: str
    warning_status: str
    warning_status_name: str
    current_handler: Optional[str] = None
    current_handler_id: Optional[int] = None
    creator: str
    creator_id: int
    street_clerk: Optional[str] = None
    street_clerk_id: Optional[int] = None
    leader: Optional[str] = None
    leader_id: Optional[int] = None
    node_deadline: Optional[datetime] = None
    version: int
    created_at: datetime
    updated_at: datetime
    attachments: List[AttachmentSchema] = []
    processing_records: List[ProcessingRecordSchema] = []
    audit_notes: List[AuditNoteSchema] = []

    class Config:
        from_attributes = True


class ApplicationCreateSchema(BaseModel):
    applicant_name: str
    applicant_id_card: str
    applicant_phone: str
    community: str
    address: str
    family_situation: str
    difficulty_type: str
    application_reason: str
    apply_amount: Optional[float] = None


class ApplicationProcessSchema(BaseModel):
    application_id: int
    version: int
    action: str
    comment: Optional[str] = None
    evidence_required: Optional[List[str]] = None


class BatchProcessItem(BaseModel):
    application_id: int
    version: int
    action: str
    comment: Optional[str] = None


class BatchProcessSchema(BaseModel):
    items: List[BatchProcessItem]


class BatchResultItem(BaseModel):
    application_id: int
    application_no: str
    success: bool
    error_code: Optional[str] = None
    error_message: Optional[str] = None


class BatchProcessResult(BaseModel):
    batch_id: str
    total_count: int
    success_count: int
    failure_count: int
    results: List[BatchResultItem]


class WarningStatsSchema(BaseModel):
    normal: int
    approaching: int
    overdue: int


class ApplicationFilterSchema(BaseModel):
    status: Optional[str] = None
    current_node: Optional[str] = None
    warning_status: Optional[str] = None
    community: Optional[str] = None
    keyword: Optional[str] = None
