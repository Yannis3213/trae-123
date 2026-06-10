from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, Boolean
from sqlalchemy.orm import relationship

from database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    full_name = Column(String, nullable=False)
    hashed_password = Column(String, nullable=False)
    role = Column(String, nullable=False)

    ROLE_CUSTOMER_SERVICE = "客服专员"
    ROLE_DISPATCH_SUPERVISOR = "调度主管"
    ROLE_OPERATIONS_MANAGER = "运营经理"

    ROLES = [ROLE_CUSTOMER_SERVICE, ROLE_DISPATCH_SUPERVISOR, ROLE_OPERATIONS_MANAGER]


class TransportOrder(Base):
    __tablename__ = "transport_orders"

    id = Column(Integer, primary_key=True, index=True)
    order_no = Column(String, unique=True, index=True, nullable=False)
    status = Column(String, nullable=False, default="待补正")
    priority = Column(String, nullable=False, default="中")
    responsible_person = Column(String, nullable=False)
    deadline = Column(DateTime, nullable=False)
    version = Column(Integer, nullable=False, default=1)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    current_handler = Column(String, nullable=False)
    is_overdue = Column(Boolean, default=False)
    overdue_reason = Column(Text, nullable=True)

    consignor_name = Column(String, nullable=True)
    consignor_contact = Column(String, nullable=True)
    consignor_phone = Column(String, nullable=True)
    consignee_name = Column(String, nullable=True)
    consignee_contact = Column(String, nullable=True)
    consignee_phone = Column(String, nullable=True)
    cargo_name = Column(String, nullable=True)
    cargo_weight = Column(String, nullable=True)
    cargo_volume = Column(String, nullable=True)
    cargo_quantity = Column(String, nullable=True)
    departure = Column(String, nullable=True)
    destination = Column(String, nullable=True)
    transport_requirements = Column(Text, nullable=True)

    vehicle_plate = Column(String, nullable=True)
    vehicle_type = Column(String, nullable=True)
    driver_name = Column(String, nullable=True)
    driver_phone = Column(String, nullable=True)
    dispatch_time = Column(DateTime, nullable=True)
    estimated_arrival = Column(DateTime, nullable=True)

    receipt_signer = Column(String, nullable=True)
    receipt_time = Column(DateTime, nullable=True)
    receipt_status = Column(String, nullable=True)
    receipt_remark = Column(Text, nullable=True)

    STATUS_PENDING_CORRECTION = "待补正"
    STATUS_UNDER_REVIEW = "复核中"
    STATUS_COMPLETED = "办结"

    STATUSES = [STATUS_PENDING_CORRECTION, STATUS_UNDER_REVIEW, STATUS_COMPLETED]

    PRIORITY_HIGH = "高"
    PRIORITY_MEDIUM = "中"
    PRIORITY_LOW = "低"

    PRIORITIES = [PRIORITY_HIGH, PRIORITY_MEDIUM, PRIORITY_LOW]

    attachments = relationship("Attachment", back_populates="order", cascade="all, delete-orphan")
    processing_records = relationship("ProcessingRecord", back_populates="order", cascade="all, delete-orphan")
    audit_notes = relationship("AuditNote", back_populates="order", cascade="all, delete-orphan")
    exception_reasons = relationship("ExceptionReason", back_populates="order", cascade="all, delete-orphan")


class Attachment(Base):
    __tablename__ = "attachments"

    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("transport_orders.id"), nullable=False)
    file_name = Column(String, nullable=False)
    file_type = Column(String, nullable=False)
    uploaded_by = Column(String, nullable=False)
    uploaded_at = Column(DateTime, default=datetime.utcnow)
    description = Column(Text, nullable=True)

    TYPE_CONSIGNMENT = "运输委托单"
    TYPE_DISPATCH = "车辆调度单"
    TYPE_RECEIPT = "签收回单"
    TYPE_OTHER = "其他"

    TYPES = [TYPE_CONSIGNMENT, TYPE_DISPATCH, TYPE_RECEIPT, TYPE_OTHER]

    order = relationship("TransportOrder", back_populates="attachments")


class ProcessingRecord(Base):
    __tablename__ = "processing_records"

    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("transport_orders.id"), nullable=False)
    action = Column(String, nullable=False)
    operator = Column(String, nullable=False)
    operator_role = Column(String, nullable=False)
    previous_status = Column(String, nullable=True)
    new_status = Column(String, nullable=True)
    remark = Column(Text, nullable=True)
    evidence_summary = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    ACTION_SUBMIT = "提交"
    ACTION_REVIEW = "核验"
    ACTION_APPROVE = "通过"
    ACTION_REJECT = "退回补正"
    ACTION_COMPLETE = "办结归档"
    ACTION_UPDATE = "更新"
    ACTION_SAVE = "保存"

    ACTIONS = [ACTION_SUBMIT, ACTION_REVIEW, ACTION_APPROVE, ACTION_REJECT, ACTION_COMPLETE, ACTION_UPDATE, ACTION_SAVE]

    order = relationship("TransportOrder", back_populates="processing_records")


class AuditNote(Base):
    __tablename__ = "audit_notes"

    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("transport_orders.id"), nullable=False)
    note = Column(Text, nullable=False)
    noted_by = Column(String, nullable=False)
    noted_at = Column(DateTime, default=datetime.utcnow)

    order = relationship("TransportOrder", back_populates="audit_notes")


class ExceptionReason(Base):
    __tablename__ = "exception_reasons"

    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("transport_orders.id"), nullable=False)
    category = Column(String, nullable=False)
    reason = Column(Text, nullable=False)
    reported_by = Column(String, nullable=False)
    node_handler = Column(String, nullable=True)
    reported_at = Column(DateTime, default=datetime.utcnow)
    resolved = Column(Boolean, default=False)
    resolved_by = Column(String, nullable=True)
    resolved_at = Column(DateTime, nullable=True)
    resolution_note = Column(Text, nullable=True)

    CATEGORY_MATERIAL = "材料问题"
    CATEGORY_PERMISSION = "权限问题"
    CATEGORY_DEADLINE = "时限问题"
    CATEGORY_STATUS = "状态问题"

    CATEGORIES = [CATEGORY_MATERIAL, CATEGORY_PERMISSION, CATEGORY_DEADLINE, CATEGORY_STATUS]

    order = relationship("TransportOrder", back_populates="exception_reasons")
