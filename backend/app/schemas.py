from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field

from .models import UserRole, PurchaseStatus, PriorityLevel, WarningLevel


class Token(BaseModel):
    access_token: str
    token_type: str
    user: "UserOut"


class UserBase(BaseModel):
    username: str
    full_name: str
    role: UserRole
    store: Optional[str] = None


class UserCreate(UserBase):
    password: str


class UserOut(UserBase):
    id: int
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class LoginRequest(BaseModel):
    username: str
    password: str


class AttachmentBase(BaseModel):
    filename: str
    file_type: Optional[str] = None
    category: Optional[str] = None
    description: Optional[str] = None


class AttachmentCreate(AttachmentBase):
    pass


class AttachmentOut(AttachmentBase):
    id: int
    uploader_id: Optional[int] = None
    uploaded_at: datetime

    class Config:
        from_attributes = True


class ProcessingRecordBase(BaseModel):
    action: str
    from_status: Optional[str] = None
    to_status: Optional[str] = None
    result: Optional[str] = None
    comment: Optional[str] = None
    exception_reason: Optional[str] = None
    evidence_checked: Optional[str] = None


class ProcessingRecordOut(ProcessingRecordBase):
    id: int
    order_id: int
    handler_id: Optional[int] = None
    handler_name: Optional[str] = None
    handler_role: Optional[str] = None
    timestamp: datetime

    class Config:
        from_attributes = True


class AuditNoteBase(BaseModel):
    note: str
    note_type: Optional[str] = None


class AuditNoteCreate(AuditNoteBase):
    pass


class AuditNoteOut(AuditNoteBase):
    id: int
    order_id: int
    author_id: Optional[int] = None
    author_name: Optional[str] = None
    author_role: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class FreshPurchaseOrderBase(BaseModel):
    title: str
    supplier_name: str
    store: str
    category: Optional[str] = None
    amount: Optional[str] = None
    priority: PriorityLevel = PriorityLevel.MEDIUM
    deadline: datetime
    supplier_quotation: Optional[str] = None
    purchase_order_content: Optional[str] = None
    arrival_verification: Optional[str] = None
    has_quotation_evidence: bool = False
    has_purchase_evidence: bool = False
    has_arrival_evidence: bool = False
    reject_reason: Optional[str] = None
    exception_reason: Optional[str] = None


class FreshPurchaseOrderCreate(FreshPurchaseOrderBase):
    pass


class FreshPurchaseOrderUpdate(BaseModel):
    title: Optional[str] = None
    supplier_name: Optional[str] = None
    store: Optional[str] = None
    category: Optional[str] = None
    amount: Optional[str] = None
    priority: Optional[PriorityLevel] = None
    deadline: Optional[datetime] = None
    supplier_quotation: Optional[str] = None
    purchase_order_content: Optional[str] = None
    arrival_verification: Optional[str] = None
    has_quotation_evidence: Optional[bool] = None
    has_purchase_evidence: Optional[bool] = None
    has_arrival_evidence: Optional[bool] = None
    reject_reason: Optional[str] = None
    exception_reason: Optional[str] = None


class FreshPurchaseOrderOut(FreshPurchaseOrderBase):
    id: int
    order_no: str
    status: PurchaseStatus
    warning_level: WarningLevel
    creator_id: int
    current_handler_id: Optional[int] = None
    creator: Optional[UserOut] = None
    current_handler: Optional[UserOut] = None
    is_overdue: bool
    has_exception: bool
    version: int
    created_at: datetime
    updated_at: datetime
    closed_at: Optional[datetime] = None
    attachments: List[AttachmentOut] = []
    processing_records: List[ProcessingRecordOut] = []
    audit_notes: List[AuditNoteOut] = []

    class Config:
        from_attributes = True


class StatusTransitionRequest(BaseModel):
    target_status: PurchaseStatus
    comment: Optional[str] = None
    audit_note: Optional[str] = None
    expected_version: int
    action: str


class BatchActionRequest(BaseModel):
    order_ids: List[int]
    target_status: Optional[PurchaseStatus] = None
    comment: Optional[str] = None
    action: str
    expected_versions: Optional[dict] = None


class BatchActionResult(BaseModel):
    order_id: int
    order_no: str
    success: bool
    message: str
    current_status: Optional[PurchaseStatus] = None


class PurchaseOrderListResponse(BaseModel):
    total: int
    items: List[FreshPurchaseOrderOut]
    warning_counts: dict


class PurchaseOrderStats(BaseModel):
    total: int
    pending_dispatch: int
    processing: int
    closed: int
    overdue: int
    exception: int
    approaching_deadline: int


Token.model_rebuild()
