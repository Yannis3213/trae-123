from ninja import Router, Schema, Field
from django.contrib.auth import authenticate, login, logout
from django.http import HttpRequest
from .models import UserProfile, ROLE_CHOICES

router = Router(tags=['认证'])


class LoginSchema(Schema):
    username: str
    password: str


class UserInfoSchema(Schema):
    id: int
    username: str
    real_name: str
    role: str
    role_display: str
    department: str


class LoginResponseSchema(Schema):
    success: bool
    message: str = ''
    user: UserInfoSchema | None = None


@router.post('/login', response=LoginResponseSchema)
def api_login(request: HttpRequest, payload: LoginSchema):
    user = authenticate(username=payload.username, password=payload.password)
    if not user:
        return {'success': False, 'message': '用户名或密码错误'}
    login(request, user)
    try:
        profile = user.profile
    except UserProfile.DoesNotExist:
        return {'success': False, 'message': '用户资料不存在'}
    return {
        'success': True,
        'message': '登录成功',
        'user': {
            'id': user.id,
            'username': user.username,
            'real_name': profile.real_name,
            'role': profile.role,
            'role_display': profile.get_role_display(),
            'department': profile.department,
        }
    }


@router.post('/logout')
def api_logout(request: HttpRequest):
    logout(request)
    return {'success': True, 'message': '已退出登录'}


@router.get('/me', response=LoginResponseSchema)
def get_current_user(request: HttpRequest):
    if not request.user.is_authenticated:
        return {'success': False, 'message': '未登录'}
    try:
        profile = request.user.profile
    except UserProfile.DoesNotExist:
        return {'success': False, 'message': '用户资料不存在'}
    return {
        'success': True,
        'message': '',
        'user': {
            'id': request.user.id,
            'username': request.user.username,
            'real_name': profile.real_name,
            'role': profile.role,
            'role_display': profile.get_role_display(),
            'department': profile.department,
        }
    }


@router.get('/roles')
def list_roles(request: HttpRequest):
    return {
        'roles': [
            {'value': r[0], 'label': r[1]} for r in ROLE_CHOICES
        ]
    }
