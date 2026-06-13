from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Dict, Any
from datetime import datetime


class UserBase(BaseModel):
    username: str
    full_name: str
    role: str
    department: str = ""


class UserCreate(UserBase):
    password: str


class UserLogin(BaseModel):
    username: str
    password: str


class UserResponse(UserBase):
    id: int
    created_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class LoginResponse(BaseModel):
    user: UserResponse
    token: str


class AttachmentBase(BaseModel):
    file_name: str
    file_type: str = ""
    file_size: int = 0
    evidence_type: str = ""


class AttachmentResponse(AttachmentBase):
    id: int
    care_record_id: int
    uploaded_by: Optional[int] = None
    uploaded_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class ProcessRecordBase(BaseModel):
    action: str
    from_status: str = ""
    to_status: str = ""
    remark: str = ""
    result: str = "success"
    error_message: str = ""


class ProcessRecordResponse(ProcessRecordBase):
    id: int
    care_record_id: int
    operator_id: Optional[int] = None
    operator_name: str = ""
    operator_role: str = ""
    version_snapshot: int = 1
    created_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class AuditNoteBase(BaseModel):
    note_type: str = "general"
    content: str


class AuditNoteResponse(AuditNoteBase):
    id: int
    care_record_id: int
    operator_id: Optional[int] = None
    operator_name: str = ""
    created_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class CareRecordBase(BaseModel):
    elder_name: str
    elder_id_card: str = ""
    room_no: str = ""
    bed_no: str = ""
    care_type: str
    care_content: str
    record_date: datetime
    medication_detail: Any = Field(default_factory=list)
    vital_signs: Dict[str, Any] = Field(default_factory=dict)
    evidence_required: List[str] = Field(default_factory=list)
    evidence_provided: List[str] = Field(default_factory=list)
    abnormal_reason: str = ""


class CareRecordCreate(CareRecordBase):
    pass


class CareRecordUpdate(BaseModel):
    care_content: Optional[str] = None
    medication_issued: Optional[bool] = None
    medication_detail: Optional[Any] = None
    vital_signs: Optional[Dict[str, Any]] = None
    vital_signs_corrected: Optional[bool] = None
    abnormal_reported: Optional[bool] = None
    abnormal_review_result: Optional[str] = None
    abnormal_reason: Optional[str] = None
    evidence_provided: Optional[List[str]] = None
    missing_evidence: Optional[List[str]] = None


class CareRecordSubmit(BaseModel):
    version: int
    evidence_provided: List[str] = Field(default_factory=list)


class CareRecordAudit(BaseModel):
    version: int
    passed: bool
    remark: str = ""
    missing_evidence: List[str] = Field(default_factory=list)
    abnormal_reason: str = ""


class CareRecordReview(BaseModel):
    version: int
    remark: str = ""


class CareRecordCorrect(BaseModel):
    version: int
    care_content: Optional[str] = None
    medication_detail: Optional[Any] = None
    vital_signs: Optional[Dict[str, Any]] = None
    vital_signs_corrected: Optional[bool] = None
    abnormal_reported: Optional[bool] = None
    abnormal_review_result: Optional[str] = None
    abnormal_reason: Optional[str] = None
    evidence_provided: Optional[List[str]] = None
    correction_note: str = ""


class CareRecordResponse(BaseModel):
    id: int
    record_no: str
    elder_name: str
    elder_id_card: str
    room_no: str
    bed_no: str
    care_type: str
    care_content: str
    record_date: datetime
    status: str
    version: int

    medication_issued: bool
    medication_detail: Any = Field(default_factory=list)
    vital_signs: Dict[str, Any] = Field(default_factory=dict)
    vital_signs_corrected: bool

    abnormal_reported: bool
    abnormal_review_result: str
    abnormal_reason: str

    evidence_required: List[str] = Field(default_factory=list)
    evidence_provided: List[str] = Field(default_factory=list)
    missing_evidence: List[str] = Field(default_factory=list)

    submitter_id: Optional[int] = None
    submitter_name: str
    submitted_at: Optional[datetime] = None

    auditor_id: Optional[int] = None
    auditor_name: str
    audited_at: Optional[datetime] = None
    audit_remark: str

    reviewer_id: Optional[int] = None
    reviewer_name: str
    reviewed_at: Optional[datetime] = None
    review_remark: str

    sync_status: str
    synced_at: Optional[datetime] = None

    due_date: Optional[datetime] = None
    overdue: bool

    correction_history: List[Dict[str, Any]] = Field(default_factory=list)
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    attachments: List[AttachmentResponse] = Field(default_factory=list)
    process_records: List[ProcessRecordResponse] = Field(default_factory=list)
    audit_notes: List[AuditNoteResponse] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)


class CareRecordListResponse(BaseModel):
    id: int
    record_no: str
    elder_name: str
    room_no: str
    bed_no: str
    care_type: str
    status: str
    submitter_name: str
    auditor_name: str
    reviewer_name: str
    submitted_at: Optional[datetime] = None
    audited_at: Optional[datetime] = None
    reviewed_at: Optional[datetime] = None
    due_date: Optional[datetime] = None
    overdue: bool
    version: int
    abnormal_reported: bool
    missing_evidence: List[str] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)


class PaginatedResponse(BaseModel):
    items: List[CareRecordListResponse]
    total: int
    page: int
    page_size: int


class BatchOperationRequest(BaseModel):
    ids: List[int]
    version_map: Dict[int, int] = Field(default_factory=dict)
    action: str
    remark: str = ""
    missing_evidence: Dict[int, List[str]] = Field(default_factory=dict)
    passed_map: Dict[int, bool] = Field(default_factory=dict)


class BatchResultItem(BaseModel):
    id: int
    record_no: str
    success: bool
    error_message: str = ""
    has_missing_evidence: bool = False
    missing_evidence: List[str] = Field(default_factory=list)
    abnormal_reported: bool = False
    abnormal_reason: str = ""


class BatchAdvanceOverdueRequest(BaseModel):
    ids: List[int]
    version_map: Dict[int, int] = Field(default_factory=dict)


class BatchOperationResponse(BaseModel):
    results: List[BatchResultItem]
    success_count: int
    failed_count: int


class StatsResponse(BaseModel):
    total: int = 0
    pending_submit: int = 0
    pending_audit: int = 0
    pending_review: int = 0
    audited_passed: int = 0
    synced: int = 0
    returned: int = 0
    overdue: int = 0
    near_due: int = 0
    abnormal: int = 0
    missing_evidence: int = 0
    by_status: Dict[str, int] = Field(default_factory=dict)
