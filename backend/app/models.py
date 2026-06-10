from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Boolean, Enum
from sqlalchemy.orm import relationship
import enum

from .database import Base


class UserRole(str, enum.Enum):
    REGISTRAR = "registrar"
    SUPERVISOR = "supervisor"
    REVIEWER = "reviewer"


class PurchaseStatus(str, enum.Enum):
    PENDING_DISPATCH = "pending_dispatch"
    PROCESSING = "processing"
    CLOSED = "closed"


class PriorityLevel(str, enum.Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    URGENT = "urgent"


class WarningLevel(str, enum.Enum):
    NORMAL = "normal"
    APPROACHING = "approaching"
    OVERDUE = "overdue"


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, index=True, nullable=False)
    full_name = Column(String(100), nullable=False)
    hashed_password = Column(String(200), nullable=False)
    role = Column(Enum(UserRole), nullable=False)
    store = Column(String(100))
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    created_orders = relationship("FreshPurchaseOrder", back_populates="creator", foreign_keys="FreshPurchaseOrder.creator_id")
    handled_orders = relationship("FreshPurchaseOrder", back_populates="current_handler", foreign_keys="FreshPurchaseOrder.current_handler_id")


class FreshPurchaseOrder(Base):
    __tablename__ = "fresh_purchase_orders"

    id = Column(Integer, primary_key=True, index=True)
    order_no = Column(String(50), unique=True, index=True, nullable=False)
    title = Column(String(200), nullable=False)
    supplier_name = Column(String(200), nullable=False)
    store = Column(String(100), nullable=False)
    category = Column(String(100))
    amount = Column(String(100))
    priority = Column(Enum(PriorityLevel), default=PriorityLevel.MEDIUM)
    status = Column(Enum(PurchaseStatus), default=PurchaseStatus.PENDING_DISPATCH)
    deadline = Column(DateTime, nullable=False)
    warning_level = Column(Enum(WarningLevel), default=WarningLevel.NORMAL)

    creator_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    current_handler_id = Column(Integer, ForeignKey("users.id"))

    supplier_quotation = Column(Text)
    purchase_order_content = Column(Text)
    arrival_verification = Column(Text)

    has_quotation_evidence = Column(Boolean, default=False)
    has_purchase_evidence = Column(Boolean, default=False)
    has_arrival_evidence = Column(Boolean, default=False)

    is_overdue = Column(Boolean, default=False)
    has_exception = Column(Boolean, default=False)
    exception_reason = Column(Text)
    reject_reason = Column(Text)

    version = Column(Integer, default=1)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    closed_at = Column(DateTime)

    creator = relationship("User", back_populates="created_orders", foreign_keys=[creator_id])
    current_handler = relationship("User", back_populates="handled_orders", foreign_keys=[current_handler_id])

    attachments = relationship("Attachment", back_populates="order", cascade="all, delete-orphan")
    processing_records = relationship("ProcessingRecord", back_populates="order", cascade="all, delete-orphan")
    audit_notes = relationship("AuditNote", back_populates="order", cascade="all, delete-orphan")


class Attachment(Base):
    __tablename__ = "attachments"

    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("fresh_purchase_orders.id"), nullable=False)
    filename = Column(String(255), nullable=False)
    file_type = Column(String(50))
    category = Column(String(100))
    uploader_id = Column(Integer, ForeignKey("users.id"))
    uploaded_at = Column(DateTime, default=datetime.utcnow)
    description = Column(Text)

    order = relationship("FreshPurchaseOrder", back_populates="attachments")


class ProcessingRecord(Base):
    __tablename__ = "processing_records"

    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("fresh_purchase_orders.id"), nullable=False)
    action = Column(String(100), nullable=False)
    from_status = Column(String(50))
    to_status = Column(String(50))
    handler_id = Column(Integer, ForeignKey("users.id"))
    handler_name = Column(String(100))
    handler_role = Column(String(50))
    result = Column(String(50))
    comment = Column(Text)
    exception_reason = Column(Text)
    evidence_checked = Column(Text)
    timestamp = Column(DateTime, default=datetime.utcnow)

    order = relationship("FreshPurchaseOrder", back_populates="processing_records")


class AuditNote(Base):
    __tablename__ = "audit_notes"

    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("fresh_purchase_orders.id"), nullable=False)
    note = Column(Text, nullable=False)
    note_type = Column(String(50))
    author_id = Column(Integer, ForeignKey("users.id"))
    author_name = Column(String(100))
    author_role = Column(String(50))
    created_at = Column(DateTime, default=datetime.utcnow)

    order = relationship("FreshPurchaseOrder", back_populates="audit_notes")
