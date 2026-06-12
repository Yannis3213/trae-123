from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from models import get_db, User, TrainingProject, Attachment
from schemas import (
    TrainingProjectCreate, TrainingProjectUpdate, TrainingProjectDetailResponse,
    ProjectListResponse, ProcessActionRequest, BatchActionRequest,
    BatchActionResponse, DashboardStats, AttachmentCreate, AttachmentResponse, OkResponse
)
from auth_service import user_simple_response
from routers.auth import get_current_user
from project_service import (
    create_project, update_project, process_action, batch_process,
    list_projects, project_to_simple_dict, project_to_detail_dict,
    get_dashboard_stats, add_exception
)

router = APIRouter(prefix="/api/projects", tags=["培训项目单"])


@router.get("/dashboard", response_model=DashboardStats)
def dashboard(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return get_dashboard_stats(db, user)


@router.post("/batch/action", response_model=BatchActionResponse)
def do_batch_action(req: BatchActionRequest,
                    db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    results = batch_process(db, req, user)
    success = sum(1 for r in results if r.success)
    return {
        "total": len(results),
        "success_count": success,
        "fail_count": len(results) - success,
        "results": results
    }


@router.get("", response_model=ProjectListResponse)
def get_list(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status: Optional[str] = None,
    stage: Optional[str] = None,
    deadline_status: Optional[str] = None,
    keyword: Optional[str] = None,
    handler_only: bool = False,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    items, total, stats = list_projects(
        db, user, page, page_size, status, stage, deadline_status, keyword, handler_only
    )
    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "items": [project_to_simple_dict(p) for p in items],
        "stats": stats
    }


@router.get("/{project_id}", response_model=TrainingProjectDetailResponse)
def get_detail(project_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    p = db.query(TrainingProject).filter(
        TrainingProject.id == project_id, TrainingProject.is_deleted == False
    ).first()
    if not p:
        raise HTTPException(status_code=404, detail="项目单不存在")
    return project_to_detail_dict(p, db, user)


@router.post("", response_model=TrainingProjectDetailResponse)
def create(data: TrainingProjectCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    if user.role != User.ROLE_REGISTRAR:
        raise HTTPException(status_code=403, detail="仅课程顾问可创建项目单")
    p = create_project(db, data, user)
    return project_to_detail_dict(p, db, user)


@router.put("/{project_id}", response_model=TrainingProjectDetailResponse)
def update(project_id: int, data: TrainingProjectUpdate,
           db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    p = db.query(TrainingProject).filter(
        TrainingProject.id == project_id, TrainingProject.is_deleted == False
    ).first()
    if not p:
        raise HTTPException(status_code=404, detail="项目单不存在")
    ok, msg = update_project(db, p, data, user)
    if not ok:
        raise HTTPException(status_code=400, detail=msg)
    return project_to_detail_dict(p, db, user)


@router.post("/{project_id}/action", response_model=TrainingProjectDetailResponse)
def do_action(project_id: int, req: ProcessActionRequest,
              db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    p = db.query(TrainingProject).filter(
        TrainingProject.id == project_id, TrainingProject.is_deleted == False
    ).first()
    if not p:
        raise HTTPException(status_code=404, detail="项目单不存在")
    ok, msg = process_action(db, p, req, user)
    if not ok:
        raise HTTPException(status_code=400, detail=msg)
    return project_to_detail_dict(p, db, user)


@router.delete("/{project_id}", response_model=OkResponse)
def delete_project(project_id: int, db: Session = Depends(get_db),
                   user: User = Depends(get_current_user)):
    p = db.query(TrainingProject).filter(
        TrainingProject.id == project_id, TrainingProject.is_deleted == False
    ).first()
    if not p:
        raise HTTPException(status_code=404, detail="项目单不存在")
    if p.status != TrainingProject.STATUS_DRAFT:
        raise HTTPException(status_code=400, detail="仅草稿状态可删除")
    if p.created_by_id != user.id and user.role != User.ROLE_REGISTRAR:
        raise HTTPException(status_code=403, detail="仅创建人可删除")
    p.is_deleted = True
    p.updated_at = datetime.utcnow()
    db.commit()
    return {"ok": True, "message": "已删除"}


@router.post("/{project_id}/attachments", response_model=AttachmentResponse)
def upload_attachment(project_id: int, data: AttachmentCreate,
                      db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    p = db.query(TrainingProject).filter(
        TrainingProject.id == project_id, TrainingProject.is_deleted == False
    ).first()
    if not p:
        raise HTTPException(status_code=404, detail="项目单不存在")
    att = Attachment(
        project_id=project_id,
        file_name=data.file_name,
        file_type=data.file_type,
        file_size=data.file_size,
        file_path=data.file_path,
        category=data.category,
        is_required=data.is_required,
        uploaded_by_id=user.id
    )
    db.add(att)
    p.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(att)
    return {
        "id": att.id,
        "file_name": att.file_name,
        "file_type": att.file_type,
        "file_size": att.file_size,
        "category": att.category,
        "is_required": att.is_required,
        "uploaded_by": user_simple_response(att.uploaded_by),
        "uploaded_at": att.uploaded_at
    }


@router.delete("/{project_id}/attachments/{attachment_id}", response_model=OkResponse)
def delete_attachment(project_id: int, attachment_id: int,
                      db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    att = db.query(Attachment).filter(
        Attachment.id == attachment_id, Attachment.project_id == project_id
    ).first()
    if not att:
        raise HTTPException(status_code=404, detail="附件不存在")
    if att.uploaded_by_id != user.id and user.role == User.ROLE_AUDITOR:
        raise HTTPException(status_code=403, detail="仅上传人可删除附件")
    db.delete(att)
    db.commit()
    return {"ok": True, "message": "已删除附件"}
