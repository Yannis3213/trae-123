from datetime import datetime
from typing import Optional

from ninja import ModelSchema, Schema

from listings.models import (
    Operator,
    VehicleListingApplication,
    ProcessingRecord,
    AuditNote,
    Attachment,
    RoleChoices,
    ApplicationStatus,
    STATUS_LABEL_MAP,
    ROLE_DISPLAY_MAP,
)


class OperatorOut(ModelSchema):
    class Config:
        model = Operator
        model_fields = ('id', 'username', 'display_name', 'role', 'store_name')


class ApplicationOut(Schema):
    id: int
    application_no: str
    brand: str
    model_name: str
    year: int
    vin: str
    license_plate: str
    mileage: int
    status: str
    version: int
    applicant: Optional[int] = None
    evaluator: Optional[int] = None
    reviewer: Optional[int] = None
    applicant_display: Optional[str] = None
    evaluator_display: Optional[str] = None
    reviewer_display: Optional[str] = None
    store_name: str
    has_listing_evidence: bool
    missing_evidence_reason: str
    supplement_remark: str
    evaluation_result: str
    review_result: str
    reject_reason: str
    deadline: Optional[datetime] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    page_label: str
    expiry_status: str
    responsible_person_display: Optional[str] = None


class ApplicationCreate(Schema):
    brand: str
    model_name: str
    year: int
    vin: str
    license_plate: str
    mileage: int
    has_listing_evidence: bool = False
    missing_evidence_reason: str = ''
    store_name: str = ''
    deadline: Optional[datetime] = None


class ApplicationSupplement(Schema):
    supplement_remark: str = ''
    has_listing_evidence: Optional[bool] = None
    missing_evidence_reason: str = ''
    status: str = ''
    version: int = 0


class ApplicationProcess(Schema):
    evaluation_result: str
    status: str = ''
    version: int = 0


class ApplicationReview(Schema):
    review_result: str
    action: str
    reject_reason: str = ''
    status: str = ''
    version: int = 0


class BatchProcessItem(Schema):
    application_id: int
    action: str
    remark: str = ''
    status: str = ''
    version: int = 0


class BatchProcessResult(Schema):
    application_id: int
    application_no: str
    success: bool
    reason: str = ''


class ProcessingRecordOut(ModelSchema):
    class Config:
        model = ProcessingRecord
        model_fields = (
            'id', 'application', 'operator', 'operator_role',
            'action', 'from_status', 'to_status', 'remark',
            'failure_reason', 'created_at',
        )


class AuditNoteOut(ModelSchema):
    class Config:
        model = AuditNote
        model_fields = (
            'id', 'application', 'operator', 'operator_role',
            'note', 'failure_reason', 'created_at',
        )


class AttachmentOut(ModelSchema):
    class Config:
        model = Attachment
        model_fields = ('id', 'application', 'file_name', 'file_type', 'uploaded_by', 'uploaded_at')


class ExpiryWarningGroup(Schema):
    status_label: str
    items: list[ApplicationOut]


class ErrorResponse(Schema):
    detail: str
    code: Optional[str] = None


class StateCheck(Schema):
    status: str
    version: int


class LoginRequest(Schema):
    username: str


class PaginatedApplicationOut(Schema):
    count: int
    results: list[ApplicationOut]
    stats: Optional[dict] = None
