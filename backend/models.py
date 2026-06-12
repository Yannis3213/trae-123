from sqlalchemy import create_engine, Column, Integer, String, Text, DateTime, ForeignKey, Boolean, Float
from sqlalchemy.orm import declarative_base, sessionmaker, relationship
from datetime import datetime
import os

DATABASE_URL = "sqlite:///" + os.path.join(os.path.dirname(os.path.abspath(__file__)), "training_projects.db")

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    full_name = Column(String(100), nullable=False)
    role = Column(String(50), nullable=False)
    department = Column(String(100))
    created_at = Column(DateTime, default=datetime.utcnow)
    is_active = Column(Boolean, default=True)

    ROLE_REGISTRAR = "registrar"
    ROLE_AUDITOR = "auditor"
    ROLE_REVIEWER = "reviewer"

    ROLE_NAMES = {
        ROLE_REGISTRAR: "课程顾问（培训项目登记员）",
        ROLE_AUDITOR: "讲师运营（培训项目审核主管）",
        ROLE_REVIEWER: "项目经理（企业培训公司复核负责人）"
    }


class TrainingProject(Base):
    __tablename__ = "training_projects"
    id = Column(Integer, primary_key=True, index=True)
    project_no = Column(String(50), unique=True, index=True, nullable=False)
    project_name = Column(String(200), nullable=False)
    client_company = Column(String(200), nullable=False)
    contact_person = Column(String(100))
    contact_phone = Column(String(50))
    training_type = Column(String(50))
    training_count = Column(Integer, default=0)
    expected_start_date = Column(DateTime)
    expected_end_date = Column(DateTime)
    demand_description = Column(Text)
    plan_content = Column(Text)
    quotation_amount = Column(Float, default=0)
    contract_no = Column(String(100))
    contract_date = Column(DateTime)

    status = Column(String(50), nullable=False, default="draft")
    current_handler_role = Column(String(50))
    current_handler_id = Column(Integer, ForeignKey("users.id"))
    version = Column(Integer, default=1)

    deadline = Column(DateTime)
    stage = Column(String(50), default="demand")

    created_by_id = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    is_deleted = Column(Boolean, default=False)

    STATUS_DRAFT = "draft"
    STATUS_PENDING_AUDIT = "pending_audit"
    STATUS_AUDIT_REJECTED = "audit_rejected"
    STATUS_AUDIT_PASSED = "audit_passed"
    STATUS_PENDING_REVIEW = "pending_review"
    STATUS_REVIEW_REJECTED = "review_rejected"
    STATUS_SYNCED = "synced"
    STATUS_ARCHIVED = "archived"

    STATUS_NAMES = {
        STATUS_DRAFT: "草稿",
        STATUS_PENDING_AUDIT: "待审核（讲师运营）",
        STATUS_AUDIT_REJECTED: "退回补正（课程顾问）",
        STATUS_AUDIT_PASSED: "审核通过（待项目经理复核）",
        STATUS_PENDING_REVIEW: "待复核（项目经理）",
        STATUS_REVIEW_REJECTED: "复核退回（讲师运营）",
        STATUS_SYNCED: "已同步",
        STATUS_ARCHIVED: "已归档"
    }

    STAGE_DEMAND = "demand"
    STAGE_PLAN = "plan"
    STAGE_CONTRACT = "contract"

    STAGE_NAMES = {
        STAGE_DEMAND: "培训需求",
        STAGE_PLAN: "方案报价",
        STAGE_CONTRACT: "合同确认"
    }

    created_by = relationship("User", foreign_keys=[created_by_id])
    current_handler = relationship("User", foreign_keys=[current_handler_id])
    attachments = relationship("Attachment", back_populates="project", cascade="all, delete-orphan")
    processing_records = relationship("ProcessingRecord", back_populates="project", cascade="all, delete-orphan")
    audit_notes = relationship("AuditNote", back_populates="project", cascade="all, delete-orphan")
    exceptions = relationship("ExceptionRecord", back_populates="project", cascade="all, delete-orphan",
                              foreign_keys="ExceptionRecord.project_id")


class Attachment(Base):
    __tablename__ = "attachments"
    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("training_projects.id"), nullable=False)
    file_name = Column(String(200), nullable=False)
    file_type = Column(String(50))
    file_size = Column(Integer)
    file_path = Column(String(500))
    category = Column(String(50))
    uploaded_by_id = Column(Integer, ForeignKey("users.id"))
    uploaded_at = Column(DateTime, default=datetime.utcnow)
    is_required = Column(Boolean, default=False)

    CATEGORY_DEMAND = "demand"
    CATEGORY_PLAN = "plan"
    CATEGORY_CONTRACT = "contract"
    CATEGORY_OTHER = "other"

    project = relationship("TrainingProject", back_populates="attachments")
    uploaded_by = relationship("User", foreign_keys=[uploaded_by_id])


class ProcessingRecord(Base):
    __tablename__ = "processing_records"
    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("training_projects.id"), nullable=False)
    action = Column(String(50), nullable=False)
    action_name = Column(String(100))
    from_status = Column(String(50))
    to_status = Column(String(50))
    from_stage = Column(String(50))
    to_stage = Column(String(50))
    operator_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    operator_role = Column(String(50))
    remark = Column(Text)
    evidence_checked = Column(Text)
    processed_at = Column(DateTime, default=datetime.utcnow)
    version_at_action = Column(Integer)

    project = relationship("TrainingProject", back_populates="processing_records")
    operator = relationship("User", foreign_keys=[operator_id])


class AuditNote(Base):
    __tablename__ = "audit_notes"
    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("training_projects.id"), nullable=False)
    note_type = Column(String(50), nullable=False)
    note_content = Column(Text, nullable=False)
    created_by_id = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime, default=datetime.utcnow)
    related_record_id = Column(Integer, ForeignKey("processing_records.id"))

    TYPE_STATUS_CHANGE = "status_change"
    TYPE_EXCEPTION = "exception"
    TYPE_SUPPLEMENT = "supplement"
    TYPE_DEADLINE = "deadline"

    project = relationship("TrainingProject", back_populates="audit_notes")
    created_by = relationship("User", foreign_keys=[created_by_id])


class ExceptionRecord(Base):
    __tablename__ = "exception_records"
    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("training_projects.id"), nullable=False)
    exception_type = Column(String(50), nullable=False)
    exception_code = Column(String(50))
    exception_message = Column(Text, nullable=False)
    responsible_role = Column(String(50))
    responsible_user_id = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime, default=datetime.utcnow)
    resolved = Column(Boolean, default=False)
    resolved_at = Column(DateTime)
    resolved_by_id = Column(Integer, ForeignKey("users.id"))
    resolution = Column(Text)

    TYPE_MISSING_EVIDENCE = "missing_evidence"
    TYPE_OVERDUE = "overdue"
    TYPE_STATUS_CONFLICT = "status_conflict"
    TYPE_VERSION_CONFLICT = "version_conflict"
    TYPE_PERMISSION_DENIED = "permission_denied"
    TYPE_DUPLICATE_SUBMIT = "duplicate_submit"

    project = relationship("TrainingProject", back_populates="exceptions", foreign_keys=[project_id])
    responsible_user = relationship("User", foreign_keys=[responsible_user_id])
    resolved_by = relationship("User", foreign_keys=[resolved_by_id])

    ROLE_LABELS = {
        "registrar": "课程顾问（培训项目登记员）",
        "auditor": "讲师运营（培训项目审核主管）",
        "reviewer": "项目经理（企业培训公司复核负责人）",
    }

    TYPE_LABELS = {
        TYPE_MISSING_EVIDENCE: "缺少必备证据",
        TYPE_OVERDUE: "节点超时/逾期",
        TYPE_STATUS_CONFLICT: "状态冲突",
        TYPE_VERSION_CONFLICT: "版本冲突",
        TYPE_PERMISSION_DENIED: "越权/无权限",
        TYPE_DUPLICATE_SUBMIT: "重复提交",
    }


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    Base.metadata.create_all(bind=engine)
