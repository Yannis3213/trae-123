from pydantic import BaseModel, Field
from typing import Optional, List, Any
from datetime import datetime
from enum import Enum


class RoleEnum(str, Enum):
    registrar = "registrar"
    auditor = "auditor"
    reviewer = "reviewer"


class StatusEnum(str, Enum):
    draft = "draft"
    pending_audit = "pending_audit"
    audit_rejected = "audit_rejected"
    audit_passed = "audit_passed"
    pending_review = "pending_review"
    review_rejected = "review_rejected"
    synced = "synced"
    archived = "archived"


class StageEnum(str, Enum):
    demand = "demand"
    plan = "plan"
    contract = "contract"


class LoginRequest(BaseModel):
    username: str
    password: str


class UserResponse(BaseModel):
    id: int
    username: str
    full_name: str
    role: str
    role_name: str
    department: Optional[str] = None
    token: str

    class Config:
        from_attributes = True


class UserSimpleResponse(BaseModel):
    id: int
    username: str
    full_name: str
    role: str
    role_name: str

    class Config:
        from_attributes = True


class AttachmentBase(BaseModel):
    file_name: str
    file_type: Optional[str] = None
    file_size: Optional[int] = None
    category: str
    is_required: Optional[bool] = False


class AttachmentCreate(AttachmentBase):
    file_path: str


class AttachmentResponse(AttachmentBase):
    id: int
    uploaded_by: Optional[UserSimpleResponse] = None
    uploaded_at: datetime

    class Config:
        from_attributes = True


class ProcessingRecordResponse(BaseModel):
    id: int
    project_id: int
    action: str
    action_name: str
    from_status: Optional[str] = None
    to_status: Optional[str] = None
    from_stage: Optional[str] = None
    to_stage: Optional[str] = None
    operator: Optional[UserSimpleResponse] = None
    operator_role: Optional[str] = None
    remark: Optional[str] = None
    evidence_checked: Optional[str] = None
    processed_at: datetime
    version_at_action: Optional[int] = None

    class Config:
        from_attributes = True


class AuditNoteResponse(BaseModel):
    id: int
    project_id: int
    note_type: str
    note_content: str
    created_by: Optional[UserSimpleResponse] = None
    created_at: datetime

    class Config:
        from_attributes = True


class ExceptionRecordResponse(BaseModel):
    id: int
    project_id: int
    exception_type: str
    exception_code: Optional[str] = None
    exception_message: str
    responsible_role: Optional[str] = None
    responsible_user: Optional[UserSimpleResponse] = None
    created_at: datetime
    resolved: bool
    resolved_at: Optional[datetime] = None
    resolution: Optional[str] = None

    class Config:
        from_attributes = True


class TrainingProjectBase(BaseModel):
    project_name: str
    client_company: str
    contact_person: Optional[str] = None
    contact_phone: Optional[str] = None
    training_type: Optional[str] = None
    training_count: Optional[int] = 0
    expected_start_date: Optional[datetime] = None
    expected_end_date: Optional[datetime] = None
    demand_description: Optional[str] = None
    plan_content: Optional[str] = None
    quotation_amount: Optional[float] = 0
    contract_no: Optional[str] = None
    contract_date: Optional[datetime] = None
    deadline: Optional[datetime] = None
    stage: Optional[str] = "demand"


class TrainingProjectCreate(TrainingProjectBase):
    pass


class TrainingProjectUpdate(TrainingProjectBase):
    version: int


class TrainingProjectSimpleResponse(BaseModel):
    id: int
    project_no: str
    project_name: str
    client_company: str
    contact_person: Optional[str] = None
    training_type: Optional[str] = None
    training_count: int
    status: str
    status_name: str
    current_handler_role: Optional[str] = None
    current_handler: Optional[UserSimpleResponse] = None
    deadline: Optional[datetime] = None
    stage: str
    stage_name: str
    version: int
    created_by: Optional[UserSimpleResponse] = None
    created_at: datetime
    updated_at: datetime
    deadline_status: Optional[str] = None
    overdue_days: Optional[int] = None

    class Config:
        from_attributes = True


class TrainingProjectDetailResponse(TrainingProjectSimpleResponse):
    demand_description: Optional[str] = None
    plan_content: Optional[str] = None
    quotation_amount: float
    contract_no: Optional[str] = None
    contract_date: Optional[datetime] = None
    expected_start_date: Optional[datetime] = None
    expected_end_date: Optional[datetime] = None
    contact_phone: Optional[str] = None
    attachments: List[AttachmentResponse] = []
    processing_records: List[ProcessingRecordResponse] = []
    audit_notes: List[AuditNoteResponse] = []
    exceptions: List[ExceptionRecordResponse] = []
    allowed_actions: List[str] = []

    class Config:
        from_attributes = True


class ProjectListResponse(BaseModel):
    total: int
    page: int
    page_size: int
    items: List[TrainingProjectSimpleResponse]
    stats: Optional[dict] = None


class ProcessActionRequest(BaseModel):
    action: str
    remark: Optional[str] = None
    version: int
    target_stage: Optional[str] = None
    required_attachments: Optional[List[int]] = None


class BatchActionRequest(BaseModel):
    ids: List[int]
    action: str
    remark: Optional[str] = None
    versions: Optional[dict] = None


class BatchResultItem(BaseModel):
    id: int
    project_no: Optional[str] = None
    success: bool
    message: str
    new_status: Optional[str] = None


class BatchActionResponse(BaseModel):
    total: int
    success_count: int
    fail_count: int
    results: List[BatchResultItem]


class AttachmentIdsRequest(BaseModel):
    ids: List[int]


class DashboardStats(BaseModel):
    total_count: int
    draft_count: int
    pending_audit_count: int
    audit_passed_count: int
    pending_review_count: int
    synced_count: int
    normal_deadline_count: int
    near_deadline_count: int
    overdue_count: int
    stage_demand_count: int
    stage_plan_count: int
    stage_contract_count: int
    role_counts: dict
