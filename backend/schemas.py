from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field


class LoginRequest(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: "UserOut"


class UserOut(BaseModel):
    id: int
    username: str
    full_name: str
    role: str

    class Config:
        from_attributes = True


TokenResponse.model_rebuild()


class AttachmentBase(BaseModel):
    file_name: str
    file_type: str
    description: Optional[str] = None


class AttachmentCreate(AttachmentBase):
    pass


class AttachmentOut(AttachmentBase):
    id: int
    uploaded_by: str
    uploaded_at: datetime

    class Config:
        from_attributes = True


class ProcessingRecordBase(BaseModel):
    action: str
    remark: Optional[str] = None
    evidence_summary: Optional[str] = None


class ProcessingRecordOut(ProcessingRecordBase):
    id: int
    order_id: int
    operator: str
    operator_role: str
    previous_status: Optional[str] = None
    new_status: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class AuditNoteBase(BaseModel):
    note: str


class AuditNoteCreate(AuditNoteBase):
    pass


class AuditNoteOut(AuditNoteBase):
    id: int
    order_id: int
    noted_by: str
    noted_at: datetime

    class Config:
        from_attributes = True


class ExceptionReasonBase(BaseModel):
    category: str
    reason: str


class ExceptionReasonCreate(ExceptionReasonBase):
    pass


class ExceptionReasonOut(ExceptionReasonBase):
    id: int
    order_id: int
    reported_by: str
    node_handler: Optional[str] = None
    reported_at: datetime
    resolved: bool = False
    resolved_by: Optional[str] = None
    resolved_at: Optional[datetime] = None
    resolution_note: Optional[str] = None

    class Config:
        from_attributes = True


class TransportOrderBase(BaseModel):
    priority: str = "中"
    responsible_person: str
    deadline: datetime
    consignor_name: Optional[str] = None
    consignor_contact: Optional[str] = None
    consignor_phone: Optional[str] = None
    consignee_name: Optional[str] = None
    consignee_contact: Optional[str] = None
    consignee_phone: Optional[str] = None
    cargo_name: Optional[str] = None
    cargo_weight: Optional[str] = None
    cargo_volume: Optional[str] = None
    cargo_quantity: Optional[str] = None
    departure: Optional[str] = None
    destination: Optional[str] = None
    transport_requirements: Optional[str] = None
    vehicle_plate: Optional[str] = None
    vehicle_type: Optional[str] = None
    driver_name: Optional[str] = None
    driver_phone: Optional[str] = None
    dispatch_time: Optional[datetime] = None
    estimated_arrival: Optional[datetime] = None
    receipt_signer: Optional[str] = None
    receipt_time: Optional[datetime] = None
    receipt_status: Optional[str] = None
    receipt_remark: Optional[str] = None


class TransportOrderCreate(TransportOrderBase):
    order_no: str


class TransportOrderUpdate(BaseModel):
    priority: Optional[str] = None
    responsible_person: Optional[str] = None
    deadline: Optional[datetime] = None
    consignor_name: Optional[str] = None
    consignor_contact: Optional[str] = None
    consignor_phone: Optional[str] = None
    consignee_name: Optional[str] = None
    consignee_contact: Optional[str] = None
    consignee_phone: Optional[str] = None
    cargo_name: Optional[str] = None
    cargo_weight: Optional[str] = None
    cargo_volume: Optional[str] = None
    cargo_quantity: Optional[str] = None
    departure: Optional[str] = None
    destination: Optional[str] = None
    transport_requirements: Optional[str] = None
    vehicle_plate: Optional[str] = None
    vehicle_type: Optional[str] = None
    driver_name: Optional[str] = None
    driver_phone: Optional[str] = None
    dispatch_time: Optional[datetime] = None
    estimated_arrival: Optional[datetime] = None
    receipt_signer: Optional[str] = None
    receipt_time: Optional[datetime] = None
    receipt_status: Optional[str] = None
    receipt_remark: Optional[str] = None


class TransportOrderOut(TransportOrderBase):
    id: int
    order_no: str
    status: str
    version: int
    created_at: datetime
    updated_at: datetime
    current_handler: str
    is_overdue: bool = False
    overdue_reason: Optional[str] = None
    attachments: List[AttachmentOut] = []
    processing_records: List[ProcessingRecordOut] = []
    audit_notes: List[AuditNoteOut] = []
    exception_reasons: List[ExceptionReasonOut] = []

    class Config:
        from_attributes = True


class TransportOrderListOut(BaseModel):
    id: int
    order_no: str
    status: str
    priority: str
    responsible_person: str
    deadline: datetime
    current_handler: str
    is_overdue: bool = False
    consignor_name: Optional[str] = None
    consignee_name: Optional[str] = None
    cargo_name: Optional[str] = None
    version: int

    class Config:
        from_attributes = True


class OrderListResponse(BaseModel):
    items: List[TransportOrderListOut]
    total: int
    page: int
    page_size: int


class OrderActionRequest(BaseModel):
    action: str
    remark: Optional[str] = None
    evidence_files: Optional[List[AttachmentCreate]] = None
    expected_version: Optional[int] = None


class BatchActionRequest(BaseModel):
    order_ids: List[int]
    action: str
    remark: Optional[str] = None
    expected_versions: Optional[dict] = None


class BatchResultItem(BaseModel):
    order_id: int
    order_no: str
    success: bool
    message: str


class BatchActionResponse(BaseModel):
    results: List[BatchResultItem]
    total_success: int
    total_failed: int


class WarningGroup(BaseModel):
    group: str
    orders: List[TransportOrderListOut]
    count: int


class WarningResponse(BaseModel):
    normal: WarningGroup
    approaching: WarningGroup
    overdue: WarningGroup
