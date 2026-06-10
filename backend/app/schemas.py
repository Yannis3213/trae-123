from pydantic import BaseModel, Field
from typing import Optional, Any
from datetime import date, datetime


class ContractBasic(BaseModel):
    id: int
    contract_no: str
    contract_name: str
    customer_id: int
    customer_name: Optional[str] = None
    pricing_id: Optional[int] = None
    contract_amount: float = 0
    term_start_date: Optional[str] = None
    term_end_date: Optional[str] = None
    sign_date: Optional[str] = None
    deadline: str
    current_stage: str
    status: str
    version: int
    current_handler_id: Optional[int] = None
    previous_handler_id: Optional[int] = None
    previous_opinion: Optional[str] = None
    audit_remark: Optional[str] = None
    warning_level: Optional[str] = None
    overdue_days: Optional[int] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


class CustomerBase(BaseModel):
    id: Optional[int] = None
    customer_code: str
    customer_name: str
    contact_person: Optional[str] = None
    contact_phone: Optional[str] = None
    address: Optional[str] = None
    voltage_level: Optional[str] = None
    monthly_usage_kwh: Optional[float] = None
    industry: Optional[str] = None


class PricingBase(BaseModel):
    id: Optional[int] = None
    calculation_code: str
    customer_id: int
    contract_term_months: int = 12
    base_price: float
    peak_price: Optional[float] = None
    valley_price: Optional[float] = None
    expected_annual_kwh: Optional[float] = None
    estimated_annual_amount: Optional[float] = None
    discount_rate: float = 0
    status: str = 'draft'


class AttachmentInfo(BaseModel):
    id: int
    contract_id: int
    file_name: str
    file_type: Optional[str] = None
    file_size: Optional[int] = None
    uploaded_by: Optional[int] = None
    uploaded_by_name: Optional[str] = None
    stage: Optional[str] = None
    uploaded_at: Optional[str] = None


class ProcessingRecordInfo(BaseModel):
    id: int
    contract_id: int
    stage: str
    action: str
    from_status: Optional[str] = None
    to_status: Optional[str] = None
    handler_id: int
    handler_name: Optional[str] = None
    handler_role: Optional[str] = None
    opinion: Optional[str] = None
    evidence_json: Optional[str] = None
    version: Optional[int] = None
    created_at: Optional[str] = None


class AuditNoteInfo(BaseModel):
    id: int
    contract_id: int
    note: str
    noted_by: Optional[int] = None
    noted_by_name: Optional[str] = None
    created_at: Optional[str] = None


class ExceptionInfo(BaseModel):
    id: int
    contract_id: int
    exception_type: str
    exception_code: str
    message: str
    detail_json: Optional[str] = None
    stage: Optional[str] = None
    triggered_by: Optional[int] = None
    created_at: Optional[str] = None


class ContractDetail(ContractBasic):
    customer: Optional[CustomerBase] = None
    pricing: Optional[PricingBase] = None
    attachments: list[AttachmentInfo] = []
    records: list[ProcessingRecordInfo] = []
    audit_notes: list[AuditNoteInfo] = []
    exceptions: list[ExceptionInfo] = []
    missing_fields: dict[str, list[str]] = {}


class ProcessAction(BaseModel):
    contract_id: int
    action: str
    version: int
    opinion: Optional[str] = None
    evidence: Optional[dict[str, Any]] = None
    customer_patch: Optional[dict[str, Any]] = None
    pricing_patch: Optional[dict[str, Any]] = None
    audit_remark: Optional[str] = None


class BatchProcessItem(BaseModel):
    contract_id: int
    version: int


class BatchProcessRequest(BaseModel):
    action: str
    items: list[BatchProcessItem]
    opinion: Optional[str] = None
    evidence: Optional[dict[str, Any]] = None


class BatchProcessResult(BaseModel):
    contract_id: int
    contract_no: str
    success: bool
    reason: str


class ContractCreate(BaseModel):
    contract_name: str
    customer_id: int
    pricing_id: Optional[int] = None
    contract_amount: float = 0
    term_start_date: Optional[str] = None
    term_end_date: Optional[str] = None
    sign_date: Optional[str] = None
    deadline: str


class LoginRequest(BaseModel):
    username: str
    password: str


class CurrentUser(BaseModel):
    id: int
    username: str
    real_name: str
    role: str
