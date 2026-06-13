from fastapi import FastAPI, Depends, HTTPException, status, Header, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_
from datetime import datetime, timedelta
from typing import List, Optional

from database import engine, get_db, Base
from models import User, CareRecord, Attachment, ProcessRecord, AuditNote
from schemas import (
    UserCreate, UserLogin, UserResponse, LoginResponse,
    CareRecordCreate, CareRecordUpdate, CareRecordSubmit,
    CareRecordAudit, CareRecordReview, CareRecordCorrect,
    CareRecordResponse, CareRecordListResponse, PaginatedResponse,
    BatchOperationRequest, BatchOperationResponse, BatchResultItem,
    BatchAdvanceOverdueRequest,
    StatsResponse, EvidenceState, EVIDENCE_STATE_DISPLAY, EVIDENCE_STATE_COLOR,
)
from auth import (
    ROLE_REGISTRAR, ROLE_AUDITOR, ROLE_REVIEWER,
    STATUS_PENDING_SUBMIT, STATUS_PENDING_AUDIT, STATUS_PENDING_REVIEW,
    STATUS_AUDITED_PASSED, STATUS_RETURNED, STATUS_SYNCED,
    STATUS_DISPLAY, ROLE_DISPLAY,
    hash_password, authenticate_user, get_user_by_username,
    generate_token, parse_token
)

Base.metadata.create_all(bind=engine)

from seed import seed_database
import os
seed_database(next(get_db()))

app = FastAPI(title="养老护理院月底集中处理照护记录系统", version="1.0.0")

origins = [
    "http://localhost:3105",
    "http://127.0.0.1:3105",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def get_current_user(x_auth_token: Optional[str] = Header(None), db: Session = Depends(get_db)) -> User:
    if not x_auth_token:
        raise HTTPException(status_code=401, detail="未提供认证令牌")
    token_info = parse_token(x_auth_token)
    if not token_info:
        raise HTTPException(status_code=401, detail="无效的认证令牌")
    user = db.query(User).filter(User.id == token_info["id"]).first()
    if not user:
        raise HTTPException(status_code=401, detail="用户不存在")
    if user.role != token_info["role"]:
        raise HTTPException(status_code=401, detail="令牌与用户角色不匹配")
    return user


def require_role(user: User, allowed_roles: List[str]):
    if user.role not in allowed_roles:
        raise HTTPException(status_code=403, detail=f"当前角色无此操作权限，需要: {','.join([ROLE_DISPLAY.get(r, r) for r in allowed_roles])}")


def add_process_record(db: Session, care_record_id: int, action: str,
                       from_status: str, to_status: str, user: User,
                       remark: str = "", result: str = "success",
                       error_message: str = "", version_snapshot: int = 1):
    pr = ProcessRecord(
        care_record_id=care_record_id,
        action=action,
        from_status=from_status,
        to_status=to_status,
        operator_id=user.id,
        operator_name=user.full_name,
        operator_role=user.role,
        remark=remark,
        result=result,
        error_message=error_message,
        version_snapshot=version_snapshot,
    )
    db.add(pr)
    db.flush()


def add_audit_note(db: Session, care_record_id: int, note_type: str,
                   content: str, user: User):
    an = AuditNote(
        care_record_id=care_record_id,
        note_type=note_type,
        content=content,
        operator_id=user.id,
        operator_name=user.full_name,
    )
    db.add(an)
    db.flush()


def check_overdue_and_update(db: Session, record: CareRecord) -> CareRecord:
    if record.due_date and record.status not in [STATUS_SYNCED, STATUS_AUDITED_PASSED]:
        record.overdue = datetime.utcnow() > record.due_date
    return record


def get_evidence_state(record: CareRecord) -> str:
    if record.status == STATUS_SYNCED:
        return EvidenceState.ARCHIVED
    missing = list(record.missing_evidence or [])
    if record.overdue and record.status in [STATUS_PENDING_AUDIT, STATUS_PENDING_REVIEW]:
        return EvidenceState.OVERDUE_PENDING
    if len(missing) > 0:
        return EvidenceState.MISSING
    return EvidenceState.COMPLETE


def generate_record_no(db: Session) -> str:
    today = datetime.utcnow().strftime("%Y%m%d")
    prefix = f"CR{today}"
    last = db.query(CareRecord).filter(CareRecord.record_no.like(f"{prefix}%")).order_by(CareRecord.id.desc()).first()
    if last:
        try:
            seq = int(last.record_no[-4:]) + 1
        except ValueError:
            seq = 1
    else:
        seq = 1
    return f"{prefix}{seq:04d}"


# ============ Auth Routes ============
@app.post("/api/auth/login", response_model=LoginResponse)
def login(body: UserLogin, db: Session = Depends(get_db)):
    user = authenticate_user(db, body.username, body.password)
    if not user:
        raise HTTPException(status_code=401, detail="用户名或密码错误")
    return {"user": user, "token": generate_token(user)}


@app.get("/api/auth/me", response_model=UserResponse)
def me(current_user: User = Depends(get_current_user)):
    return current_user


# ============ User Routes ============
@app.get("/api/users", response_model=List[UserResponse])
def list_users(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return db.query(User).all()


# ============ Stats Routes ============
@app.get("/api/stats", response_model=StatsResponse)
def get_stats(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    records = db.query(CareRecord).all()
    for r in records:
        check_overdue_and_update(db, r)
    db.commit()

    total = len(records)
    by_status = {}
    stats = StatsResponse(
        total=total,
        by_status=by_status,
    )
    now = datetime.utcnow()

    for r in records:
        s = r.status
        by_status[s] = by_status.get(s, 0) + 1
        if s == STATUS_PENDING_SUBMIT:
            stats.pending_submit += 1
        elif s == STATUS_PENDING_AUDIT:
            stats.pending_audit += 1
        elif s == STATUS_PENDING_REVIEW:
            stats.pending_review += 1
        elif s == STATUS_AUDITED_PASSED:
            stats.audited_passed += 1
        elif s == STATUS_SYNCED:
            stats.synced += 1
        elif s == STATUS_RETURNED:
            stats.returned += 1

        if r.overdue and r.status != STATUS_SYNCED:
            stats.overdue += 1
        if r.due_date and (r.due_date - now).days <= 2 and (r.due_date - now).days >= 0 and r.status != STATUS_SYNCED:
            stats.near_due += 1
        if r.abnormal_reported:
            stats.abnormal += 1
        if r.missing_evidence and len(r.missing_evidence) > 0 and r.status != STATUS_SYNCED:
            stats.missing_evidence += 1

    return stats


@app.get("/api/warnings", response_model=List[CareRecordListResponse])
def get_warnings(db: Session = Depends(get_db),
                 current_user: User = Depends(get_current_user),
                 warning_type: str = Query("all", pattern="^(all|normal|near|overdue)$")):
    records = db.query(CareRecord).filter(
        CareRecord.status.notin_([STATUS_SYNCED])
    ).all()
    now = datetime.utcnow()
    result = []
    for r in records:
        check_overdue_and_update(db, r)
        days_left = (r.due_date - now).days if r.due_date else 999

        if warning_type == "all":
            result.append(r)
        elif warning_type == "normal" and days_left > 2 and not r.overdue:
            result.append(r)
        elif warning_type == "near" and 0 <= days_left <= 2 and not r.overdue:
            result.append(r)
        elif warning_type == "overdue" and r.overdue:
            result.append(r)
    db.commit()
    return sorted(result, key=lambda x: x.due_date or datetime.min)


# ============ Care Record Routes ============
@app.get("/api/care-records", response_model=PaginatedResponse)
def list_care_records(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    page: int = 1,
    page_size: int = 20,
    status: Optional[str] = None,
    statuses: Optional[str] = None,
    keyword: Optional[str] = None,
    overdue: Optional[bool] = None,
    abnormal: Optional[bool] = None,
    missing_evidence: Optional[bool] = None,
    evidence_state: Optional[str] = None,
    module: Optional[str] = None,
):
    q = db.query(CareRecord)

    if current_user.role == ROLE_REGISTRAR:
        if module == "register":
            q = q.filter(or_(
                CareRecord.status == STATUS_PENDING_SUBMIT,
                CareRecord.status == STATUS_RETURNED,
            ))
        else:
            q = q.filter(or_(
                CareRecord.status == STATUS_PENDING_SUBMIT,
                CareRecord.status == STATUS_RETURNED,
                CareRecord.status == STATUS_PENDING_AUDIT,
                CareRecord.status == STATUS_PENDING_REVIEW,
                CareRecord.status == STATUS_AUDITED_PASSED,
                CareRecord.status == STATUS_SYNCED,
            ))
    elif current_user.role == ROLE_AUDITOR:
        if module == "verify":
            q = q.filter(CareRecord.status == STATUS_PENDING_AUDIT)
        else:
            q = q.filter(CareRecord.status != STATUS_PENDING_SUBMIT)
    elif current_user.role == ROLE_REVIEWER:
        if module == "review":
            q = q.filter(CareRecord.status.in_([STATUS_PENDING_REVIEW, STATUS_AUDITED_PASSED]))
        else:
            pass

    if status:
        q = q.filter(CareRecord.status == status)
    if statuses:
        status_list = statuses.split(",")
        q = q.filter(CareRecord.status.in_(status_list))
    if keyword:
        kw = f"%{keyword}%"
        q = q.filter(or_(
            CareRecord.elder_name.like(kw),
            CareRecord.record_no.like(kw),
            CareRecord.room_no.like(kw),
            CareRecord.bed_no.like(kw),
        ))
    if overdue is not None:
        q = q.filter(CareRecord.overdue == overdue)
    if abnormal is not None:
        q = q.filter(CareRecord.abnormal_reported == abnormal)
    if missing_evidence is not None:
        if missing_evidence:
            q = q.filter(CareRecord.missing_evidence != "[]")
        else:
            q = q.filter(CareRecord.missing_evidence == "[]")
    if evidence_state:
        states = evidence_state.split(",")
        conditions = []
        for s in states:
            if s == EvidenceState.ARCHIVED:
                conditions.append(CareRecord.status == STATUS_SYNCED)
            elif s == EvidenceState.OVERDUE_PENDING:
                conditions.append(and_(
                    CareRecord.overdue == True,
                    CareRecord.status.in_([STATUS_PENDING_AUDIT, STATUS_PENDING_REVIEW]),
                ))
            elif s == EvidenceState.MISSING:
                conditions.append(and_(
                    CareRecord.missing_evidence != "[]",
                    CareRecord.status != STATUS_SYNCED,
                    or_(CareRecord.overdue == False, CareRecord.status.notin_([STATUS_PENDING_AUDIT, STATUS_PENDING_REVIEW]))
                ))
            elif s == EvidenceState.COMPLETE:
                conditions.append(and_(
                    CareRecord.missing_evidence == "[]",
                    CareRecord.status != STATUS_SYNCED,
                    or_(CareRecord.overdue == False, CareRecord.status.notin_([STATUS_PENDING_AUDIT, STATUS_PENDING_REVIEW]))
                ))
        if conditions:
            q = q.filter(or_(*conditions))

    total = q.count()

    records = q.order_by(CareRecord.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()
    for r in records:
        check_overdue_and_update(db, r)
        r.evidence_state = get_evidence_state(r)
    db.commit()

    return PaginatedResponse(
        items=records,
        total=total,
        page=page,
        page_size=page_size,
    )


@app.post("/api/care-records", response_model=CareRecordResponse)
def create_care_record(body: CareRecordCreate,
                       db: Session = Depends(get_db),
                       current_user: User = Depends(get_current_user)):
    require_role(current_user, [ROLE_REGISTRAR])

    record = CareRecord(
        record_no=generate_record_no(db),
        elder_name=body.elder_name,
        elder_id_card=body.elder_id_card,
        room_no=body.room_no,
        bed_no=body.bed_no,
        care_type=body.care_type,
        care_content=body.care_content,
        record_date=body.record_date,
        status=STATUS_PENDING_SUBMIT,
        version=1,
        medication_detail=body.medication_detail,
        vital_signs=body.vital_signs,
        evidence_required=body.evidence_required,
        evidence_provided=body.evidence_provided,
        abnormal_reason=body.abnormal_reason,
        submitter_id=current_user.id,
        submitter_name=current_user.full_name,
        due_date=datetime.utcnow() + timedelta(days=3),
    )
    if body.medication_detail and len(body.medication_detail) > 0:
        record.medication_issued = True

    db.add(record)
    db.flush()

    add_process_record(
        db, record.id, "CREATE", "", STATUS_PENDING_SUBMIT, current_user,
        remark=f"创建照护记录 {record.record_no}", version_snapshot=1,
    )

    db.commit()
    db.refresh(record)
    return record


@app.get("/api/care-records/{record_id}", response_model=CareRecordResponse)
def get_care_record(record_id: int,
                    db: Session = Depends(get_db),
                    current_user: User = Depends(get_current_user)):
    record = db.query(CareRecord).filter(CareRecord.id == record_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="照护记录不存在")

    if current_user.role == ROLE_REGISTRAR and record.submitter_id != current_user.id \
            and record.status not in [STATUS_PENDING_AUDIT, STATUS_PENDING_REVIEW, STATUS_AUDITED_PASSED, STATUS_SYNCED]:
        raise HTTPException(status_code=403, detail="无权查看此记录")

    check_overdue_and_update(db, record)
    record.evidence_state = get_evidence_state(record)
    db.commit()
    db.refresh(record)
    return record


@app.put("/api/care-records/{record_id}", response_model=CareRecordResponse)
def update_care_record(record_id: int, body: CareRecordUpdate,
                       db: Session = Depends(get_db),
                       current_user: User = Depends(get_current_user)):
    require_role(current_user, [ROLE_REGISTRAR])
    record = db.query(CareRecord).filter(CareRecord.id == record_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="照护记录不存在")
    if record.status not in [STATUS_PENDING_SUBMIT, STATUS_RETURNED]:
        raise HTTPException(status_code=400, detail=f"当前状态「{STATUS_DISPLAY.get(record.status, record.status)}」不可编辑")
    if record.submitter_id != current_user.id:
        raise HTTPException(status_code=403, detail="只能编辑本人创建的记录")

    upd = body.model_dump(exclude_unset=True)
    for k, v in upd.items():
        setattr(record, k, v)
    if "medication_detail" in upd and len(upd["medication_detail"]) > 0:
        record.medication_issued = True

    record.version += 1
    add_process_record(
        db, record.id, "UPDATE", record.status, record.status, current_user,
        remark=f"编辑照护记录，版本提升至 {record.version}", version_snapshot=record.version,
    )

    db.commit()
    db.refresh(record)
    return record


@app.post("/api/care-records/{record_id}/submit")
def submit_care_record(record_id: int, body: CareRecordSubmit,
                       db: Session = Depends(get_db),
                       current_user: User = Depends(get_current_user)):
    require_role(current_user, [ROLE_REGISTRAR])
    record = db.query(CareRecord).filter(CareRecord.id == record_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="照护记录不存在")

    if record.version != body.version:
        add_process_record(
            db, record.id, "SUBMIT_FAIL", record.status, record.status, current_user,
            result="fail", error_message=f"版本冲突：当前版本 {record.version}，提交版本 {body.version}",
            version_snapshot=record.version,
        )
        db.commit()
        raise HTTPException(status_code=409, detail=f"版本冲突：记录已被更新，请刷新后重试（当前版本 {record.version}）")

    if record.status not in [STATUS_PENDING_SUBMIT, STATUS_RETURNED]:
        add_process_record(
            db, record.id, "SUBMIT_FAIL", record.status, record.status, current_user,
            result="fail", error_message=f"状态冲突：{STATUS_DISPLAY.get(record.status, record.status)} 不可提交",
            version_snapshot=record.version,
        )
        db.commit()
        raise HTTPException(status_code=400, detail=f"当前状态「{STATUS_DISPLAY.get(record.status, record.status)}」不可提交")

    if record.submitter_id != current_user.id:
        raise HTTPException(status_code=403, detail="只能提交本人创建的记录")

    missing_evidence = [e for e in record.evidence_required if e not in body.evidence_provided]

    old_status = record.status
    record.status = STATUS_PENDING_AUDIT
    record.version += 1
    record.submitted_at = datetime.utcnow()
    record.evidence_provided = body.evidence_provided
    record.missing_evidence = missing_evidence

    add_process_record(
        db, record.id, "SUBMIT", old_status, STATUS_PENDING_AUDIT, current_user,
        remark=f"提交审核，版本 {record.version}", version_snapshot=record.version,
    )

    if missing_evidence:
        add_audit_note(db, record.id, "missing_evidence", f"提交时缺失证据: {', '.join(missing_evidence)}", current_user)
        add_process_record(
            db, record.id, "EVIDENCE_WARNING", record.status, record.status, current_user,
            remark=f"缺失证据: {', '.join(missing_evidence)}", version_snapshot=record.version,
        )

    db.commit()
    db.refresh(record)
    return {"message": "提交成功", "record": record, "missing_evidence": missing_evidence}


@app.post("/api/care-records/{record_id}/correct")
def correct_care_record(record_id: int, body: CareRecordCorrect,
                        db: Session = Depends(get_db),
                        current_user: User = Depends(get_current_user)):
    require_role(current_user, [ROLE_REGISTRAR])
    record = db.query(CareRecord).filter(CareRecord.id == record_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="照护记录不存在")
    if record.status != STATUS_RETURNED:
        raise HTTPException(status_code=400, detail=f"当前状态「{STATUS_DISPLAY.get(record.status, record.status)}」不可补正")
    if record.version != body.version:
        raise HTTPException(status_code=409, detail=f"版本冲突：当前版本 {record.version}，提交版本 {body.version}")
    if record.submitter_id != current_user.id:
        raise HTTPException(status_code=403, detail="只能补正本人创建的记录")

    old_vitals = dict(record.vital_signs) if record.vital_signs else {}

    upd = body.model_dump(exclude_unset=True, exclude={"correction_note", "version"})
    for k, v in upd.items():
        setattr(record, k, v)

    if "vital_signs" in upd and len(upd["vital_signs"]) > 0 and old_vitals != upd["vital_signs"]:
        record.vital_signs_corrected = True

    if "medication_detail" in upd and len(upd["medication_detail"]) > 0:
        record.medication_issued = True

    if "abnormal_report_result" in upd or "abnormal_reported" in upd:
        if record.abnormal_reported:
            add_audit_note(db, record.id, "abnormal", f"异常复核: {body.abnormal_review_result or record.abnormal_review_result}", current_user)

    correction_item = {
        "time": datetime.utcnow().isoformat(),
        "operator": current_user.full_name,
        "note": body.correction_note or "补正内容",
        "fields": list(upd.keys()),
    }
    hist = list(record.correction_history) if record.correction_history else []
    hist.append(correction_item)
    record.correction_history = hist

    record.version += 1
    old_status = record.status
    record.status = STATUS_PENDING_AUDIT
    record.submitted_at = datetime.utcnow()

    add_process_record(
        db, record.id, "CORRECT", old_status, STATUS_PENDING_AUDIT, current_user,
        remark=f"补正后重新提交：{body.correction_note or '无备注'}，版本 {record.version}",
        version_snapshot=record.version,
    )

    db.commit()
    db.refresh(record)
    return {"message": "补正成功", "record": record}


@app.post("/api/care-records/{record_id}/audit")
def audit_care_record(record_id: int, body: CareRecordAudit,
                      db: Session = Depends(get_db),
                      current_user: User = Depends(get_current_user)):
    require_role(current_user, [ROLE_AUDITOR])
    record = db.query(CareRecord).filter(CareRecord.id == record_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="照护记录不存在")

    if record.status != STATUS_PENDING_AUDIT:
        add_process_record(
            db, record.id, "AUDIT_FAIL", record.status, record.status, current_user,
            result="fail", error_message=f"状态冲突：{STATUS_DISPLAY.get(record.status, record.status)} 不可审核",
            version_snapshot=record.version,
        )
        db.commit()
        raise HTTPException(status_code=400, detail=f"当前状态「{STATUS_DISPLAY.get(record.status, record.status)}」不可审核")

    if record.version != body.version:
        add_process_record(
            db, record.id, "AUDIT_FAIL", record.status, record.status, current_user,
            result="fail", error_message=f"版本冲突：当前 {record.version} vs {body.version}",
            version_snapshot=record.version,
        )
        db.commit()
        raise HTTPException(status_code=409, detail=f"版本冲突：记录已被更新，请刷新后重试（当前版本 {record.version}）")

    old_status = record.status
    current_missing = list(record.missing_evidence or [])

    if body.passed and current_missing:
        add_process_record(
            db, record.id, "AUDIT_FAIL", record.status, record.status, current_user,
            result="fail", error_message=f"审核通过被拦截：仍缺证据 {', '.join(current_missing)}",
            version_snapshot=record.version,
        )
        db.commit()
        raise HTTPException(status_code=400, detail=f"审核通过被拦截：记录仍缺少必填证据 {', '.join(current_missing)}，请先退回补正")

    record.auditor_id = current_user.id
    record.auditor_name = current_user.full_name
    record.audited_at = datetime.utcnow()
    record.audit_remark = body.remark
    record.version += 1
    record.missing_evidence = body.missing_evidence
    if body.abnormal_reason:
        record.abnormal_reason = body.abnormal_reason
        add_audit_note(db, record.id, "abnormal_reason", body.abnormal_reason, current_user)

    if body.passed:
        record.status = STATUS_PENDING_REVIEW
        add_process_record(
            db, record.id, "AUDIT_PASS", old_status, STATUS_PENDING_REVIEW, current_user,
            remark=f"审核通过：{body.remark or '无备注'}，版本 {record.version}",
            version_snapshot=record.version,
        )
    else:
        record.status = STATUS_RETURNED
        add_process_record(
            db, record.id, "AUDIT_REJECT", old_status, STATUS_RETURNED, current_user,
            remark=f"审核退回：{body.remark or '无备注'}，版本 {record.version}",
            version_snapshot=record.version,
        )
        if body.missing_evidence:
            add_audit_note(db, record.id, "missing_evidence", f"审核退回缺失证据: {', '.join(body.missing_evidence)}", current_user)

    db.commit()
    db.refresh(record)
    return {"message": "审核完成", "record": record, "passed": body.passed}


@app.post("/api/care-records/{record_id}/review")
def review_care_record(record_id: int, body: CareRecordReview,
                       db: Session = Depends(get_db),
                       current_user: User = Depends(get_current_user)):
    require_role(current_user, [ROLE_REVIEWER])
    record = db.query(CareRecord).filter(CareRecord.id == record_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="照护记录不存在")

    if record.status not in [STATUS_PENDING_REVIEW, STATUS_AUDITED_PASSED]:
        add_process_record(
            db, record.id, "REVIEW_FAIL", record.status, record.status, current_user,
            result="fail", error_message=f"状态冲突：{STATUS_DISPLAY.get(record.status, record.status)} 不可复核",
            version_snapshot=record.version,
        )
        db.commit()
        raise HTTPException(status_code=400, detail=f"当前状态「{STATUS_DISPLAY.get(record.status, record.status)}」不可复核归档")

    if record.version != body.version:
        add_process_record(
            db, record.id, "REVIEW_FAIL", record.status, record.status, current_user,
            result="fail", error_message=f"版本冲突：当前 {record.version} vs {body.version}",
            version_snapshot=record.version,
        )
        db.commit()
        raise HTTPException(status_code=409, detail=f"版本冲突：记录已被更新，请刷新后重试（当前版本 {record.version}）")

    if not record.auditor_id or record.status == STATUS_PENDING_AUDIT:
        add_process_record(
            db, record.id, "REVIEW_FAIL", record.status, record.status, current_user,
            result="fail", error_message="护士长尚未处理，不能复核归档",
            version_snapshot=record.version,
        )
        db.commit()
        raise HTTPException(status_code=400, detail="护士长尚未完成审核处理，不能进行复核归档")

    if record.missing_evidence and len(record.missing_evidence) > 0:
        add_process_record(
            db, record.id, "REVIEW_FAIL", record.status, record.status, current_user,
            result="fail", error_message=f"记录仍有缺失证据: {', '.join(record.missing_evidence)}",
            version_snapshot=record.version,
        )
        db.commit()
        raise HTTPException(status_code=400, detail=f"记录仍缺少必填证据：{', '.join(record.missing_evidence)}，请先补正")

    if record.overdue:
        add_audit_note(db, record.id, "overdue", "逾期记录归档处理", current_user)

    old_status = record.status
    record.status = STATUS_SYNCED
    record.sync_status = "SYNCED"
    record.synced_at = datetime.utcnow()
    record.reviewer_id = current_user.id
    record.reviewer_name = current_user.full_name
    record.reviewed_at = datetime.utcnow()
    record.review_remark = body.remark
    record.version += 1

    add_process_record(
        db, record.id, "REVIEW_SYNC", old_status, STATUS_SYNCED, current_user,
        remark=f"复核归档同步：{body.remark or '无备注'}，版本 {record.version}",
        version_snapshot=record.version,
    )

    db.commit()
    db.refresh(record)
    return {"message": "复核归档完成", "record": record}


@app.post("/api/care-records/batch")
def batch_operation(body: BatchOperationRequest,
                    db: Session = Depends(get_db),
                    current_user: User = Depends(get_current_user)):
    results: List[BatchResultItem] = []
    allowed_status_map = {
        "submit": [STATUS_PENDING_SUBMIT, STATUS_RETURNED],
        "audit_pass": [STATUS_PENDING_AUDIT],
        "audit_reject": [STATUS_PENDING_AUDIT],
        "review_sync": [STATUS_PENDING_REVIEW, STATUS_AUDITED_PASSED],
    }
    allowed_roles_map = {
        "submit": [ROLE_REGISTRAR],
        "audit_pass": [ROLE_AUDITOR],
        "audit_reject": [ROLE_AUDITOR],
        "review_sync": [ROLE_REVIEWER],
    }
    if body.action not in allowed_roles_map:
        raise HTTPException(status_code=400, detail=f"未知操作: {body.action}")
    require_role(current_user, allowed_roles_map[body.action])

    for rid in body.ids:
        record = db.query(CareRecord).filter(CareRecord.id == rid).first()
        if not record:
            results.append(BatchResultItem(id=rid, record_no=f"ID{rid}", success=False, error_message="记录不存在"))
            continue

        version_expect = body.version_map.get(rid, record.version)

        try:
            if record.status not in allowed_status_map[body.action]:
                raise HTTPException(status_code=400, detail=f"状态「{STATUS_DISPLAY.get(record.status)}」不支持此批量操作")
            if body.action == "submit" and record.submitter_id != current_user.id:
                raise HTTPException(status_code=403, detail="非本人创建，不可批量提交")
            if body.action in ["audit_pass", "audit_reject"] and record.auditor_id and record.auditor_id != current_user.id:
                raise HTTPException(status_code=403, detail=f"该记录已分配给 {record.auditor_name}，您无权处理")
            if body.action == "review_sync":
                if not record.auditor_id:
                    raise HTTPException(status_code=400, detail="护士长尚未处理")
                if record.missing_evidence and len(record.missing_evidence) > 0:
                    raise HTTPException(status_code=400, detail=f"仍缺证据: {', '.join(record.missing_evidence)}")

            if body.action == "submit":
                if record.version != version_expect:
                    raise HTTPException(status_code=409, detail=f"版本冲突（当前{record.version}）")
                missing = [e for e in record.evidence_required if e not in (record.evidence_provided or [])]
                old_status = record.status
                record.status = STATUS_PENDING_AUDIT
                record.version += 1
                record.submitted_at = datetime.utcnow()
                record.missing_evidence = missing
                add_process_record(db, record.id, "BATCH_SUBMIT", old_status, STATUS_PENDING_AUDIT,
                                   current_user, remark=f"批量提交 {body.remark or ''}", version_snapshot=record.version)

            elif body.action == "audit_pass":
                if record.version != version_expect:
                    raise HTTPException(status_code=409, detail=f"版本冲突（当前{record.version}）")
                current_missing = list(record.missing_evidence or [])
                if current_missing:
                    raise HTTPException(status_code=400, detail=f"审核通过被拦截：仍缺证据 {', '.join(current_missing)}，请先退回补正")
                record.auditor_id = current_user.id
                record.auditor_name = current_user.full_name
                record.audited_at = datetime.utcnow()
                record.audit_remark = body.remark
                record.version += 1
                record.status = STATUS_PENDING_REVIEW
                add_process_record(db, record.id, "BATCH_AUDIT_PASS", STATUS_PENDING_AUDIT, STATUS_PENDING_REVIEW,
                                   current_user, remark=f"批量审核通过 {body.remark or ''}", version_snapshot=record.version)

            elif body.action == "audit_reject":
                if record.version != version_expect:
                    raise HTTPException(status_code=409, detail=f"版本冲突（当前{record.version}）")
                missing_ev = body.missing_evidence.get(rid, [])
                record.auditor_id = current_user.id
                record.auditor_name = current_user.full_name
                record.audited_at = datetime.utcnow()
                record.audit_remark = body.remark
                record.version += 1
                record.status = STATUS_RETURNED
                record.missing_evidence = missing_ev
                add_process_record(db, record.id, "BATCH_AUDIT_REJECT", STATUS_PENDING_AUDIT, STATUS_RETURNED,
                                   current_user, remark=f"批量退回 {body.remark or ''}", version_snapshot=record.version)
                if missing_ev:
                    add_audit_note(db, record.id, "missing_evidence",
                                   f"批量退回缺失证据: {', '.join(missing_ev)}", current_user)

            elif body.action == "review_sync":
                if record.version != version_expect:
                    raise HTTPException(status_code=409, detail=f"版本冲突（当前{record.version}）")
                record.status = STATUS_SYNCED
                record.sync_status = "SYNCED"
                record.synced_at = datetime.utcnow()
                record.reviewer_id = current_user.id
                record.reviewer_name = current_user.full_name
                record.reviewed_at = datetime.utcnow()
                record.review_remark = body.remark
                record.version += 1
                if record.overdue:
                    add_audit_note(db, record.id, "overdue", "逾期记录批量归档处理", current_user)
                add_process_record(db, record.id, "BATCH_REVIEW", STATUS_PENDING_REVIEW, STATUS_SYNCED,
                                   current_user, remark=f"批量复核归档 {body.remark or ''}", version_snapshot=record.version)

            else:
                raise HTTPException(status_code=400, detail=f"未知操作: {body.action}")

            check_overdue_and_update(db, record)
            ev_state = get_evidence_state(record)
            results.append(BatchResultItem(
                id=rid, record_no=record.record_no, success=True,
                has_missing_evidence=len(list(record.missing_evidence or [])) > 0,
                missing_evidence=list(record.missing_evidence or []),
                abnormal_reported=record.abnormal_reported,
                abnormal_reason=record.abnormal_reason or "",
            ))
            record.evidence_state = ev_state

        except HTTPException as e:
            check_overdue_and_update(db, record)
            ev_state = get_evidence_state(record)
            add_process_record(
                db, record.id, f"BATCH_{body.action.upper()}_FAIL",
                record.status, record.status, current_user,
                result="fail", error_message=e.detail,
                version_snapshot=record.version,
            )
            results.append(BatchResultItem(
                id=rid, record_no=record.record_no, success=False,
                error_message=str(e.detail),
                has_missing_evidence=len(list(record.missing_evidence or [])) > 0,
                missing_evidence=list(record.missing_evidence or []),
                abnormal_reported=record.abnormal_reported,
                abnormal_reason=record.abnormal_reason or "",
            ))

        except Exception as e:
            results.append(BatchResultItem(id=rid, record_no=record.record_no, success=False, error_message=str(e)))

    db.commit()
    success_count = sum(1 for r in results if r.success)
    return BatchOperationResponse(
        results=results,
        success_count=success_count,
        failed_count=len(results) - success_count,
    )


def validate_care_record(record: CareRecord, user: User, *,
                        allowed_roles: List[str],
                        allowed_statuses: List[str],
                        version: int,
                        check_handler: bool = False,
                        handler_field: str = "auditor_id",
                        check_evidence: bool = False,
                        action_label: str = ""):
    require_role(user, allowed_roles)
    errs = []
    if record.status not in allowed_statuses:
        errs.append(f"状态冲突：当前「{STATUS_DISPLAY.get(record.status, record.status)}」不可{action_label}")
    if record.version != version:
        errs.append(f"版本冲突：当前 {record.version} vs 提交 {version}")
    if check_handler:
        handler_val = getattr(record, handler_field, None)
        if not handler_val:
            if handler_field == "auditor_id":
                errs.append("护士长尚未处理，不能操作")
            elif handler_field == "reviewer_id":
                errs.append("院区主任尚未复核")
    if check_evidence and record.missing_evidence and len(record.missing_evidence) > 0:
        errs.append(f"记录仍缺必填证据：{', '.join(record.missing_evidence)}，请先补正")
    return errs


@app.post("/api/care-records/{record_id}/advance-overdue")
def advance_overdue_record(record_id: int,
                           db: Session = Depends(get_db),
                           current_user: User = Depends(get_current_user)):
    require_role(current_user, [ROLE_REVIEWER])
    record = db.query(CareRecord).filter(CareRecord.id == record_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="记录不存在")
    if not record.overdue:
        add_process_record(
            db, record.id, "OVERDUE_ADVANCE_FAIL", record.status, record.status, current_user,
            result="fail", error_message="该记录未逾期，不适用逾期推进",
            version_snapshot=record.version,
        )
        db.commit()
        raise HTTPException(status_code=400, detail="该记录未逾期，不适用逾期推进")
    if record.status not in [STATUS_PENDING_AUDIT, STATUS_PENDING_REVIEW]:
        add_process_record(
            db, record.id, "OVERDUE_ADVANCE_FAIL", record.status, record.status, current_user,
            result="fail", error_message=f"状态冲突：{STATUS_DISPLAY.get(record.status, record.status)} 不适用逾期推进",
            version_snapshot=record.version,
        )
        db.commit()
        raise HTTPException(status_code=400, detail=f"当前状态「{STATUS_DISPLAY.get(record.status, record.status)}」不适用逾期推进")

    miss = record.missing_evidence or []
    has_missing = len(miss) > 0
    advance_remark_parts = []
    if has_missing:
        advance_remark_parts.append(f"逾期推进时仍缺证据: {', '.join(miss)}")
    if record.abnormal_reported:
        advance_remark_parts.append(f"存在异常: {record.abnormal_reason or '（已上报）'}")
    advance_remark = "逾期记录手动推进提醒"
    if advance_remark_parts:
        advance_remark += "；" + "；".join(advance_remark_parts)

    add_process_record(
        db, record.id, "OVERDUE_ADVANCE", record.status, record.status, current_user,
        remark=advance_remark, version_snapshot=record.version,
    )
    add_audit_note(db, record.id, "overdue_advance",
                   f"逾期记录由 {current_user.full_name} 发起推进提醒" +
                   (f"；缺失证据: {', '.join(miss)}" if has_missing else "") +
                   (f"；异常原因: {record.abnormal_reason}" if record.abnormal_reported else ""),
                   current_user)
    if has_missing:
        add_audit_note(db, record.id, "missing_evidence",
                       f"逾期推进时仍缺失证据: {', '.join(miss)}", current_user)
    if record.abnormal_reported and record.abnormal_reason:
        add_audit_note(db, record.id, "abnormal_reason",
                       f"逾期推进异常原因留痕: {record.abnormal_reason}", current_user)
    db.commit()
    return {
        "message": "逾期推进提醒已发送",
        "has_missing_evidence": has_missing,
        "missing_evidence": miss,
        "abnormal_reported": record.abnormal_reported,
        "abnormal_reason": record.abnormal_reason if record.abnormal_reported else "",
    }


@app.post("/api/care-records/batch-advance-overdue")
def batch_advance_overdue(body: BatchAdvanceOverdueRequest,
                          db: Session = Depends(get_db),
                          current_user: User = Depends(get_current_user)):
    require_role(current_user, [ROLE_REVIEWER, ROLE_AUDITOR])
    results: List[BatchResultItem] = []

    for rid in body.ids:
        record = db.query(CareRecord).filter(CareRecord.id == rid).first()
        if not record:
            results.append(BatchResultItem(id=rid, record_no=f"ID{rid}", success=False, error_message="记录不存在"))
            continue

        version_expect = body.version_map.get(rid, record.version)

        try:
            if not record.overdue:
                raise HTTPException(status_code=400, detail="该记录未逾期，不适用逾期推进")
            if record.version != version_expect:
                raise HTTPException(status_code=409, detail=f"版本冲突（当前{record.version}）")
            if record.status not in [STATUS_PENDING_AUDIT, STATUS_PENDING_REVIEW]:
                raise HTTPException(status_code=400, detail=f"状态「{STATUS_DISPLAY.get(record.status)}」不适用逾期推进")

            miss = record.missing_evidence or []
            has_missing = len(miss) > 0
            remark = f"批量逾期推进 {body.remark if hasattr(body, 'remark') and body.remark else ''}"
            if has_missing:
                remark += f"；仍缺证据: {', '.join(miss)}"
            if record.abnormal_reported:
                remark += f"；异常: {record.abnormal_reason or '（已上报）'}"

            add_process_record(
                db, record.id, "BATCH_OVERDUE_ADVANCE", record.status, record.status, current_user,
                remark=remark, version_snapshot=record.version,
            )
            add_audit_note(db, record.id, "overdue_advance",
                           f"批量逾期推进 by {current_user.full_name}" +
                           (f"；缺证据: {', '.join(miss)}" if has_missing else "") +
                           (f"；异常: {record.abnormal_reason}" if record.abnormal_reported else ""),
                           current_user)
            if has_missing:
                add_audit_note(db, record.id, "missing_evidence",
                               f"批量逾期推进时缺失证据: {', '.join(miss)}", current_user)
            if record.abnormal_reported and record.abnormal_reason:
                add_audit_note(db, record.id, "abnormal_reason",
                               f"批量逾期推进异常留痕: {record.abnormal_reason}", current_user)

            results.append(BatchResultItem(
                id=rid, record_no=record.record_no, success=True,
                has_missing_evidence=has_missing, missing_evidence=miss,
                abnormal_reported=record.abnormal_reported,
                abnormal_reason=record.abnormal_reason or "",
            ))

        except HTTPException as e:
            check_overdue_and_update(db, record)
            add_process_record(
                db, record.id, "BATCH_OVERDUE_ADVANCE_FAIL", record.status, record.status, current_user,
                result="fail", error_message=e.detail, version_snapshot=record.version,
            )
            results.append(BatchResultItem(
                id=rid, record_no=record.record_no, success=False, error_message=str(e.detail),
                has_missing_evidence=len(list(record.missing_evidence or [])) > 0,
                missing_evidence=list(record.missing_evidence or []),
                abnormal_reported=record.abnormal_reported,
                abnormal_reason=record.abnormal_reason or "",
            ))

        except Exception as e:
            results.append(BatchResultItem(id=rid, record_no=record.record_no, success=False, error_message=str(e)))

    db.commit()
    success_count = sum(1 for r in results if r.success)
    return BatchOperationResponse(
        results=results,
        success_count=success_count,
        failed_count=len(results) - success_count,
    )


@app.post("/api/care-records/batch-validate")
def batch_validate_candidates(body: BatchOperationRequest,
                              db: Session = Depends(get_db),
                              current_user: User = Depends(get_current_user)):
    """批量操作候选验证：检查选中的记录是否符合操作条件（角色、状态、处理人、证据）"""
    action = body.action
    allowed_status_map = {
        "submit": [STATUS_PENDING_SUBMIT, STATUS_RETURNED],
        "audit_pass": [STATUS_PENDING_AUDIT],
        "audit_reject": [STATUS_PENDING_AUDIT],
        "review_sync": [STATUS_PENDING_REVIEW, STATUS_AUDITED_PASSED],
        "overdue_advance": [STATUS_PENDING_AUDIT, STATUS_PENDING_REVIEW],
    }
    allowed_roles_map = {
        "submit": [ROLE_REGISTRAR],
        "audit_pass": [ROLE_AUDITOR],
        "audit_reject": [ROLE_AUDITOR],
        "review_sync": [ROLE_REVIEWER],
        "overdue_advance": [ROLE_AUDITOR, ROLE_REVIEWER],
    }
    if action not in allowed_roles_map:
        raise HTTPException(status_code=400, detail=f"未知操作: {action}")
    require_role(current_user, allowed_roles_map[action])

    valid_ids = []
    invalid_items = []

    for rid in body.ids:
        record = db.query(CareRecord).filter(CareRecord.id == rid).first()
        if not record:
            invalid_items.append({"id": rid, "error": "记录不存在"})
            continue
        check_overdue_and_update(db, record)

        errors = []
        if record.status not in allowed_status_map[action]:
            errors.append(f"状态「{STATUS_DISPLAY.get(record.status)}」不支持此操作")
        if action == "submit" and record.submitter_id != current_user.id:
            errors.append("非本人创建")
        if action in ["audit_pass", "audit_reject"] and record.auditor_id and record.auditor_id != current_user.id:
            errors.append(f"已分配给 {record.auditor_name}")
        if action == "review_sync":
            if not record.auditor_id:
                errors.append("护士长尚未处理")
            if record.missing_evidence and len(record.missing_evidence) > 0:
                errors.append(f"仍缺证据: {', '.join(record.missing_evidence)}")
        if action == "audit_pass":
            if record.missing_evidence and len(record.missing_evidence) > 0:
                errors.append(f"仍缺证据: {', '.join(record.missing_evidence)}")
        if action == "overdue_advance" and not record.overdue:
            errors.append("未逾期")

        if errors:
            invalid_items.append({
                "id": rid, "record_no": record.record_no,
                "error": "、".join(errors),
            })
        else:
            valid_ids.append(rid)

    return {
        "action": action,
        "valid_ids": valid_ids,
        "invalid_items": invalid_items,
        "valid_count": len(valid_ids),
        "invalid_count": len(invalid_items),
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8105)
