from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel


class LoginRequest(BaseModel):
    username: str
    password: str


class LoginResponse(BaseModel):
    user_id: str
    role: str
    name: str
    token: str


class UserResponse(BaseModel):
    id: str
    name: str
    role: str

    class Config:
        from_attributes = True


class AttachmentResponse(BaseModel):
    id: str
    inspection_id: str
    file_name: str
    file_path: str
    uploaded_by: str
    uploaded_by_name: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class PreviousOpinionResponse(BaseModel):
    operator_name: Optional[str] = None
    operator_role: Optional[str] = None
    opinion: Optional[str] = None
    attachments: List[AttachmentResponse] = []
    created_at: Optional[datetime] = None


class ChargingPileInspectionCreate(BaseModel):
    pile_code: str
    inspection_items: Optional[str] = None
    result: Optional[str] = None


class ChargingPileInspectionResponse(BaseModel):
    id: str
    pile_code: str
    inspection_items: Optional[str] = None
    result: Optional[str] = None
    inspection_id: Optional[str] = None
    created_by: str
    created_at: datetime

    class Config:
        from_attributes = True


class FaultReportCreate(BaseModel):
    equipment_code: str
    description: str
    severity: str


class FaultReportResponse(BaseModel):
    id: str
    equipment_code: str
    description: str
    severity: str
    inspection_id: Optional[str] = None
    created_by: str
    created_at: datetime

    class Config:
        from_attributes = True


class InspectionCreate(BaseModel):
    title: str
    description: Optional[str] = None
    deadline: str
    charging_pile_inspection_ids: List[str] = []
    fault_report_ids: List[str] = []


class InspectionSubmit(BaseModel):
    version: int


class InspectionProcess(BaseModel):
    opinion: str
    version: int


class InspectionReview(BaseModel):
    opinion: str
    action: str
    version: int


class InspectionReturn(BaseModel):
    reason: str
    version: int


class InspectionCorrect(BaseModel):
    reason: str
    field: str
    new_value: str
    version: int


class ProcessingRecordResponse(BaseModel):
    id: str
    inspection_id: str
    operator_id: str
    operator_role: str
    operator_name: Optional[str] = None
    from_status: str
    to_status: str
    opinion: Optional[str] = None
    version: int
    created_at: datetime

    class Config:
        from_attributes = True


class AuditRemarkResponse(BaseModel):
    id: str
    inspection_id: str
    processing_record_id: Optional[str] = None
    operator_id: str
    operator_name: Optional[str] = None
    from_status: str
    to_status: str
    remark: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class CorrectionRecordResponse(BaseModel):
    id: str
    inspection_id: str
    corrector_id: str
    corrector_name: Optional[str] = None
    reason: str
    field: str
    old_value: Optional[str] = None
    new_value: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class ExceptionReasonResponse(BaseModel):
    id: str
    inspection_id: str
    type: str
    description: str
    created_at: datetime

    class Config:
        from_attributes = True


class InspectionResponse(BaseModel):
    id: str
    title: str
    description: Optional[str] = None
    status: str
    creator_id: str
    creator_name: Optional[str] = None
    processor_id: Optional[str] = None
    processor_name: Optional[str] = None
    reviewer_id: Optional[str] = None
    reviewer_name: Optional[str] = None
    version: int
    deadline: str
    created_at: datetime
    updated_at: datetime
    previous_opinion: Optional[PreviousOpinionResponse] = None
    attachments: List[AttachmentResponse] = []
    charging_pile_inspections: List[ChargingPileInspectionResponse] = []
    fault_reports: List[FaultReportResponse] = []
    processing_records: List[ProcessingRecordResponse] = []
    audit_remarks: List[AuditRemarkResponse] = []
    correction_records: List[CorrectionRecordResponse] = []
    exception_reasons: List[ExceptionReasonResponse] = []

    class Config:
        from_attributes = True


class InspectionListItem(BaseModel):
    id: str
    title: str
    description: Optional[str] = None
    status: str
    creator_id: str
    creator_name: Optional[str] = None
    processor_id: Optional[str] = None
    processor_name: Optional[str] = None
    reviewer_id: Optional[str] = None
    reviewer_name: Optional[str] = None
    version: int
    deadline: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class InspectionStats(BaseModel):
    total: int
    pending_submit: int
    pending_process: int
    pending_review: int
    completed: int
    returned: int
    resubmitted: int


class BatchProcessRequest(BaseModel):
    inspection_ids: List[str]
    action: str
    opinion: Optional[str] = None


class BatchResult(BaseModel):
    inspection_id: str
    success: bool
    reason: Optional[str] = None


class AuditTrailResponse(BaseModel):
    processing_records: List[ProcessingRecordResponse]
    audit_remarks: List[AuditRemarkResponse]
    correction_records: List[CorrectionRecordResponse]
    exception_reasons: List[ExceptionReasonResponse]


class ExpiryQueueResponse(BaseModel):
    normal: List[InspectionListItem]
    approaching: List[InspectionListItem]
    overdue: List[InspectionListItem]
