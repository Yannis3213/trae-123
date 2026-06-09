from datetime import datetime, date
from typing import Optional, List
from pydantic import BaseModel, Field


class UserOut(BaseModel):
    id: int
    username: str
    name: str
    role: str

    class Config:
        from_attributes = True


class LoginIn(BaseModel):
    username: str


class AttachmentOut(BaseModel):
    id: int
    file_name: str
    file_type: str
    evidence_type: str
    description: str
    uploaded_by_id: int
    uploaded_by_name: str
    uploaded_at: datetime

    class Config:
        from_attributes = True


class AttachmentIn(BaseModel):
    file_name: str
    file_type: str = 'text/plain'
    evidence_type: str = ''
    description: str = ''


class ExceptionReasonOut(BaseModel):
    id: int
    exception_type: str
    description: str
    reporter_id: int
    reporter_name: str
    created_at: datetime
    resolved: bool

    class Config:
        from_attributes = True


class ExceptionReasonIn(BaseModel):
    exception_type: str
    description: str


class AuditNoteOut(BaseModel):
    id: int
    author_id: int
    author_name: str
    content: str
    created_at: datetime

    class Config:
        from_attributes = True


class ProcessingRecordOut(BaseModel):
    id: int
    actor_id: int
    actor_name: str
    action: str
    from_status: str
    to_status: str
    comment: str
    opinion: str
    audit_note: str = ''
    exception_type: str = ''
    exception_desc: str = ''
    evidence_count: int = 0
    batch_id: str = ''
    created_at: datetime

    class Config:
        from_attributes = True


class AppointmentBase(BaseModel):
    title: str
    experiment_name: str
    experiment_room: str = ''
    experiment_date: Optional[date] = None
    student_count: int = 0
    course_name: str = ''
    teacher_name: str = ''
    materials_requested: str = ''
    safety_confirmed: bool = False
    safety_note: str = ''
    priority: str = 'NORMAL'
    deadline: Optional[datetime] = None


class AppointmentIn(AppointmentBase):
    version: int = 1
    opinion: str = ''
    comment: str = ''
    audit_note: str = ''
    attachments: List[AttachmentIn] = []
    exception_type: str = ''
    exception_desc: str = ''


class AppointmentUpdateIn(BaseModel):
    title: Optional[str] = None
    experiment_name: Optional[str] = None
    experiment_room: Optional[str] = None
    experiment_date: Optional[date] = None
    student_count: Optional[int] = None
    course_name: Optional[str] = None
    teacher_name: Optional[str] = None
    materials_requested: Optional[str] = None
    safety_confirmed: Optional[bool] = None
    safety_note: Optional[str] = None
    priority: Optional[str] = None
    deadline: Optional[datetime] = None
    status: Optional[str] = None
    audit_comment: Optional[str] = None
    version: int


class AppointmentOut(AppointmentBase):
    id: int
    order_no: str
    status: str
    version: int
    owner_id: Optional[int] = None
    owner_name: str = ''
    current_handler_id: Optional[int] = None
    current_handler_name: str = ''
    created_at: datetime
    updated_at: datetime
    warning_level: str = 'normal'
    is_overdue: bool = False

    class Config:
        from_attributes = True


class AppointmentDetailOut(AppointmentOut):
    attachments: List[AttachmentOut] = []
    records: List[ProcessingRecordOut] = []
    audit_notes: List[AuditNoteOut] = []
    exceptions: List[ExceptionReasonOut] = []


class ActionIn(BaseModel):
    opinion: str = ''
    comment: str = ''
    version: int
    attachments: List[AttachmentIn] = []
    audit_note: str = ''
    exception_type: str = ''
    exception_desc: str = ''


class BatchActionIn(BaseModel):
    ids: List[int]
    action: str
    opinion: str = ''
    comment: str = ''
    audit_note: str = ''
    version_map: dict = {}
    opinion_map: dict = {}
    audit_note_map: dict = {}
    exception_type_map: dict = {}
    exception_desc_map: dict = {}
