import os
import sys
import django

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from datetime import timedelta
from django.utils import timezone
from django.db import transaction

from listings.models import (
    Operator,
    VehicleListingApplication,
    ProcessingRecord,
    AuditNote,
    Attachment,
    ApplicationStatus,
    RoleChoices,
    ROLE_DISPLAY_MAP,
)


def generate_application_no():
    from datetime import date
    today = date.today()
    date_str = today.strftime('%Y%m%d')
    prefix = f'CJ{date_str}'
    last_app = VehicleListingApplication.objects.filter(
        application_no__startswith=prefix
    ).order_by('-application_no').first()
    if last_app:
        seq = int(last_app.application_no[-4:]) + 1
    else:
        seq = 1
    return f'{prefix}{seq:04d}'


def create_record_and_note(app, operator, action, from_status, to_status, remark='', failure_reason=''):
    role_display = ROLE_DISPLAY_MAP.get(operator.role, operator.role)
    ProcessingRecord.objects.create(
        application=app,
        operator=operator,
        operator_role=role_display,
        action=action,
        from_status=from_status,
        to_status=to_status,
        remark=remark,
        failure_reason=failure_reason,
    )
    AuditNote.objects.create(
        application=app,
        operator=operator,
        operator_role=role_display,
        note=f'{action}: {remark}' if remark else action,
        failure_reason=failure_reason,
    )


def run():
    now = timezone.now()

    print('=== 清理旧数据 ===')
    VehicleListingApplication.objects.all().delete()
    Operator.objects.all().delete()

    print('=== 创建操作人 ===')
    consultant1 = Operator.objects.create(
        username='consultant1', display_name='张伟',
        role=RoleChoices.CONSULTANT, store_name='阳光门店',
    )
    consultant2 = Operator.objects.create(
        username='consultant2', display_name='李娜',
        role=RoleChoices.CONSULTANT, store_name='阳光门店',
    )
    evaluator1 = Operator.objects.create(
        username='evaluator1', display_name='王强',
        role=RoleChoices.EVALUATOR, store_name='阳光门店',
    )
    manager1 = Operator.objects.create(
        username='manager1', display_name='赵敏',
        role=RoleChoices.MANAGER, store_name='阳光门店',
    )

    print('=== 创建演示车源上架单 ===')

    # Type 1: 正常流转 - 2 applications
    # 1a: PENDING_PROCESS (ready for evaluator)
    app1a = VehicleListingApplication.objects.create(
        application_no=generate_application_no(),
        brand='丰田', model_name='凯美瑞', year=2022,
        vin='LVSHFFAL2NE000001', license_plate='京A12345',
        mileage=35000, status=ApplicationStatus.PENDING_PROCESS,
        version=2, applicant=consultant1, store_name='阳光门店',
        has_listing_evidence=True,
        deadline=now + timedelta(days=7),
    )
    create_record_and_note(app1a, consultant1, 'create', '', ApplicationStatus.DRAFT, '创建车源上架单')
    create_record_and_note(app1a, consultant1, 'submit', ApplicationStatus.DRAFT, ApplicationStatus.PENDING_PROCESS, '提交车源上架单，资料齐全')
    Attachment.objects.create(
        application=app1a, file_name='挂牌确认书.pdf',
        file_type='listing_evidence', uploaded_by=consultant1,
    )

    # 1b: UNDER_REVIEW (ready for manager)
    app1b = VehicleListingApplication.objects.create(
        application_no=generate_application_no(),
        brand='本田', model_name='雅阁', year=2021,
        vin='LVSHFFAL2NE000002', license_plate='京B23456',
        mileage=42000, status=ApplicationStatus.UNDER_REVIEW,
        version=3, applicant=consultant2, evaluator=evaluator1,
        store_name='阳光门店',
        has_listing_evidence=True,
        evaluation_result='车况良好，评估通过',
        deadline=now + timedelta(days=5),
    )
    create_record_and_note(app1b, consultant2, 'create', '', ApplicationStatus.DRAFT, '创建车源上架单')
    create_record_and_note(app1b, consultant2, 'submit', ApplicationStatus.DRAFT, ApplicationStatus.PENDING_PROCESS, '提交车源上架单')
    create_record_and_note(app1b, evaluator1, 'process', ApplicationStatus.PENDING_PROCESS, ApplicationStatus.UNDER_REVIEW, '评估通过，车况良好')
    Attachment.objects.create(
        application=app1b, file_name='检测报告.pdf',
        file_type='inspection_report', uploaded_by=evaluator1,
    )

    # Type 2: 缺材料 - 2 applications
    # 2a: PENDING_SUPPLEMENT, missing listing evidence with reason
    app2a = VehicleListingApplication.objects.create(
        application_no=generate_application_no(),
        brand='大众', model_name='帕萨特', year=2020,
        vin='LVSHFFAL2NE000003', license_plate='京C34567',
        mileage=58000, status=ApplicationStatus.PENDING_SUPPLEMENT,
        version=2, applicant=consultant1, store_name='阳光门店',
        has_listing_evidence=False,
        missing_evidence_reason='挂牌确认书正在办理中，预计3天后取得',
        deadline=now + timedelta(days=5),
    )
    create_record_and_note(app2a, consultant1, 'create', '', ApplicationStatus.DRAFT, '创建车源上架单，缺少挂牌确认书')
    create_record_and_note(app2a, consultant1, 'submit', ApplicationStatus.DRAFT, ApplicationStatus.PENDING_SUPPLEMENT, '提交但缺少挂牌证据')

    # 2b: DRAFT, missing evidence
    app2b = VehicleListingApplication.objects.create(
        application_no=generate_application_no(),
        brand='宝马', model_name='3系', year=2023,
        vin='LVSHFFAL2NE000004', license_plate='京D45678',
        mileage=15000, status=ApplicationStatus.DRAFT,
        version=1, applicant=consultant2, store_name='阳光门店',
        has_listing_evidence=False,
        missing_evidence_reason='等待总部邮寄挂牌确认文件',
        deadline=now + timedelta(days=10),
    )
    create_record_and_note(app2b, consultant2, 'create', '', ApplicationStatus.DRAFT, '创建车源上架单，尚未获取挂牌证据')

    # Type 3: 超时或逾期 - 2 applications
    # 3a: PENDING_PROCESS with deadline in the past (overdue)
    app3a = VehicleListingApplication.objects.create(
        application_no=generate_application_no(),
        brand='奔驰', model_name='C级', year=2021,
        vin='LVSHFFAL2NE000005', license_plate='京E56789',
        mileage=62000, status=ApplicationStatus.PENDING_PROCESS,
        version=2, applicant=consultant1, store_name='阳光门店',
        has_listing_evidence=True,
        deadline=now - timedelta(days=2),
    )
    create_record_and_note(app3a, consultant1, 'create', '', ApplicationStatus.DRAFT, '创建车源上架单')
    create_record_and_note(app3a, consultant1, 'submit', ApplicationStatus.DRAFT, ApplicationStatus.PENDING_PROCESS, '提交车源上架单，已逾期未处理')

    # 3b: PENDING_PROCESS with deadline within 2 days (near expiry)
    app3b = VehicleListingApplication.objects.create(
        application_no=generate_application_no(),
        brand='奥迪', model_name='A4L', year=2022,
        vin='LVSHFFAL2NE000006', license_plate='京F67890',
        mileage=38000, status=ApplicationStatus.PENDING_PROCESS,
        version=2, applicant=consultant2, store_name='阳光门店',
        has_listing_evidence=True,
        deadline=now + timedelta(hours=36),
    )
    create_record_and_note(app3b, consultant2, 'create', '', ApplicationStatus.DRAFT, '创建车源上架单')
    create_record_and_note(app3b, consultant2, 'submit', ApplicationStatus.DRAFT, ApplicationStatus.PENDING_PROCESS, '提交车源上架单，即将到期')

    # Type 4: 退回补正或状态冲突 - 2 applications
    # 4a: RETURNED status with reject_reason
    app4a = VehicleListingApplication.objects.create(
        application_no=generate_application_no(),
        brand='特斯拉', model_name='Model 3', year=2023,
        vin='LVSHFFAL2NE000007', license_plate='京G78901',
        mileage=12000, status=ApplicationStatus.RETURNED,
        version=4, applicant=consultant1, evaluator=evaluator1,
        reviewer=manager1, store_name='阳光门店',
        has_listing_evidence=True,
        evaluation_result='车况评估通过',
        review_result='复核发现问题，需补正',
        reject_reason='挂牌确认书信息与登记信息不一致，请核实后重新提交',
        deadline=now + timedelta(days=3),
    )
    create_record_and_note(app4a, consultant1, 'create', '', ApplicationStatus.DRAFT, '创建车源上架单')
    create_record_and_note(app4a, consultant1, 'submit', ApplicationStatus.DRAFT, ApplicationStatus.PENDING_PROCESS, '提交车源上架单')
    create_record_and_note(app4a, evaluator1, 'process', ApplicationStatus.PENDING_PROCESS, ApplicationStatus.UNDER_REVIEW, '评估通过')
    create_record_and_note(app4a, manager1, 'return', ApplicationStatus.UNDER_REVIEW, ApplicationStatus.RETURNED, '退回补正：挂牌确认书信息与登记信息不一致')

    # 4b: Another PENDING_SUPPLEMENT
    app4b = VehicleListingApplication.objects.create(
        application_no=generate_application_no(),
        brand='比亚迪', model_name='汉EV', year=2024,
        vin='LVSHFFAL2NE000008', license_plate='京H89012',
        mileage=8000, status=ApplicationStatus.PENDING_SUPPLEMENT,
        version=2, applicant=consultant2, store_name='阳光门店',
        has_listing_evidence=False,
        missing_evidence_reason='等待检测站出具挂牌确认',
        deadline=now + timedelta(days=4),
    )
    create_record_and_note(app4b, consultant2, 'create', '', ApplicationStatus.DRAFT, '创建车源上架单')
    create_record_and_note(app4b, consultant2, 'submit', ApplicationStatus.DRAFT, ApplicationStatus.PENDING_SUPPLEMENT, '提交但缺少挂牌证据，需补正')

    print('=== 初始化完成 ===')
    print(f'操作人数量: {Operator.objects.count()}')
    print(f'车源上架单数量: {VehicleListingApplication.objects.count()}')
    print(f'处理记录数量: {ProcessingRecord.objects.count()}')
    print(f'审计备注数量: {AuditNote.objects.count()}')
    print(f'附件数量: {Attachment.objects.count()}')

    for app in VehicleListingApplication.objects.all():
        print(f'  {app.application_no}: {app.get_status_display()} (页面标签: {app.page_label}, 超期: {app.expiry_status})')


if __name__ == '__main__':
    run()
