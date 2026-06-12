from datetime import datetime, timedelta
from typing import List, Optional, Tuple, Dict, Any
from sqlalchemy import and_, or_, func
from sqlalchemy.orm import Session
from models import (
    User, TrainingProject, Attachment, ProcessingRecord,
    AuditNote, ExceptionRecord
)
from schemas import (
    TrainingProjectCreate, TrainingProjectUpdate,
    ProcessActionRequest, BatchActionRequest, BatchResultItem,
    DashboardStats
)
from auth_service import user_simple_response


def get_deadline_status(project: TrainingProject) -> Tuple[str, int]:
    if not project.deadline:
        return ("normal", 0)
    now = datetime.utcnow()
    delta = (project.deadline - now).total_seconds() / 86400
    if delta < 0:
        return ("overdue", int(abs(delta)))
    elif delta <= 3:
        return ("near", int(delta))
    else:
        return ("normal", int(delta))


def project_to_simple_dict(p: TrainingProject) -> dict:
    deadline_status, overdue_days = get_deadline_status(p)
    return {
        "id": p.id,
        "project_no": p.project_no,
        "project_name": p.project_name,
        "client_company": p.client_company,
        "contact_person": p.contact_person,
        "training_type": p.training_type,
        "training_count": p.training_count or 0,
        "status": p.status,
        "status_name": TrainingProject.STATUS_NAMES.get(p.status, p.status),
        "current_handler_role": p.current_handler_role,
        "current_handler": user_simple_response(p.current_handler),
        "deadline": p.deadline,
        "stage": p.stage,
        "stage_name": TrainingProject.STAGE_NAMES.get(p.stage, p.stage),
        "version": p.version,
        "created_by": user_simple_response(p.created_by),
        "created_at": p.created_at,
        "updated_at": p.updated_at,
        "deadline_status": deadline_status,
        "overdue_days": overdue_days
    }


def project_to_detail_dict(p: TrainingProject, current_user: Optional[User] = None) -> dict:
    d = project_to_simple_dict(p)
    d.update({
        "demand_description": p.demand_description,
        "plan_content": p.plan_content,
        "quotation_amount": p.quotation_amount or 0,
        "contract_no": p.contract_no,
        "contract_date": p.contract_date,
        "expected_start_date": p.expected_start_date,
        "expected_end_date": p.expected_end_date,
        "contact_phone": p.contact_phone,
        "attachments": [
            {
                "id": a.id,
                "file_name": a.file_name,
                "file_type": a.file_type,
                "file_size": a.file_size,
                "category": a.category,
                "is_required": a.is_required,
                "uploaded_by": user_simple_response(a.uploaded_by),
                "uploaded_at": a.uploaded_at
            } for a in sorted(p.attachments, key=lambda x: x.uploaded_at, reverse=True)
        ],
        "processing_records": [
            {
                "id": r.id,
                "project_id": r.project_id,
                "action": r.action,
                "action_name": r.action_name,
                "from_status": r.from_status,
                "to_status": r.to_status,
                "from_stage": r.from_stage,
                "to_stage": r.to_stage,
                "operator": user_simple_response(r.operator),
                "operator_role": r.operator_role,
                "remark": r.remark,
                "evidence_checked": r.evidence_checked,
                "processed_at": r.processed_at,
                "version_at_action": r.version_at_action
            } for r in sorted(p.processing_records, key=lambda x: x.processed_at, reverse=True)
        ],
        "audit_notes": [
            {
                "id": n.id,
                "project_id": n.project_id,
                "note_type": n.note_type,
                "note_content": n.note_content,
                "created_by": user_simple_response(n.created_by),
                "created_at": n.created_at
            } for n in sorted(p.audit_notes, key=lambda x: x.created_at, reverse=True)
        ],
        "exceptions": [],
        "allowed_actions": get_allowed_actions(p, current_user) if current_user else []
    })
    return d


ACTION_SUBMIT = "submit"
ACTION_AUDIT_PASS = "audit_pass"
ACTION_AUDIT_REJECT = "audit_reject"
ACTION_REVIEW_PASS = "review_pass"
ACTION_REVIEW_REJECT = "review_reject"
ACTION_SUPPLEMENT = "supplement"
ACTION_ADVANCE_STAGE = "advance_stage"
ACTION_ARCHIVE = "archive"

ACTION_NAMES = {
    ACTION_SUBMIT: "提交审核",
    ACTION_AUDIT_PASS: "审核通过",
    ACTION_AUDIT_REJECT: "退回补正",
    ACTION_REVIEW_PASS: "复核通过并同步",
    ACTION_REVIEW_REJECT: "复核退回",
    ACTION_SUPPLEMENT: "补正提交",
    ACTION_ADVANCE_STAGE: "推进至下一阶段",
    ACTION_ARCHIVE: "归档"
}


def get_allowed_actions(project: TrainingProject, user: User) -> List[str]:
    actions = []
    s = project.status
    r = user.role
    h_id = project.current_handler_id

    if r == User.ROLE_REGISTRAR:
        if s == TrainingProject.STATUS_DRAFT and project.created_by_id == user.id:
            actions.append(ACTION_SUBMIT)
            actions.append(ACTION_ADVANCE_STAGE)
        elif s == TrainingProject.STATUS_AUDIT_REJECTED and h_id == user.id:
            actions.append(ACTION_SUPPLEMENT)
            actions.append(ACTION_ADVANCE_STAGE)

    elif r == User.ROLE_AUDITOR:
        if s == TrainingProject.STATUS_PENDING_AUDIT and h_id == user.id:
            actions.append(ACTION_AUDIT_PASS)
            actions.append(ACTION_AUDIT_REJECT)
        elif s == TrainingProject.STATUS_REVIEW_REJECTED and h_id == user.id:
            actions.append(ACTION_AUDIT_PASS)
            actions.append(ACTION_AUDIT_REJECT)

    elif r == User.ROLE_REVIEWER:
        if s == TrainingProject.STATUS_AUDIT_PASSED:
            actions.append(ACTION_REVIEW_PASS)
            actions.append(ACTION_REVIEW_REJECT)
        elif s == TrainingProject.STATUS_SYNCED:
            actions.append(ACTION_ARCHIVE)

    return actions


def generate_project_no(db: Session) -> str:
    now = datetime.utcnow()
    prefix = f"TP{now.strftime('%Y%m')}"
    last = db.query(TrainingProject).filter(
        TrainingProject.project_no.like(f"{prefix}%")
    ).order_by(TrainingProject.id.desc()).first()
    seq = 1
    if last:
        try:
            seq = int(last.project_no[len(prefix):]) + 1
        except ValueError:
            seq = 1
    return f"{prefix}{seq:04d}"


def add_exception(db: Session, project_id: int, exc_type: str, msg: str,
                  resp_role: Optional[str] = None, resp_user_id: Optional[int] = None,
                  exc_code: Optional[str] = None):
    exc = ExceptionRecord(
        project_id=project_id,
        exception_type=exc_type,
        exception_code=exc_code,
        exception_message=msg,
        responsible_role=resp_role,
        responsible_user_id=resp_user_id
    )
    db.add(exc)
    note = AuditNote(
        project_id=project_id,
        note_type=AuditNote.TYPE_EXCEPTION,
        note_content=f"[{exc_type}] {msg}"
    )
    db.add(note)
    db.flush()


def add_audit_note(db: Session, project_id: int, note_type: str, content: str,
                   created_by_id: Optional[int] = None):
    note = AuditNote(
        project_id=project_id,
        note_type=note_type,
        note_content=content,
        created_by_id=created_by_id
    )
    db.add(note)
    db.flush()
    return note


def add_processing_record(db: Session, project_id: int, action: str,
                          operator_id: int, operator_role: str,
                          from_status: Optional[str] = None, to_status: Optional[str] = None,
                          from_stage: Optional[str] = None, to_stage: Optional[str] = None,
                          remark: Optional[str] = None, evidence: Optional[str] = None,
                          version: Optional[int] = None):
    r = ProcessingRecord(
        project_id=project_id,
        action=action,
        action_name=ACTION_NAMES.get(action, action),
        from_status=from_status,
        to_status=to_status,
        from_stage=from_stage,
        to_stage=to_stage,
        operator_id=operator_id,
        operator_role=operator_role,
        remark=remark,
        evidence_checked=evidence,
        version_at_action=version
    )
    db.add(r)
    db.flush()
    return r


def check_deadline_overdue(db: Session, project: TrainingProject) -> bool:
    if project.deadline and datetime.utcnow() > project.deadline:
        if project.status not in [TrainingProject.STATUS_SYNCED, TrainingProject.STATUS_ARCHIVED]:
            status, _ = get_deadline_status(project)
            if status == "overdue":
                add_exception(
                    db, project.id,
                    ExceptionRecord.TYPE_OVERDUE,
                    f"项目已逾期，截止日期为 {project.deadline.strftime('%Y-%m-%d')}，已逾期 {get_deadline_status(project)[1]} 天",
                    resp_role=project.current_handler_role,
                    resp_user_id=project.current_handler_id,
                    exc_code="OVERDUE-001"
                )
                return True
    return False


def validate_required_evidence(db: Session, project: TrainingProject, stage: str) -> Tuple[bool, List[str]]:
    missing = []
    atts = db.query(Attachment).filter(
        Attachment.project_id == project.id,
        Attachment.is_required == True
    ).all()
    att_categories = {a.category for a in atts}
    any_atts = db.query(Attachment).filter(Attachment.project_id == project.id).all()
    any_categories = {a.category for a in any_atts}

    if stage == TrainingProject.STAGE_DEMAND:
        if not project.demand_description or not project.demand_description.strip():
            missing.append("培训需求描述未填写")
        if not project.training_count or project.training_count <= 0:
            missing.append("培训人数未填写")
        if Attachment.CATEGORY_DEMAND not in any_categories and Attachment.CATEGORY_DEMAND not in att_categories:
            missing.append("缺少需求阶段的材料（需求说明/调研记录等）")

    if stage == TrainingProject.STAGE_PLAN:
        if not project.plan_content or not project.plan_content.strip():
            missing.append("方案内容未填写")
        if not project.quotation_amount or project.quotation_amount <= 0:
            missing.append("报价金额未填写")
        if Attachment.CATEGORY_PLAN not in any_categories and Attachment.CATEGORY_PLAN not in att_categories:
            missing.append("缺少方案阶段的必备材料（方案文档/报价明细等）")

    if stage == TrainingProject.STAGE_CONTRACT:
        if not project.contract_no or not project.contract_no.strip():
            missing.append("合同编号未填写")
        if not project.plan_content or not project.quotation_amount:
            missing.append("合同阶段需先完成方案内容与报价（方案阶段前置材料）")
        if Attachment.CATEGORY_CONTRACT not in any_categories and Attachment.CATEGORY_CONTRACT not in att_categories:
            missing.append("缺少合同阶段的必备材料（合同扫描件等）")

    return (len(missing) == 0, missing)


def create_project(db: Session, data: TrainingProjectCreate, user: User) -> TrainingProject:
    p = TrainingProject(
        project_no=generate_project_no(db),
        project_name=data.project_name,
        client_company=data.client_company,
        contact_person=data.contact_person,
        contact_phone=data.contact_phone,
        training_type=data.training_type,
        training_count=data.training_count,
        expected_start_date=data.expected_start_date,
        expected_end_date=data.expected_end_date,
        demand_description=data.demand_description,
        plan_content=data.plan_content,
        quotation_amount=data.quotation_amount,
        contract_no=data.contract_no,
        contract_date=data.contract_date,
        deadline=data.deadline,
        stage=data.stage or TrainingProject.STAGE_DEMAND,
        status=TrainingProject.STATUS_DRAFT,
        current_handler_role=User.ROLE_REGISTRAR,
        current_handler_id=user.id,
        created_by_id=user.id,
        version=1
    )
    db.add(p)
    db.flush()
    add_processing_record(
        db, p.id, "create", user.id, user.role,
        from_status=None, to_status=TrainingProject.STATUS_DRAFT,
        from_stage=None, to_stage=p.stage,
        remark="项目单创建", version=1
    )
    add_audit_note(db, p.id, AuditNote.TYPE_STATUS_CHANGE,
                   f"项目单创建，状态：草稿，创建人：{user.full_name}", user.id)
    db.commit()
    db.refresh(p)
    return p


def update_project(db: Session, p: TrainingProject, data: TrainingProjectUpdate, user: User) -> Tuple[bool, str]:
    allowed_roles_edit = [User.ROLE_REGISTRAR]
    if user.role not in allowed_roles_edit:
        return (False, "无权限修改项目单，仅课程顾问可修改")
    if p.created_by_id != user.id and user.role != User.ROLE_REGISTRAR:
        return (False, "仅创建人可修改项目单")
    if p.status not in [TrainingProject.STATUS_DRAFT, TrainingProject.STATUS_AUDIT_REJECTED]:
        return (False, f"当前状态 [{TrainingProject.STATUS_NAMES.get(p.status)}] 不允许修改")

    if data.version != p.version:
        add_exception(db, p.id, ExceptionRecord.TYPE_VERSION_CONFLICT,
                      f"版本冲突：提交版本 {data.version}，当前版本 {p.version}，请刷新后重试",
                      resp_role=user.role, resp_user_id=user.id, exc_code="VER-001")
        db.commit()
        return (False, f"版本冲突：当前版本已更新至 {p.version}，请刷新页面")

    p.project_name = data.project_name
    p.client_company = data.client_company
    p.contact_person = data.contact_person
    p.contact_phone = data.contact_phone
    p.training_type = data.training_type
    p.training_count = data.training_count
    p.expected_start_date = data.expected_start_date
    p.expected_end_date = data.expected_end_date
    p.demand_description = data.demand_description
    p.plan_content = data.plan_content
    p.quotation_amount = data.quotation_amount
    p.contract_no = data.contract_no
    p.contract_date = data.contract_date
    p.deadline = data.deadline
    p.stage = data.stage or p.stage
    p.version += 1
    p.updated_at = datetime.utcnow()

    add_processing_record(
        db, p.id, "update", user.id, user.role,
        from_status=p.status, to_status=p.status,
        from_stage=None, to_stage=None,
        remark=f"项目单修改，版本更新至 {p.version}", version=p.version
    )
    db.commit()
    db.refresh(p)
    return (True, "修改成功")


def process_action(db: Session, p: TrainingProject, req: ProcessActionRequest, user: User) -> Tuple[bool, str]:
    action = req.action
    version = req.version

    if version != p.version:
        add_exception(db, p.id, ExceptionRecord.TYPE_VERSION_CONFLICT,
                      f"动作[{action}]版本冲突：提交 {version}，当前 {p.version}",
                      resp_role=user.role, resp_user_id=user.id, exc_code="VER-002")
        db.commit()
        return (False, f"版本冲突，请刷新后重试（当前版本 {p.version}）")

    allowed = get_allowed_actions(p, user)
    if action not in allowed:
        add_exception(db, p.id, ExceptionRecord.TYPE_PERMISSION_DENIED,
                      f"越权操作：角色[{user.role}]在状态[{p.status}]下不允许执行[{action}]",
                      resp_role=user.role, resp_user_id=user.id, exc_code="PERM-001")
        db.commit()
        return (False, f"当前角色无权限执行该操作")

    if p.current_handler_id and p.current_handler_id != user.id and action in [
        ACTION_AUDIT_PASS, ACTION_AUDIT_REJECT, ACTION_SUPPLEMENT
    ]:
        add_exception(db, p.id, ExceptionRecord.TYPE_PERMISSION_DENIED,
                      f"处理人不匹配：当前处理人ID {p.current_handler_id}，操作人 {user.id}",
                      resp_role=user.role, resp_user_id=user.id, exc_code="PERM-002")
        db.commit()
        return (False, "该单据分配给其他处理人，您无法办理")

    check_deadline_overdue(db, p)

    old_status = p.status
    old_stage = p.stage
    msg = ""
    evidence_info = ""

    try:
        if action == ACTION_SUBMIT:
            ok, missing = validate_required_evidence(db, p, p.stage)
            if not ok:
                for m in missing:
                    add_exception(db, p.id, ExceptionRecord.TYPE_MISSING_EVIDENCE,
                                  f"提交审核时缺少必要材料：{m}",
                                  resp_role=user.role, resp_user_id=user.id, exc_code="EVI-001")
                db.commit()
                return (False, "缺少必要材料：" + "；".join(missing))

            auditor = db.query(User).filter(User.role == User.ROLE_AUDITOR, User.is_active == True).first()
            p.status = TrainingProject.STATUS_PENDING_AUDIT
            p.current_handler_role = User.ROLE_AUDITOR
            p.current_handler_id = auditor.id if auditor else None
            msg = f"已提交审核，等待讲师运营处理"
            evidence_info = "需求材料检查通过"

        elif action == ACTION_AUDIT_PASS:
            ok, missing = validate_required_evidence(db, p, p.stage)
            if not ok:
                for m in missing:
                    add_exception(db, p.id, ExceptionRecord.TYPE_MISSING_EVIDENCE,
                                  f"审核通过时缺少必要材料：{m}",
                                  resp_role=user.role, resp_user_id=user.id, exc_code="EVI-002")
                db.commit()
                return (False, "缺少必要材料，无法通过审核：" + "；".join(missing))
            p.status = TrainingProject.STATUS_AUDIT_PASSED
            p.current_handler_role = User.ROLE_REVIEWER
            p.current_handler_id = None
            msg = "审核通过，等待项目经理复核"
            evidence_info = "过程核对完成，材料齐全"

        elif action == ACTION_AUDIT_REJECT:
            p.status = TrainingProject.STATUS_AUDIT_REJECTED
            p.current_handler_role = User.ROLE_REGISTRAR
            p.current_handler_id = p.created_by_id
            msg = f"已退回补正：{req.remark or '无备注'}"
            add_audit_note(db, p.id, AuditNote.TYPE_SUPPLEMENT,
                           f"讲师运营退回补正，原因：{req.remark or '未填写'}", user.id)

        elif action == ACTION_REVIEW_PASS:
            ok, missing = validate_required_evidence(db, p, p.stage)
            if not ok:
                for m in missing:
                    add_exception(db, p.id, ExceptionRecord.TYPE_MISSING_EVIDENCE,
                                  f"复核通过时缺少必要材料：{m}",
                                  resp_role=user.role, resp_user_id=user.id, exc_code="EVI-003")
                db.commit()
                return (False, "缺少必要材料，无法同步：" + "；".join(missing))
            p.status = TrainingProject.STATUS_SYNCED
            p.current_handler_role = User.ROLE_REVIEWER
            p.current_handler_id = user.id
            msg = "复核通过，已同步"
            evidence_info = "结果确认完成，已同步归档队列"

        elif action == ACTION_REVIEW_REJECT:
            p.status = TrainingProject.STATUS_REVIEW_REJECTED
            auditor = db.query(User).filter(User.role == User.ROLE_AUDITOR, User.is_active == True).first()
            p.current_handler_role = User.ROLE_AUDITOR
            p.current_handler_id = auditor.id if auditor else None
            msg = f"复核退回：{req.remark or '无备注'}"
            add_audit_note(db, p.id, AuditNote.TYPE_SUPPLEMENT,
                           f"项目经理复核退回，原因：{req.remark or '未填写'}", user.id)

        elif action == ACTION_SUPPLEMENT:
            auditor = db.query(User).filter(User.role == User.ROLE_AUDITOR, User.is_active == True).first()
            p.status = TrainingProject.STATUS_PENDING_AUDIT
            p.current_handler_role = User.ROLE_AUDITOR
            p.current_handler_id = auditor.id if auditor else None
            msg = f"补正完成，重新提交审核"
            evidence_info = "补正材料已上传"
            add_audit_note(db, p.id, AuditNote.TYPE_SUPPLEMENT,
                           f"课程顾问补正完成，备注：{req.remark or '无'}", user.id)

        elif action == ACTION_ADVANCE_STAGE:
            ok, missing = validate_required_evidence(db, p, p.stage)
            if not ok:
                for m in missing:
                    add_exception(db, p.id, ExceptionRecord.TYPE_MISSING_EVIDENCE,
                                  f"推进阶段缺少必要材料：{m}",
                                  resp_role=user.role, resp_user_id=user.id, exc_code="EVI-004")
                db.commit()
                return (False, "当前阶段材料不完整，无法推进：" + "；".join(missing))
            stage_order = [TrainingProject.STAGE_DEMAND, TrainingProject.STAGE_PLAN, TrainingProject.STAGE_CONTRACT]
            idx = stage_order.index(p.stage) if p.stage in stage_order else -1
            if idx < len(stage_order) - 1:
                p.stage = stage_order[idx + 1]
                msg = f"已推进至下一阶段：{TrainingProject.STAGE_NAMES[p.stage]}"
                evidence_info = f"阶段推进：{TrainingProject.STAGE_NAMES[old_stage]} -> {TrainingProject.STAGE_NAMES[p.stage]}"
            else:
                return (False, "已处于最终阶段，无法继续推进")

        elif action == ACTION_ARCHIVE:
            p.status = TrainingProject.STATUS_ARCHIVED
            p.current_handler_role = None
            p.current_handler_id = None
            msg = "项目已归档"

        else:
            return (False, f"未知操作：{action}")

        p.version += 1
        p.updated_at = datetime.utcnow()

        add_processing_record(
            db, p.id, action, user.id, user.role,
            from_status=old_status, to_status=p.status,
            from_stage=old_stage, to_stage=p.stage,
            remark=req.remark or msg,
            evidence=evidence_info or None,
            version=p.version
        )
        add_audit_note(
            db, p.id, AuditNote.TYPE_STATUS_CHANGE,
            f"[{ACTION_NAMES.get(action, action)}] {old_status} -> {p.status}，处理人：{user.full_name}，备注：{req.remark or '无'}",
            user.id
        )
        db.commit()
        db.refresh(p)
        return (True, msg)

    except Exception as e:
        db.rollback()
        add_exception(db, p.id, ExceptionRecord.TYPE_STATUS_CONFLICT,
                      f"状态流转异常：{str(e)}",
                      resp_role=user.role, resp_user_id=user.id, exc_code="FLOW-001")
        db.commit()
        return (False, f"操作异常：{str(e)}")


def batch_process(db: Session, req: BatchActionRequest, user: User) -> List[BatchResultItem]:
    results = []
    versions_map = req.versions or {}

    for pid in req.ids:
        p = db.query(TrainingProject).filter(TrainingProject.id == pid, TrainingProject.is_deleted == False).first()
        if not p:
            results.append(BatchResultItem(id=pid, project_no=None, success=False,
                                           message="项目单不存在", new_status=None))
            continue

        v = versions_map.get(pid, p.version)
        action_req = ProcessActionRequest(
            action=req.action,
            remark=req.remark,
            version=v
        )
        ok, msg = process_action(db, p, action_req, user)
        results.append(BatchResultItem(
            id=pid,
            project_no=p.project_no,
            success=ok,
            message=msg,
            new_status=p.status if ok else None
        ))

    return results


def list_projects(db: Session, user: User, page: int = 1, page_size: int = 20,
                  status: Optional[str] = None, stage: Optional[str] = None,
                  deadline_status: Optional[str] = None, keyword: Optional[str] = None,
                  handler_only: bool = False) -> Tuple[List[TrainingProject], int, Dict]:
    q = db.query(TrainingProject).filter(TrainingProject.is_deleted == False)

    if handler_only:
        q = q.filter(
            or_(
                TrainingProject.current_handler_id == user.id,
                and_(
                    TrainingProject.current_handler_role == user.role,
                    TrainingProject.current_handler_id == None
                ),
                TrainingProject.created_by_id == user.id
            )
        )
    else:
        if user.role == User.ROLE_REGISTRAR:
            q = q.filter(
                or_(
                    TrainingProject.created_by_id == user.id,
                    TrainingProject.current_handler_role == User.ROLE_REGISTRAR
                )
            )
        elif user.role == User.ROLE_AUDITOR:
            q = q.filter(
                or_(
                    TrainingProject.current_handler_id == user.id,
                    TrainingProject.current_handler_role == User.ROLE_AUDITOR,
                    TrainingProject.status.in_([
                        TrainingProject.STATUS_PENDING_AUDIT,
                        TrainingProject.STATUS_AUDIT_REJECTED,
                        TrainingProject.STATUS_AUDIT_PASSED,
                        TrainingProject.STATUS_REVIEW_REJECTED
                    ])
                )
            )
        elif user.role == User.ROLE_REVIEWER:
            pass

    if status:
        status_list = status.split(",")
        q = q.filter(TrainingProject.status.in_(status_list))
    if stage:
        stage_list = stage.split(",")
        q = q.filter(TrainingProject.stage.in_(stage_list))
    if keyword:
        kw = f"%{keyword}%"
        q = q.filter(
            or_(
                TrainingProject.project_no.like(kw),
                TrainingProject.project_name.like(kw),
                TrainingProject.client_company.like(kw)
            )
        )

    total = q.count()
    items = q.order_by(TrainingProject.updated_at.desc()).offset((page - 1) * page_size).limit(page_size).all()

    all_items = q.all()
    normal_c = near_c = overdue_c = 0
    for it in all_items:
        ds, _ = get_deadline_status(it)
        if ds == "normal":
            normal_c += 1
        elif ds == "near":
            near_c += 1
        else:
            overdue_c += 1

    filtered_items = items
    if deadline_status:
        ds_list = deadline_status.split(",")
        filtered_items = [it for it in items if get_deadline_status(it)[0] in ds_list]
        total = len([it for it in all_items if get_deadline_status(it)[0] in ds_list])

    stats = {
        "normal_deadline": normal_c,
        "near_deadline": near_c,
        "overdue": overdue_c
    }
    return filtered_items, total, stats


def get_dashboard_stats(db: Session, user: User) -> DashboardStats:
    q = db.query(TrainingProject).filter(TrainingProject.is_deleted == False)

    if user.role == User.ROLE_REGISTRAR:
        q = q.filter(
            or_(
                TrainingProject.created_by_id == user.id,
                TrainingProject.current_handler_role == User.ROLE_REGISTRAR
            )
        )
    elif user.role == User.ROLE_AUDITOR:
        q = q.filter(
            or_(
                TrainingProject.current_handler_id == user.id,
                TrainingProject.current_handler_role == User.ROLE_AUDITOR
            )
        )

    all_items = q.all()
    normal_c = near_c = overdue_c = 0
    for it in all_items:
        ds, _ = get_deadline_status(it)
        if ds == "normal":
            normal_c += 1
        elif ds == "near":
            near_c += 1
        else:
            overdue_c += 1

    role_counts = {}
    for r in [User.ROLE_REGISTRAR, User.ROLE_AUDITOR, User.ROLE_REVIEWER]:
        rc = sum(1 for it in all_items if it.current_handler_role == r)
        role_counts[User.ROLE_NAMES[r]] = rc

    return DashboardStats(
        total_count=len(all_items),
        draft_count=sum(1 for x in all_items if x.status == TrainingProject.STATUS_DRAFT),
        pending_audit_count=sum(1 for x in all_items if x.status in [TrainingProject.STATUS_PENDING_AUDIT, TrainingProject.STATUS_AUDIT_REJECTED, TrainingProject.STATUS_REVIEW_REJECTED]),
        audit_passed_count=sum(1 for x in all_items if x.status == TrainingProject.STATUS_AUDIT_PASSED),
        pending_review_count=sum(1 for x in all_items if x.status in [TrainingProject.STATUS_AUDIT_PASSED, TrainingProject.STATUS_PENDING_REVIEW]),
        synced_count=sum(1 for x in all_items if x.status in [TrainingProject.STATUS_SYNCED, TrainingProject.STATUS_ARCHIVED]),
        normal_deadline_count=normal_c,
        near_deadline_count=near_c,
        overdue_count=overdue_c,
        stage_demand_count=sum(1 for x in all_items if x.stage == TrainingProject.STAGE_DEMAND),
        stage_plan_count=sum(1 for x in all_items if x.stage == TrainingProject.STAGE_PLAN),
        stage_contract_count=sum(1 for x in all_items if x.stage == TrainingProject.STAGE_CONTRACT),
        role_counts=role_counts
    )
