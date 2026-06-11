import datetime
from typing import Optional

from pydantic import BaseModel, Field

from app.models import (
    ActionTypeEnum,
    EnrollmentStatusEnum,
    EvidenceTypeEnum,
    ExceptionTypeEnum,
    ExpiryStatusEnum,
    RoleEnum,
)


class UserBase(BaseModel):
    username: str
    full_name: str
    role: RoleEnum


class UserCreate(UserBase):
    password: str


class UserResponse(UserBase):
    id: int
    is_active: bool
    created_at: datetime.datetime

    class Config:
        from_attributes = True


class LoginRequest(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


class AttachmentBase(BaseModel):
    evidence_type: EvidenceTypeEnum
    file_name: str
    file_url: str


class AttachmentResponse(AttachmentBase):
    id: int
    enrollment_id: int
    uploaded_by_id: int
    uploaded_at: datetime.datetime
    is_valid: bool

    class Config:
        from_attributes = True


class EnrollmentCreate(BaseModel):
    member_name: str
    member_phone: str
    member_id_card: Optional[str] = None
    membership_type: str
    card_level: Optional[str] = None
    amount: int
    contract_no: Optional[str] = None
    salesperson: Optional[str] = None
    private_trainer: Optional[str] = None
    store: str
    remark: Optional[str] = None
    due_days: int = Field(default=3, ge=1, le=30)
    attachments: list[AttachmentBase] = []


class EnrollmentUpdate(BaseModel):
    member_name: Optional[str] = None
    member_phone: Optional[str] = None
    member_id_card: Optional[str] = None
    membership_type: Optional[str] = None
    card_level: Optional[str] = None
    amount: Optional[int] = None
    contract_no: Optional[str] = None
    salesperson: Optional[str] = None
    private_trainer: Optional[str] = None
    store: Optional[str] = None
    remark: Optional[str] = None
    attachments: Optional[list[AttachmentBase]] = None


class EnrollmentResponse(BaseModel):
    id: int
    member_name: str
    member_phone: str
    member_id_card: Optional[str] = None
    membership_type: str
    card_level: Optional[str] = None
    amount: int
    contract_no: Optional[str] = None
    salesperson: Optional[str] = None
    private_trainer: Optional[str] = None
    store: str
    remark: Optional[str] = None

    status: EnrollmentStatusEnum
    version: int

    created_by_id: int
    current_handler_id: Optional[int] = None
    audit_by_id: Optional[int] = None
    review_by_id: Optional[int] = None

    created_at: datetime.datetime
    submitted_at: Optional[datetime.datetime] = None
    audited_at: Optional[datetime.datetime] = None
    reviewed_at: Optional[datetime.datetime] = None
    due_at: datetime.datetime

    created_by: Optional[UserResponse] = None
    current_handler: Optional[UserResponse] = None
    audit_by: Optional[UserResponse] = None
    review_by: Optional[UserResponse] = None

    attachments: list[AttachmentResponse] = []
    expiry_status: Optional[ExpiryStatusEnum] = None
    has_exception: bool = False
    evidence_summary: dict[str, bool] = {}

    class Config:
        from_attributes = True


class EnrollmentDetailResponse(EnrollmentResponse):
    audit_logs: list["AuditLogResponse"] = []
    exceptions: list["ExceptionLogResponse"] = []

    evidence_summary: dict[str, bool] = {}


class AuditLogBase(BaseModel):
    action_type: ActionTypeEnum
    comment: Optional[str] = None


class AuditLogResponse(AuditLogBase):
    id: int
    enrollment_id: int
    user_id: int
    old_status: Optional[EnrollmentStatusEnum] = None
    new_status: Optional[EnrollmentStatusEnum] = None
    created_at: datetime.datetime
    user: Optional[UserResponse] = None

    class Config:
        from_attributes = True


class ExceptionLogBase(BaseModel):
    exception_type: ExceptionTypeEnum
    description: str


class ExceptionLogResponse(ExceptionLogBase):
    id: int
    enrollment_id: int
    detected_at: datetime.datetime
    detected_by: Optional[str] = None
    resolved: bool
    resolved_at: Optional[datetime.datetime] = None
    resolution_note: Optional[str] = None

    class Config:
        from_attributes = True


class AuditRequest(BaseModel):
    enrollment_id: int
    passed: bool
    comment: Optional[str] = None
    version: int


class ReviewRequest(BaseModel):
    enrollment_id: int
    passed: bool
    comment: Optional[str] = None
    version: int


class CorrectRequest(BaseModel):
    enrollment_id: int
    comment: str
    update_data: Optional[EnrollmentUpdate] = None
    version: int


class BatchItemResult(BaseModel):
    id: int
    success: bool
    message: str
    error_code: Optional[str] = None
    data: Optional[EnrollmentResponse] = None


class BatchAuditRequest(BaseModel):
    ids: list[int]
    passed: bool
    comment: Optional[str] = None


class BatchReviewRequest(BaseModel):
    ids: list[int]
    passed: bool
    comment: Optional[str] = None


class BatchResultResponse(BaseModel):
    total: int
    success_count: int
    fail_count: int
    results: list[BatchItemResult]


class EnrollmentListResponse(BaseModel):
    total: int
    items: list[EnrollmentResponse]
    page: int
    page_size: int


class StatsResponse(BaseModel):
    total: int
    pending: int
    failed: int
    completed: int
    normal: int
    approaching: int
    overdue: int
    my_todo: int


EnrollmentDetailResponse.model_rebuild()
