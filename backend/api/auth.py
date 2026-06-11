from ninja import Router
from django.http import HttpResponse

from listings.models import Operator, ROLE_DISPLAY_MAP
from .schemas import OperatorOut, LoginRequest, ErrorResponse

auth_router = Router()


def get_operator_from_session(request):
    operator_id = request.session.get('operator_id')
    if not operator_id:
        return None
    try:
        return Operator.objects.get(id=operator_id)
    except Operator.DoesNotExist:
        return None


def require_auth(request):
    operator = get_operator_from_session(request)
    if not operator:
        raise Exception('未登录')
    return operator


@auth_router.post('login', response={200: OperatorOut, 401: ErrorResponse})
def login(request, payload: LoginRequest):
    try:
        operator = Operator.objects.get(username=payload.username)
    except Operator.DoesNotExist:
        return 401, {'detail': f'用户名 {payload.username} 不存在'}
    request.session['operator_id'] = operator.id
    return 200, operator


@auth_router.post('logout', response={200: ErrorResponse})
def logout(request):
    request.session.flush()
    return 200, {'detail': '已登出'}


@auth_router.get('me', response={200: OperatorOut, 401: ErrorResponse})
def me(request):
    operator = get_operator_from_session(request)
    if not operator:
        return 401, {'detail': '未登录'}
    return 200, operator


@auth_router.get('operators', response=list[OperatorOut])
def list_operators(request):
    return Operator.objects.all()
