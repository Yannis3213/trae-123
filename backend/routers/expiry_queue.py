from datetime import datetime
from typing import List

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from database import get_db
from models import Inspection, User
from schemas import ExpiryQueueResponse, InspectionListItem
from auth import get_current_user

router = APIRouter(prefix="/expiry-queue", tags=["expiry-queue"])


@router.get("", response_model=ExpiryQueueResponse)
def get_expiry_queue(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    now = datetime.utcnow()
    week_later_ts = now.timestamp() + 7 * 86400

    inspections = db.query(Inspection).all()

    normal: List[InspectionListItem] = []
    approaching: List[InspectionListItem] = []
    overdue: List[InspectionListItem] = []

    for insp in inspections:
        try:
            dl = datetime.fromisoformat(insp.deadline).timestamp()
        except (ValueError, TypeError):
            continue

        item = InspectionListItem.model_validate(insp)
        if dl < now.timestamp():
            overdue.append(item)
        elif dl <= week_later_ts:
            approaching.append(item)
        else:
            normal.append(item)

    return ExpiryQueueResponse(normal=normal, approaching=approaching, overdue=overdue)
