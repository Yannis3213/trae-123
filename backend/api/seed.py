import os
import sys
import django
from datetime import date, timedelta

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'app.settings')
django.setup()

from django.db import transaction
from api.models import (
    User, RequirementDeliveryOrder, ProcessingRecord, ExceptionReason, Attachment, AuditNote,
    RoleChoices, OrderStatusChoices, RequirementStatusChoices, ActionChoices, ModuleTypeChoices
)


DEMO_USERS = [
    {'username': 'project_assistant', 'role': RoleChoices.PROJECT_ASSISTANT, 'email': 'pa@demo.com'},
    {'username': 'delivery_registrar', 'role': RoleChoices.DELIVERY_REGISTRAR, 'email': 'dr@demo.com'},
    {'username': 'dev_lead', 'role': RoleChoices.DEV_LEAD, 'email': 'dl@demo.com'},
    {'username': 'audit_supervisor', 'role': RoleChoices.AUDIT_SUPERVISOR, 'email': 'as@demo.com'},
    {'username': 'delivery_manager', 'role': RoleChoices.DELIVERY_MANAGER, 'email': 'dm@demo.com'},
    {'username': 'review_leader', 'role': RoleChoices.REVIEW_LEADER, 'email': 'rl@demo.com'},
]

DEFAULT_PASSWORD = 'test123456'


def create_demo_users():
    users = {}
    for user_data in DEMO_USERS:
        user, created = User.objects.get_or_create(
            username=user_data['username'],
            defaults={
                'role': user_data['role'],
                'email': user_data['email'],
                'is_active': True,
                'is_staff': True,
            }
        )
        if created:
            user.set_password(DEFAULT_PASSWORD)
            user.save()
            print(f'创建用户: {user.username} ({user.get_role_display()})')
        else:
            print(f'用户已存在: {user.username}')
        users[user_data['role']] = user
    return users


def create_order(order_no, title, project_name, clue, **kwargs):
    order, created = RequirementDeliveryOrder.objects.get_or_create(
        order_no=order_no,
        defaults={
            'title': title,
            'project_name': project_name,
            'requirement_confirmation_clue': clue,
            **kwargs,
        }
    )
    if created:
        print(f'创建单据: {order_no} - {title}')
    return order


@transaction.atomic
def seed():
    print('=' * 60)
    print('开始初始化演示数据...')
    print('=' * 60)

    users = create_demo_users()
    today = date.today()

    print()
    print('--- 创建演示单据 ---')

    order1 = create_order(
        order_no='XQJF202606010001',
        title='客户管理系统需求交付单（正常流转）',
        project_name='客户管理系统升级项目',
        clue='客户访谈纪要-2026-05-20-王总',
        status=OrderStatusChoices.REVIEW_PENDING,
        current_handler=users[RoleChoices.REVIEW_LEADER],
        version=5,
        requirement_status=RequirementStatusChoices.COMPLETED,
        schedule_status=RequirementStatusChoices.COMPLETED,
        delivery_status=RequirementStatusChoices.COMPLETED,
        requirement_evidence={
            'confirmation_document': '需求确认书_v1.0.pdf',
            'stakeholder_signature': '已签字-张明',
            'meeting_minutes': '需求评审会议纪要.docx',
        },
        schedule_evidence={
            'schedule_plan': '项目排期计划表_v2.xlsx',
            'resource_allocation': '资源分配方案.pdf',
            'milestone_plan': '里程碑计划.docx',
        },
        delivery_evidence={
            'delivery_report': '交付验收报告_v1.0.pdf',
            'acceptance_certificate': '客户验收确认书.pdf',
            'test_report': '测试报告.pdf',
        },
        requirement_deadline=today + timedelta(days=10),
        schedule_deadline=today + timedelta(days=20),
        delivery_deadline=today + timedelta(days=30),
        created_by=users[RoleChoices.PROJECT_ASSISTANT],
    )
    ProcessingRecord.objects.bulk_create([
        ProcessingRecord(order=order1, action=ActionChoices.SUBMIT, operator=users[RoleChoices.DELIVERY_REGISTRAR],
                         role=RoleChoices.DELIVERY_REGISTRAR, from_status=OrderStatusChoices.PENDING_VERIFY,
                         to_status=OrderStatusChoices.REQUIREMENT_SUBMITTED, remark='需求确认材料已准备齐全',
                         created_at=today - timedelta(days=10)),
        ProcessingRecord(order=order1, action=ActionChoices.APPROVE, operator=users[RoleChoices.AUDIT_SUPERVISOR],
                         role=RoleChoices.AUDIT_SUPERVISOR, from_status=OrderStatusChoices.REQUIREMENT_SUBMITTED,
                         to_status=OrderStatusChoices.REQUIREMENT_AUDITED, remark='需求确认材料齐全，审核通过',
                         created_at=today - timedelta(days=9)),
        ProcessingRecord(order=order1, action=ActionChoices.SUBMIT, operator=users[RoleChoices.DEV_LEAD],
                         role=RoleChoices.DEV_LEAD, from_status=OrderStatusChoices.REQUIREMENT_AUDITED,
                         to_status=OrderStatusChoices.SCHEDULE_SUBMITTED, remark='排期评估完成',
                         created_at=today - timedelta(days=7)),
        ProcessingRecord(order=order1, action=ActionChoices.APPROVE, operator=users[RoleChoices.AUDIT_SUPERVISOR],
                         role=RoleChoices.AUDIT_SUPERVISOR, from_status=OrderStatusChoices.SCHEDULE_SUBMITTED,
                         to_status=OrderStatusChoices.SCHEDULE_AUDITED, remark='排期合理，审核通过',
                         created_at=today - timedelta(days=6)),
        ProcessingRecord(order=order1, action=ActionChoices.SUBMIT, operator=users[RoleChoices.PROJECT_ASSISTANT],
                         role=RoleChoices.PROJECT_ASSISTANT, from_status=OrderStatusChoices.SCHEDULE_AUDITED,
                         to_status=OrderStatusChoices.DELIVERY_SUBMITTED, remark='交付验收材料提交',
                         created_at=today - timedelta(days=3)),
        ProcessingRecord(order=order1, action=ActionChoices.APPROVE, operator=users[RoleChoices.AUDIT_SUPERVISOR],
                         role=RoleChoices.AUDIT_SUPERVISOR, from_status=OrderStatusChoices.DELIVERY_SUBMITTED,
                         to_status=OrderStatusChoices.REVIEW_PENDING, remark='所有模块审核通过，进入复核',
                         created_at=today - timedelta(days=2)),
    ])

    order2 = create_order(
        order_no='XQJF202606010002',
        title='报表平台需求交付单（缺材料）',
        project_name='数据分析报表平台',
        clue='邮件沟通-2026-06-01-李经理',
        status=OrderStatusChoices.PENDING_VERIFY,
        current_handler=users[RoleChoices.DELIVERY_REGISTRAR],
        version=1,
        requirement_status=RequirementStatusChoices.NOT_STARTED,
        schedule_status=RequirementStatusChoices.NOT_STARTED,
        delivery_status=RequirementStatusChoices.NOT_STARTED,
        requirement_deadline=today + timedelta(days=2),
        schedule_deadline=today + timedelta(days=15),
        delivery_deadline=today + timedelta(days=25),
        created_by=users[RoleChoices.PROJECT_ASSISTANT],
    )

    order3 = create_order(
        order_no='XQJF202606010003',
        title='移动端APP需求交付单（超时逾期）',
        project_name='企业移动办公APP',
        clue='现场调研-2026-05-15',
        status=OrderStatusChoices.VERIFY_FAILED,
        current_handler=users[RoleChoices.DEV_LEAD],
        version=4,
        requirement_status=RequirementStatusChoices.COMPLETED,
        schedule_status=RequirementStatusChoices.EXCEPTION,
        delivery_status=RequirementStatusChoices.NOT_STARTED,
        requirement_evidence={
            'confirmation_document': 'APP需求说明书.pdf',
            'stakeholder_signature': '已签字-赵总',
        },
        requirement_deadline=today - timedelta(days=5),
        schedule_deadline=today - timedelta(days=2),
        delivery_deadline=today + timedelta(days=10),
        created_by=users[RoleChoices.DELIVERY_REGISTRAR],
    )
    ProcessingRecord.objects.bulk_create([
        ProcessingRecord(order=order3, action=ActionChoices.SUBMIT, operator=users[RoleChoices.DELIVERY_REGISTRAR],
                         role=RoleChoices.DELIVERY_REGISTRAR, from_status=OrderStatusChoices.PENDING_VERIFY,
                         to_status=OrderStatusChoices.REQUIREMENT_SUBMITTED, remark='需求确认提交',
                         created_at=today - timedelta(days=15)),
        ProcessingRecord(order=order3, action=ActionChoices.APPROVE, operator=users[RoleChoices.AUDIT_SUPERVISOR],
                         role=RoleChoices.AUDIT_SUPERVISOR, from_status=OrderStatusChoices.REQUIREMENT_SUBMITTED,
                         to_status=OrderStatusChoices.REQUIREMENT_AUDITED, remark='需求确认审核通过',
                         created_at=today - timedelta(days=14)),
        ProcessingRecord(order=order3, action=ActionChoices.SUBMIT, operator=users[RoleChoices.DEV_LEAD],
                         role=RoleChoices.DEV_LEAD, from_status=OrderStatusChoices.REQUIREMENT_AUDITED,
                         to_status=OrderStatusChoices.SCHEDULE_SUBMITTED, remark='排期评估提交（缺少资源分配）',
                         created_at=today - timedelta(days=8)),
        ProcessingRecord(order=order3, action=ActionChoices.REJECT, operator=users[RoleChoices.AUDIT_SUPERVISOR],
                         role=RoleChoices.AUDIT_SUPERVISOR, from_status=OrderStatusChoices.SCHEDULE_SUBMITTED,
                         to_status=OrderStatusChoices.VERIFY_FAILED, remark='缺少资源分配方案，请补充',
                         created_at=today - timedelta(days=7)),
    ])
    ExceptionReason.objects.create(
        order=order3,
        module_type=ModuleTypeChoices.SCHEDULE,
        reason='排期评估缺少资源分配方案，需要补充开发人员和测试人员的具体分配计划',
        handler=users[RoleChoices.DEV_LEAD],
        created_at=today - timedelta(days=7),
        resolved=False,
    )
    AuditNote.objects.create(
        order=order3,
        note='排期逾期，请尽快补正',
        author=users[RoleChoices.AUDIT_SUPERVISOR],
        created_at=today - timedelta(days=3),
    )

    order4 = create_order(
        order_no='XQJF202606010004',
        title='库存管理模块需求交付单（退回补正/状态冲突）',
        project_name='ERP系统-库存管理模块',
        clue='电话沟通-2026-05-28-仓库孙主任',
        status=OrderStatusChoices.SCHEDULE_AUDITED,
        current_handler=users[RoleChoices.PROJECT_ASSISTANT],
        version=6,
        requirement_status=RequirementStatusChoices.COMPLETED,
        schedule_status=RequirementStatusChoices.COMPLETED,
        delivery_status=RequirementStatusChoices.NOT_STARTED,
        requirement_evidence={
            'confirmation_document': '库存管理需求说明书_v3.pdf',
            'stakeholder_signature': '已签字-孙主任',
            'meeting_minutes': '需求沟通纪要_v2.docx',
        },
        schedule_evidence={
            'schedule_plan': '库存模块排期_v2.xlsx',
            'resource_allocation': '资源分配_v2.pdf',
        },
        requirement_deadline=today + timedelta(days=5),
        schedule_deadline=today + timedelta(days=1),
        delivery_deadline=today + timedelta(days=12),
        created_by=users[RoleChoices.DELIVERY_REGISTRAR],
    )
    ProcessingRecord.objects.bulk_create([
        ProcessingRecord(order=order4, action=ActionChoices.SUBMIT, operator=users[RoleChoices.DELIVERY_REGISTRAR],
                         role=RoleChoices.DELIVERY_REGISTRAR, from_status=OrderStatusChoices.PENDING_VERIFY,
                         to_status=OrderStatusChoices.REQUIREMENT_SUBMITTED, remark='需求确认提交v1',
                         created_at=today - timedelta(days=20)),
        ProcessingRecord(order=order4, action=ActionChoices.REJECT, operator=users[RoleChoices.AUDIT_SUPERVISOR],
                         role=RoleChoices.AUDIT_SUPERVISOR, from_status=OrderStatusChoices.REQUIREMENT_SUBMITTED,
                         to_status=OrderStatusChoices.VERIFY_FAILED, remark='需求描述不清晰，退回补正',
                         created_at=today - timedelta(days=19)),
        ProcessingRecord(order=order4, action=ActionChoices.SUBMIT, operator=users[RoleChoices.DELIVERY_REGISTRAR],
                         role=RoleChoices.DELIVERY_REGISTRAR, from_status=OrderStatusChoices.VERIFY_FAILED,
                         to_status=OrderStatusChoices.REQUIREMENT_SUBMITTED, remark='需求确认补正v2',
                         created_at=today - timedelta(days=17)),
        ProcessingRecord(order=order4, action=ActionChoices.APPROVE, operator=users[RoleChoices.AUDIT_SUPERVISOR],
                         role=RoleChoices.AUDIT_SUPERVISOR, from_status=OrderStatusChoices.REQUIREMENT_SUBMITTED,
                         to_status=OrderStatusChoices.REQUIREMENT_AUDITED, remark='补正后审核通过',
                         created_at=today - timedelta(days=16)),
        ProcessingRecord(order=order4, action=ActionChoices.SUBMIT, operator=users[RoleChoices.DEV_LEAD],
                         role=RoleChoices.DEV_LEAD, from_status=OrderStatusChoices.REQUIREMENT_AUDITED,
                         to_status=OrderStatusChoices.SCHEDULE_SUBMITTED, remark='排期评估提交v1',
                         created_at=today - timedelta(days=12)),
        ProcessingRecord(order=order4, action=ActionChoices.REJECT, operator=users[RoleChoices.AUDIT_SUPERVISOR],
                         role=RoleChoices.AUDIT_SUPERVISOR, from_status=OrderStatusChoices.SCHEDULE_SUBMITTED,
                         to_status=OrderStatusChoices.VERIFY_FAILED, remark='排期不合理，工期过短，退回调整',
                         created_at=today - timedelta(days=11)),
        ProcessingRecord(order=order4, action=ActionChoices.SUBMIT, operator=users[RoleChoices.DEV_LEAD],
                         role=RoleChoices.DEV_LEAD, from_status=OrderStatusChoices.VERIFY_FAILED,
                         to_status=OrderStatusChoices.SCHEDULE_SUBMITTED, remark='排期评估调整v2',
                         created_at=today - timedelta(days=8)),
        ProcessingRecord(order=order4, action=ActionChoices.APPROVE, operator=users[RoleChoices.AUDIT_SUPERVISOR],
                         role=RoleChoices.AUDIT_SUPERVISOR, from_status=OrderStatusChoices.SCHEDULE_SUBMITTED,
                         to_status=OrderStatusChoices.SCHEDULE_AUDITED, remark='排期调整合理，审核通过',
                         created_at=today - timedelta(days=7)),
    ])
    ExceptionReason.objects.create(
        order=order4,
        module_type=ModuleTypeChoices.REQUIREMENT,
        reason='需求描述不够具体，缺少出入库流程的详细描述',
        handler=users[RoleChoices.DELIVERY_REGISTRAR],
        created_at=today - timedelta(days=19),
        resolved=True,
        resolved_at=today - timedelta(days=17),
    )
    ExceptionReason.objects.create(
        order=order4,
        module_type=ModuleTypeChoices.SCHEDULE,
        reason='排期工期过短，开发时间只有5天，实际需要10天',
        handler=users[RoleChoices.DEV_LEAD],
        created_at=today - timedelta(days=11),
        resolved=True,
        resolved_at=today - timedelta(days=8),
    )

    order5 = create_order(
        order_no='XQJF202606010005',
        title='用户中心需求交付单（待补正样例）',
        project_name='用户中心重构项目',
        clue='需求研讨会-2026-06-05',
        status=OrderStatusChoices.VERIFY_FAILED,
        current_handler=users[RoleChoices.DELIVERY_REGISTRAR],
        version=3,
        requirement_status=RequirementStatusChoices.EXCEPTION,
        schedule_status=RequirementStatusChoices.NOT_STARTED,
        delivery_status=RequirementStatusChoices.NOT_STARTED,
        requirement_evidence={
            'confirmation_document': '用户中心需求说明书_v1.pdf',
            'stakeholder_signature': '已签字-刘经理',
        },
        requirement_deadline=today - timedelta(days=1),
        schedule_deadline=today + timedelta(days=14),
        delivery_deadline=today + timedelta(days=28),
        created_by=users[RoleChoices.DELIVERY_REGISTRAR],
    )
    ProcessingRecord.objects.bulk_create([
        ProcessingRecord(order=order5, action=ActionChoices.SUBMIT, operator=users[RoleChoices.DELIVERY_REGISTRAR],
                         role=RoleChoices.DELIVERY_REGISTRAR, from_status=OrderStatusChoices.PENDING_VERIFY,
                         to_status=OrderStatusChoices.REQUIREMENT_SUBMITTED, remark='需求确认提交',
                         created_at=today - timedelta(days=5)),
        ProcessingRecord(order=order5, action=ActionChoices.REJECT, operator=users[RoleChoices.AUDIT_SUPERVISOR],
                         role=RoleChoices.AUDIT_SUPERVISOR, from_status=OrderStatusChoices.REQUIREMENT_SUBMITTED,
                         to_status=OrderStatusChoices.VERIFY_FAILED, remark='需求描述不够详细，缺少边界条件说明',
                         created_at=today - timedelta(days=4)),
    ])
    ExceptionReason.objects.create(
        order=order5,
        module_type=ModuleTypeChoices.REQUIREMENT,
        reason='需求描述不够详细，缺少边界条件说明',
        handler=users[RoleChoices.DELIVERY_REGISTRAR],
        created_at=today - timedelta(days=4),
        resolved=False,
    )

    order6 = create_order(
        order_no='XQJF202606010006',
        title='数据分析平台需求交付单（状态冲突样例）',
        project_name='数据分析平台建设',
        clue='招投标文件-数据分析模块',
        status=OrderStatusChoices.VERIFY_FAILED,
        current_handler=users[RoleChoices.DEV_LEAD],
        version=5,
        requirement_status=RequirementStatusChoices.COMPLETED,
        schedule_status=RequirementStatusChoices.EXCEPTION,
        delivery_status=RequirementStatusChoices.NOT_STARTED,
        requirement_evidence={
            'confirmation_document': '数据分析平台需求说明书_v2.pdf',
            'stakeholder_signature': '已签字-陈总监',
            'meeting_minutes': '需求评审会议纪要.docx',
        },
        schedule_evidence={
            'schedule_plan': '数据分析平台排期计划_v1.xlsx',
            'resource_allocation': '',
        },
        requirement_deadline=today - timedelta(days=8),
        schedule_deadline=today - timedelta(days=2),
        delivery_deadline=today - timedelta(days=3),
        created_by=users[RoleChoices.PROJECT_ASSISTANT],
    )
    ProcessingRecord.objects.bulk_create([
        ProcessingRecord(order=order6, action=ActionChoices.SUBMIT, operator=users[RoleChoices.DELIVERY_REGISTRAR],
                         role=RoleChoices.DELIVERY_REGISTRAR, from_status=OrderStatusChoices.PENDING_VERIFY,
                         to_status=OrderStatusChoices.REQUIREMENT_SUBMITTED, remark='需求确认提交v1',
                         created_at=today - timedelta(days=15)),
        ProcessingRecord(order=order6, action=ActionChoices.APPROVE, operator=users[RoleChoices.AUDIT_SUPERVISOR],
                         role=RoleChoices.AUDIT_SUPERVISOR, from_status=OrderStatusChoices.REQUIREMENT_SUBMITTED,
                         to_status=OrderStatusChoices.REQUIREMENT_AUDITED, remark='需求确认审核通过',
                         created_at=today - timedelta(days=14)),
        ProcessingRecord(order=order6, action=ActionChoices.SUBMIT, operator=users[RoleChoices.DEV_LEAD],
                         role=RoleChoices.DEV_LEAD, from_status=OrderStatusChoices.REQUIREMENT_AUDITED,
                         to_status=OrderStatusChoices.SCHEDULE_SUBMITTED, remark='排期评估提交v1',
                         created_at=today - timedelta(days=10)),
        ProcessingRecord(order=order6, action=ActionChoices.REJECT, operator=users[RoleChoices.AUDIT_SUPERVISOR],
                         role=RoleChoices.AUDIT_SUPERVISOR, from_status=OrderStatusChoices.SCHEDULE_SUBMITTED,
                         to_status=OrderStatusChoices.VERIFY_FAILED, remark='资源分配不完整，且排期过于紧张',
                         created_at=today - timedelta(days=9)),
        ProcessingRecord(order=order6, action=ActionChoices.CORRECT, operator=users[RoleChoices.DEV_LEAD],
                         role=RoleChoices.DEV_LEAD, from_status=OrderStatusChoices.VERIFY_FAILED,
                         to_status=OrderStatusChoices.SCHEDULE_SUBMITTED, remark='排期补正v2',
                         created_at=today - timedelta(days=7)),
        ProcessingRecord(order=order6, action=ActionChoices.REJECT, operator=users[RoleChoices.AUDIT_SUPERVISOR],
                         role=RoleChoices.AUDIT_SUPERVISOR, from_status=OrderStatusChoices.SCHEDULE_SUBMITTED,
                         to_status=OrderStatusChoices.VERIFY_FAILED, remark='资源分配仍不符合要求，请重新评估',
                         created_at=today - timedelta(days=6)),
    ])
    ExceptionReason.objects.create(
        order=order6,
        module_type=ModuleTypeChoices.SCHEDULE,
        reason='资源分配不完整，缺少测试人员分配，且开发工期评估不足',
        handler=users[RoleChoices.DEV_LEAD],
        created_at=today - timedelta(days=6),
        resolved=False,
    )

    order7 = create_order(
        order_no='XQJF202606010007',
        title='会员营销系统需求交付单（非当前处理人样例）',
        project_name='会员营销系统',
        clue='市场部需求文档-2026-06-10',
        status=OrderStatusChoices.PENDING_VERIFY,
        current_handler=users[RoleChoices.DELIVERY_REGISTRAR],
        version=2,
        requirement_status=RequirementStatusChoices.NOT_STARTED,
        schedule_status=RequirementStatusChoices.NOT_STARTED,
        delivery_status=RequirementStatusChoices.NOT_STARTED,
        requirement_deadline=today + timedelta(days=1),
        schedule_deadline=today + timedelta(days=15),
        delivery_deadline=today + timedelta(days=30),
        created_by=users[RoleChoices.PROJECT_ASSISTANT],
    )
    AuditNote.objects.create(
        order=order7,
        note='待登记员处理',
        author=users[RoleChoices.PROJECT_ASSISTANT],
        created_at=today - timedelta(days=1),
    )

    order8 = create_order(
        order_no='XQJF202606010008',
        title='客服工单系统需求交付单（旧版本冲突样例）',
        project_name='客服工单系统',
        clue='客服中心访谈纪要-2026-05-30',
        status=OrderStatusChoices.VERIFY_FAILED,
        current_handler=users[RoleChoices.DELIVERY_REGISTRAR],
        version=4,
        requirement_status=RequirementStatusChoices.EXCEPTION,
        schedule_status=RequirementStatusChoices.NOT_STARTED,
        delivery_status=RequirementStatusChoices.NOT_STARTED,
        requirement_evidence={
            'confirmation_document': '客服工单系统需求说明书_v1.pdf',
            'stakeholder_signature': '已签字-客服中心王经理',
        },
        requirement_deadline=today - timedelta(days=3),
        schedule_deadline=today + timedelta(days=12),
        delivery_deadline=today + timedelta(days=25),
        created_by=users[RoleChoices.DELIVERY_REGISTRAR],
    )
    ProcessingRecord.objects.bulk_create([
        ProcessingRecord(order=order8, action=ActionChoices.SUBMIT, operator=users[RoleChoices.DELIVERY_REGISTRAR],
                         role=RoleChoices.DELIVERY_REGISTRAR, from_status=OrderStatusChoices.PENDING_VERIFY,
                         to_status=OrderStatusChoices.REQUIREMENT_SUBMITTED, remark='需求确认提交',
                         created_at=today - timedelta(days=8)),
        ProcessingRecord(order=order8, action=ActionChoices.REJECT, operator=users[RoleChoices.AUDIT_SUPERVISOR],
                         role=RoleChoices.AUDIT_SUPERVISOR, from_status=OrderStatusChoices.REQUIREMENT_SUBMITTED,
                         to_status=OrderStatusChoices.VERIFY_FAILED, remark='需求缺少非功能性需求描述',
                         created_at=today - timedelta(days=7)),
    ])
    ExceptionReason.objects.create(
        order=order8,
        module_type=ModuleTypeChoices.REQUIREMENT,
        reason='需求缺少非功能性需求描述，需要补充性能、安全、可用性等方面的需求说明',
        handler=users[RoleChoices.DELIVERY_REGISTRAR],
        created_at=today - timedelta(days=7),
        resolved=False,
    )
    AuditNote.objects.create(
        order=order8,
        note='版本已更新，请刷新后处理',
        author=users[RoleChoices.AUDIT_SUPERVISOR],
        created_at=today - timedelta(days=1),
    )

    Attachment.objects.bulk_create([
        Attachment(order=order1, module_type=ModuleTypeChoices.REQUIREMENT,
                   file_name='需求确认书_v1.0.pdf', file_url='/files/req_001.pdf',
                   uploaded_by=users[RoleChoices.DELIVERY_REGISTRAR]),
        Attachment(order=order1, module_type=ModuleTypeChoices.SCHEDULE,
                   file_name='项目排期计划表_v2.xlsx', file_url='/files/sch_001.xlsx',
                   uploaded_by=users[RoleChoices.DEV_LEAD]),
        Attachment(order=order1, module_type=ModuleTypeChoices.DELIVERY,
                   file_name='交付验收报告_v1.0.pdf', file_url='/files/dlv_001.pdf',
                   uploaded_by=users[RoleChoices.PROJECT_ASSISTANT]),
    ])

    print()
    print('=' * 60)
    print('初始化完成！')
    print(f'创建了 {User.objects.count()} 个用户，{RequirementDeliveryOrder.objects.count()} 个单据')
    print(f'所有用户默认密码: {DEFAULT_PASSWORD}')
    print('演示账号列表:')
    for u in DEMO_USERS:
        print(f'  - {u["username"]} ({dict(RoleChoices.choices)[u["role"]]})')
    print('=' * 60)


if __name__ == '__main__':
    seed()
