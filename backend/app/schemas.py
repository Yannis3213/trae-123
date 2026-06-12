from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime


class LoginRequest(BaseModel):
    username: str
    password: str


class UserInfo(BaseModel):
    id: int
    username: str
    role: str
    name: str

    class Config:
        from_attributes = True


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserInfo


class ApplicationCreate(BaseModel):
    company_name: str
    contact_person: str
    contact_phone: str
    contact_email: Optional[str] = None
    exhibition_type: str
    booth_area: Optional[float] = None
    booth_preference: Optional[str] = None


class ApplicationUpdate(BaseModel):
    company_name: Optional[str] = None
    contact_person: Optional[str] = None
    contact_phone: Optional[str] = None
    contact_email: Optional[str] = None
    exhibition_type: Optional[str] = None
    booth_area: Optional[float] = None
    booth_preference: Optional[str] = None


class ActionRequest(BaseModel):
    application_id: int
    action: str
    comment: Optional[str] = None
    correction_reason: Optional[str] = None
    reject_reason: Optional[str] = None
    evidence_required: Optional[str] = None
    booth_confirmation_evidence: Optional[str] = None
    version: int


class BatchActionRequest(BaseModel):
    action: str
    application_ids: List[int]
    comment: Optional[str] = None
    correction_reason: Optional[str] = None
    reject_reason: Optional[str] = None
    evidence_required: Optional[str] = None
    booth_confirmation_evidence: Optional[str] = None


class BatchResultItem(BaseModel):
    application_id: int
    application_no: Optional[str] = None
    success: bool
    error_code: Optional[str] = None
    error_message: Optional[str] = None


class BatchActionResponse(BaseModel):
    batch_no: str
    total_count: int
    success_count: int
    fail_count: int
    results: List[BatchResultItem]


class ApplicationResponse(BaseModel):
    id: int
    application_no: str
    company_name: str
    contact_person: str
    contact_phone: str
    contact_email: Optional[str] = None
    exhibition_type: str
    booth_area: Optional[float] = None
    booth_preference: Optional[str] = None
    status: str
    status_name: str
    queue: str
    queue_name: str
    current_handler: Optional[str] = None
    version: int
    is_overdue: bool
    warning_level: str
    warning_level_name: str
    deadline: Optional[datetime] = None
    submitted_at: datetime
    last_updated_at: datetime
    created_by: str
    booth_confirmation_evidence: Optional[str] = None
    sync_status: str

    class Config:
        from_attributes = True


class ProcessingRecordResponse(BaseModel):
    id: int
    application_id: int
    action: str
    from_status: Optional[str] = None
    to_status: Optional[str] = None
    handler: str
    handler_name: str
    handler_role: str
    role_name: str
    comment: Optional[str] = None
    correction_reason: Optional[str] = None
    reject_reason: Optional[str] = None
    evidence_required: Optional[str] = None
    previous_handler: Optional[str] = None
    version: Optional[int] = None
    created_at: datetime

    class Config:
        from_attributes = True


class StatisticsResponse(BaseModel):
    pending: int
    passed: int
    synced: int
    total: int
    by_queue: Dict[str, int]
    by_warning: Dict[str, int]
