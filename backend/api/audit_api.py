from ninja import Router
from ninja.errors import HttpError

from listings.models import (
    VehicleListingApplication,
    ProcessingRecord,
    AuditNote,
    ApplicationStatus,
    STATUS_LABEL_MAP,
)
from .auth import get_operator_from_session
from .schemas import (
    ProcessingRecordOut,
    AuditNoteOut,
    ApplicationOut,
    ExpiryWarningGroup,
)

audit_router = Router()


def _check_auth(request):
    operator = get_operator_from_session(request)
    if not operator:
        raise HttpError(401, '未登录，请先登录')
    return operator


def _app_to_out(app):
    person = app.responsible_person
    return ApplicationOut(
        id=app.id,
        application_no=app.application_no,
        brand=app.brand,
        model_name=app.model_name,
        year=app.year,
        vin=app.vin,
        license_plate=app.license_plate,
        mileage=app.mileage,
        status=app.status,
        version=app.version,
        applicant=app.applicant_id,
        evaluator=app.evaluator_id,
        reviewer=app.reviewer_id,
        applicant_display=app.applicant.display_name if app.applicant else None,
        evaluator_display=app.evaluator.display_name if app.evaluator else None,
        reviewer_display=app.reviewer.display_name if app.reviewer else None,
        store_name=app.store_name,
        has_listing_evidence=app.has_listing_evidence,
        missing_evidence_reason=app.missing_evidence_reason,
        supplement_remark=app.supplement_remark,
        evaluation_result=app.evaluation_result,
        review_result=app.review_result,
        reject_reason=app.reject_reason,
        deadline=app.deadline,
        created_at=app.created_at,
        updated_at=app.updated_at,
        page_label=app.page_label,
        expiry_status=app.expiry_status,
        responsible_person_display=person.display_name if person else None,
    )


@audit_router.get('applications/{application_id}/records', response=list[ProcessingRecordOut])
def get_processing_records(request, application_id: int):
    _check_auth(request)
    try:
        app = VehicleListingApplication.objects.get(id=application_id)
    except VehicleListingApplication.DoesNotExist:
        raise HttpError(404, f'车源上架单ID {application_id} 不存在')
    records = ProcessingRecord.objects.filter(application=app).order_by('-created_at')
    return records


@audit_router.get('applications/{application_id}/notes', response=list[AuditNoteOut])
def get_audit_notes(request, application_id: int):
    _check_auth(request)
    try:
        app = VehicleListingApplication.objects.get(id=application_id)
    except VehicleListingApplication.DoesNotExist:
        raise HttpError(404, f'车源上架单ID {application_id} 不存在')
    notes = AuditNote.objects.filter(application=app).order_by('-created_at')
    return notes


@audit_router.get('warnings', response=list[ExpiryWarningGroup])
def get_expiry_warnings(request):
    _check_auth(request)
    apps = VehicleListingApplication.objects.select_related(
        'applicant', 'evaluator', 'reviewer'
    ).all()

    normal_items = []
    near_expiry_items = []
    overdue_items = []

    for app in apps:
        out = _app_to_out(app)
        es = app.expiry_status
        if es == 'normal':
            normal_items.append(out)
        elif es == 'near_expiry':
            near_expiry_items.append(out)
        elif es == 'overdue':
            overdue_items.append(out)

    return [
        ExpiryWarningGroup(status_label='正常', items=normal_items),
        ExpiryWarningGroup(status_label='临期', items=near_expiry_items),
        ExpiryWarningGroup(status_label='逾期', items=overdue_items),
    ]
