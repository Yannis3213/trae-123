from datetime import timedelta
from typing import Annotated

from litestar import Controller, Request, Response, get, post
from litestar.di import Provide
from litestar.enums import RequestEncodingType
from litestar.params import Body
from litestar.status_codes import HTTP_200_OK, HTTP_401_UNAUTHORIZED
from sqlalchemy.orm import Session

from app.auth import authenticate_user, create_access_token
from app.config import settings
from app.database import get_db
from app.models import User
from app.schemas import LoginRequest, TokenResponse, UserResponse


class AuthController(Controller):
    path = "/auth"
    dependencies = {"db": Provide(get_db)}

    @post("/login")
    async def login(
        self,
        request: Request,
        db: Session,
        data: Annotated[LoginRequest, Body(media_type=RequestEncodingType.JSON)],
    ) -> Response[TokenResponse]:
        user = authenticate_user(db, data.username, data.password)
        if not user:
            empty_user = UserResponse(
                id=0,
                username="",
                full_name="",
                role="registration_clerk",
                is_active=False,
                created_at="",
            )
            return Response(
                content=TokenResponse(access_token="", token_type="bearer", user=empty_user),
                status_code=HTTP_401_UNAUTHORIZED,
            )

        access_token_expires = timedelta(minutes=settings.access_token_expire_minutes)
        access_token = create_access_token(
            data={"sub": user.username, "role": user.role.value},
            expires_delta=access_token_expires,
        )

        user_resp = UserResponse.model_validate(user)
        return Response(
            content=TokenResponse(access_token=access_token, token_type="bearer", user=user_resp),
            status_code=HTTP_200_OK,
        )

    @get("/me")
    async def me(self, request: Request, db: Session) -> UserResponse:
        user = request.scope.get("user")
        if not user:
            from litestar.exceptions import HTTPException
            raise HTTPException(status_code=401, detail="未授权")
        return UserResponse.model_validate(user)
