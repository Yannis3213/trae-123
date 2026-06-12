from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.orm import Session
from models import get_db, User
from schemas import (
    LoginRequest, UserResponse, UserSimpleResponse, OkResponse
)
from auth_service import (
    authenticate, create_session_token, get_user_from_token,
    user_to_response, logout
)

router = APIRouter(prefix="/api/auth", tags=["认证"])


def get_current_user(authorization: str = Header(None), db: Session = Depends(get_db)) -> User:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="未提供认证令牌")
    token = authorization[7:]
    user = get_user_from_token(db, token)
    if not user:
        raise HTTPException(status_code=401, detail="认证令牌无效或已过期")
    return user


def require_role(*roles: str):
    def _check(user: User = Depends(get_current_user)) -> User:
        if user.role not in roles:
            raise HTTPException(status_code=403, detail=f"角色无权限，需要角色: {roles}")
        return user
    return _check


@router.post("/login", response_model=UserResponse)
def login(req: LoginRequest, db: Session = Depends(get_db)):
    user = authenticate(db, req)
    if not user:
        raise HTTPException(status_code=401, detail="用户名或密码错误")
    token = create_session_token(user)
    return user_to_response(user, token)


@router.post("/logout", response_model=OkResponse)
def api_logout(authorization: str = Header(None)):
    if authorization and authorization.startswith("Bearer "):
        logout(authorization[7:])
    return {"ok": True, "message": "已退出登录"}


@router.get("/me", response_model=UserResponse)
def get_me(user: User = Depends(get_current_user)):
    return user_to_response(user, "")


@router.get("/users", response_model=list[UserSimpleResponse])
def list_users(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    users = db.query(User).filter(User.is_active == True).all()
    return [
        {
            "id": u.id,
            "username": u.username,
            "full_name": u.full_name,
            "role": u.role,
            "role_name": User.ROLE_NAMES.get(u.role, u.role)
        } for u in users
    ]
