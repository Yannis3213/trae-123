from datetime import datetime
from uuid import uuid4
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session, joinedload

from database import get_db
from models import (
    User, Inspection, ChargingPileInspection, FaultReport,
    ProcessingRecord, AuditRemark, CorrectionRecord, ExceptionReason,
)
from schemas import (
    InspectionCreate, InspectionSubmit, InspectionProcess,
    InspectionReview, InspectionReturn, InspectionCorrect,
    InspectionResponse, InspectionListItem, InspectionStats,
    BatchProcessRequest, BatchResult, AuditTrailResponse,
    ProcessingRecordResponse, AuditRemarkResponse,
    CorrectionRecordResponse, ExceptionReasonResponse,
    ChargingPileInspectionResponse, FaultReportResponse,
)
from auth import get_current_user, check_permission

router = APIRouter(prefix="/inspections", tags=["inspections"])


def _build_inspection_response(insp: Inspection) -> InspectionResponse:
    return InspectionResponse(
        id=insp.id,
        title=insp.title,
        description=insp.description,
        status=insp.status,
        creator_id=insp.creator_id,
        processor_id=insp.processor_id,
        reviewer_id=insp.reviewer_id,
        version=insp.version,
        deadline=insp.deadline,
        created_at=insp.created_at,
        updated_at=insp.updated_at,
        charging_pile_inspections=[
            ChargingPileInspectionResponse.model_validate(c) for c in insp.charging_pile_inspections
        ] if hasattr(insp, 'charging_pile_inspections') and insp.charging_pile_inspections else [],
        fault_reports=[
            FaultReportResponse.model_validate(f) for f in insp.fault_reports
        ] if hasattr(insp, 'fault_reports') and insp.fault_reports else [],
        processing_records=[
            ProcessingRecordResponse.model_validate(p) for p in insp.processing_records
        ] if hasattr(insp, 'processing_records') and insp.processing_records else [],
        audit_remarks=[
            AuditRemarkResponse.model_validate(a) for a in insp.audit_remarks
        ] if hasattr(insp, 'audit_remarks') and insp.audit_remarks else [],
        correction_records=[
            CorrectionRecordResponse.model_validate(c) for c in insp.correction_records
        ] if hasattr(insp, 'correction_records') and insp.correction_records else [],
        exception_reasons=[
            ExceptionReasonResponse.model_validate(e) for e in insp.exception_reasons
        ] if hasattr(insp, 'exception_reasons') and insp.exception_reasons else [],
    )


def _create_transition(db: Session, insp: Inspection, user: User, from_status: str, to_status: str,
                       opinion: Optional[str] = None, remark: Optional[str] = None):
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


def _write_exception(db: Session, insp: Inspection, exc_type: str, description: str):
    er = ExceptionReason(
        id=str(uuid4()),
        inspection_id=insp.id,
        type=exc_type,
        description=description,
        created_at=datetime.utcnow(),
    )
    db.add(er)


@router.get("", response_model=List[InspectionListItem])
def list_inspections(
    status_filter: Optional[str] = Query(None, alias="status"),
    expiry_status: Optional[str] = Query(None, alias="expiry_status"),
    role: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(Inspection)

    if status_filter:
        query = query.filter(Inspection.status == status_filter)

    if role == "duty_officer":
        query = query.filter(Inspection.creator_id == current_user.id)
    elif role == "maintenance_engineer":
        query = query.filter(Inspection.processor_id == current_user.id)
    elif role == "operations_manager":
        query = query.filter(Inspection.reviewer_id == current_user.id)

    inspections = query.order_by(Inspection.created_at.desc()).all()

    if expiry_status:
        now = datetime.utcnow()
        week_later = now.timestamp() + 7 * 86400
        filtered = []
        for insp in inspections:
            try:
                dl = datetime.fromisoformat(insp.deadline).timestamp()
            except (ValueError, TypeError):
                continue
            if expiry_status == "normal" and dl > week_later:
                filtered.append(insp)
            elif expiry_status == "approaching" and now.timestamp() <= dl <= week_later:
                filtered.append(insp)
            elif expiry_status == "overdue" and dl < now.timestamp():
                filtered.append(insp)
        inspections = filtered

    return [InspectionListItem.model_validate(i) for i in inspections]


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
    insp = (
        db.query(Inspection)
        .options(
            joinedload(Inspection.charging_pile_inspections),
            joinedload(Inspection.fault_reports),
            joinedload(Inspection.processing_records),
            joinedload(Inspection.audit_remarks),
            joinedload(Inspection.correction_records),
            joinedload(Inspection.exception_reasons),
        )
        .filter(Inspection.id == inspection_id)
        .first()
    )
    if not insp:
        raise HTTPException(status_code=404, detail="巡检单不存在")
    return _build_inspection_response(insp)


@router.post("", response_model=InspectionResponse, status_code=status.HTTP_201_CREATED)
def create_inspection(
    req: InspectionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    check_permission(current_user, "duty_officer")

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

    pr = ProcessingRecord(
        id=str(uuid4()),
        inspection_id=insp_id,
        operator_id=current_user.id,
        operator_role=current_user.role,
        from_status="none",
        to_status="pending_submit",
        opinion="创建巡检单",
        version=1,
        created_at=now,
    )
    db.add(pr)
    db.flush()

    ar = AuditRemark(
        id=str(uuid4()),
        inspection_id=insp_id,
        processing_record_id=pr.id,
        operator_id=current_user.id,
        from_status="none",
        to_status="pending_submit",
        remark="站点值班员创建巡检单",
        created_at=now,
    )
    db.add(ar)

    for cpi_id in req.charging_pile_inspection_ids:
        cpi = db.query(ChargingPileInspection).filter(ChargingPileInspection.id == cpi_id).first()
        if cpi:
            cpi.inspection_id = insp_id

    for fr_id in req.fault_report_ids:
        fr = db.query(FaultReport).filter(FaultReport.id == fr_id).first()
        if fr:
            fr.inspection_id = insp_id

    db.flush()
    db.refresh(insp)

    insp.charging_pile_inspections = (
        db.query(ChargingPileInspection).filter(ChargingPileInspection.inspection_id == insp_id).all()
    )
    insp.fault_reports = db.query(FaultReport).filter(FaultReport.inspection_id == insp_id).all()
    insp.processing_records = []
    insp.audit_remarks = []
    insp.correction_records = []
    insp.exception_reasons = []

    return _build_inspection_response(insp)


@router.put("/{inspection_id}/submit", response_model=InspectionResponse)
def submit_inspection(
    inspection_id: str,
    req: InspectionSubmit,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    check_permission(current_user, "duty_officer")

    insp = db.query(Inspection).filter(Inspection.id == inspection_id).first()
    if not insp:
        raise HTTPException(status_code=404, detail="巡检单不存在")

    if insp.creator_id != current_user.id:
        _write_exception(db, insp, "permission", "非创建人无法提交")
        db.commit()
        raise HTTPException(status_code=403, detail="只有创建人可以提交")

    if insp.status not in ("pending_submit", "resubmitted"):
        _write_exception(db, insp, "status", f"当前状态 {insp.status} 不可提交")
        db.commit()
        raise HTTPException(status_code=400, detail=f"当前状态 {insp.status} 不可提交，仅允许 pending_submit 或 resubmitted")

    if insp.version != req.version:
        _write_exception(db, insp, "status", f"版本冲突：当前版本 {insp.version}，请求版本 {req.version}")
        db.commit()
        raise HTTPException(status_code=409, detail=f"版本冲突：当前版本 {insp.version}，请求版本 {req.version}")

    old_status = insp.status
    insp.status = "pending_process"
    insp.version += 1
    insp.updated_at = datetime.utcnow()

    _create_transition(db, insp, current_user, old_status, "pending_process",
                       opinion="提交巡检单", remark="值班员提交巡检单")

    db.commit()
    db.refresh(insp)

    insp.charging_pile_inspections = db.query(ChargingPileInspection).filter(ChargingPileInspection.inspection_id == insp.id).all()
    insp.fault_reports = db.query(FaultReport).filter(FaultReport.inspection_id == insp.id).all()
    insp.processing_records = db.query(ProcessingRecord).filter(ProcessingRecord.inspection_id == insp.id).all()
    insp.audit_remarks = db.query(AuditRemark).filter(AuditRemark.inspection_id == insp.id).all()
    insp.correction_records = db.query(CorrectionRecord).filter(CorrectionRecord.inspection_id == insp.id).all()
    insp.exception_reasons = db.query(ExceptionReason).filter(ExceptionReason.inspection_id == insp.id).all()

    return _build_inspection_response(insp)


@router.put("/{inspection_id}/process", response_model=InspectionResponse)
def process_inspection(
    inspection_id: str,
    req: InspectionProcess,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    check_permission(current_user, "maintenance_engineer")

    insp = db.query(Inspection).filter(Inspection.id == inspection_id).first()
    if not insp:
        raise HTTPException(status_code=404, detail="巡检单不存在")

    if insp.processor_id and insp.processor_id != current_user.id:
        _write_exception(db, insp, "permission", "非指派处理人无法处理")
        db.commit()
        raise HTTPException(status_code=403, detail="只有指派的处理人可以处理")

    if insp.status != "pending_process":
        _write_exception(db, insp, "status", f"当前状态 {insp.status} 不可处理")
        db.commit()
        raise HTTPException(status_code=400, detail=f"当前状态 {insp.status} 不可处理，仅允许 pending_process")

    if insp.version != req.version:
        _write_exception(db, insp, "status", f"版本冲突：当前版本 {insp.version}，请求版本 {req.version}")
        db.commit()
        raise HTTPException(status_code=409, detail=f"版本冲突：当前版本 {insp.version}，请求版本 {req.version}")

    old_status = insp.status
    insp.processor_id = current_user.id
    insp.status = "pending_review"
    insp.version += 1
    insp.updated_at = datetime.utcnow()

    _create_transition(db, insp, current_user, old_status, "pending_review",
                       opinion=req.opinion, remark="运维工程师处理完毕，提交审核")

    db.commit()
    db.refresh(insp)

    insp.charging_pile_inspections = db.query(ChargingPileInspection).filter(ChargingPileInspection.inspection_id == insp.id).all()
    insp.fault_reports = db.query(FaultReport).filter(FaultReport.inspection_id == insp.id).all()
    insp.processing_records = db.query(ProcessingRecord).filter(ProcessingRecord.inspection_id == insp.id).all()
    insp.audit_remarks = db.query(AuditRemark).filter(AuditRemark.inspection_id == insp.id).all()
    insp.correction_records = db.query(CorrectionRecord).filter(CorrectionRecord.inspection_id == insp.id).all()
    insp.exception_reasons = db.query(ExceptionReason).filter(ExceptionReason.inspection_id == insp.id).all()

    return _build_inspection_response(insp)


@router.put("/{inspection_id}/review", response_model=InspectionResponse)
def review_inspection(
    inspection_id: str,
    req: InspectionReview,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    check_permission(current_user, "operations_manager")

    insp = db.query(Inspection).filter(Inspection.id == inspection_id).first()
    if not insp:
        raise HTTPException(status_code=404, detail="巡检单不存在")

    if insp.reviewer_id and insp.reviewer_id != current_user.id:
        _write_exception(db, insp, "permission", "非指派审核人无法审核")
        db.commit()
        raise HTTPException(status_code=403, detail="只有指派的审核人可以审核")

    if insp.status != "pending_review":
        _write_exception(db, insp, "status", f"当前状态 {insp.status} 不可审核")
        db.commit()
        raise HTTPException(status_code=400, detail=f"当前状态 {insp.status} 不可审核，仅允许 pending_review")

    if insp.version != req.version:
        _write_exception(db, insp, "status", f"版本冲突：当前版本 {insp.version}，请求版本 {req.version}")
        db.commit()
        raise HTTPException(status_code=409, detail=f"版本冲突：当前版本 {insp.version}，请求版本 {req.version}")

    if req.action not in ("approve", "reject"):
        raise HTTPException(status_code=400, detail="action 必须为 approve 或 reject")

    old_status = insp.status
    new_status = "completed" if req.action == "approve" else "returned"
    insp.reviewer_id = current_user.id
    insp.status = new_status
    insp.version += 1
    insp.updated_at = datetime.utcnow()

    remark_text = "运营经理审核通过" if req.action == "approve" else "运营经理审核退回"
    _create_transition(db, insp, current_user, old_status, new_status,
                       opinion=req.opinion, remark=remark_text)

    db.commit()
    db.refresh(insp)

    insp.charging_pile_inspections = db.query(ChargingPileInspection).filter(ChargingPileInspection.inspection_id == insp.id).all()
    insp.fault_reports = db.query(FaultReport).filter(FaultReport.inspection_id == insp.id).all()
    insp.processing_records = db.query(ProcessingRecord).filter(ProcessingRecord.inspection_id == insp.id).all()
    insp.audit_remarks = db.query(AuditRemark).filter(AuditRemark.inspection_id == insp.id).all()
    insp.correction_records = db.query(CorrectionRecord).filter(CorrectionRecord.inspection_id == insp.id).all()
    insp.exception_reasons = db.query(ExceptionReason).filter(ExceptionReason.inspection_id == insp.id).all()

    return _build_inspection_response(insp)


@router.put("/{inspection_id}/return", response_model=InspectionResponse)
def return_inspection(
    inspection_id: str,
    req: InspectionReturn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    check_permission(current_user, "operations_manager")

    insp = db.query(Inspection).filter(Inspection.id == inspection_id).first()
    if not insp:
        raise HTTPException(status_code=404, detail="巡检单不存在")

    if insp.reviewer_id and insp.reviewer_id != current_user.id:
        _write_exception(db, insp, "permission", "非指派审核人无法退回")
        db.commit()
        raise HTTPException(status_code=403, detail="只有指派的审核人可以退回")

    if insp.status != "pending_review":
        _write_exception(db, insp, "status", f"当前状态 {insp.status} 不可退回")
        db.commit()
        raise HTTPException(status_code=400, detail=f"当前状态 {insp.status} 不可退回，仅允许 pending_review")

    if insp.version != req.version:
        _write_exception(db, insp, "status", f"版本冲突：当前版本 {insp.version}，请求版本 {req.version}")
        db.commit()
        raise HTTPException(status_code=409, detail=f"版本冲突：当前版本 {insp.version}，请求版本 {req.version}")

    old_status = insp.status
    insp.reviewer_id = current_user.id
    insp.status = "returned"
    insp.version += 1
    insp.updated_at = datetime.utcnow()

    _create_transition(db, insp, current_user, old_status, "returned",
                       opinion=req.reason, remark=f"运营经理退回：{req.reason}")

    db.commit()
    db.refresh(insp)

    insp.charging_pile_inspections = db.query(ChargingPileInspection).filter(ChargingPileInspection.inspection_id == insp.id).all()
    insp.fault_reports = db.query(FaultReport).filter(FaultReport.inspection_id == insp.id).all()
    insp.processing_records = db.query(ProcessingRecord).filter(ProcessingRecord.inspection_id == insp.id).all()
    insp.audit_remarks = db.query(AuditRemark).filter(AuditRemark.inspection_id == insp.id).all()
    insp.correction_records = db.query(CorrectionRecord).filter(CorrectionRecord.inspection_id == insp.id).all()
    insp.exception_reasons = db.query(ExceptionReason).filter(ExceptionReason.inspection_id == insp.id).all()

    return _build_inspection_response(insp)


@router.put("/{inspection_id}/correct", response_model=InspectionResponse)
def correct_inspection(
    inspection_id: str,
    req: InspectionCorrect,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    check_permission(current_user, "duty_officer")

    insp = db.query(Inspection).filter(Inspection.id == inspection_id).first()
    if not insp:
        raise HTTPException(status_code=404, detail="巡检单不存在")

    if insp.creator_id != current_user.id:
        _write_exception(db, insp, "permission", "非创建人无法修正")
        db.commit()
        raise HTTPException(status_code=403, detail="只有创建人可以修正")

    if insp.status != "returned":
        _write_exception(db, insp, "status", f"当前状态 {insp.status} 不可修正")
        db.commit()
        raise HTTPException(status_code=400, detail=f"当前状态 {insp.status} 不可修正，仅允许 returned")

    if insp.version != req.version:
        _write_exception(db, insp, "status", f"版本冲突：当前版本 {insp.version}，请求版本 {req.version}")
        db.commit()
        raise HTTPException(status_code=409, detail=f"版本冲突：当前版本 {insp.version}，请求版本 {req.version}")

    old_value = getattr(insp, req.field, None)
    old_value_str = str(old_value) if old_value is not None else None

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

    insp.charging_pile_inspections = db.query(ChargingPileInspection).filter(ChargingPileInspection.inspection_id == insp.id).all()
    insp.fault_reports = db.query(FaultReport).filter(FaultReport.inspection_id == insp.id).all()
    insp.processing_records = db.query(ProcessingRecord).filter(ProcessingRecord.inspection_id == insp.id).all()
    insp.audit_remarks = db.query(AuditRemark).filter(AuditRemark.inspection_id == insp.id).all()
    insp.correction_records = db.query(CorrectionRecord).filter(CorrectionRecord.inspection_id == insp.id).all()
    insp.exception_reasons = db.query(ExceptionReason).filter(ExceptionReason.inspection_id == insp.id).all()

    return _build_inspection_response(insp)


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

    results = []
    for insp_id in req.inspection_ids:
        insp = db.query(Inspection).filter(Inspection.id == insp_id).first()
        if not insp:
            results.append(BatchResult(inspection_id=insp_id, success=False, reason="巡检单不存在"))
            continue

        if req.action == "process":
            if insp.status != "pending_process":
                _write_exception(db, insp, "status", f"批量处理失败：状态 {insp.status} 不可处理")
                results.append(BatchResult(inspection_id=insp_id, success=False, reason=f"状态 {insp.status} 不可处理"))
                continue
            if insp.processor_id and insp.processor_id != current_user.id:
                _write_exception(db, insp, "permission", "批量处理失败：非指派处理人")
                results.append(BatchResult(inspection_id=insp_id, success=False, reason="非指派处理人"))
                continue

            old_status = insp.status
            insp.processor_id = current_user.id
            insp.status = "pending_review"
            insp.version += 1
            insp.updated_at = datetime.utcnow()
            _create_transition(db, insp, current_user, old_status, "pending_review",
                               opinion=req.opinion or "批量处理", remark="运维工程师批量处理完毕")
            results.append(BatchResult(inspection_id=insp_id, success=True))

        elif req.action == "advance":
            now = datetime.utcnow()
            if not insp.deadline:
                results.append(BatchResult(inspection_id=insp_id, success=False, reason="无截止日期"))
                continue
            try:
                dl = datetime.fromisoformat(insp.deadline)
            except (ValueError, TypeError):
                results.append(BatchResult(inspection_id=insp_id, success=False, reason="截止日期格式错误"))
                continue

            if dl >= now:
                results.append(BatchResult(inspection_id=insp_id, success=False, reason="未超期"))
                continue

            if insp.status == "pending_process":
                old_status = insp.status
                insp.status = "pending_review"
                insp.version += 1
                insp.updated_at = datetime.utcnow()
                insp.reviewer_id = current_user.id
                _create_transition(db, insp, current_user, old_status, "pending_review",
                                   opinion="超期自动推进", remark="超期巡检单自动推进至审核")
                results.append(BatchResult(inspection_id=insp_id, success=True))
            else:
                _write_exception(db, insp, "deadline", f"超期推进失败：状态 {insp.status} 不可推进")
                results.append(BatchResult(inspection_id=insp_id, success=False, reason=f"状态 {insp.status} 不可推进"))

    db.commit()
    return results


@router.post("/batch-advance", response_model=List[BatchResult])
def batch_advance(
    req: BatchProcessRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    check_permission(current_user, "operations_manager")
    now = datetime.utcnow()
    results = []

    for insp_id in req.inspection_ids:
        insp = db.query(Inspection).filter(Inspection.id == insp_id).first()
        if not insp:
            results.append(BatchResult(inspection_id=insp_id, success=False, reason="巡检单不存在"))
            continue

        if not insp.deadline:
            results.append(BatchResult(inspection_id=insp_id, success=False, reason="无截止日期"))
            continue

        try:
            dl = datetime.fromisoformat(insp.deadline)
        except (ValueError, TypeError):
            results.append(BatchResult(inspection_id=insp_id, success=False, reason="截止日期格式错误"))
            continue

        if dl >= now:
            results.append(BatchResult(inspection_id=insp_id, success=False, reason="未超期，不可推进"))
            continue

        if insp.status != "pending_process":
            _write_exception(db, insp, "deadline", f"超期推进失败：状态 {insp.status} 不可推进")
            results.append(BatchResult(inspection_id=insp_id, success=False, reason=f"状态 {insp.status} 不可推进"))
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


@router.get("/global-audit-trail")
def get_global_audit_trail(
    inspection_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    pr_query = db.query(ProcessingRecord)
    ar_query = db.query(AuditRemark)
    cr_query = db.query(CorrectionRecord)
    er_query = db.query(ExceptionReason)

    if inspection_id:
        pr_query = pr_query.filter(ProcessingRecord.inspection_id == inspection_id)
        ar_query = ar_query.filter(AuditRemark.inspection_id == inspection_id)
        cr_query = cr_query.filter(CorrectionRecord.inspection_id == inspection_id)
        er_query = er_query.filter(ExceptionReason.inspection_id == inspection_id)

    return AuditTrailResponse(
        processing_records=[ProcessingRecordResponse.model_validate(p) for p in pr_query.order_by(ProcessingRecord.created_at.desc()).all()],
        audit_remarks=[AuditRemarkResponse.model_validate(a) for a in ar_query.order_by(AuditRemark.created_at.desc()).all()],
        correction_records=[CorrectionRecordResponse.model_validate(c) for c in cr_query.order_by(CorrectionRecord.created_at.desc()).all()],
        exception_reasons=[ExceptionReasonResponse.model_validate(e) for e in er_query.order_by(ExceptionReason.created_at.desc()).all()],
    )


@router.get("/{inspection_id}/audit-trail", response_model=AuditTrailResponse)
def get_audit_trail(
    inspection_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    insp = db.query(Inspection).filter(Inspection.id == inspection_id).first()
    if not insp:
        raise HTTPException(status_code=404, detail="巡检单不存在")

    processing_records = db.query(ProcessingRecord).filter(
        ProcessingRecord.inspection_id == inspection_id
    ).order_by(ProcessingRecord.created_at).all()

    audit_remarks = db.query(AuditRemark).filter(
        AuditRemark.inspection_id == inspection_id
    ).order_by(AuditRemark.created_at).all()

    correction_records = db.query(CorrectionRecord).filter(
        CorrectionRecord.inspection_id == inspection_id
    ).order_by(CorrectionRecord.created_at).all()

    exception_reasons = db.query(ExceptionReason).filter(
        ExceptionReason.inspection_id == inspection_id
    ).order_by(ExceptionReason.created_at).all()

    return AuditTrailResponse(
        processing_records=[ProcessingRecordResponse.model_validate(p) for p in processing_records],
        audit_remarks=[AuditRemarkResponse.model_validate(a) for a in audit_remarks],
        correction_records=[CorrectionRecordResponse.model_validate(c) for c in correction_records],
        exception_reasons=[ExceptionReasonResponse.model_validate(e) for e in exception_reasons],
    )
