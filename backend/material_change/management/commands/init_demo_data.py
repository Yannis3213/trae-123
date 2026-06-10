from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
from django.utils import timezone
from datetime import timedelta
from material_change.models import (
    UserProfile, MaterialChangeOrder, ProcessingRecord,
    ExceptionRecord, Attachment, BOMChangeRecord,
    MaterialSubstituteRecord, PilotVerifyRecord
)

DEMO_USERS = [
    {'username': 'registrar', 'password': '123456', 'real_name': '张登记', 'role': 'registrar', 'department': '物料部'},
    {'username': 'material', 'password': '123456', 'real_name': '李物料', 'role': 'material_officer', 'department': '物料部'},
    {'username': 'quality', 'password': '123456', 'real_name': '王品质', 'role': 'quality_engineer', 'department': '品质部'},
    {'username': 'auditor', 'password': '123456', 'real_name': '赵主管', 'role': 'auditor', 'department': '品质部'},
    {'username': 'pm', 'password': '123456', 'real_name': '钱经理', 'role': 'production_manager', 'department': '生产部'},
    {'username': 'factory', 'password': '123456', 'real_name': '孙复核', 'role': 'factory_reviewer', 'department': '工厂'},
]


class Command(BaseCommand):
    help = '初始化演示数据'

    def handle(self, *args, **options):
        self.stdout.write('开始初始化演示数据...')

        profiles = {}
        for u in DEMO_USERS:
            user, created = User.objects.get_or_create(
                username=u['username'],
                defaults={'is_active': True}
            )
            if created:
                user.set_password(u['password'])
                user.save()
                self.stdout.write(f'  创建用户: {u["username"]}')

            profile, p_created = UserProfile.objects.get_or_create(
                user=user,
                defaults={
                    'real_name': u['real_name'],
                    'role': u['role'],
                    'department': u['department'],
                }
            )
            if not p_created:
                profile.real_name = u['real_name']
                profile.role = u['role']
                profile.department = u['department']
                profile.save()
            profiles[u['role']] = profile

        self.stdout.write('用户数据初始化完成')

        now = timezone.now()
        registrar = profiles['registrar']
        material_officer = profiles['material_officer']
        quality = profiles['quality_engineer']
        auditor = profiles['auditor']
        pm = profiles['production_manager']
        factory = profiles['factory_reviewer']

        samples = []

        order1 = MaterialChangeOrder.objects.create(
            order_no='MCO202506010001',
            title='0402电阻10KΩ物料替代变更',
            change_type='bom_change',
            urgency='normal',
            status='draft',
            version=1,
            old_material_code='R-0402-10K-1%',
            old_material_name='贴片电阻 0402 10KΩ ±1%',
            old_material_spec='0402 10KΩ 1% 1/16W',
            new_material_code='R-0402-10K-5%',
            new_material_name='贴片电阻 0402 10KΩ ±5%',
            new_material_spec='0402 10KΩ 5% 1/16W',
            bom_reference='BOM-2025-0147',
            product_model='ZX-200A',
            change_reason='原物料供应商停产，寻找替代物料',
            change_description='将1%精度电阻替换为5%精度，成本降低15%，不影响电路性能',
            deadline=now + timedelta(days=5),
            created_by=registrar,
            current_handler=registrar,
            bom_evidence_ready=False,
            substitute_evidence_ready=False,
            pilot_evidence_ready=False,
        )
        ProcessingRecord.objects.create(
            order=order1, operator=registrar, action='create',
            action_display='创建', from_status='', to_status='draft',
            comment='正常样例-草稿状态', version=1
        )
        samples.append(('正常流转-待提交', order1))

        order2 = MaterialChangeOrder.objects.create(
            order_no='MCO202506010002',
            title='10uF陶瓷电容BOM版本升级',
            change_type='bom_change',
            urgency='urgent',
            status='bom_pending',
            version=2,
            old_material_code='C-0805-10U-25V',
            old_material_name='多层陶瓷电容 0805 10uF 25V',
            old_material_spec='0805 10uF 25V X7R',
            new_material_code='C-0805-10U-50V',
            new_material_name='多层陶瓷电容 0805 10uF 50V',
            new_material_spec='0805 10uF 50V X7R',
            bom_reference='BOM-2025-0089',
            product_model='ZX-300B',
            change_reason='电源板电容耐压不足，需升级',
            change_description='将25V耐压电容升级为50V耐压，提高可靠性',
            deadline=now + timedelta(hours=12),
            created_by=registrar,
            current_handler=material_officer,
            bom_evidence_ready=False,
            submit_time=now - timedelta(hours=2),
        )
        ProcessingRecord.objects.create(
            order=order2, operator=registrar, action='submit',
            action_display='提交', from_status='draft', to_status='bom_pending',
            comment='提交BOM确认', version=2
        )
        samples.append(('缺材料-BOM待确认无证据', order2))

        order3 = MaterialChangeOrder.objects.create(
            order_no='MCO202506010003',
            title='IC芯片型号更换验证',
            change_type='pilot_verify',
            urgency='critical',
            status='returned',
            version=3,
            old_material_code='IC-STM32F103C8T6',
            old_material_name='STM32F103C8T6 微控制器',
            old_material_spec='LQFP-48 72MHz 64KB Flash',
            new_material_code='IC-STM32F103CBT6',
            new_material_name='STM32F103CBT6 微控制器',
            new_material_spec='LQFP-48 72MHz 128KB Flash',
            bom_reference='BOM-2025-0256',
            product_model='ZX-500C',
            change_reason='Flash容量不足，需更换更大容量型号',
            change_description='Flash从64KB升级到128KB，pin to pin兼容',
            deadline=now - timedelta(days=1),
            created_by=registrar,
            current_handler=registrar,
            bom_evidence_ready=True,
            substitute_evidence_ready=True,
            pilot_evidence_ready=False,
            return_reason='试产验证数据不足，需要补充良率报告和可靠性测试数据',
            submit_time=now - timedelta(days=3),
            warn_status='overdue',
        )
        ProcessingRecord.objects.create(
            order=order3, operator=registrar, action='submit',
            action_display='提交', from_status='draft', to_status='bom_pending', version=2
        )
        ProcessingRecord.objects.create(
            order=order3, operator=material_officer, action='confirm_bom',
            action_display='确认BOM变更', from_status='bom_pending', to_status='bom_confirmed', version=3
        )
        ProcessingRecord.objects.create(
            order=order3, operator=quality, action='return',
            action_display='退回', from_status='pilot_pending', to_status='returned',
            comment='试产验证数据不足，需要补充良率报告和可靠性测试数据', version=3
        )
        ExceptionRecord.objects.create(
            order=order3, exception_type='退回补正', exception_code='RETURNED',
            description='从待试产验证退回，原因：试产验证数据不足，需要补充良率报告和可靠性测试数据',
            responsible_user=registrar, responsible_role='registrar'
        )
        samples.append(('退回补正-试产阶段被退回', order3))

        order4 = MaterialChangeOrder.objects.create(
            order_no='MCO202506010004',
            title='二极管物料替代验证',
            change_type='material_substitute',
            urgency='normal',
            status='substitute_checked',
            version=4,
            old_material_code='D-1N4148',
            old_material_name='开关二极管 1N4148',
            old_material_spec='DO-35 100V 200mA',
            new_material_code='D-BAV21',
            new_material_name='开关二极管 BAV21',
            new_material_spec='SOT-23 200V 200mA',
            bom_reference='BOM-2025-0178',
            product_model='ZX-100A',
            change_reason='原物料交期过长，切换替代料',
            change_description='DO-35封装替换为SOT-23封装，性能参数更优',
            deadline=now - timedelta(hours=6),
            created_by=registrar,
            current_handler=quality,
            bom_evidence_ready=True,
            substitute_evidence_ready=True,
            pilot_evidence_ready=False,
            submit_time=now - timedelta(days=2),
            warn_status='overdue',
        )
        ProcessingRecord.objects.create(
            order=order4, operator=registrar, action='submit',
            action_display='提交', from_status='draft', to_status='bom_pending', version=2
        )
        ProcessingRecord.objects.create(
            order=order4, operator=material_officer, action='confirm_bom',
            action_display='确认BOM变更', from_status='bom_pending', to_status='bom_confirmed', version=3
        )
        ProcessingRecord.objects.create(
            order=order4, operator=quality, action='check_substitute',
            action_display='核对物料替代', from_status='substitute_pending', to_status='substitute_checked',
            comment='物料替代参数核对完成', version=4
        )
        ExceptionRecord.objects.create(
            order=order4, exception_type='超时逾期', exception_code='OVERDUE',
            description='节点超时，当前处理人：王品质',
            responsible_user=quality, responsible_role='quality_engineer'
        )
        BOMChangeRecord.objects.create(
            order=order4, bom_no='BOM-2025-0178', bom_version='V2.1',
            change_items='1. R101 10K→10.2K\n2. D102 1N4148→BAV21',
            confirmed_by=material_officer, confirmed_at=now - timedelta(days=1, hours=20),
            evidence_url='/static/evidence/bom_001.pdf', remark='BOM变更已确认'
        )
        MaterialSubstituteRecord.objects.create(
            order=order4, substitute_plan='1:1替代，电性参数更优',
            substitute_result='替代料来料检验合格，参数符合要求',
            checked_by=quality, checked_at=now - timedelta(days=1, hours=10),
            evidence_url='/static/evidence/sub_001.pdf', remark='替代核对完成'
        )
        samples.append(('超时逾期-替代核对后逾期', order4))

        order5 = MaterialChangeOrder.objects.create(
            order_no='MCO202506010005',
            title='电感值调整验证',
            change_type='pilot_verify',
            urgency='urgent',
            status='pilot_pending',
            version=5,
            old_material_code='L-10uH-1A',
            old_material_name='功率电感 10uH 1A',
            old_material_spec='CDRH105R 10uH ±20% 1A',
            new_material_code='L-15uH-1A',
            new_material_name='功率电感 15uH 1A',
            new_material_spec='CDRH105R 15uH ±20% 1A',
            bom_reference='BOM-2025-0312',
            product_model='ZX-400D',
            change_reason='电源纹波偏大，增大电感值',
            change_description='电感从10uH增加到15uH，降低输出纹波',
            deadline=now + timedelta(hours=36),
            created_by=registrar,
            current_handler=quality,
            bom_evidence_ready=True,
            substitute_evidence_ready=True,
            pilot_evidence_ready=False,
            submit_time=now - timedelta(days=1),
            warn_status='near_deadline',
        )
        ProcessingRecord.objects.create(
            order=order5, operator=registrar, action='submit',
            action_display='提交', from_status='draft', to_status='bom_pending', version=2
        )
        ProcessingRecord.objects.create(
            order=order5, operator=material_officer, action='confirm_bom',
            action_display='确认BOM变更', from_status='bom_pending', to_status='bom_confirmed', version=3
        )
        ProcessingRecord.objects.create(
            order=order5, operator=quality, action='check_substitute',
            action_display='核对物料替代', from_status='substitute_pending', to_status='substitute_checked', version=4
        )
        BOMChangeRecord.objects.create(
            order=order5, bom_no='BOM-2025-0312', bom_version='V1.3',
            change_items='L201 10uH→15uH',
            confirmed_by=material_officer, confirmed_at=now - timedelta(days=1, hours=18),
            evidence_url='/static/evidence/bom_002.pdf', remark='BOM变更已确认'
        )
        MaterialSubstituteRecord.objects.create(
            order=order5, substitute_plan='电感值增大，同封装',
            substitute_result='物料参数符合替代要求',
            checked_by=quality, checked_at=now - timedelta(days=1, hours=8),
            evidence_url='/static/evidence/sub_002.pdf', remark='替代核对完成'
        )
        samples.append(('临期-待试产验证', order5))

        order6 = MaterialChangeOrder.objects.create(
            order_no='MCO202506010006',
            title='晶振频率更换全流程完成',
            change_type='bom_change',
            urgency='normal',
            status='archived',
            version=10,
            old_material_code='X-8MHz-20ppm',
            old_material_name='无源晶振 8MHz ±20ppm',
            old_material_spec='HC-49S 8MHz 20ppm',
            new_material_code='X-12MHz-10ppm',
            new_material_name='无源晶振 12MHz ±10ppm',
            new_material_spec='HC-49S 12MHz 10ppm',
            bom_reference='BOM-2025-0045',
            product_model='ZX-200A',
            change_reason='升级主控芯片，需要更高频率晶振',
            change_description='8MHz替换为12MHz，提高系统主频',
            deadline=now - timedelta(days=5),
            created_by=registrar,
            current_handler=None,
            bom_evidence_ready=True,
            substitute_evidence_ready=True,
            pilot_evidence_ready=True,
            submit_time=now - timedelta(days=10),
            last_approve_time=now - timedelta(days=3),
            warn_status='normal',
        )
        ProcessingRecord.objects.create(
            order=order6, operator=registrar, action='submit',
            action_display='提交', from_status='draft', to_status='bom_pending', version=2
        )
        ProcessingRecord.objects.create(
            order=order6, operator=material_officer, action='confirm_bom',
            action_display='确认BOM变更', from_status='bom_pending', to_status='bom_confirmed', version=3
        )
        ProcessingRecord.objects.create(
            order=order6, operator=material_officer, action='to_substitute',
            action_display='进入物料替代核对', from_status='bom_confirmed', to_status='substitute_pending', version=4
        )
        ProcessingRecord.objects.create(
            order=order6, operator=quality, action='check_substitute',
            action_display='核对物料替代', from_status='substitute_pending', to_status='substitute_checked', version=5
        )
        ProcessingRecord.objects.create(
            order=order6, operator=quality, action='to_pilot',
            action_display='进入试产验证', from_status='substitute_checked', to_status='pilot_pending', version=6
        )
        ProcessingRecord.objects.create(
            order=order6, operator=quality, action='verify_pilot',
            action_display='完成试产验证', from_status='pilot_pending', to_status='pilot_passed', version=7
        )
        ProcessingRecord.objects.create(
            order=order6, operator=quality, action='to_audit',
            action_display='提交主管审核', from_status='pilot_passed', to_status='audit_pending', version=8
        )
        ProcessingRecord.objects.create(
            order=order6, operator=auditor, action='audit_pass',
            action_display='主管审核通过', from_status='audit_pending', to_status='audit_passed', version=9
        )
        ProcessingRecord.objects.create(
            order=order6, operator=auditor, action='to_pm_review',
            action_display='提交生产经理复核', from_status='audit_passed', to_status='pm_review_pending', version=10
        )
        ProcessingRecord.objects.create(
            order=order6, operator=pm, action='pm_review_pass',
            action_display='生产经理复核通过', from_status='pm_review_pending', to_status='pm_review_passed', version=11
        )
        ProcessingRecord.objects.create(
            order=order6, operator=pm, action='to_factory_review',
            action_display='提交工厂复核', from_status='pm_review_passed', to_status='factory_review_pending', version=12
        )
        ProcessingRecord.objects.create(
            order=order6, operator=factory, action='factory_review_pass',
            action_display='工厂复核归档', from_status='factory_review_pending', to_status='archived', version=13
        )
        BOMChangeRecord.objects.create(
            order=order6, bom_no='BOM-2025-0045', bom_version='V3.0',
            change_items='X101 8MHz→12MHz\nR105 1K→1.2K',
            confirmed_by=material_officer, confirmed_at=now - timedelta(days=9),
            evidence_url='/static/evidence/bom_003.pdf', remark='BOM变更已确认'
        )
        MaterialSubstituteRecord.objects.create(
            order=order6, substitute_plan='晶振频率调整，同封装',
            substitute_result='替代料参数验证合格',
            checked_by=quality, checked_at=now - timedelta(days=7),
            evidence_url='/static/evidence/sub_003.pdf', remark='替代核对完成'
        )
        PilotVerifyRecord.objects.create(
            order=order6, pilot_plan='试产500PCS，测试功能和可靠性',
            pilot_result='试产通过，功能正常，良率99.2%',
            pilot_quantity=500, pass_rate=99.2,
            verified_by=quality, verified_at=now - timedelta(days=5),
            evidence_url='/static/evidence/pilot_003.pdf', remark='试产验证通过'
        )
        samples.append(('正常流转-已归档完成', order6))

        order7 = MaterialChangeOrder.objects.create(
            order_no='MCO202506010007',
            title='MOS管型号替换-主管审核中',
            change_type='material_substitute',
            urgency='urgent',
            status='audit_pending',
            version=7,
            old_material_code='Q-AO3400',
            old_material_name='N沟道MOS管 AO3400',
            old_material_spec='SOT-23 30V 5.8A',
            new_material_code='Q-AO3401',
            new_material_name='N沟道MOS管 AO3401',
            new_material_spec='SOT-23 30V 4.2A',
            bom_reference='BOM-2025-0199',
            product_model='ZX-300B',
            change_reason='原型号缺货，寻找pin to pin替代',
            change_description='电流略有降低，但满足设计余量',
            deadline=now + timedelta(days=2),
            created_by=registrar,
            current_handler=auditor,
            bom_evidence_ready=True,
            substitute_evidence_ready=True,
            pilot_evidence_ready=True,
            submit_time=now - timedelta(days=2),
            warn_status='normal',
        )
        ProcessingRecord.objects.create(
            order=order7, operator=registrar, action='submit',
            action_display='提交', from_status='draft', to_status='bom_pending', version=2
        )
        ProcessingRecord.objects.create(
            order=order7, operator=material_officer, action='confirm_bom',
            action_display='确认BOM变更', from_status='bom_pending', to_status='bom_confirmed', version=3
        )
        ProcessingRecord.objects.create(
            order=order7, operator=quality, action='check_substitute',
            action_display='核对物料替代', from_status='substitute_pending', to_status='substitute_checked', version=4
        )
        ProcessingRecord.objects.create(
            order=order7, operator=quality, action='verify_pilot',
            action_display='完成试产验证', from_status='pilot_pending', to_status='pilot_passed', version=5
        )
        ProcessingRecord.objects.create(
            order=order7, operator=quality, action='to_audit',
            action_display='提交主管审核', from_status='pilot_passed', to_status='audit_pending', version=7
        )
        samples.append(('正常流转-待主管审核', order7))

        order8 = MaterialChangeOrder.objects.create(
            order_no='MCO202506010008',
            title='LED灯珠色温调整-已退回重新提交',
            change_type='bom_change',
            urgency='normal',
            status='resubmitted',
            version=4,
            old_material_code='LED-0603-WW-3000K',
            old_material_name='贴片LED 0603 暖白 3000K',
            old_material_spec='0603 暖白光 3000K',
            new_material_code='LED-0603-NW-4000K',
            new_material_name='贴片LED 0603 自然白 4000K',
            new_material_spec='0603 自然光 4000K',
            bom_reference='BOM-2025-0067',
            product_model='ZX-100A',
            change_reason='客户反馈色温偏黄，调整为自然白',
            change_description='3000K暖白更换为4000K自然白',
            deadline=now + timedelta(days=4),
            created_by=registrar,
            current_handler=registrar,
            bom_evidence_ready=True,
            return_reason='请补充光谱数据和色容差报告',
            correction_reason='已补充光谱测试报告和色容差数据',
            submit_time=now - timedelta(days=2),
        )
        ProcessingRecord.objects.create(
            order=order8, operator=registrar, action='submit',
            action_display='提交', from_status='draft', to_status='bom_pending', version=2
        )
        ProcessingRecord.objects.create(
            order=order8, operator=material_officer, action='return',
            action_display='退回', from_status='bom_pending', to_status='returned',
            comment='请补充光谱数据和色容差报告', version=2
        )
        ProcessingRecord.objects.create(
            order=order8, operator=registrar, action='resubmit',
            action_display='重新提交', from_status='returned', to_status='resubmitted',
            comment='已补充光谱测试报告和色容差数据', version=4
        )
        ExceptionRecord.objects.create(
            order=order8, exception_type='退回补正', exception_code='RETURNED',
            description='从BOM待确认退回，原因：请补充光谱数据和色容差报告',
            responsible_user=registrar, responsible_role='registrar'
        )
        samples.append(('重新提交状态', order8))

        self.stdout.write(f'\n共创建 {len(samples)} 条样例数据：')
        for name, order in samples:
            self.stdout.write(f'  [{order.status_display}] {name} - {order.order_no}')

        self.stdout.write(self.style.SUCCESS('\n演示数据初始化完成！'))
        self.stdout.write(f'演示账号（密码均为 123456）：')
        for u in DEMO_USERS:
            role_display = dict(UserProfile._meta.get_field('role').choices).get(u['role'], u['role'])
            self.stdout.write(f'  {u["username"]} / 123456  -  {u["real_name"]}（{role_display}）')
