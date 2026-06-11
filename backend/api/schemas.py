from datetime import date, datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field

from api.models import (
    RoleChoices, OrderStatusChoices, RequirementStatusChoices,
    ModuleTypeChoices, ActionChoices
)


class UserSchema(BaseModel):
    id: int
    username: str
    role: RoleChoices
    role_display: str
    is_active: bool

    @classmethod
    def from_orm(cls, obj):
        return cls(
            id=obj.id,
            username=obj.username,
            role=obj.role,
            role_display=obj.get_role_display(),
            is_active=obj.is_active,
        )

    class Config:
        orm_mode = True


class LoginSchema(BaseModel):
    username: str
    password: str


class LoginResponse(BaseModel):
    token: str
    user: UserSchema


class AttachmentSchema(BaseModel):
    id: int
    module_type: ModuleTypeChoices
    module_type_display: str
    file_name: str
    file_url: str
    uploaded_by: Optional[UserSchema] = None
    uploaded_at: datetime

    @classmethod
    def from_orm(cls, obj):
        return cls(
            id=obj.id,
            module_type=obj.module_type,
            module_type_display=obj.get_module_type_display(),
            file_name=obj.file_name,
            file_url=obj.file_url,
            uploaded_by=UserSchema.from_orm(obj.uploaded_by) if obj.uploaded_by else None,
            uploaded_at=obj.uploaded_at,
        )

    class Config:
        orm_mode = True


class ProcessingRecordSchema(BaseModel):
    id: int
    action: ActionChoices
    action_display: str
    operator: Optional[UserSchema] = None
    role: RoleChoices
    role_display: str
    from_status: OrderStatusChoices
    from_status_display: str
    to_status: OrderStatusChoices
    to_status_display: str
    remark: str
    created_at: datetime

    @classmethod
    def from_orm(cls, obj):
        return cls(
            id=obj.id,
            action=obj.action,
            action_display=obj.get_action_display(),
            operator=UserSchema.from_orm(obj.operator) if obj.operator else None,
            role=obj.role,
            role_display=dict(RoleChoices.choices).get(obj.role, obj.role),
            from_status=obj.from_status,
            from_status_display=dict(OrderStatusChoices.choices).get(obj.from_status, obj.from_status),
            to_status=obj.to_status,
            to_status_display=dict(OrderStatusChoices.choices).get(obj.to_status, obj.to_status),
            remark=obj.remark,
            created_at=obj.created_at,
        )

    class Config:
        orm_mode = True


class AuditNoteSchema(BaseModel):
    id: int
    note: str
    author: Optional[UserSchema] = None
    created_at: datetime

    @classmethod
    def from_orm(cls, obj):
        return cls(
            id=obj.id,
            note=obj.note,
            author=UserSchema.from_orm(obj.author) if obj.author else None,
            created_at=obj.created_at,
        )

    class Config:
        orm_mode = True


class ExceptionReasonSchema(BaseModel):
    id: int
    module_type: ModuleTypeChoices
    module_type_display: str
    reason: str
    handler: Optional[UserSchema] = None
    created_at: datetime
    resolved: bool
    resolved_at: Optional[datetime] = None

    @classmethod
    def from_orm(cls, obj):
        return cls(
            id=obj.id,
            module_type=obj.module_type,
            module_type_display=obj.get_module_type_display(),
            reason=obj.reason,
            handler=UserSchema.from_orm(obj.handler) if obj.handler else None,
            created_at=obj.created_at,
            resolved=obj.resolved,
            resolved_at=obj.resolved_at,
        )

    class Config:
        orm_mode = True


class OrderListSchema(BaseModel):
    id: int
    order_no: str
    title: str
    project_name: str
    status: OrderStatusChoices
    status_display: str
    current_handler: Optional[UserSchema] = None
    version: int
    requirement_status: RequirementStatusChoices
    requirement_status_display: str
    schedule_status: RequirementStatusChoices
    schedule_status_display: str
    delivery_status: RequirementStatusChoices
    delivery_status_display: str
    requirement_deadline: Optional[date] = None
    schedule_deadline: Optional[date] = None
    delivery_deadline: Optional[date] = None
    created_by: Optional[UserSchema] = None
    created_at: datetime
    updated_at: datetime

    @classmethod
    def from_orm(cls, obj):
        return cls(
            id=obj.id,
            order_no=obj.order_no,
            title=obj.title,
            project_name=obj.project_name,
            status=obj.status,
            status_display=obj.get_status_display(),
            current_handler=UserSchema.from_orm(obj.current_handler) if obj.current_handler else None,
            version=obj.version,
            requirement_status=obj.requirement_status,
            requirement_status_display=dict(RequirementStatusChoices.choices).get(obj.requirement_status, obj.requirement_status),
            schedule_status=obj.schedule_status,
            schedule_status_display=dict(RequirementStatusChoices.choices).get(obj.schedule_status, obj.schedule_status),
            delivery_status=obj.delivery_status,
            delivery_status_display=dict(RequirementStatusChoices.choices).get(obj.delivery_status, obj.delivery_status),
            requirement_deadline=obj.requirement_deadline,
            schedule_deadline=obj.schedule_deadline,
            delivery_deadline=obj.delivery_deadline,
            created_by=UserSchema.from_orm(obj.created_by) if obj.created_by else None,
            created_at=obj.created_at,
            updated_at=obj.updated_at,
        )

    class Config:
        orm_mode = True


class OrderDetailSchema(OrderListSchema):
    requirement_confirmation_clue: str
    requirement_evidence: Dict[str, Any] = {}
    schedule_evidence: Dict[str, Any] = {}
    delivery_evidence: Dict[str, Any] = {}
    attachments: List[AttachmentSchema] = []
    processing_records: List[ProcessingRecordSchema] = []
    audit_notes: List[AuditNoteSchema] = []
    exception_reasons: List[ExceptionReasonSchema] = []

    @classmethod
    def from_orm(cls, obj):
        return cls(
            id=obj.id,
            order_no=obj.order_no,
            title=obj.title,
            project_name=obj.project_name,
            status=obj.status,
            status_display=obj.get_status_display(),
            current_handler=UserSchema.from_orm(obj.current_handler) if obj.current_handler else None,
            version=obj.version,
            requirement_status=obj.requirement_status,
            requirement_status_display=dict(RequirementStatusChoices.choices).get(obj.requirement_status, obj.requirement_status),
            schedule_status=obj.schedule_status,
            schedule_status_display=dict(RequirementStatusChoices.choices).get(obj.schedule_status, obj.schedule_status),
            delivery_status=obj.delivery_status,
            delivery_status_display=dict(RequirementStatusChoices.choices).get(obj.delivery_status, obj.delivery_status),
            requirement_deadline=obj.requirement_deadline,
            schedule_deadline=obj.schedule_deadline,
            delivery_deadline=obj.delivery_deadline,
            created_by=UserSchema.from_orm(obj.created_by) if obj.created_by else None,
            created_at=obj.created_at,
            updated_at=obj.updated_at,
            requirement_confirmation_clue=obj.requirement_confirmation_clue,
            requirement_evidence=obj.requirement_evidence,
            schedule_evidence=obj.schedule_evidence,
            delivery_evidence=obj.delivery_evidence,
            attachments=[AttachmentSchema.from_orm(a) for a in obj.attachments.all()],
            processing_records=[ProcessingRecordSchema.from_orm(r) for r in obj.processing_records.all()],
            audit_notes=[AuditNoteSchema.from_orm(n) for n in obj.audit_notes.all()],
            exception_reasons=[ExceptionReasonSchema.from_orm(e) for e in obj.exception_reasons.all()],
        )

    class Config:
        orm_mode = True


class OrderCreateSchema(BaseModel):
    title: str
    project_name: str
    requirement_confirmation_clue: str
    requirement_deadline: Optional[date] = None
    schedule_deadline: Optional[date] = None
    delivery_deadline: Optional[date] = None


class RequirementSubmitSchema(BaseModel):
    version: int
    evidence: Dict[str, Any] = Field(default_factory=dict)
    deadline: Optional[date] = None


class ScheduleSubmitSchema(BaseModel):
    version: int
    evidence: Dict[str, Any] = Field(default_factory=dict)
    deadline: Optional[date] = None


class DeliverySubmitSchema(BaseModel):
    version: int
    evidence: Dict[str, Any] = Field(default_factory=dict)
    deadline: Optional[date] = None


class AuditSchema(BaseModel):
    version: int
    approved: bool
    remark: str = ''
    exception_reason: Optional[str] = None


class BatchAdvanceSchema(BaseModel):
    order_ids: List[int]
    remark: str = ''


class BatchVerifySchema(BaseModel):
    order_ids: List[int]
    approved: bool
    remark: str = ''
    version: Optional[int] = None
    order_versions: Optional[Dict[int, int]] = None


class BatchProcessSchema(BaseModel):
    order_ids: List[int]
    action: str
    remark: str = ''
    approved: Optional[bool] = None


class BatchResultItem(BaseModel):
    order_id: int
    order_no: str
    success: bool
    message: str = ''
    exception_reason: Optional[str] = None
    failure_reason: Optional[str] = None
    biz_result: Optional[str] = None


class BatchResult(BaseModel):
    total: int
    success_count: int
    failed_count: int
    results: List[BatchResultItem]


class StatisticsSchema(BaseModel):
    total_orders: int
    pending_verify: int
    verify_failed: int
    verify_completed: int
    in_progress: int
    archived: int
    by_status: Dict[str, int]
    by_module: Dict[str, Dict[str, int]]


class DeadlineWarningSchema(BaseModel):
    order_id: int
    order_no: str
    title: str
    project_name: str
    module_type: str
    deadline: date
    days_left: int
    warning_level: str
    handler: Optional[UserSchema] = None


class SuccessResponse(BaseModel):
    success: bool = True
    message: str = '操作成功'
