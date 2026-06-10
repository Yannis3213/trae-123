from datetime import datetime
from uuid import uuid4
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from database import get_db
from models import ChargingPileInspection, User
from schemas import ChargingPileInspectionCreate, ChargingPileInspectionResponse
from auth import get_current_user

router = APIRouter(prefix="/charging-pile-inspections", tags=["charging-pile-inspections"])


@router.get("", response_model=List[ChargingPileInspectionResponse])
def list_charging_pile_inspections(
    inspection_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(ChargingPileInspection)
    if inspection_id:
        query = query.filter(ChargingPileInspection.inspection_id == inspection_id)
    items = query.order_by(ChargingPileInspection.created_at.desc()).all()
    return [ChargingPileInspectionResponse.model_validate(i) for i in items]


@router.post("", response_model=ChargingPileInspectionResponse, status_code=201)
def create_charging_pile_inspection(
    req: ChargingPileInspectionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    item = ChargingPileInspection(
        id=str(uuid4()),
        pile_code=req.pile_code,
        inspection_items=req.inspection_items,
        result=req.result,
        created_by=current_user.id,
        created_at=datetime.utcnow(),
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return ChargingPileInspectionResponse.model_validate(item)


@router.get("/{item_id}", response_model=ChargingPileInspectionResponse)
def get_charging_pile_inspection(
    item_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    item = db.query(ChargingPileInspection).filter(ChargingPileInspection.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="充电桩巡检记录不存在")
    return ChargingPileInspectionResponse.model_validate(item)
