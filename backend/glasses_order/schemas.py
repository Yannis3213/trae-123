from datetime import datetime, date
from typing import Optional, List
from pydantic import BaseModel, Field


class UserOut(BaseModel):
    id: int
    username: str
    real_name: str
    role: str
    role_display: str

    class Config:
        from_attributes = True


class LoginIn(BaseModel):
    username: str
    password: str


class LoginOut(BaseModel):
    token: str
    user: UserOut


class OptometryRecordSchema(BaseModel):
    id: Optional[int] = None
    left_sphere: Optional[float] = None
    left_cylinder: Optional[float] = None
    left_axis: Optional[int] = None
    left_visual_acuity: Optional[str] = ''
    right_sphere: Optional[float] = None
    right_cylinder: Optional[float] = None
    right_axis: Optional[int] = None
    right_visual_acuity: Optional[str] = ''
    pd: Optional[float] = None
    exam_notes: Optional[str] = ''
    is_complete: bool = False

    class Config:
        from_attributes = True


class LensOrderSchema(BaseModel):
    id: Optional[int] = None
    left_lens_type: Optional[str] = ''
    left_lens_brand: Optional[str] = ''
    left_lens_price: Optional[float] = None
    right_lens_type: Optional[str] = ''
    right_lens_brand: Optional[str] = ''
    right_lens_price: Optional[float] = None
    frame_brand: Optional[str] = ''
    frame_model: Optional[str] = ''
    frame_price: Optional[float] = None
    total_price: Optional[float] = None
    supplier: Optional[str] = ''
    is_complete: bool = False

    class Config:
        from_attributes = True


class OrderRegistrationSchema(BaseModel):
    id: Optional[int] = None
    sales_person: Optional[str] = ''
    registered_at: Optional[datetime] = None
    payment_method: Optional[str] = ''
    deposit_amount: Optional[float] = None
    delivery_method: Optional[str] = ''
    expected_delivery: Optional[date] = None
    notes: Optional[str] = ''
    is_complete: bool = False

    class Config:
        from_attributes = True


class AttachmentSchema(BaseModel):
    id: int
    category: str
    category_display: str
    file_name: str
    file_path: str
    file_size: int = 0
    uploaded_by: str
    description: str = ''
    is_required: bool = False
    created_at: datetime

    class Config:
        from_attributes = True


class ProcessingRecordSchema(BaseModel):
    id: int
    action: str
    action_display: str
    operator: str
    from_status: str = ''
    to_status: str = ''
    opinion: str = ''
    version: int = 1
    created_at: datetime

    class Config:
        from_attributes = True


class AuditNoteSchema(BaseModel):
    id: int
    operator: str
    note_type: str
    content: str
    created_at: datetime

    class Config:
        from_attributes = True


class ExceptionReasonSchema(BaseModel):
    id: int
    exception_type: str
    exception_type_display: str
    description: str
    detected_by: str
    resolved: bool = False
    resolved_by: Optional[str] = None
    resolved_at: Optional[datetime] = None
    resolution_note: str = ''
    created_at: datetime

    class Config:
        from_attributes = True


class GlassesOrderListSchema(BaseModel):
    id: int
    order_no: str
    customer_name: str
    customer_phone: str
    business_area: str
    status: str
    status_display: str
    version: int
    urgency_status: str
    current_handler_name: Optional[str] = None
    submitted_at: Optional[datetime] = None
    review_due_at: Optional[datetime] = None
    sync_due_at: Optional[datetime] = None
    reviewed_at: Optional[datetime] = None
    synced_at: Optional[datetime] = None
    has_defect: bool = False
    created_at: datetime

    class Config:
        from_attributes = True


class GlassesOrderDetailSchema(BaseModel):
    id: int
    order_no: str
    customer_name: str
    customer_phone: str
    business_area: str
    status: str
    status_display: str
    version: int
    urgency_status: str
    submitted_by_name: Optional[str] = None
    current_handler_name: Optional[str] = None
    reviewed_by_name: Optional[str] = None
    synced_by_name: Optional[str] = None
    submitted_at: Optional[datetime] = None
    review_due_at: Optional[datetime] = None
    sync_due_at: Optional[datetime] = None
    reviewed_at: Optional[datetime] = None
    synced_at: Optional[datetime] = None
    last_opinion: str = ''
    last_operator_name: Optional[str] = None
    has_defect: bool = False
    defect_description: str = ''
    optometry_record: Optional[OptometryRecordSchema] = None
    lens_order: Optional[LensOrderSchema] = None
    registration: Optional[OrderRegistrationSchema] = None
    attachments: List[AttachmentSchema] = []
    processing_records: List[ProcessingRecordSchema] = []
    audit_notes: List[AuditNoteSchema] = []
    exceptions: List[ExceptionReasonSchema] = []
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class GlassesOrderCreateSchema(BaseModel):
    customer_name: str
    customer_phone: str
    business_area: str
    optometry_record: Optional[OptometryRecordSchema] = None
    lens_order: Optional[LensOrderSchema] = None
    registration: Optional[OrderRegistrationSchema] = None


class OrderReviewSchema(BaseModel):
    order_id: int
    version: int
    action: str
    opinion: str = ''


class OrderCorrectSchema(BaseModel):
    order_id: int
    version: int
    optometry_record: Optional[OptometryRecordSchema] = None
    lens_order: Optional[LensOrderSchema] = None
    registration: Optional[OrderRegistrationSchema] = None
    opinion: str = ''


class BatchOrderItemSchema(BaseModel):
    order_id: int
    version: int


class BatchProcessSchema(BaseModel):
    orders: List[BatchOrderItemSchema]
    action: str
    opinion: str = ''


class BatchResultSchema(BaseModel):
    order_id: int
    order_no: str
    success: bool
    message: str


class StatisticsSchema(BaseModel):
    total: int = 0
    pending_review: int = 0
    review_approved: int = 0
    synced: int = 0
    returned: int = 0
    normal: int = 0
    warning: int = 0
    overdue: int = 0
