from datetime import datetime
from typing import List, Dict

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from database import get_db
from models import Inspection, User
from schemas import ExpiryQueueResponse, InspectionListItem
from auth import get_current_user

router = APIRouter(prefix="/expiry-queue", tags=["expiry-queue"])


def _user_name_map(db: Session) -> Dict[str, str]:
    return {u.id: u.name for u in db.query(User).all()}


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


@router.get("", response_model=ExpiryQueueResponse)
def get_expiry_queue(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    now = datetime.utcnow()
    week_later_ts = now.timestamp() + 7 * 86400

    inspections = db.query(Inspection).all()
    name_map = _user_name_map(db)

    normal: List[InspectionListItem] = []
    approaching: List[InspectionListItem] = []
    overdue: List[InspectionListItem] = []

    for insp in inspections:
        try:
            dl = datetime.fromisoformat(insp.deadline).timestamp()
        except (ValueError, TypeError):
            continue

        item = _build_list_item(insp, name_map)
        if dl < now.timestamp():
            overdue.append(item)
        elif dl <= week_later_ts:
            approaching.append(item)
        else:
            normal.append(item)

    return ExpiryQueueResponse(normal=normal, approaching=approaching, overdue=overdue)
