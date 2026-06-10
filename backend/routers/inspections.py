import os
import shutil
from datetime import datetime
from uuid import uuid4
from typing import Optional, List, Dict

from fastapi import APIRouter, Depends, HTTPException, status, Query, UploadFile, File, Form
from sqlalchemy.orm import Session, joinedload

from database import get_db
from models import (
    User, Inspection, ChargingPileInspection, FaultReport,
    ProcessingRecord, AuditRemark, CorrectionRecord, ExceptionReason,
    Attachment,
)
from schemas import (
    InspectionCreate, InspectionSubmit, InspectionProcess,
    InspectionReview, InspectionReturn, InspectionCorrect,
    InspectionResponse, InspectionListItem, InspectionStats,
    BatchProcessRequest, BatchResult, AuditTrailResponse,
    ProcessingRecordResponse, AuditRemarkResponse,
    CorrectionRecordResponse, ExceptionReasonResponse,
    ChargingPileInspectionResponse, FaultReportResponse,
    AttachmentResponse, PreviousOpinionResponse,
)
from auth import get_current_user, check_permission

router = APIRouter(prefix="/inspections", tags=["inspections"])

ATTACHMENTS_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "attachments")
os.makedirs(ATTACHMENTS_DIR, exist_ok=True)


def _user_name_map(db: Session) -> Dict[str, str]:
    return {u.id: u.name for u in db.query(User).all()}


def _attachments_for_record(db: Session, record: ProcessingRecord) -> List[Attachment]:
    return (
        db.query(Attachment)
        .filter(Attachment.inspection_id == record.inspection_id)
        .filter(Attachment.uploaded_by == record.operator_id)
        .filter(Attachment.created_at >= record.created_at)
        .all()
    )


def _build_list_item(insp: Inspection, name_map: Dict[str, str]) -> InspectionListItem:
    return InspectionListItem(
        id=insp.id,
        title=insp.title,
        description=insp.description,
        status=insp.status,
        creator_id=insp.creator_id,
        creator_name=name_map.get(insp.creator_id),
        processor_id=insp.processor_id,
        processor_name=name_map.get(insp.processor_id) if insp.processor_id else None,
        reviewer_id=insp.reviewer_id,
        reviewer_name=name_map.get(insp.reviewer_id) if insp.reviewer_id else None,
        version=insp.version,
        deadline=insp.deadline,
        created_at=insp.created_at,
        updated_at=insp.updated_at,
    )


def _build_previous_opinion(db: Session, insp: Inspection, name_map: Dict[str, str]) -> Optional[PreviousOpinionResponse]:
    prs = (
        db.query(ProcessingRecord)
        .filter(ProcessingRecord.inspection_id == insp.id)
        .filter(ProcessingRecord.to_status == insp.status)
        .order_by(ProcessingRecord.created_at.desc())
        .all()
    )
    if not prs:
        all_prs = (
            db.query(ProcessingRecord)
            .filter(ProcessingRecord.inspection_id == insp.id)
            .order_by(ProcessingRecord.created_at.desc())
            .limit(2)
            .all()
        )
        if len(all_prs) >= 2:
            prev = all_prs[1]
        else:
            prev = all_prs[0] if all_prs else None
    else:
        if len(prs) >= 1:
            prev_inspection = (
                db.query(ProcessingRecord)
                .filter(ProcessingRecord.inspection_id == insp.id)
                .filter(ProcessingRecord.created_at < prs[0].created_at)
                .order_by(ProcessingRecord.created_at.desc())
                .first()
            )
            prev = prev_inspection if prev_inspection else prs[0]
        else:
            prev = None

    if not prev:
        return None

    atts = _attachments_for_record(db, prev)
    att_resps = [
        AttachmentResponse(
            id=a.id, inspection_id=a.inspection_id, file_name=a.file_name,
            file_path=a.file_path, uploaded_by=a.uploaded_by,
            uploaded_by_name=name_map.get(a.uploaded_by), created_at=a.created_at,
        )
        for a in atts
    ]
    return PreviousOpinionResponse(
        operator_name=name_map.get(prev.operator_id),
        operator_role=prev.operator_role,
        opinion=prev.opinion,
        attachments=att_resps,
        created_at=prev.created_at,
    )


def _build_inspection_response(db: Session, insp: Inspection, name_map: Dict[str, str]) -> InspectionResponse:
    cpis = db.query(ChargingPileInspection).filter(ChargingPileInspection.inspection_id == insp.id).all()
    frs = db.query(FaultReport).filter(FaultReport.inspection_id == insp.id).all()
    prs = db.query(ProcessingRecord).filter(ProcessingRecord.inspection_id == insp.id).order_by(ProcessingRecord.created_at).all()
    ars = db.query(AuditRemark).filter(AuditRemark.inspection_id == insp.id).order_by(AuditRemark.created_at).all()
    crs = db.query(CorrectionRecord).filter(CorrectionRecord.inspection_id == insp.id).order_by(CorrectionRecord.created_at).all()
    ers = db.query(ExceptionReason).filter(ExceptionReason.inspection_id == insp.id).order_by(ExceptionReason.created_at).all()
    atts = db.query(Attachment).filter(Attachment.inspection_id == insp.id).order_by(Attachment.created_at).all()

    return InspectionResponse(
        id=insp.id,
        title=insp.title,
        description=insp.description,
        status=insp.status,
        creator_id=insp.creator_id,
        creator_name=name_map.get(insp.creator_id),
        processor_id=insp.processor_id,
        processor_name=name_map.get(insp.processor_id) if insp.processor_id else None,
        reviewer_id=insp.reviewer_id,
        reviewer_name=name_map.get(insp.reviewer_id) if insp.reviewer_id else None,
        version=insp.version,
        deadline=insp.deadline,
        created_at=insp.created_at,
        updated_at=insp.updated_at,
        previous_opinion=_build_previous_opinion(db, insp, name_map),
        attachments=[
            AttachmentResponse(
                id=a.id, inspection_id=a.inspection_id, file_name=a.file_name,
                file_path=a.file_path, uploaded_by=a.uploaded_by,
                uploaded_by_name=name_map.get(a.uploaded_by), created_at=a.created_at,
            )
            for a in atts
        ],
        charging_pile_inspections=[ChargingPileInspectionResponse.model_validate(c) for c in cpis],
        fault_reports=[FaultReportResponse.model_validate(f) for f in frs],
        processing_records=[
            ProcessingRecordResponse(
                id=p.id, inspection_id=p.inspection_id, operator_id=p.operator_id,
                operator_role=p.operator_role, operator_name=name_map.get(p.operator_id),
                from_status=p.from_status, to_status=p.to_status, opinion=p.opinion,
                version=p.version, created_at=p.created_at,
            )
            for p in prs
        ],
        audit_remarks=[
            AuditRemarkResponse(
                id=a.id, inspection_id=a.inspection_id, processing_record_id=a.processing_record_id,
                operator_id=a.operator_id, operator_name=name_map.get(a.operator_id),
                from_status=a.from_status, to_status=a.to_status, remark=a.remark, created_at=a.created_at,
            )
            for a in ars
        ],
        correction_records=[
            CorrectionRecordResponse(
                id=c.id, inspection_id=c.inspection_id, corrector_id=c.corrector_id,
                corrector_name=name_map.get(c.corrector_id), reason=c.reason, field=c.field,
                old_value=c.old_value, new_value=c.new_value, created_at=c.created_at,
            )
            for c in crs
        ],
        exception_reasons=[ExceptionReasonResponse.model_validate(e) for e in ers],
    )


def _create_transition(db: Session, insp: Inspection, user: User, from_status: str, to_status: str,
                       opinion: Optional[str] = None, remark: Optional[str] = None) -> ProcessingRecord:
    pr = ProcessingRecord(
        id=str(uuid4()),
        inspection_id=insp.id,
        operator_id=user.id,
        operator_role=user.role,
        from_status=from_status,
        to_status=to_status,
        opinion=opinion,
        version=insp.version,
        created_at=datetime.utcnow(),
    )
    db.add(pr)
    db.flush()

    ar = AuditRemark(
        id=str(uuid4()),
        inspection_id=insp.id,
        processing_record_id=pr.id,
        operator_id=user.id,
        from_status=from_status,
        to_status=to_status,
        remark=remark or opinion or "",
        created_at=datetime.utcnow(),
    )
    db.add(ar)
    return pr


def _write_exception(db: Session, insp: Inspection, exc_type: str, description: str) -> ExceptionReason:
    er = ExceptionReason(
        id=str(uuid4()),
        inspection_id=insp.id,
        type=exc_type,
        description=description,
        created_at=datetime.utcnow(),
    )
    db.add(er)
    db.flush()
    return er


def _fail(db: Session, insp: Inspection, exc_type: str, description: str, http_code: int, detail: str):
    _write_exception(db, insp, exc_type, description)
    db.commit()
    raise HTTPException(status_code=http_code, detail=detail)


# ---------------------------------------------------------------------------
# GLOBAL AUDIT TRAIL — must come BEFORE /{inspection_id} routes
# ---------------------------------------------------------------------------
@router.get("/global-audit-trail", response_model=AuditTrailResponse)
def get_global_audit_trail(
    inspection_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    name_map = _user_name_map(db)
    pr_query = db.query(ProcessingRecord)
    ar_query = db.query(AuditRemark)
    cr_query = db.query(CorrectionRecord)
    er_query = db.query(ExceptionReason)

    if inspection_id:
        pr_query = pr_query.filter(ProcessingRecord.inspection_id == inspection_id)
        ar_query = ar_query.filter(AuditRemark.inspection_id == inspection_id)
        cr_query = cr_query.filter(CorrectionRecord.inspection_id == inspection_id)
        er_query = er_query.filter(ExceptionReason.inspection_id == inspection_id)

    prs = pr_query.order_by(ProcessingRecord.created_at.desc()).all()
    ars = ar_query.order_by(AuditRemark.created_at.desc()).all()
    crs = cr_query.order_by(CorrectionRecord.created_at.desc()).all()
    ers = er_query.order_by(ExceptionReason.created_at.desc()).all()

    return AuditTrailResponse(
        processing_records=[
            ProcessingRecordResponse(
                id=p.id, inspection_id=p.inspection_id, operator_id=p.operator_id,
                operator_role=p.operator_role, operator_name=name_map.get(p.operator_id),
                from_status=p.from_status, to_status=p.to_status, opinion=p.opinion,
                version=p.version, created_at=p.created_at,
            )
            for p in prs
        ],
        audit_remarks=[
            AuditRemarkResponse(
                id=a.id, inspection_id=a.inspection_id, processing_record_id=a.processing_record_id,
                operator_id=a.operator_id, operator_name=name_map.get(a.operator_id),
                from_status=a.from_status, to_status=a.to_status, remark=a.remark, created_at=a.created_at,
            )
            for a in ars
        ],
        correction_records=[
            CorrectionRecordResponse(
                id=c.id, inspection_id=c.inspection_id, corrector_id=c.corrector_id,
                corrector_name=name_map.get(c.corrector_id), reason=c.reason, field=c.field,
                old_value=c.old_value, new_value=c.new_value, created_at=c.created_at,
            )
            for c in crs
        ],
        exception_reasons=[ExceptionReasonResponse.model_validate(e) for e in ers],
    )


@router.get("", response_model=List[InspectionListItem])
def list_inspections(
    status_filter: Optional[str] = Query(None, alias="status"),
    expiry_status: Optional[str] = Query(None, alias="expiry_status"),
    role: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    name_map = _user_name_map(db)
    query = db.query(Inspection)

    if status_filter:
        query = query.filter(Inspection.status == status_filter)

    if role == "duty_officer":
        query = query.filter(Inspection.creator_id == current_user.id)
    elif role == "maintenance_engineer":
        query = query.filter(
            (Inspection.processor_id == current_user.id) | (Inspection.processor_id.is_(None))
        )
    elif role == "operations_manager":
        query = query.filter(
            (Inspection.reviewer_id == current_user.id) | (Inspection.reviewer_id.is_(None))
        )

    inspections = query.order_by(Inspection.created_at.desc()).all()

    if expiry_status:
        now_ts = datetime.utcnow().timestamp()
        week_later = now_ts + 7 * 86400
        filtered = []
        for insp in inspections:
            try:
                dl = datetime.fromisoformat(insp.deadline).timestamp()
            except (ValueError, TypeError):
                continue
            if expiry_status == "normal" and dl > week_later:
                filtered.append(insp)
            elif expiry_status == "approaching" and now_ts <= dl <= week_later:
                filtered.append(insp)
            elif expiry_status == "overdue" and dl < now_ts:
                filtered.append(insp)
        inspections = filtered

    return [_build_list_item(i, name_map) for i in inspections]


@router.get("/stats", response_model=InspectionStats)
def get_stats(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    total = db.query(Inspection).count()
    return InspectionStats(
        total=total,
        pending_submit=db.query(Inspection).filter(Inspection.status == "pending_submit").count(),
        pending_process=db.query(Inspection).filter(Inspection.status == "pending_process").count(),
        pending_review=db.query(Inspection).filter(Inspection.status == "pending_review").count(),
        completed=db.query(Inspection).filter(Inspection.status == "completed").count(),
        returned=db.query(Inspection).filter(Inspection.status == "returned").count(),
        resubmitted=db.query(Inspection).filter(Inspection.status == "resubmitted").count(),
    )


@router.get("/{inspection_id}", response_model=InspectionResponse)
def get_inspection(
    inspection_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    insp = db.query(Inspection).filter(Inspection.id == inspection_id).first()
    if not insp:
        raise HTTPException(status_code=404, detail="巡检单不存在")
    name_map = _user_name_map(db)
    return _build_inspection_response(db, insp, name_map)


# ---------------------------------------------------------------------------
# CREATE
# ---------------------------------------------------------------------------
@router.post("", response_model=InspectionResponse, status_code=status.HTTP_201_CREATED)
def create_inspection(
    req: InspectionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    check_permission(current_user, "duty_officer")

    try:
        insp_id = str(uuid4())
        now = datetime.utcnow()
        insp = Inspection(
            id=insp_id,
            title=req.title,
            description=req.description,
            status="pending_submit",
            creator_id=current_user.id,
            version=1,
            deadline=req.deadline,
            created_at=now,
            updated_at=now,
        )
        db.add(insp)
        db.flush()

        _create_transition(
            db, insp, current_user, "none", "pending_submit",
            opinion="创建巡检单", remark="站点值班员创建巡检单",
        )

        for cpi_id in req.charging_pile_inspection_ids:
            cpi = db.query(ChargingPileInspection).filter(ChargingPileInspection.id == cpi_id).first()
            if cpi:
                cpi.inspection_id = insp_id

        for fr_id in req.fault_report_ids:
            fr = db.query(FaultReport).filter(FaultReport.id == fr_id).first()
            if fr:
                fr.inspection_id = insp_id

        db.commit()
        db.refresh(insp)
        name_map = _user_name_map(db)
        return _build_inspection_response(db, insp, name_map)
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"创建失败：{str(e)}")


# ---------------------------------------------------------------------------
# SUBMIT
# ---------------------------------------------------------------------------
@router.put("/{inspection_id}/submit", response_model=InspectionResponse)
def submit_inspection(
    inspection_id: str,
    req: InspectionSubmit,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    check_permission(current_user, "duty_officer")
    try:
        insp = db.query(Inspection).filter(Inspection.id == inspection_id).first()
        if not insp:
            raise HTTPException(status_code=404, detail="巡检单不存在")

        if insp.creator_id != current_user.id:
            _fail(db, insp, "permission", f"非创建人无法提交：创建人={insp.creator_id}，当前用户={current_user.id}",
                  403, "只有创建人可以提交")

        if insp.status not in ("pending_submit", "resubmitted"):
            _fail(db, insp, "status", f"当前状态 {insp.status} 不可提交，仅允许 pending_submit 或 resubmitted",
                  400, f"当前状态 {insp.status} 不可提交")

        if insp.version != req.version:
            _fail(db, insp, "status", f"版本冲突：当前版本 {insp.version}，请求版本 {req.version}",
                  409, f"版本冲突：当前版本 {insp.version}，请求版本 {req.version}")

        old_status = insp.status
        insp.status = "pending_process"
        insp.version += 1
        insp.updated_at = datetime.utcnow()
        _create_transition(
            db, insp, current_user, old_status, "pending_process",
            opinion="提交巡检单", remark="值班员提交巡检单",
        )
        db.commit()
        db.refresh(insp)
        name_map = _user_name_map(db)
        return _build_inspection_response(db, insp, name_map)
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"提交失败：{str(e)}")


# ---------------------------------------------------------------------------
# PROCESS (maintenance_engineer)
# ---------------------------------------------------------------------------
@router.put("/{inspection_id}/process", response_model=InspectionResponse)
def process_inspection(
    inspection_id: str,
    req: InspectionProcess,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    check_permission(current_user, "maintenance_engineer")
    try:
        insp = db.query(Inspection).filter(Inspection.id == inspection_id).first()
        if not insp:
            raise HTTPException(status_code=404, detail="巡检单不存在")

        if insp.processor_id and insp.processor_id != current_user.id:
            _fail(db, insp, "permission", f"非指派处理人无法处理：处理人={insp.processor_id}，当前用户={current_user.id}",
                  403, "只有指派的处理人可以处理")

        if insp.status != "pending_process":
            _fail(db, insp, "status", f"当前状态 {insp.status} 不可处理，仅允许 pending_process",
                  400, f"当前状态 {insp.status} 不可处理")

        if insp.version != req.version:
            _fail(db, insp, "status", f"版本冲突：当前版本 {insp.version}，请求版本 {req.version}",
                  409, f"版本冲突：当前版本 {insp.version}，请求版本 {req.version}")

        if not req.opinion or not req.opinion.strip():
            _fail(db, insp, "material", "缺少必填证据：处理意见不能为空",
                  400, "处理意见为必填项")

        try:
            dl = datetime.fromisoformat(insp.deadline)
            if datetime.utcnow() > dl:
                _write_exception(db, insp, "deadline", "处理超时：已超过截止日期")
        except (ValueError, TypeError):
            pass

        old_status = insp.status
        insp.processor_id = current_user.id
        insp.status = "pending_review"
        insp.version += 1
        insp.updated_at = datetime.utcnow()
        _create_transition(
            db, insp, current_user, old_status, "pending_review",
            opinion=req.opinion, remark="运维工程师处理完毕，提交审核",
        )
        db.commit()
        db.refresh(insp)
        name_map = _user_name_map(db)
        return _build_inspection_response(db, insp, name_map)
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"处理失败：{str(e)}")


# ---------------------------------------------------------------------------
# REVIEW (operations_manager)
# ---------------------------------------------------------------------------
@router.put("/{inspection_id}/review", response_model=InspectionResponse)
def review_inspection(
    inspection_id: str,
    req: InspectionReview,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    check_permission(current_user, "operations_manager")
    try:
        insp = db.query(Inspection).filter(Inspection.id == inspection_id).first()
        if not insp:
            raise HTTPException(status_code=404, detail="巡检单不存在")

        if insp.reviewer_id and insp.reviewer_id != current_user.id:
            _fail(db, insp, "permission", f"非指派审核人无法审核：审核人={insp.reviewer_id}，当前用户={current_user.id}",
                  403, "只有指派的审核人可以审核")

        if insp.status != "pending_review":
            _fail(db, insp, "status", f"当前状态 {insp.status} 不可审核，仅允许 pending_review",
                  400, f"当前状态 {insp.status} 不可审核")

        if insp.version != req.version:
            _fail(db, insp, "status", f"版本冲突：当前版本 {insp.version}，请求版本 {req.version}",
                  409, f"版本冲突：当前版本 {insp.version}，请求版本 {req.version}")

        if req.action not in ("approve", "reject"):
            raise HTTPException(status_code=400, detail="action 必须为 approve 或 reject")

        if not req.opinion or not req.opinion.strip():
            _fail(db, insp, "material", "缺少必填证据：复核意见不能为空",
                  400, "复核意见为必填项")

        old_status = insp.status
        new_status = "completed" if req.action == "approve" else "returned"
        insp.reviewer_id = current_user.id
        insp.status = new_status
        insp.version += 1
        insp.updated_at = datetime.utcnow()
        remark_text = "运营经理审核通过" if req.action == "approve" else f"运营经理审核退回：{req.opinion}"
        _create_transition(db, insp, current_user, old_status, new_status,
                           opinion=req.opinion, remark=remark_text)
        db.commit()
        db.refresh(insp)
        name_map = _user_name_map(db)
        return _build_inspection_response(db, insp, name_map)
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"复核失败：{str(e)}")


# ---------------------------------------------------------------------------
# RETURN (operations_manager, separate from review/reject)
# ---------------------------------------------------------------------------
@router.put("/{inspection_id}/return", response_model=InspectionResponse)
def return_inspection(
    inspection_id: str,
    req: InspectionReturn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    check_permission(current_user, "operations_manager")
    try:
        insp = db.query(Inspection).filter(Inspection.id == inspection_id).first()
        if not insp:
            raise HTTPException(status_code=404, detail="巡检单不存在")

        if insp.reviewer_id and insp.reviewer_id != current_user.id:
            _fail(db, insp, "permission", f"非指派审核人无法退回：审核人={insp.reviewer_id}，当前用户={current_user.id}",
                  403, "只有指派的审核人可以退回")

        if insp.status != "pending_review":
            _fail(db, insp, "status", f"当前状态 {insp.status} 不可退回，仅允许 pending_review",
                  400, f"当前状态 {insp.status} 不可退回")

        if insp.version != req.version:
            _fail(db, insp, "status", f"版本冲突：当前版本 {insp.version}，请求版本 {req.version}",
                  409, f"版本冲突：当前版本 {insp.version}，请求版本 {req.version}")

        if not req.reason or not req.reason.strip():
            _fail(db, insp, "material", "缺少必填证据：退回原因不能为空",
                  400, "退回原因为必填项")

        old_status = insp.status
        insp.reviewer_id = current_user.id
        insp.status = "returned"
        insp.version += 1
        insp.updated_at = datetime.utcnow()
        _create_transition(db, insp, current_user, old_status, "returned",
                           opinion=req.reason, remark=f"运营经理退回：{req.reason}")
        db.commit()
        db.refresh(insp)
        name_map = _user_name_map(db)
        return _build_inspection_response(db, insp, name_map)
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"退回失败：{str(e)}")


# ---------------------------------------------------------------------------
# CORRECT (duty_officer, after returned)
# ---------------------------------------------------------------------------
@router.put("/{inspection_id}/correct", response_model=InspectionResponse)
def correct_inspection(
    inspection_id: str,
    req: InspectionCorrect,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    check_permission(current_user, "duty_officer")
    try:
        insp = db.query(Inspection).filter(Inspection.id == inspection_id).first()
        if not insp:
            raise HTTPException(status_code=404, detail="巡检单不存在")

        if insp.creator_id != current_user.id:
            _fail(db, insp, "permission", f"非创建人无法修正：创建人={insp.creator_id}，当前用户={current_user.id}",
                  403, "只有创建人可以修正")

        if insp.status != "returned":
            _fail(db, insp, "status", f"当前状态 {insp.status} 不可修正，仅允许 returned",
                  400, f"当前状态 {insp.status} 不可修正")

        if insp.version != req.version:
            _fail(db, insp, "status", f"版本冲突：当前版本 {insp.version}，请求版本 {req.version}",
                  409, f"版本冲突：当前版本 {insp.version}，请求版本 {req.version}")

        if not req.reason or not req.reason.strip():
            _fail(db, insp, "material", "缺少必填证据：补正原因不能为空",
                  400, "补正原因为必填项")

        old_value = getattr(insp, req.field, None)
        old_value_str = str(old_value) if old_value is not None else None
        if hasattr(insp, req.field):
            setattr(insp, req.field, req.new_value)

        cr = CorrectionRecord(
            id=str(uuid4()),
            inspection_id=insp.id,
            corrector_id=current_user.id,
            reason=req.reason,
            field=req.field,
            old_value=old_value_str,
            new_value=req.new_value,
            created_at=datetime.utcnow(),
        )
        db.add(cr)

        old_status = insp.status
        insp.status = "resubmitted"
        insp.version += 1
        insp.updated_at = datetime.utcnow()
        _create_transition(db, insp, current_user, old_status, "resubmitted",
                           opinion=req.reason, remark=f"值班员修正后重新提交：{req.reason}")
        db.commit()
        db.refresh(insp)
        name_map = _user_name_map(db)
        return _build_inspection_response(db, insp, name_map)
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"修正失败：{str(e)}")


# ---------------------------------------------------------------------------
# UPLOAD ATTACHMENT
# ---------------------------------------------------------------------------
@router.post("/{inspection_id}/attachments", response_model=AttachmentResponse)
def upload_attachment(
    inspection_id: str,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    check_permission(current_user, ["maintenance_engineer", "operations_manager"])
    try:
        insp = db.query(Inspection).filter(Inspection.id == inspection_id).first()
        if not insp:
            raise HTTPException(status_code=404, detail="巡检单不存在")

        insp_dir = os.path.join(ATTACHMENTS_DIR, inspection_id)
        os.makedirs(insp_dir, exist_ok=True)

        safe_name = f"{uuid4()}_{os.path.basename(file.filename or 'attachment')}"
        save_path = os.path.join(insp_dir, safe_name)
        with open(save_path, "wb") as f:
            shutil.copyfileobj(file.file, f)

        rel_path = f"data/attachments/{inspection_id}/{safe_name}"
        att = Attachment(
            id=str(uuid4()),
            inspection_id=inspection_id,
            file_name=file.filename or "attachment",
            file_path=rel_path,
            uploaded_by=current_user.id,
            created_at=datetime.utcnow(),
        )
        db.add(att)
        db.commit()
        db.refresh(att)
        name_map = _user_name_map(db)
        return AttachmentResponse(
            id=att.id, inspection_id=att.inspection_id, file_name=att.file_name,
            file_path=att.file_path, uploaded_by=att.uploaded_by,
            uploaded_by_name=name_map.get(att.uploaded_by), created_at=att.created_at,
        )
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"上传失败：{str(e)}")


# ---------------------------------------------------------------------------
# BATCH PROCESS (process / advance)
# ---------------------------------------------------------------------------
@router.post("/batch-process", response_model=List[BatchResult])
def batch_process(
    req: BatchProcessRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if req.action not in ("process", "advance"):
        raise HTTPException(status_code=400, detail="action 必须为 process 或 advance")

    if req.action == "process":
        check_permission(current_user, "maintenance_engineer")
    else:
        check_permission(current_user, "operations_manager")

    results: List[BatchResult] = []
    try:
        for insp_id in req.inspection_ids:
            insp = db.query(Inspection).filter(Inspection.id == insp_id).first()
            if not insp:
                results.append(BatchResult(inspection_id=insp_id, success=False, reason="巡检单不存在"))
                continue

            if req.action == "process":
                if insp.status != "pending_process":
                    _write_exception(db, insp, "status", f"批量处理失败：状态 {insp.status} 不可处理")
                    results.append(BatchResult(inspection_id=insp_id, success=False,
                                               reason=f"状态 {insp.status} 不可处理"))
                    continue
                if insp.processor_id and insp.processor_id != current_user.id:
                    _write_exception(db, insp, "permission", "批量处理失败：非指派处理人")
                    results.append(BatchResult(inspection_id=insp_id, success=False,
                                               reason="非指派处理人"))
                    continue
                opinion = (req.opinion or "批量处理").strip()
                if not opinion:
                    _write_exception(db, insp, "material", "批量处理失败：处理意见为空")
                    results.append(BatchResult(inspection_id=insp_id, success=False,
                                               reason="处理意见不能为空"))
                    continue

                old_status = insp.status
                insp.processor_id = current_user.id
                insp.status = "pending_review"
                insp.version += 1
                insp.updated_at = datetime.utcnow()
                _create_transition(db, insp, current_user, old_status, "pending_review",
                                   opinion=opinion, remark="运维工程师批量处理完毕")
                results.append(BatchResult(inspection_id=insp_id, success=True))

            elif req.action == "advance":
                now_ts = datetime.utcnow()
                try:
                    dl = datetime.fromisoformat(insp.deadline)
                except (ValueError, TypeError):
                    _write_exception(db, insp, "deadline", "批量推进失败：截止日期格式错误")
                    results.append(BatchResult(inspection_id=insp_id, success=False,
                                               reason="截止日期格式错误"))
                    continue

                if dl >= now_ts:
                    results.append(BatchResult(inspection_id=insp_id, success=False,
                                               reason="未超期，不可推进"))
                    continue

                if insp.status != "pending_process":
                    _write_exception(db, insp, "deadline",
                                     f"超期推进失败：状态 {insp.status} 不可推进（仅 pending_process）")
                    results.append(BatchResult(inspection_id=insp_id, success=False,
                                               reason=f"状态 {insp.status} 不可推进"))
                    continue

                old_status = insp.status
                insp.reviewer_id = current_user.id
                insp.status = "pending_review"
                insp.version += 1
                insp.updated_at = datetime.utcnow()
                _create_transition(db, insp, current_user, old_status, "pending_review",
                                   opinion="超期自动推进", remark="超期巡检单批量推进至审核")
                results.append(BatchResult(inspection_id=insp_id, success=True))

        db.commit()
        return results
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"批量处理失败：{str(e)}")


# ---------------------------------------------------------------------------
# SINGLE INSPECTION AUDIT TRAIL
# ---------------------------------------------------------------------------
@router.get("/{inspection_id}/audit-trail", response_model=AuditTrailResponse)
def get_audit_trail(
    inspection_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    insp = db.query(Inspection).filter(Inspection.id == inspection_id).first()
    if not insp:
        raise HTTPException(status_code=404, detail="巡检单不存在")
    name_map = _user_name_map(db)

    prs = db.query(ProcessingRecord).filter(
        ProcessingRecord.inspection_id == inspection_id
    ).order_by(ProcessingRecord.created_at).all()
    ars = db.query(AuditRemark).filter(
        AuditRemark.inspection_id == inspection_id
    ).order_by(AuditRemark.created_at).all()
    crs = db.query(CorrectionRecord).filter(
        CorrectionRecord.inspection_id == inspection_id
    ).order_by(CorrectionRecord.created_at).all()
    ers = db.query(ExceptionReason).filter(
        ExceptionReason.inspection_id == inspection_id
    ).order_by(ExceptionReason.created_at).all()

    return AuditTrailResponse(
        processing_records=[
            ProcessingRecordResponse(
                id=p.id, inspection_id=p.inspection_id, operator_id=p.operator_id,
                operator_role=p.operator_role, operator_name=name_map.get(p.operator_id),
                from_status=p.from_status, to_status=p.to_status, opinion=p.opinion,
                version=p.version, created_at=p.created_at,
            )
            for p in prs
        ],
        audit_remarks=[
            AuditRemarkResponse(
                id=a.id, inspection_id=a.inspection_id, processing_record_id=a.processing_record_id,
                operator_id=a.operator_id, operator_name=name_map.get(a.operator_id),
                from_status=a.from_status, to_status=a.to_status, remark=a.remark, created_at=a.created_at,
            )
            for a in ars
        ],
        correction_records=[
            CorrectionRecordResponse(
                id=c.id, inspection_id=c.inspection_id, corrector_id=c.corrector_id,
                corrector_name=name_map.get(c.corrector_id), reason=c.reason, field=c.field,
                old_value=c.old_value, new_value=c.new_value, created_at=c.created_at,
            )
            for c in crs
        ],
        exception_reasons=[ExceptionReasonResponse.model_validate(e) for e in ers],
    )
