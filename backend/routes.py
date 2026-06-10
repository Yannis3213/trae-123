from datetime import timedelta
from typing import Optional
from litestar import Controller, get, post, put, Router
from litestar.connection import ASGIConnection
from litestar.exceptions import NotAuthorizedException, NotFoundException, ClientException
from litestar.di import Provide
from litestar.params import Parameter

from auth import verify_password, create_access_token
from config import settings
from database import get_db_session
from dependencies import get_current_user
from models import User, TransportOrder
from schemas import (
    LoginRequest, TokenResponse, UserOut,
    TransportOrderCreate, TransportOrderUpdate, TransportOrderOut,
    TransportOrderListOut, OrderListResponse, OrderActionRequest,
    BatchActionRequest, BatchActionResponse, AuditNoteCreate, AuditNoteOut,
    ExceptionReasonCreate, ExceptionReasonOut, WarningResponse
)
from services import OrderService


class AuthController(Controller):
    path = "/api/auth"

    @post("/login")
    async def login(self, data: LoginRequest, db=Provide(get_db_session)) -> TokenResponse:
        user = db.query(User).filter(User.username == data.username).first()
        if not user or not verify_password(data.password, user.hashed_password):
            raise NotAuthorizedException("用户名或密码错误")

        access_token = create_access_token(
            data={"sub": user.username, "role": user.role},
            expires_delta=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
        )
        return TokenResponse(
            access_token=access_token,
            user=UserOut.model_validate(user)
        )

    @get("/me")
    async def get_me(self, current_user: User = Provide(get_current_user)) -> UserOut:
        return UserOut.model_validate(current_user)


class OrderController(Controller):
    path = "/api/orders"
    dependencies = {"current_user": Provide(get_current_user), "db": Provide(get_db_session)}

    @get("/")
    async def list_orders(
        self,
        current_user: User,
        db,
        status: Optional[str] = Parameter(default=None),
        responsible_person: Optional[str] = Parameter(default=None),
        priority: Optional[str] = Parameter(default=None),
        deadline_from: Optional[str] = Parameter(default=None),
        deadline_to: Optional[str] = Parameter(default=None),
        page: int = Parameter(default=1, ge=1),
        page_size: int = Parameter(default=20, ge=1, le=100)
    ) -> OrderListResponse:
        from datetime import datetime
        service = OrderService(db)

        df = None
        dt = None
        if deadline_from:
            try:
                df = datetime.fromisoformat(deadline_from)
            except ValueError:
                pass
        if deadline_to:
            try:
                dt = datetime.fromisoformat(deadline_to)
            except ValueError:
                pass

        items, total = service.list_orders(
            status=status,
            responsible_person=responsible_person,
            priority=priority,
            deadline_from=df,
            deadline_to=dt,
            page=page,
            page_size=page_size,
            current_user=current_user
        )
        return OrderListResponse(
            items=[TransportOrderListOut.model_validate(o) for o in items],
            total=total,
            page=page,
            page_size=page_size
        )

    @get("/warnings")
    async def get_warnings(
        self, current_user: User, db
    ) -> WarningResponse:
        service = OrderService(db)
        return service.get_warnings(current_user)

    @get("/{order_id:int}")
    async def get_order(
        self, order_id: int, current_user: User, db
    ) -> TransportOrderOut:
        service = OrderService(db)
        order = service.get_order(order_id)
        if not order:
            raise NotFoundException("订单不存在")
        return TransportOrderOut.model_validate(order)

    @post("/")
    async def create_order(
        self, data: TransportOrderCreate, current_user: User, db
    ) -> TransportOrderOut:
        if current_user.role != User.ROLE_CUSTOMER_SERVICE:
            raise NotAuthorizedException("只有客服专员可以创建订单")
        service = OrderService(db)
        existing = db.query(TransportOrder).filter(TransportOrder.order_no == data.order_no).first()
        if existing:
            raise ClientException(f"订单号 {data.order_no} 已存在")
        order = service.create_order(data, current_user)
        return TransportOrderOut.model_validate(order)

    @put("/{order_id:int}")
    async def update_order(
        self, order_id: int, data: TransportOrderUpdate, current_user: User, db
    ) -> TransportOrderOut:
        service = OrderService(db)
        order, error = service.update_order(order_id, data, current_user)
        if error:
            raise ClientException(error)
        return TransportOrderOut.model_validate(order)

    @post("/{order_id:int}/action")
    async def process_order(
        self, order_id: int, data: OrderActionRequest, current_user: User, db
    ) -> TransportOrderOut:
        service = OrderService(db)
        order, error = service.process_order(order_id, data, current_user)
        if error:
            raise ClientException(error)
        return TransportOrderOut.model_validate(order)

    @post("/batch")
    async def batch_process(
        self, data: BatchActionRequest, current_user: User, db
    ) -> BatchActionResponse:
        service = OrderService(db)
        return service.batch_process(data, current_user)

    @post("/{order_id:int}/audit-notes")
    async def add_audit_note(
        self, order_id: int, data: AuditNoteCreate, current_user: User, db
    ) -> AuditNoteOut:
        service = OrderService(db)
        note = service.add_audit_note(order_id, data.note, current_user)
        if not note:
            raise NotFoundException("订单不存在")
        return AuditNoteOut.model_validate(note)

    @post("/{order_id:int}/exceptions")
    async def add_exception(
        self, order_id: int, data: ExceptionReasonCreate, current_user: User, db
    ) -> ExceptionReasonOut:
        service = OrderService(db)
        exc = service.add_exception(order_id, data.category, data.reason, current_user)
        if not exc:
            raise NotFoundException("订单不存在")
        return ExceptionReasonOut.model_validate(exc)


auth_router = Router(path="/", route_handlers=[AuthController])
order_router = Router(path="/", route_handlers=[OrderController])
