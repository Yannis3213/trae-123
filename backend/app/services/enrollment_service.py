import datetime
from typing import Optional

from sqlalchemy.orm import Session

from app.models import (
    ActionTypeEnum,
    Attachment,
    AuditLog,
    Enrollment,
    EnrollmentStatusEnum,
    EvidenceTypeEnum,
    ExceptionLog,
    ExceptionTypeEnum,
    ExpiryStatusEnum,
    RoleEnum,
    User,
)
from app.schemas import (
    AuditRequest,
    BatchAuditRequest,
    BatchItemResult,
    BatchResultResponse,
    BatchReviewRequest,
    CorrectRequest,
    EnrollmentCreate,
    EnrollmentResponse,
    EnrollmentUpdate,
    ReviewRequest,
)


def get_expiry_status(due_at: datetime.datetime, now: Optional[datetime.datetime] = None) -> ExpiryStatusEnum:
    now = now or datetime.datetime.utcnow()
    if now > due_at:
        return ExpiryStatusEnum.OVERDUE
    delta = due_at - now
    if delta.total_seconds() <= 24 * 3600:
        return ExpiryStatusEnum.APPROACHING
    return ExpiryStatusEnum.NORMAL


def has_exception(enrollment: Enrollment) -> bool:
    return any(not exc.resolved for exc in enrollment.exceptions)


def get_evidence_summary(enrollment: Enrollment) -> dict[str, bool]:
    evidence_types = [e.value for e in EvidenceTypeEnum]
    summary = {et: False for et in evidence_types}
    for att in enrollment.attachments:
        if att.is_valid and att.evidence_type.value in summary:
            summary[att.evidence_type.value] = True
    return summary


def enrollment_to_response(enrollment: Enrollment) -> EnrollmentResponse:
    resp = EnrollmentResponse.model_validate(enrollment)
    resp.expiry_status = get_expiry_status(enrollment.due_at)
    resp.has_exception = has_exception(enrollment)
    return resp


def create_enrollment(db: Session, data: EnrollmentCreate, user: User) -> Enrollment:
    if user.role != RoleEnum.REGISTRATION_CLERK:
        raise PermissionError("只有登记员可以创建入会单")

    due_at = datetime.datetime.utcnow() + datetime.timedelta(days=data.due_days)

    enrollment = Enrollment(
        member_name=data.member_name,
        member_phone=data.member_phone,
        member_id_card=data.member_id_card,
        membership_type=data.membership_type,
        card_level=data.card_level,
        amount=data.amount,
        contract_no=data.contract_no,
        salesperson=data.salesperson,
        private_trainer=data.private_trainer,
        store=data.store,
        remark=data.remark,
        status=EnrollmentStatusEnum.PENDING,
        version=1,
        created_by_id=user.id,
        current_handler_id=user.id,
        created_at=datetime.datetime.utcnow(),
        due_at=due_at,
    )

    for att_data in data.attachments:
        attachment = Attachment(
            evidence_type=att_data.evidence_type,
            file_name=att_data.file_name,
            file_url=att_data.file_url,
            uploaded_by_id=user.id,
            is_valid=True,
        )
        enrollment.attachments.append(attachment)

    db.add(enrollment)
    db.flush()

    audit_log = AuditLog(
        enrollment_id=enrollment.id,
        user_id=user.id,
        action_type=ActionTypeEnum.CREATE,
        old_status=None,
        new_status=enrollment.status,
        comment="创建入会单",
    )
    db.add(audit_log)

    db.commit()
    db.refresh(enrollment)
    return enrollment


def get_enrollment(db: Session, enrollment_id: int, user: User) -> Optional[Enrollment]:
    enrollment = db.query(Enrollment).filter(Enrollment.id == enrollment_id).first()
    if not enrollment:
        return None
    return enrollment


def list_enrollments(
    db: Session,
    user: User,
    status: Optional[EnrollmentStatusEnum] = None,
    expiry_status: Optional[ExpiryStatusEnum] = None,
    store: Optional[str] = None,
    keyword: Optional[str] = None,
    my_todo: bool = False,
    page: int = 1,
    page_size: int = 20,
) -> tuple[list[Enrollment], int]:
    query = db.query(Enrollment)

    if my_todo:
        if user.role == RoleEnum.REGISTRATION_CLERK:
            query = query.filter(
                Enrollment.status == EnrollmentStatusEnum.FAILED,
                Enrollment.created_by_id == user.id,
            )
        elif user.role == RoleEnum.AUDIT_SUPERVISOR:
            query = query.filter(
                Enrollment.status == EnrollmentStatusEnum.PENDING,
                Enrollment.audit_by_id.is_(None),
            )
        elif user.role == RoleEnum.REVIEW_LEAD:
            query = query.filter(
                Enrollment.status == EnrollmentStatusEnum.PENDING,
                Enrollment.audit_by_id.isnot(None),
                Enrollment.review_by_id.is_(None),
            )

    if status:
        query = query.filter(Enrollment.status == status)

    if store:
        query = query.filter(Enrollment.store == store)

    if keyword:
        like = f"%{keyword}%"
        query = query.filter(
            db.or_(
                Enrollment.member_name.like(like),
                Enrollment.member_phone.like(like),
                Enrollment.contract_no.like(like),
            )
        )

    if expiry_status:
        now = datetime.datetime.utcnow()
        if expiry_status == ExpiryStatusEnum.OVERDUE:
            query = query.filter(Enrollment.due_at < now)
        elif expiry_status == ExpiryStatusEnum.APPROACHING:
            approaching_threshold = now + datetime.timedelta(days=1)
            query = query.filter(
                Enrollment.due_at >= now,
                Enrollment.due_at <= approaching_threshold,
            )
        elif expiry_status == ExpiryStatusEnum.NORMAL:
            normal_threshold = now + datetime.timedelta(days=1)
            query = query.filter(Enrollment.due_at > normal_threshold)

    total = query.count()

    items = (
        query.order_by(Enrollment.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    return items, total


def _check_audit_permissions(enrollment: Enrollment, user: User, expected_version: int) -> None:
    if user.role not in (RoleEnum.AUDIT_SUPERVISOR, RoleEnum.REVIEW_LEAD):
        raise PermissionError("没有审核权限")

    if enrollment.version != expected_version:
        raise ValueError("版本不匹配，数据已更新，请刷新后重试")

    if enrollment.status == EnrollmentStatusEnum.COMPLETED:
        raise ValueError("状态冲突：入会单已完成，无法再处理")


def audit_enrollment(db: Session, data: AuditRequest, user: User) -> Enrollment:
    if user.role != RoleEnum.AUDIT_SUPERVISOR:
        raise PermissionError("只有审核主管可以进行审核")

    enrollment = db.query(Enrollment).filter(Enrollment.id == data.enrollment_id).first()
    if not enrollment:
        raise ValueError("入会单不存在")

    _check_audit_permissions(enrollment, user, data.version)

    if enrollment.status not in (EnrollmentStatusEnum.PENDING, EnrollmentStatusEnum.FAILED):
        raise ValueError("状态冲突：只有待核验或核验失败的单据可以审核")

    if data.passed:
        required_evidence = {e.value for e in EvidenceTypeEnum}
        actual_evidence = {
            att.evidence_type.value for att in enrollment.attachments if att.is_valid
        }
        missing = required_evidence - actual_evidence
        if missing:
            missing_labels = [EvidenceTypeEnum(m).value for m in missing]
            raise ValueError(f"资料缺失：缺少 {', '.join(missing_labels)} 证据")

    old_status = enrollment.status

    if data.passed:
        enrollment.status = EnrollmentStatusEnum.PENDING
        enrollment.audit_by_id = user.id
        enrollment.audited_at = datetime.datetime.utcnow()
        enrollment.current_handler_id = None
        action_type = ActionTypeEnum.AUDIT_PASS
        comment = data.comment or "审核通过，提交复核"
    else:
        enrollment.status = EnrollmentStatusEnum.FAILED
        enrollment.audit_by_id = user.id
        enrollment.audited_at = datetime.datetime.utcnow()
        enrollment.current_handler_id = enrollment.created_by_id
        action_type = ActionTypeEnum.AUDIT_FAIL
        comment = data.comment or "审核退回"

        exc = ExceptionLog(
            enrollment_id=enrollment.id,
            exception_type=ExceptionTypeEnum.STATUS_CONFLICT,
            description=f"审核退回：{comment}",
            detected_by=user.full_name,
        )
        db.add(exc)

    enrollment.version += 1

    audit_log = AuditLog(
        enrollment_id=enrollment.id,
        user_id=user.id,
        action_type=action_type,
        old_status=old_status,
        new_status=enrollment.status,
        comment=comment,
    )
    db.add(audit_log)

    db.commit()
    db.refresh(enrollment)
    return enrollment


def review_enrollment(db: Session, data: ReviewRequest, user: User) -> Enrollment:
    if user.role != RoleEnum.REVIEW_LEAD:
        raise PermissionError("只有复核负责人可以进行复核")

    enrollment = db.query(Enrollment).filter(Enrollment.id == data.enrollment_id).first()
    if not enrollment:
        raise ValueError("入会单不存在")

    if enrollment.version != data.version:
        raise ValueError("版本不匹配，数据已更新，请刷新后重试")

    if enrollment.status not in (EnrollmentStatusEnum.PENDING,):
        raise ValueError("状态冲突：只有待核验的单据可以复核")

    if not enrollment.audit_by_id:
        raise ValueError("状态冲突：单据未经审核，无法复核")

    old_status = enrollment.status

    if data.passed:
        enrollment.status = EnrollmentStatusEnum.COMPLETED
        enrollment.review_by_id = user.id
        enrollment.reviewed_at = datetime.datetime.utcnow()
        enrollment.current_handler_id = None
        action_type = ActionTypeEnum.REVIEW_PASS
        comment = data.comment or "复核通过，归档完成"
    else:
        enrollment.status = EnrollmentStatusEnum.FAILED
        enrollment.review_by_id = user.id
        enrollment.reviewed_at = datetime.datetime.utcnow()
        enrollment.current_handler_id = enrollment.created_by_id
        action_type = ActionTypeEnum.REVIEW_FAIL
        comment = data.comment or "复核退回"

        exc = ExceptionLog(
            enrollment_id=enrollment.id,
            exception_type=ExceptionTypeEnum.STATUS_CONFLICT,
            description=f"复核退回：{comment}",
            detected_by=user.full_name,
        )
        db.add(exc)

    enrollment.version += 1

    audit_log = AuditLog(
        enrollment_id=enrollment.id,
        user_id=user.id,
        action_type=action_type,
        old_status=old_status,
        new_status=enrollment.status,
        comment=comment,
    )
    db.add(audit_log)

    db.commit()
    db.refresh(enrollment)
    return enrollment


def correct_enrollment(db: Session, data: CorrectRequest, user: User) -> Enrollment:
    if user.role != RoleEnum.REGISTRATION_CLERK:
        raise PermissionError("只有登记员可以补正")

    enrollment = db.query(Enrollment).filter(Enrollment.id == data.enrollment_id).first()
    if not enrollment:
        raise ValueError("入会单不存在")

    if enrollment.version != data.version:
        raise ValueError("版本不匹配，数据已更新，请刷新后重试")

    if enrollment.status != EnrollmentStatusEnum.FAILED:
        raise ValueError("状态冲突：只有核验失败的单据可以补正")

    if enrollment.created_by_id != user.id:
        raise PermissionError("越权推进：只能补正自己创建的单据")

    old_status = enrollment.status

    if data.update_data:
        update_dict = data.update_data.model_dump(exclude_unset=True)
        attachments_data = update_dict.pop("attachments", None)
        for key, value in update_dict.items():
            setattr(enrollment, key, value)

        if attachments_data is not None:
            for att in enrollment.attachments:
                att.is_valid = False
            for att_data in attachments_data:
                attachment = Attachment(
                    evidence_type=att_data.evidence_type,
                    file_name=att_data.file_name,
                    file_url=att_data.file_url,
                    uploaded_by_id=user.id,
                    is_valid=True,
                )
                enrollment.attachments.append(attachment)

    enrollment.status = EnrollmentStatusEnum.PENDING
    enrollment.version += 1
    enrollment.current_handler_id = None

    for exc in enrollment.exceptions:
        if not exc.resolved and exc.exception_type == ExceptionTypeEnum.STATUS_CONFLICT:
            exc.resolved = True
            exc.resolved_at = datetime.datetime.utcnow()
            exc.resolution_note = f"补正解决：{data.comment}"

    audit_log = AuditLog(
        enrollment_id=enrollment.id,
        user_id=user.id,
        action_type=ActionTypeEnum.CORRECT,
        old_status=old_status,
        new_status=enrollment.status,
        comment=data.comment,
    )
    db.add(audit_log)

    db.commit()
    db.refresh(enrollment)
    return enrollment


def batch_audit(db: Session, data: BatchAuditRequest, user: User) -> BatchResultResponse:
    results: list[BatchItemResult] = []
    success_count = 0

    for eid in data.ids:
        try:
            req = AuditRequest(
                enrollment_id=eid,
                passed=data.passed,
                comment=data.comment,
                version=0,
            )
            enrollment = db.query(Enrollment).filter(Enrollment.id == eid).first()
            if not enrollment:
                results.append(BatchItemResult(id=eid, success=False, message="入会单不存在"))
                continue
            req.version = enrollment.version
            result = audit_enrollment(db, req, user)
            results.append(
                BatchItemResult(
                    id=eid,
                    success=True,
                    message="处理成功",
                    data=enrollment_to_response(result),
                )
            )
            success_count += 1
        except (ValueError, PermissionError) as e:
            db.rollback()
            results.append(BatchItemResult(id=eid, success=False, message=str(e)))
        except Exception as e:
            db.rollback()
            results.append(BatchItemResult(id=eid, success=False, message=f"系统错误：{e}"))

    return BatchResultResponse(
        total=len(data.ids),
        success_count=success_count,
        fail_count=len(data.ids) - success_count,
        results=results,
    )


def batch_review(db: Session, data: BatchReviewRequest, user: User) -> BatchResultResponse:
    results: list[BatchItemResult] = []
    success_count = 0

    for eid in data.ids:
        try:
            enrollment = db.query(Enrollment).filter(Enrollment.id == eid).first()
            if not enrollment:
                results.append(BatchItemResult(id=eid, success=False, message="入会单不存在"))
                continue
            req = ReviewRequest(
                enrollment_id=eid,
                passed=data.passed,
                comment=data.comment,
                version=enrollment.version,
            )
            result = review_enrollment(db, req, user)
            results.append(
                BatchItemResult(
                    id=eid,
                    success=True,
                    message="处理成功",
                    data=enrollment_to_response(result),
                )
            )
            success_count += 1
        except (ValueError, PermissionError) as e:
            db.rollback()
            results.append(BatchItemResult(id=eid, success=False, message=str(e)))
        except Exception as e:
            db.rollback()
            results.append(BatchItemResult(id=eid, success=False, message=f"系统错误：{e}"))

    return BatchResultResponse(
        total=len(data.ids),
        success_count=success_count,
        fail_count=len(data.ids) - success_count,
        results=results,
    )


def get_stats(db: Session, user: User) -> dict:
    total = db.query(Enrollment).count()
    pending = db.query(Enrollment).filter(Enrollment.status == EnrollmentStatusEnum.PENDING).count()
    failed = db.query(Enrollment).filter(Enrollment.status == EnrollmentStatusEnum.FAILED).count()
    completed = db.query(Enrollment).filter(Enrollment.status == EnrollmentStatusEnum.COMPLETED).count()

    now = datetime.datetime.utcnow()
    approaching_threshold = now + datetime.timedelta(days=1)

    normal = (
        db.query(Enrollment)
        .filter(Enrollment.due_at > approaching_threshold)
        .count()
    )
    approaching = (
        db.query(Enrollment)
        .filter(
            Enrollment.due_at >= now,
            Enrollment.due_at <= approaching_threshold,
        )
        .count()
    )
    overdue = db.query(Enrollment).filter(Enrollment.due_at < now).count()

    if user.role == RoleEnum.REGISTRATION_CLERK:
        my_todo = (
            db.query(Enrollment)
            .filter(
                Enrollment.status == EnrollmentStatusEnum.FAILED,
                Enrollment.created_by_id == user.id,
            )
            .count()
        )
    elif user.role == RoleEnum.AUDIT_SUPERVISOR:
        my_todo = (
            db.query(Enrollment)
            .filter(
                Enrollment.status == EnrollmentStatusEnum.PENDING,
                Enrollment.audit_by_id.is_(None),
            )
            .count()
        )
    elif user.role == RoleEnum.REVIEW_LEAD:
        my_todo = (
            db.query(Enrollment)
            .filter(
                Enrollment.status == EnrollmentStatusEnum.PENDING,
                Enrollment.audit_by_id.isnot(None),
                Enrollment.review_by_id.is_(None),
            )
            .count()
        )
    else:
        my_todo = 0

    return {
        "total": total,
        "pending": pending,
        "failed": failed,
        "completed": completed,
        "normal": normal,
        "approaching": approaching,
        "overdue": overdue,
        "my_todo": my_todo,
    }


def check_queue_exceptions(db: Session, user: User) -> list[dict]:
    exceptions = []
    now = datetime.datetime.utcnow()

    enrollments = db.query(Enrollment).all()
    for enrollment in enrollments:
        if enrollment.status == EnrollmentStatusEnum.COMPLETED:
            continue

        if now > enrollment.due_at:
            has_overdue_exc = any(
                not exc.resolved and exc.exception_type == ExceptionTypeEnum.OVERDUE
                for exc in enrollment.exceptions
            )
            if not has_overdue_exc:
                exc = ExceptionLog(
                    enrollment_id=enrollment.id,
                    exception_type=ExceptionTypeEnum.OVERDUE,
                    description="超期未处理：已超过处理时限",
                    detected_by="system",
                )
                db.add(exc)
                exceptions.append(
                    {
                        "enrollment_id": enrollment.id,
                        "exception_type": ExceptionTypeEnum.OVERDUE.value,
                        "description": "超期未处理：已超过处理时限",
                    }
                )

        required_evidence = {e.value for e in EvidenceTypeEnum}
        actual_evidence = {
            att.evidence_type.value for att in enrollment.attachments if att.is_valid
        }
        missing = required_evidence - actual_evidence
        if missing and enrollment.status != EnrollmentStatusEnum.COMPLETED:
            has_missing_exc = any(
                not exc.resolved and exc.exception_type == ExceptionTypeEnum.MISSING_MATERIALS
                for exc in enrollment.exceptions
            )
            if not has_missing_exc:
                missing_labels = [EvidenceTypeEnum(m).value for m in missing]
                exc = ExceptionLog(
                    enrollment_id=enrollment.id,
                    exception_type=ExceptionTypeEnum.MISSING_MATERIALS,
                    description=f"资料缺失：缺少 {', '.join(missing_labels)} 证据",
                    detected_by="system",
                )
                db.add(exc)
                exceptions.append(
                    {
                        "enrollment_id": enrollment.id,
                        "exception_type": ExceptionTypeEnum.MISSING_MATERIALS.value,
                        "description": f"资料缺失：缺少 {', '.join(missing_labels)} 证据",
                    }
                )

    db.commit()
    return exceptions
