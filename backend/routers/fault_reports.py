from datetime import datetime
from uuid import uuid4
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from database import get_db
from models import FaultReport, User
from schemas import FaultReportCreate, FaultReportResponse
from auth import get_current_user

router = APIRouter(prefix="/fault-reports", tags=["fault-reports"])


@router.get("", response_model=List[FaultReportResponse])
def list_fault_reports(
    inspection_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(FaultReport)
    if inspection_id:
        query = query.filter(FaultReport.inspection_id == inspection_id)
    items = query.order_by(FaultReport.created_at.desc()).all()
    return [FaultReportResponse.model_validate(i) for i in items]


@router.post("", response_model=FaultReportResponse, status_code=201)
def create_fault_report(
    req: FaultReportCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if req.severity not in ("low", "medium", "high", "critical"):
        raise HTTPException(status_code=400, detail="severity 必须为 low/medium/high/critical")

    item = FaultReport(
        id=str(uuid4()),
        equipment_code=req.equipment_code,
        description=req.description,
        severity=req.severity,
        created_by=current_user.id,
        created_at=datetime.utcnow(),
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return FaultReportResponse.model_validate(item)


@router.get("/{item_id}", response_model=FaultReportResponse)
def get_fault_report(
    item_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    item = db.query(FaultReport).filter(FaultReport.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="故障报告不存在")
    return FaultReportResponse.model_validate(item)
