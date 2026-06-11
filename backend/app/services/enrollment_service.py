import datetime
from typing import Any, Optional

from sqlalchemy import and_, case, or_
from sqlalchemy.orm import Session, joinedload

from app.exceptions import (
    MissingMaterialsError,
    NotCurrentHandlerError,
    OverdueError,
    StatusConflictError,
    UnauthorizedAdvanceError,
    VersionConflictError,
)
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


def get_missing_evidence(enrollment: Enrollment) -> list[str]:
    summary = get_evidence_summary(enrollment)
    return [k for k, v in summary.items() if not v]


def enrollment_to_response(enrollment: Enrollment, user: Optional[Any] = None) -> EnrollmentResponse:
    resp = EnrollmentResponse.model_validate(enrollment)
    resp.expiry_status = get_expiry_status(enrollment.due_at)
    resp.has_exception = has_exception(enrollment)
    resp.evidence_summary = get_evidence_summary(enrollment)

    resp.required_role = get_required_role(enrollment)
    resp.responsible_person = get_responsible_user_name(enrollment)

    if user:
        can, reason = check_can_operate(enrollment, user)
        resp.can_operate = can
        resp.operate_reason = reason

    return resp


def get_current_handler_role(enrollment: Enrollment) -> Optional[RoleEnum]:
    if enrollment.status == EnrollmentStatusEnum.COMPLETED:
        return None
    if enrollment.current_handler and enrollment.current_handler.role:
        return enrollment.current_handler.role
    if enrollment.status == EnrollmentStatusEnum.FAILED:
        return RoleEnum.REGISTRATION_CLERK
    if enrollment.status == EnrollmentStatusEnum.PENDING:
        if not enrollment.audit_by_id:
            return RoleEnum.AUDIT_SUPERVISOR
        if not enrollment.review_by_id:
            return RoleEnum.REVIEW_LEAD
    return None


def get_required_role(enrollment: Enrollment) -> Optional[RoleEnum]:
    if enrollment.status == EnrollmentStatusEnum.COMPLETED:
        return None
    if enrollment.current_handler and enrollment.current_handler.role:
        return enrollment.current_handler.role
    if enrollment.status == EnrollmentStatusEnum.FAILED:
        return RoleEnum.REGISTRATION_CLERK
    if enrollment.status == EnrollmentStatusEnum.PENDING:
        if not enrollment.audit_by_id:
            return RoleEnum.AUDIT_SUPERVISOR
        if not enrollment.review_by_id:
            return RoleEnum.REVIEW_LEAD
    return None


ROLE_LABEL_MAP = {
    RoleEnum.REGISTRATION_CLERK: "登记员",
    RoleEnum.AUDIT_SUPERVISOR: "审核主管",
    RoleEnum.REVIEW_LEAD: "复核负责人",
}


def get_responsible_user_name(enrollment: Enrollment, db: Optional[Session] = None) -> Optional[str]:
    if enrollment.status == EnrollmentStatusEnum.COMPLETED:
        if enrollment.review_by:
            return enrollment.review_by.full_name
        if db and enrollment.review_by_id:
            u = db.query(User).filter(User.id == enrollment.review_by_id).first()
            return u.full_name if u else None
        return None

    if enrollment.current_handler:
        return enrollment.current_handler.full_name
    if db and enrollment.current_handler_id:
        u = db.query(User).filter(User.id == enrollment.current_handler_id).first()
        if u:
            return u.full_name

    if enrollment.status == EnrollmentStatusEnum.FAILED:
        if enrollment.created_by:
            return enrollment.created_by.full_name
        if db and enrollment.created_by_id:
            u = db.query(User).filter(User.id == enrollment.created_by_id).first()
            return u.full_name if u else None
        return None
    if enrollment.status == EnrollmentStatusEnum.PENDING:
        if not enrollment.audit_by_id:
            return "待分配审核主管"
        if not enrollment.review_by_id:
            if enrollment.audit_by:
                return enrollment.audit_by.full_name
            if db and enrollment.audit_by_id:
                u = db.query(User).filter(User.id == enrollment.audit_by_id).first()
                return u.full_name if u else None
            return None
    return None


def check_can_operate(enrollment: Enrollment, user: Any) -> tuple[bool, Optional[str]]:
    required_role = get_required_role(enrollment)

    if enrollment.status == EnrollmentStatusEnum.COMPLETED:
        return False, "单据已核验完成，无法继续操作"

    if enrollment.current_handler_id is not None:
        if enrollment.current_handler_id != user['id']:
            handler_name = enrollment.current_handler.full_name if enrollment.current_handler else "未知"
            handler_role = ROLE_LABEL_MAP.get(
                RoleEnum(enrollment.current_handler.role) if enrollment.current_handler else required_role,
                required_role.value if required_role else "对应角色"
            )
            return False, f"非当前处理人：该单据指定由「{handler_name}（{handler_role}）」负责"

    if required_role and user['role'] != required_role:
        return False, f"越权推进：当前角色为「{ROLE_LABEL_MAP.get(RoleEnum(user['role']), user['role'])}」，该节点需「{ROLE_LABEL_MAP.get(required_role, required_role)}」操作"

    if enrollment.status == EnrollmentStatusEnum.FAILED:
        if enrollment.created_by_id != user['id']:
            creator_name = enrollment.created_by.full_name if enrollment.created_by else '未知'
            return False, f"非当前处理人：该单据由「{creator_name}」创建，需本人补正"
        return True, None

    expiry = get_expiry_status(enrollment.due_at)
    if expiry == ExpiryStatusEnum.OVERDUE:
        return False, f"逾期拦截：单据已于 {enrollment.due_at.strftime('%Y-%m-%d %H:%M')} 逾期，请先处理逾期异常"

    return True, None


def _validate_current_handler(enrollment: Enrollment, user: Any, db: Optional[Session] = None) -> None:
    can, reason = check_can_operate(enrollment, user)
    if not can:
        exc_type = None
        exc_detail = None
        exc_class = None

        if "越权推进" in reason:
            exc_type = ExceptionTypeEnum.UNAUTHORIZED_ADVANCE
            exc_detail = f"越权访问：用户「{user['full_name']}（{ROLE_LABEL_MAP.get(RoleEnum(user['role']), user['role'])}）」尝试操作不属于其角色的单据，{reason}"
            exc_class = UnauthorizedAdvanceError
        elif "非当前处理人" in reason:
            exc_type = ExceptionTypeEnum.UNAUTHORIZED_ADVANCE
            exc_detail = f"非当前处理人：用户「{user['full_name']}」尝试操作指定由其他人负责的单据，{reason}"
            exc_class = NotCurrentHandlerError
        elif "逾期" in reason:
            exc_type = ExceptionTypeEnum.OVERDUE
            exc_detail = f"逾期拦截：{reason}"
            exc_class = OverdueError
        elif "资料缺失" in reason:
            exc_type = ExceptionTypeEnum.MISSING_MATERIALS
            exc_detail = f"资料缺失：{reason}"
            exc_class = MissingMaterialsError
        else:
            exc_type = ExceptionTypeEnum.STATUS_CONFLICT
            exc_detail = f"状态冲突：{reason}"
            exc_class = StatusConflictError

        if db and exc_type and exc_detail:
            try:
                exc = ExceptionLog(
                    enrollment_id=enrollment.id,
                    exception_type=exc_type,
                    description=exc_detail,
                    detected_by=user['full_name'],
                )
                db.add(exc)
                db.flush()
            except Exception:
                pass

        raise exc_class(reason)


def get_responsible_user_id(enrollment: Enrollment) -> Optional[int]:
    if enrollment.current_handler_id is not None:
        return enrollment.current_handler_id
    if enrollment.status == EnrollmentStatusEnum.COMPLETED:
        return enrollment.review_by_id
    if enrollment.status == EnrollmentStatusEnum.FAILED:
        return enrollment.created_by_id
    if enrollment.status == EnrollmentStatusEnum.PENDING:
        if not enrollment.audit_by_id:
            return None
        if not enrollment.review_by_id:
            return enrollment.audit_by_id
    return None


def create_enrollment(db: Session, data: EnrollmentCreate, user: Any) -> Enrollment:
    if user['role'] != RoleEnum.REGISTRATION_CLERK:
        raise UnauthorizedAdvanceError("越权推进：只有登记员可以创建入会单")

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
        created_by_id=user['id'],
        current_handler_id=None,
        created_at=datetime.datetime.utcnow(),
        submitted_at=datetime.datetime.utcnow(),
        due_at=due_at,
    )

    for att_data in data.attachments:
        attachment = Attachment(
            evidence_type=att_data.evidence_type,
            file_name=att_data.file_name,
            file_url=att_data.file_url,
            uploaded_by_id=user['id'],
            is_valid=True,
        )
        enrollment.attachments.append(attachment)

    db.add(enrollment)
    db.flush()

    audit_log = AuditLog(
        enrollment_id=enrollment.id,
        user_id=user['id'],
        action_type=ActionTypeEnum.CREATE,
        old_status=None,
        new_status=enrollment.status,
        comment="创建入会单并提交审核",
    )
    db.add(audit_log)

    missing = get_missing_evidence(enrollment)
    if missing:
        missing_labels = [EvidenceTypeEnum(m).value for m in missing]
        exc = ExceptionLog(
            enrollment_id=enrollment.id,
            exception_type=ExceptionTypeEnum.MISSING_MATERIALS,
            description=f"资料缺失：缺少 {', '.join(missing_labels)} 证据",
            detected_by="system",
        )
        db.add(exc)

    db.commit()
    db.refresh(enrollment)
    return enrollment


def get_enrollment(db: Session, enrollment_id: int, user: Any) -> Optional[Enrollment]:
    enrollment = db.query(Enrollment).options(
        joinedload(Enrollment.current_handler),
        joinedload(Enrollment.created_by),
        joinedload(Enrollment.audit_by),
        joinedload(Enrollment.review_by),
        joinedload(Enrollment.attachments),
        joinedload(Enrollment.audit_logs).joinedload(AuditLog.user),
        joinedload(Enrollment.exceptions),
    ).filter(Enrollment.id == enrollment_id).first()
    if not enrollment:
        return None
    return enrollment


def list_enrollments(
    db: Session,
    user: Any,
    status: Optional[EnrollmentStatusEnum] = None,
    expiry_status: Optional[ExpiryStatusEnum] = None,
    store: Optional[str] = None,
    keyword: Optional[str] = None,
    my_todo: bool = False,
    page: int = 1,
    page_size: int = 20,
) -> tuple[list[Enrollment], int]:
    query = db.query(Enrollment).options(
        joinedload(Enrollment.current_handler),
        joinedload(Enrollment.created_by),
        joinedload(Enrollment.audit_by),
        joinedload(Enrollment.review_by),
        joinedload(Enrollment.attachments),
    )

    if my_todo:
        query = query.filter(
            or_(
                Enrollment.current_handler_id == user['id'],
                and_(
                    Enrollment.current_handler_id.is_(None),
                    case(
                        (user['role'] == RoleEnum.REGISTRATION_CLERK,
                         and_(
                             Enrollment.status == EnrollmentStatusEnum.FAILED,
                             Enrollment.created_by_id == user['id'],
                         )),
                        (user['role'] == RoleEnum.AUDIT_SUPERVISOR,
                         and_(
                             Enrollment.status == EnrollmentStatusEnum.PENDING,
                             Enrollment.audit_by_id.is_(None),
                         )),
                        (user['role'] == RoleEnum.REVIEW_LEAD,
                         and_(
                             Enrollment.status == EnrollmentStatusEnum.PENDING,
                             Enrollment.audit_by_id.isnot(None),
                             Enrollment.review_by_id.is_(None),
                         )),
                        else_=False,
                    )
                )
            )
        )

    if status:
        query = query.filter(Enrollment.status == status)

    if store:
        query = query.filter(Enrollment.store == store)

    if keyword:
        like = f"%{keyword}%"
        query = query.filter(
            or_(
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


def _validate_version(enrollment: Enrollment, expected_version: int) -> None:
    if enrollment.version != expected_version:
        raise VersionConflictError(
            f"版本冲突：当前版本 v{enrollment.version}，提交版本 v{expected_version}，请刷新后重试"
        )


def _validate_not_completed(enrollment: Enrollment) -> None:
    if enrollment.status == EnrollmentStatusEnum.COMPLETED:
        raise StatusConflictError("状态冲突：入会单已核验完成，无法再处理")


def _validate_not_overdue(enrollment: Enrollment, block_overdue: bool = True) -> None:
    if not block_overdue:
        return
    expiry = get_expiry_status(enrollment.due_at)
    if expiry == ExpiryStatusEnum.OVERDUE:
        raise OverdueError(
            f"逾期拦截：单据已于 {enrollment.due_at.strftime('%Y-%m-%d %H:%M')} 逾期，请先处理逾期异常后再推进"
        )


def _validate_evidence_complete(enrollment: Enrollment) -> None:
    missing = get_missing_evidence(enrollment)
    if missing:
        missing_labels = [EvidenceTypeEnum(m).value for m in missing]
        raise MissingMaterialsError(
            f"资料缺失：缺少 {', '.join(missing_labels)} 证据，审核通过前请补齐"
        )


def audit_enrollment(
    db: Session,
    data: AuditRequest,
    user: Any,
    block_overdue: bool = True,
) -> Enrollment:
    if user['role'] != RoleEnum.AUDIT_SUPERVISOR:
        raise UnauthorizedAdvanceError("越权推进：只有审核主管可以进行审核")

    enrollment = db.query(Enrollment).filter(Enrollment.id == data.enrollment_id).first()
    if not enrollment:
        raise ValueError("入会单不存在")

    _validate_version(enrollment, data.version)
    _validate_not_completed(enrollment)

    if enrollment.status not in (EnrollmentStatusEnum.PENDING, EnrollmentStatusEnum.FAILED):
        raise StatusConflictError(
            f"状态冲突：当前状态为「{enrollment.status.value}」，只有待核验或核验失败的单据可以审核"
        )

    if enrollment.audit_by_id and enrollment.status == EnrollmentStatusEnum.PENDING:
        raise StatusConflictError("状态冲突：单据已审核过，请勿重复审核")

    _validate_current_handler(enrollment, user, db)

    if data.passed:
        _validate_evidence_complete(enrollment)

    if block_overdue:
        _validate_not_overdue(enrollment, block_overdue)

    old_status = enrollment.status
    old_handler_name = enrollment.current_handler.full_name if enrollment.current_handler else (
        enrollment.created_by.full_name if enrollment.status == EnrollmentStatusEnum.FAILED else "待分配"
    )

    if data.passed:
        enrollment.status = EnrollmentStatusEnum.PENDING
        enrollment.audit_by_id = user['id']
        enrollment.audited_at = datetime.datetime.utcnow()
        enrollment.current_handler_id = None
        action_type = ActionTypeEnum.AUDIT_PASS
        new_handler_name = "待分配复核负责人"
        comment = data.comment or f"审核通过，责任人从「{old_handler_name}」变更为「{new_handler_name}」，提交复核"

        for exc in enrollment.exceptions:
            if not exc.resolved and exc.exception_type == ExceptionTypeEnum.MISSING_MATERIALS:
                exc.resolved = True
                exc.resolved_at = datetime.datetime.utcnow()
                exc.resolution_note = f"审核通过时确认资料齐全，异常解决。责任人变更：{old_handler_name} → {new_handler_name}"
    else:
        enrollment.status = EnrollmentStatusEnum.FAILED
        enrollment.audit_by_id = user['id']
        enrollment.audited_at = datetime.datetime.utcnow()
        enrollment.current_handler_id = enrollment.created_by_id
        action_type = ActionTypeEnum.AUDIT_FAIL
        new_handler_name = enrollment.created_by.full_name if enrollment.created_by else "未知"
        comment = data.comment or f"审核退回，责任人从「{old_handler_name}」变更为「{new_handler_name}」，需补正"

        has_conflict_exc = any(
            not exc.resolved and exc.exception_type == ExceptionTypeEnum.STATUS_CONFLICT
            for exc in enrollment.exceptions
        )
        if not has_conflict_exc:
            exc = ExceptionLog(
                enrollment_id=enrollment.id,
                exception_type=ExceptionTypeEnum.STATUS_CONFLICT,
                description=f"审核退回：{comment}。责任人变更：{old_handler_name} → {new_handler_name}",
                detected_by=user['full_name'],
            )
            db.add(exc)

    enrollment.version += 1

    audit_log = AuditLog(
        enrollment_id=enrollment.id,
        user_id=user['id'],
        action_type=action_type,
        old_status=old_status,
        new_status=enrollment.status,
        comment=comment,
    )
    db.add(audit_log)

    db.commit()
    db.refresh(enrollment)
    return enrollment


def review_enrollment(
    db: Session,
    data: ReviewRequest,
    user: Any,
    block_overdue: bool = True,
) -> Enrollment:
    if user['role'] != RoleEnum.REVIEW_LEAD:
        raise UnauthorizedAdvanceError("越权推进：只有复核负责人可以进行复核")

    enrollment = db.query(Enrollment).filter(Enrollment.id == data.enrollment_id).first()
    if not enrollment:
        raise ValueError("入会单不存在")

    _validate_version(enrollment, data.version)
    _validate_not_completed(enrollment)

    if enrollment.status not in (EnrollmentStatusEnum.PENDING,):
        raise StatusConflictError(
            f"状态冲突：当前状态为「{enrollment.status.value}」，只有待核验的单据可以复核"
        )

    if not enrollment.audit_by_id:
        raise StatusConflictError("状态冲突：单据未经审核，无法复核")

    if enrollment.review_by_id:
        raise StatusConflictError("状态冲突：单据已复核过，请勿重复复核")

    _validate_current_handler(enrollment, user, db)

    if data.passed:
        _validate_evidence_complete(enrollment)

    if block_overdue:
        _validate_not_overdue(enrollment, block_overdue)

    old_status = enrollment.status
    old_handler_name = enrollment.current_handler.full_name if enrollment.current_handler else (
        enrollment.audit_by.full_name if enrollment.audit_by else "待分配"
    )

    if data.passed:
        enrollment.status = EnrollmentStatusEnum.COMPLETED
        enrollment.review_by_id = user['id']
        enrollment.reviewed_at = datetime.datetime.utcnow()
        enrollment.current_handler_id = None
        action_type = ActionTypeEnum.REVIEW_PASS
        new_handler_name = "已完成归档"
        comment = data.comment or f"复核通过，责任人从「{old_handler_name}」变更为「{new_handler_name}」，归档完成"

        for exc in enrollment.exceptions:
            if not exc.resolved:
                exc.resolved = True
                exc.resolved_at = datetime.datetime.utcnow()
                exc.resolution_note = f"复核完成归档，异常关闭。责任人变更：{old_handler_name} → {new_handler_name}"
    else:
        enrollment.status = EnrollmentStatusEnum.FAILED
        enrollment.review_by_id = user['id']
        enrollment.reviewed_at = datetime.datetime.utcnow()
        enrollment.current_handler_id = enrollment.created_by_id
        action_type = ActionTypeEnum.REVIEW_FAIL
        new_handler_name = enrollment.created_by.full_name if enrollment.created_by else "未知"
        comment = data.comment or f"复核退回，责任人从「{old_handler_name}」变更为「{new_handler_name}」，需补正"

        has_conflict_exc = any(
            not exc.resolved and exc.exception_type == ExceptionTypeEnum.STATUS_CONFLICT
            for exc in enrollment.exceptions
        )
        if not has_conflict_exc:
            exc = ExceptionLog(
                enrollment_id=enrollment.id,
                exception_type=ExceptionTypeEnum.STATUS_CONFLICT,
                description=f"复核退回：{comment}。责任人变更：{old_handler_name} → {new_handler_name}",
                detected_by=user['full_name'],
            )
            db.add(exc)

    enrollment.version += 1

    audit_log = AuditLog(
        enrollment_id=enrollment.id,
        user_id=user['id'],
        action_type=action_type,
        old_status=old_status,
        new_status=enrollment.status,
        comment=comment,
    )
    db.add(audit_log)

    db.commit()
    db.refresh(enrollment)
    return enrollment


def correct_enrollment(
    db: Session,
    data: CorrectRequest,
    user: Any,
) -> Enrollment:
    if user['role'] != RoleEnum.REGISTRATION_CLERK:
        raise UnauthorizedAdvanceError("越权推进：只有登记员可以补正")

    enrollment = db.query(Enrollment).filter(Enrollment.id == data.enrollment_id).first()
    if not enrollment:
        raise ValueError("入会单不存在")

    _validate_version(enrollment, data.version)

    if enrollment.status != EnrollmentStatusEnum.FAILED:
        raise StatusConflictError(
            f"状态冲突：当前状态为「{enrollment.status.value}」，只有核验失败的单据可以补正"
        )

    _validate_current_handler(enrollment, user, db)

    old_status = enrollment.status
    old_handler_name = enrollment.current_handler.full_name if enrollment.current_handler else (
        enrollment.created_by.full_name if enrollment.created_by else "待分配"
    )

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
                    uploaded_by_id=user['id'],
                    is_valid=True,
                )
                enrollment.attachments.append(attachment)

    enrollment.status = EnrollmentStatusEnum.PENDING
    enrollment.version += 1
    enrollment.current_handler_id = None
    enrollment.audit_by_id = None
    enrollment.audited_at = None
    enrollment.review_by_id = None
    enrollment.reviewed_at = None
    new_handler_name = "待分配审核主管"

    for exc in enrollment.exceptions:
        if not exc.resolved and exc.exception_type == ExceptionTypeEnum.STATUS_CONFLICT:
            exc.resolved = True
            exc.resolved_at = datetime.datetime.utcnow()
            exc.resolution_note = f"补正解决：{data.comment}。责任人变更：{old_handler_name} → {new_handler_name}"

    missing = get_missing_evidence(enrollment)
    if missing:
        missing_labels = [EvidenceTypeEnum(m).value for m in missing]
        has_missing_exc = any(
            not exc.resolved and exc.exception_type == ExceptionTypeEnum.MISSING_MATERIALS
            for exc in enrollment.exceptions
        )
        if not has_missing_exc:
            exc = ExceptionLog(
                enrollment_id=enrollment.id,
                exception_type=ExceptionTypeEnum.MISSING_MATERIALS,
                description=f"资料缺失：缺少 {', '.join(missing_labels)} 证据",
                detected_by="system",
            )
            db.add(exc)
    else:
        for exc in enrollment.exceptions:
            if not exc.resolved and exc.exception_type == ExceptionTypeEnum.MISSING_MATERIALS:
                exc.resolved = True
                exc.resolved_at = datetime.datetime.utcnow()
                exc.resolution_note = f"补正后资料齐全，异常解决。责任人变更：{old_handler_name} → {new_handler_name}"

    correct_comment = data.comment or ""
    full_comment = f"{correct_comment}。责任人变更：{old_handler_name} → {new_handler_name}" if correct_comment else f"补正提交，责任人变更：{old_handler_name} → {new_handler_name}"
    audit_log = AuditLog(
        enrollment_id=enrollment.id,
        user_id=user['id'],
        action_type=ActionTypeEnum.CORRECT,
        old_status=old_status,
        new_status=enrollment.status,
        comment=full_comment,
    )
    db.add(audit_log)

    db.commit()
    db.refresh(enrollment)
    return enrollment


def _get_error_code(exc: Exception) -> Optional[str]:
    from app.exceptions import BusinessException

    if isinstance(exc, BusinessException):
        return exc.error_code
    return None


def batch_audit(db: Session, data: BatchAuditRequest, user: Any) -> BatchResultResponse:
    results: list[BatchItemResult] = []
    success_count = 0

    for eid in data.ids:
        try:
            enrollment = db.query(Enrollment).filter(Enrollment.id == eid).first()
            if not enrollment:
                results.append(
                    BatchItemResult(
                        id=eid,
                        success=False,
                        message="入会单不存在",
                        error_code="not_found",
                    )
                )
                continue

            req = AuditRequest(
                enrollment_id=eid,
                passed=data.passed,
                comment=data.comment,
                version=enrollment.version,
            )
            result = audit_enrollment(db, req, user, block_overdue=True)
            results.append(
                BatchItemResult(
                    id=eid,
                    success=True,
                    message="审核成功",
                    data=enrollment_to_response(result),
                )
            )
            success_count += 1
        except Exception as e:
            db.rollback()
            error_code = _get_error_code(e)
            results.append(
                BatchItemResult(
                    id=eid,
                    success=False,
                    message=str(e),
                    error_code=error_code,
                )
            )

    return BatchResultResponse(
        total=len(data.ids),
        success_count=success_count,
        fail_count=len(data.ids) - success_count,
        results=results,
    )


def batch_review(db: Session, data: BatchReviewRequest, user: Any) -> BatchResultResponse:
    results: list[BatchItemResult] = []
    success_count = 0

    for eid in data.ids:
        try:
            enrollment = db.query(Enrollment).filter(Enrollment.id == eid).first()
            if not enrollment:
                results.append(
                    BatchItemResult(
                        id=eid,
                        success=False,
                        message="入会单不存在",
                        error_code="not_found",
                    )
                )
                continue

            req = ReviewRequest(
                enrollment_id=eid,
                passed=data.passed,
                comment=data.comment,
                version=enrollment.version,
            )
            result = review_enrollment(db, req, user, block_overdue=True)
            results.append(
                BatchItemResult(
                    id=eid,
                    success=True,
                    message="复核成功",
                    data=enrollment_to_response(result),
                )
            )
            success_count += 1
        except Exception as e:
            db.rollback()
            error_code = _get_error_code(e)
            results.append(
                BatchItemResult(
                    id=eid,
                    success=False,
                    message=str(e),
                    error_code=error_code,
                )
            )

    return BatchResultResponse(
        total=len(data.ids),
        success_count=success_count,
        fail_count=len(data.ids) - success_count,
        results=results,
    )


def get_stats(db: Session, user: Any) -> dict:
    total = db.query(Enrollment).count()
    pending = db.query(Enrollment).filter(Enrollment.status == EnrollmentStatusEnum.PENDING).count()
    failed = db.query(Enrollment).filter(Enrollment.status == EnrollmentStatusEnum.FAILED).count()
    completed = (
        db.query(Enrollment).filter(Enrollment.status == EnrollmentStatusEnum.COMPLETED).count()
    )

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

    if user['role'] == RoleEnum.REGISTRATION_CLERK:
        my_todo = (
            db.query(Enrollment)
            .filter(
                Enrollment.status == EnrollmentStatusEnum.FAILED,
                Enrollment.created_by_id == user['id'],
            )
            .count()
        )
    elif user['role'] == RoleEnum.AUDIT_SUPERVISOR:
        my_todo = (
            db.query(Enrollment)
            .filter(
                Enrollment.status == EnrollmentStatusEnum.PENDING,
                Enrollment.audit_by_id.is_(None),
            )
            .count()
        )
    elif user['role'] == RoleEnum.REVIEW_LEAD:
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


def check_queue_exceptions(db: Session, user: Any) -> list[dict]:
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
                        "member_name": enrollment.member_name,
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
                        "member_name": enrollment.member_name,
                        "exception_type": ExceptionTypeEnum.MISSING_MATERIALS.value,
                        "description": f"资料缺失：缺少 {', '.join(missing_labels)} 证据",
                    }
                )

    db.commit()
    return exceptions
