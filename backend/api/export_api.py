import csv
import io
from datetime import timedelta
from typing import Optional

from django.http import HttpResponse
from django.utils import timezone
from django.db.models import Q
from ninja import Router
from ninja.errors import HttpError

from listings.models import (
    VehicleListingApplication,
    ApplicationStatus,
    STATUS_LABEL_MAP,
)
from .auth import get_operator_from_session

export_router = Router()


def _check_auth(request):
    operator = get_operator_from_session(request)
    if not operator:
        raise HttpError(401, '未登录，请先登录')
    return operator


def _filter_queryset(qs, params):
    status = params.get('status')
    if status:
        qs = qs.filter(status=status)

    page_label = params.get('page_label')
    if page_label:
        status_map = {}
        for s, label in STATUS_LABEL_MAP.items():
            status_map.setdefault(label, []).append(s)
        statuses = status_map.get(page_label, [])
        if statuses:
            qs = qs.filter(status__in=statuses)
        else:
            qs = qs.none()

    store_name = params.get('store_name')
    if store_name:
        qs = qs.filter(store_name=store_name)

    applicant_id = params.get('applicant_id')
    if applicant_id:
        qs = qs.filter(applicant_id=applicant_id)

    evaluator_id = params.get('evaluator_id')
    if evaluator_id:
        qs = qs.filter(evaluator_id=evaluator_id)

    expiry_status = params.get('expiry_status')
    if expiry_status:
        now = timezone.now()
        if expiry_status == 'normal':
            qs = qs.filter(Q(deadline__isnull=True) | Q(deadline__gt=now + timedelta(days=3)))
        elif expiry_status == 'near_expiry':
            qs = qs.filter(deadline__gt=now, deadline__lte=now + timedelta(days=3))
        elif expiry_status == 'overdue':
            qs = qs.filter(deadline__lt=now)

    search = params.get('search')
    if search:
        qs = qs.filter(
            Q(application_no__icontains=search)
            | Q(vin__icontains=search)
            | Q(license_plate__icontains=search)
        )

    return qs


@export_router.get('listings')
def export_listings(
    request,
    status: Optional[str] = None,
    page_label: Optional[str] = None,
    store_name: Optional[str] = None,
    applicant_id: Optional[int] = None,
    evaluator_id: Optional[int] = None,
    expiry_status: Optional[str] = None,
    search: Optional[str] = None,
):
    _check_auth(request)

    qs = VehicleListingApplication.objects.select_related(
        'applicant', 'evaluator', 'reviewer'
    ).all()

    params = {
        'status': status,
        'page_label': page_label,
        'store_name': store_name,
        'applicant_id': applicant_id,
        'evaluator_id': evaluator_id,
        'expiry_status': expiry_status,
        'search': search,
    }
    qs = _filter_queryset(qs, params)

    output = io.StringIO()
    writer = csv.writer(output)

    now_str = timezone.now().strftime('%Y-%m-%d %H:%M:%S')
    writer.writerow([f'数据时间: {now_str}'])

    headers = [
        '上架单号', '品牌', '型号', '年份', '车架号', '车牌号',
        '里程(公里)', '状态', '页面标签', '超期状态', '版本',
        '提交人', '评估师', '复核人', '门店',
        '是否有挂牌证据', '缺证据原因', '补正说明', '评估结果',
        '复核结果', '退回原因', '截止时间', '创建时间', '更新时间',
    ]
    writer.writerow(headers)

    status_display_map = dict(ApplicationStatus.choices)

    for app in qs:
        row = [
            app.application_no,
            app.brand,
            app.model_name,
            app.year,
            app.vin,
            app.license_plate,
            app.mileage,
            status_display_map.get(app.status, app.status),
            app.page_label,
            app.expiry_status,
            app.version,
            app.applicant.display_name if app.applicant else '',
            app.evaluator.display_name if app.evaluator else '',
            app.reviewer.display_name if app.reviewer else '',
            app.store_name,
            '是' if app.has_listing_evidence else '否',
            app.missing_evidence_reason,
            app.supplement_remark,
            app.evaluation_result,
            app.review_result,
            app.reject_reason,
            app.deadline.strftime('%Y-%m-%d %H:%M:%S') if app.deadline else '',
            app.created_at.strftime('%Y-%m-%d %H:%M:%S') if app.created_at else '',
            app.updated_at.strftime('%Y-%m-%d %H:%M:%S') if app.updated_at else '',
        ]
        writer.writerow(row)

    output.seek(0)
    response = HttpResponse(output.getvalue(), content_type='text/csv; charset=utf-8-sig')
    filename = f'车源上架单导出_{timezone.now().strftime("%Y%m%d_%H%M%S")}.csv'
    response['Content-Disposition'] = f'attachment; filename="{filename}"'
    return response
