from datetime import datetime
from sqlalchemy import Column, Text, String, Integer, DateTime, ForeignKey, Index
from sqlalchemy.orm import relationship
from database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Text, primary_key=True)
    name = Column(Text, nullable=False)
    role = Column(Text, nullable=False)
    password_hash = Column(Text, nullable=False)


class Inspection(Base):
    __tablename__ = "inspections"
    __table_args__ = (
        Index("ix_inspections_status", "status"),
        Index("ix_inspections_creator_id", "creator_id"),
        Index("ix_inspections_processor_id", "processor_id"),
        Index("ix_inspections_deadline", "deadline"),
    )

    id = Column(Text, primary_key=True)
    title = Column(Text, nullable=False)
    description = Column(Text, nullable=True)
    status = Column(Text, nullable=False, default="pending_submit")
    creator_id = Column(Text, ForeignKey("users.id"), nullable=False)
    processor_id = Column(Text, ForeignKey("users.id"), nullable=True)
    reviewer_id = Column(Text, ForeignKey("users.id"), nullable=True)
    version = Column(Integer, nullable=False, default=1)
    deadline = Column(Text, nullable=False)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    charging_pile_inspections = relationship(
        "ChargingPileInspection", backref="inspection",
        foreign_keys="ChargingPileInspection.inspection_id", lazy="select",
    )
    fault_reports = relationship(
        "FaultReport", backref="inspection",
        foreign_keys="FaultReport.inspection_id", lazy="select",
    )
    processing_records = relationship(
        "ProcessingRecord", backref="inspection",
        foreign_keys="ProcessingRecord.inspection_id", lazy="select",
    )
    audit_remarks = relationship(
        "AuditRemark", backref="inspection",
        foreign_keys="AuditRemark.inspection_id", lazy="select",
    )
    correction_records = relationship(
        "CorrectionRecord", backref="inspection",
        foreign_keys="CorrectionRecord.inspection_id", lazy="select",
    )
    exception_reasons = relationship(
        "ExceptionReason", backref="inspection",
        foreign_keys="ExceptionReason.inspection_id", lazy="select",
    )
    attachments = relationship(
        "Attachment", backref="inspection",
        foreign_keys="Attachment.inspection_id", lazy="select",
    )


class ChargingPileInspection(Base):
    __tablename__ = "charging_pile_inspections"
    __table_args__ = (
        Index("ix_cpi_inspection_id", "inspection_id"),
    )

    id = Column(Text, primary_key=True)
    pile_code = Column(Text, nullable=False)
    inspection_items = Column(Text, nullable=True)
    result = Column(Text, nullable=True)
    inspection_id = Column(Text, ForeignKey("inspections.id", ondelete="SET NULL"), nullable=True)
    created_by = Column(Text, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)


class FaultReport(Base):
    __tablename__ = "fault_reports"
    __table_args__ = (
        Index("ix_fr_inspection_id", "inspection_id"),
    )

    id = Column(Text, primary_key=True)
    equipment_code = Column(Text, nullable=False)
    description = Column(Text, nullable=False)
    severity = Column(Text, nullable=False)
    inspection_id = Column(Text, ForeignKey("inspections.id", ondelete="SET NULL"), nullable=True)
    created_by = Column(Text, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)


class Attachment(Base):
    __tablename__ = "attachments"
    __table_args__ = (
        Index("ix_att_inspection_id", "inspection_id"),
    )

    id = Column(Text, primary_key=True)
    inspection_id = Column(Text, ForeignKey("inspections.id", ondelete="CASCADE"), nullable=False)
    file_name = Column(Text, nullable=False)
    file_path = Column(Text, nullable=False)
    uploaded_by = Column(Text, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)


class ProcessingRecord(Base):
    __tablename__ = "processing_records"
    __table_args__ = (
        Index("ix_pr_inspection_id", "inspection_id"),
    )

    id = Column(Text, primary_key=True)
    inspection_id = Column(Text, ForeignKey("inspections.id", ondelete="CASCADE"), nullable=False)
    operator_id = Column(Text, ForeignKey("users.id"), nullable=False)
    operator_role = Column(Text, nullable=False)
    from_status = Column(Text, nullable=False)
    to_status = Column(Text, nullable=False)
    opinion = Column(Text, nullable=True)
    version = Column(Integer, nullable=False)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)


class AuditRemark(Base):
    __tablename__ = "audit_remarks"
    __table_args__ = (
        Index("ix_ar_inspection_id", "inspection_id"),
    )

    id = Column(Text, primary_key=True)
    inspection_id = Column(Text, ForeignKey("inspections.id", ondelete="CASCADE"), nullable=False)
    processing_record_id = Column(Text, ForeignKey("processing_records.id", ondelete="SET NULL"), nullable=True)
    operator_id = Column(Text, ForeignKey("users.id"), nullable=False)
    from_status = Column(Text, nullable=False)
    to_status = Column(Text, nullable=False)
    remark = Column(Text, nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)


class CorrectionRecord(Base):
    __tablename__ = "correction_records"
    __table_args__ = (
        Index("ix_cr_inspection_id", "inspection_id"),
    )

    id = Column(Text, primary_key=True)
    inspection_id = Column(Text, ForeignKey("inspections.id", ondelete="CASCADE"), nullable=False)
    corrector_id = Column(Text, ForeignKey("users.id"), nullable=False)
    reason = Column(Text, nullable=False)
    field = Column(Text, nullable=False)
    old_value = Column(Text, nullable=True)
    new_value = Column(Text, nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)


class ExceptionReason(Base):
    __tablename__ = "exception_reasons"
    __table_args__ = (
        Index("ix_er_inspection_id", "inspection_id"),
    )

    id = Column(Text, primary_key=True)
    inspection_id = Column(Text, ForeignKey("inspections.id", ondelete="CASCADE"), nullable=False)
    type = Column(Text, nullable=False)
    description = Column(Text, nullable=False)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
