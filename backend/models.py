from sqlalchemy import (
    Column, Integer, String, Text, DateTime, ForeignKey, Boolean, JSON
)
from sqlalchemy.orm import relationship
from datetime import datetime
from database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, nullable=False)
    password = Column(String(100), nullable=False)
    full_name = Column(String(100), nullable=False)
    role = Column(String(30), nullable=False)
    department = Column(String(100), default="")
    created_at = Column(DateTime, default=datetime.utcnow)


class CareRecord(Base):
    __tablename__ = "care_records"

    id = Column(Integer, primary_key=True, index=True)
    record_no = Column(String(50), unique=True, nullable=False)
    elder_name = Column(String(100), nullable=False)
    elder_id_card = Column(String(50), default="")
    room_no = Column(String(30), default="")
    bed_no = Column(String(30), default="")
    care_type = Column(String(50), nullable=False)
    care_content = Column(Text, nullable=False)
    record_date = Column(DateTime, nullable=False)
    status = Column(String(30), default="PENDING_SUBMIT", nullable=False)
    version = Column(Integer, default=1, nullable=False)

    medication_issued = Column(Boolean, default=False)
    medication_detail = Column(JSON, default=dict)
    vital_signs = Column(JSON, default=dict)
    vital_signs_corrected = Column(Boolean, default=False)

    abnormal_reported = Column(Boolean, default=False)
    abnormal_review_result = Column(String(200), default="")
    abnormal_reason = Column(Text, default="")

    evidence_required = Column(JSON, default=list)
    evidence_provided = Column(JSON, default=list)
    missing_evidence = Column(JSON, default=list)

    submitter_id = Column(Integer, ForeignKey("users.id"))
    submitter_name = Column(String(100), default="")
    submitted_at = Column(DateTime, nullable=True)

    auditor_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    auditor_name = Column(String(100), default="")
    audited_at = Column(DateTime, nullable=True)
    audit_remark = Column(Text, default="")

    reviewer_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    reviewer_name = Column(String(100), default="")
    reviewed_at = Column(DateTime, nullable=True)
    review_remark = Column(Text, default="")

    sync_status = Column(String(30), default="NOT_SYNCED")
    synced_at = Column(DateTime, nullable=True)

    due_date = Column(DateTime, nullable=True)
    overdue = Column(Boolean, default=False)

    correction_history = Column(JSON, default=list)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    attachments = relationship("Attachment", back_populates="care_record", cascade="all, delete-orphan")
    process_records = relationship("ProcessRecord", back_populates="care_record", cascade="all, delete-orphan")
    audit_notes = relationship("AuditNote", back_populates="care_record", cascade="all, delete-orphan")


class Attachment(Base):
    __tablename__ = "attachments"

    id = Column(Integer, primary_key=True, index=True)
    care_record_id = Column(Integer, ForeignKey("care_records.id"), nullable=False)
    file_name = Column(String(255), nullable=False)
    file_type = Column(String(50), default="")
    file_size = Column(Integer, default=0)
    uploaded_by = Column(Integer, ForeignKey("users.id"))
    uploaded_at = Column(DateTime, default=datetime.utcnow)
    evidence_type = Column(String(50), default="")

    care_record = relationship("CareRecord", back_populates="attachments")


class ProcessRecord(Base):
    __tablename__ = "process_records"

    id = Column(Integer, primary_key=True, index=True)
    care_record_id = Column(Integer, ForeignKey("care_records.id"), nullable=False)
    action = Column(String(50), nullable=False)
    from_status = Column(String(30), default="")
    to_status = Column(String(30), default="")
    operator_id = Column(Integer, ForeignKey("users.id"))
    operator_name = Column(String(100), default="")
    operator_role = Column(String(30), default="")
    remark = Column(Text, default="")
    result = Column(String(20), default="success")
    error_message = Column(Text, default="")
    version_snapshot = Column(Integer, default=1)
    created_at = Column(DateTime, default=datetime.utcnow)

    care_record = relationship("CareRecord", back_populates="process_records")


class AuditNote(Base):
    __tablename__ = "audit_notes"

    id = Column(Integer, primary_key=True, index=True)
    care_record_id = Column(Integer, ForeignKey("care_records.id"), nullable=False)
    note_type = Column(String(30), default="general")
    content = Column(Text, nullable=False)
    operator_id = Column(Integer, ForeignKey("users.id"))
    operator_name = Column(String(100), default="")
    created_at = Column(DateTime, default=datetime.utcnow)

    care_record = relationship("CareRecord", back_populates="audit_notes")
