import datetime
import enum

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import relationship

from app.database import Base


class RoleEnum(str, enum.Enum):
    REGISTRATION_CLERK = "registration_clerk"
    AUDIT_SUPERVISOR = "audit_supervisor"
    REVIEW_LEAD = "review_lead"


ROLE_LABELS = {
    RoleEnum.REGISTRATION_CLERK: "会员入会登记员",
    RoleEnum.AUDIT_SUPERVISOR: "会员入会审核主管",
    RoleEnum.REVIEW_LEAD: "社区健身房复核负责人",
}


class EnrollmentStatusEnum(str, enum.Enum):
    PENDING = "pending"
    FAILED = "failed"
    COMPLETED = "completed"


STATUS_LABELS = {
    EnrollmentStatusEnum.PENDING: "待核验",
    EnrollmentStatusEnum.FAILED: "核验失败",
    EnrollmentStatusEnum.COMPLETED: "核验完成",
}


class EvidenceTypeEnum(str, enum.Enum):
    MEMBERSHIP_FORM = "membership_form"
    CONTRACT_CONFIRMATION = "contract_confirmation"
    CARD_BENEFITS = "card_benefits"


EVIDENCE_LABELS = {
    EvidenceTypeEnum.MEMBERSHIP_FORM: "会员入会",
    EvidenceTypeEnum.CONTRACT_CONFIRMATION: "合同确认",
    EvidenceTypeEnum.CARD_BENEFITS: "卡权益启用",
}


class ExpiryStatusEnum(str, enum.Enum):
    NORMAL = "normal"
    APPROACHING = "approaching"
    OVERDUE = "overdue"


EXPIRY_LABELS = {
    ExpiryStatusEnum.NORMAL: "正常",
    ExpiryStatusEnum.APPROACHING: "临期",
    ExpiryStatusEnum.OVERDUE: "逾期",
}


class ActionTypeEnum(str, enum.Enum):
    CREATE = "create"
    SUBMIT = "submit"
    AUDIT_PASS = "audit_pass"
    AUDIT_FAIL = "audit_fail"
    REVIEW_PASS = "review_pass"
    REVIEW_FAIL = "review_fail"
    CORRECT = "correct"
    REASSIGN = "reassign"
    NOTE = "note"


ACTION_LABELS = {
    ActionTypeEnum.CREATE: "创建",
    ActionTypeEnum.SUBMIT: "提交",
    ActionTypeEnum.AUDIT_PASS: "审核通过",
    ActionTypeEnum.AUDIT_FAIL: "审核退回",
    ActionTypeEnum.REVIEW_PASS: "复核通过",
    ActionTypeEnum.REVIEW_FAIL: "复核退回",
    ActionTypeEnum.CORRECT: "补正",
    ActionTypeEnum.REASSIGN: "转派",
    ActionTypeEnum.NOTE: "备注",
}


class ExceptionTypeEnum(str, enum.Enum):
    MISSING_MATERIALS = "missing_materials"
    STATUS_CONFLICT = "status_conflict"
    UNAUTHORIZED_ADVANCE = "unauthorized_advance"
    OVERDUE = "overdue"


EXCEPTION_LABELS = {
    ExceptionTypeEnum.MISSING_MATERIALS: "资料缺失",
    ExceptionTypeEnum.STATUS_CONFLICT: "状态冲突",
    ExceptionTypeEnum.UNAUTHORIZED_ADVANCE: "越权推进",
    ExceptionTypeEnum.OVERDUE: "超期未处理",
}


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, index=True, nullable=False)
    full_name = Column(String(100), nullable=False)
    hashed_password = Column(String(255), nullable=False)
    role = Column(Enum(RoleEnum), nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    created_enrollments = relationship(
        "Enrollment",
        foreign_keys="Enrollment.created_by_id",
        back_populates="created_by",
    )
    audit_logs = relationship("AuditLog", back_populates="user")


class Enrollment(Base):
    __tablename__ = "enrollments"

    id = Column(Integer, primary_key=True, index=True)
    member_name = Column(String(100), nullable=False)
    member_phone = Column(String(20), nullable=False)
    member_id_card = Column(String(20), nullable=True)
    membership_type = Column(String(50), nullable=False)
    card_level = Column(String(50), nullable=True)
    amount = Column(Integer, nullable=False)
    contract_no = Column(String(50), nullable=True)
    salesperson = Column(String(100), nullable=True)
    private_trainer = Column(String(100), nullable=True)
    store = Column(String(100), nullable=False)
    remark = Column(Text, nullable=True)

    status = Column(Enum(EnrollmentStatusEnum), default=EnrollmentStatusEnum.PENDING, nullable=False)
    version = Column(Integer, default=1, nullable=False)

    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    current_handler_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    audit_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    review_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)

    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)
    submitted_at = Column(DateTime, nullable=True)
    audited_at = Column(DateTime, nullable=True)
    reviewed_at = Column(DateTime, nullable=True)
    due_at = Column(DateTime, nullable=False)

    created_by = relationship(
        "User",
        foreign_keys=[created_by_id],
        back_populates="created_enrollments",
    )
    current_handler = relationship(
        "User",
        foreign_keys=[current_handler_id],
    )
    audit_by = relationship("User", foreign_keys=[audit_by_id])
    review_by = relationship("User", foreign_keys=[review_by_id])

    attachments = relationship(
        "Attachment",
        back_populates="enrollment",
        cascade="all, delete-orphan",
    )
    audit_logs = relationship(
        "AuditLog",
        back_populates="enrollment",
        cascade="all, delete-orphan",
        order_by="AuditLog.created_at.desc()",
    )
    exceptions = relationship(
        "ExceptionLog",
        back_populates="enrollment",
        cascade="all, delete-orphan",
        order_by="ExceptionLog.detected_at.desc()",
    )


class Attachment(Base):
    __tablename__ = "attachments"

    id = Column(Integer, primary_key=True, index=True)
    enrollment_id = Column(Integer, ForeignKey("enrollments.id"), nullable=False)
    evidence_type = Column(Enum(EvidenceTypeEnum), nullable=False)
    file_name = Column(String(255), nullable=False)
    file_url = Column(String(500), nullable=False)
    uploaded_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    uploaded_at = Column(DateTime, default=datetime.datetime.utcnow)
    is_valid = Column(Boolean, default=True)

    enrollment = relationship("Enrollment", back_populates="attachments")
    uploaded_by = relationship("User", foreign_keys=[uploaded_by_id])


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    enrollment_id = Column(Integer, ForeignKey("enrollments.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    action_type = Column(Enum(ActionTypeEnum), nullable=False)
    old_status = Column(Enum(EnrollmentStatusEnum), nullable=True)
    new_status = Column(Enum(EnrollmentStatusEnum), nullable=True)
    comment = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)

    enrollment = relationship("Enrollment", back_populates="audit_logs")
    user = relationship("User", back_populates="audit_logs")


class ExceptionLog(Base):
    __tablename__ = "exceptions"

    id = Column(Integer, primary_key=True, index=True)
    enrollment_id = Column(Integer, ForeignKey("enrollments.id"), nullable=False)
    exception_type = Column(Enum(ExceptionTypeEnum), nullable=False)
    description = Column(Text, nullable=False)
    detected_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)
    detected_by = Column(String(100), nullable=True)
    resolved = Column(Boolean, default=False)
    resolved_at = Column(DateTime, nullable=True)
    resolution_note = Column(Text, nullable=True)

    enrollment = relationship("Enrollment", back_populates="exceptions")
