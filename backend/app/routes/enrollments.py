from typing import List, Optional

from litestar import Controller, Request, get, post
from litestar.di import Provide
from litestar.params import Parameter
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import EnrollmentStatusEnum, ExpiryStatusEnum
from app.schemas import (
    AuditRequest,
    BatchAuditRequest,
    BatchResultResponse,
    BatchReviewRequest,
    CorrectRequest,
    EnrollmentCreate,
    EnrollmentDetailResponse,
    EnrollmentListResponse,
    EnrollmentResponse,
    ReviewRequest,
    StatsResponse,
)
from app.services.enrollment_service import (
    batch_audit,
    batch_review,
    check_queue_exceptions,
    correct_enrollment,
    audit_enrollment,
    enrollment_to_response,
    get_enrollment,
    get_stats,
    list_enrollments,
    create_enrollment,
    review_enrollment,
)


def get_current_user(request: Request):
    return request.scope.get("user")


class EnrollmentController(Controller):
    path = "/enrollments"
    dependencies = {"db": Provide(get_db)}

    @get()
    async def list(
        self,
        request: Request,
        db: Session,
        status: Optional[EnrollmentStatusEnum] = Parameter(default=None),
        expiry_status: Optional[ExpiryStatusEnum] = Parameter(default=None),
        store: Optional[str] = Parameter(default=None),
        keyword: Optional[str] = Parameter(default=None),
        my_todo: bool = Parameter(default=False),
        page: int = Parameter(default=1, ge=1),
        page_size: int = Parameter(default=20, ge=1, le=100),
    ) -> EnrollmentListResponse:
        user = get_current_user(request)
        items, total = list_enrollments(
            db,
            user=user,
            status=status,
            expiry_status=expiry_status,
            store=store,
            keyword=keyword,
            my_todo=my_todo,
            page=page,
            page_size=page_size,
        )
        response_items = [enrollment_to_response(item, user) for item in items]
        return EnrollmentListResponse(
            total=total,
            items=response_items,
            page=page,
            page_size=page_size,
        )

    @get("/{enrollment_id:int}")
    async def retrieve(self, request: Request, db: Session, enrollment_id: int) -> EnrollmentDetailResponse:
        user = get_current_user(request)
        enrollment = get_enrollment(db, enrollment_id, user)
        if not enrollment:
            from litestar.exceptions import HTTPException
            raise HTTPException(status_code=404, detail="入会单不存在")

        resp_base = enrollment_to_response(enrollment, user)
        resp = EnrollmentDetailResponse(**resp_base.model_dump())
        return resp

    @post()
    async def create(self, request: Request, db: Session, data: EnrollmentCreate) -> EnrollmentResponse:
        user = get_current_user(request)
        enrollment = create_enrollment(db, data, user)
        return enrollment_to_response(enrollment)

    @post("/audit")
    async def audit(self, request: Request, db: Session, data: AuditRequest) -> EnrollmentResponse:
        user = get_current_user(request)
        enrollment = audit_enrollment(db, data, user)
        return enrollment_to_response(enrollment)

    @post("/review")
    async def review(self, request: Request, db: Session, data: ReviewRequest) -> EnrollmentResponse:
        user = get_current_user(request)
        enrollment = review_enrollment(db, data, user)
        return enrollment_to_response(enrollment)

    @post("/correct")
    async def correct(self, request: Request, db: Session, data: CorrectRequest) -> EnrollmentResponse:
        user = get_current_user(request)
        enrollment = correct_enrollment(db, data, user)
        return enrollment_to_response(enrollment)

    @post("/batch/audit")
    async def batch_audit_route(self, request: Request, db: Session, data: BatchAuditRequest) -> BatchResultResponse:
        user = get_current_user(request)
        return batch_audit(db, data, user)

    @post("/batch/review")
    async def batch_review_route(self, request: Request, db: Session, data: BatchReviewRequest) -> BatchResultResponse:
        user = get_current_user(request)
        return batch_review(db, data, user)

    @get("/stats/summary")
    async def stats(self, request: Request, db: Session) -> StatsResponse:
        user = get_current_user(request)
        stats_data = get_stats(db, user)
        return StatsResponse(**stats_data)

    @post("/check-exceptions")
    async def check_exceptions(self, request: Request, db: Session) -> List[dict]:
        user = get_current_user(request)
        return check_queue_exceptions(db, user)
