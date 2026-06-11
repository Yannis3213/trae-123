from datetime import timedelta
from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
from django.utils import timezone
from apps.assistance.models import (
    UserProfile, AssistanceApplication, Attachment,
    ProcessingRecord, AuditNote, ExceptionLog, NODE_CHOICES, STATUS_CHOICES
)


EVIDENCE_NAMES = {
    'identity_proof': '身份证明',
    'difficulty_proof': '困难证明',
    'visit_record': '走访记录',
    'photo_evidence': '照片证据',
    'approval_document': '审批文件',
    'amount_calculation': '金额计算表',
}


class Command(BaseCommand):
    help = 'Seed demo data for assistance application system'

    def handle(self, *args, **options):
        self.stdout.write('Starting seed data...')

        demo_users = self.create_demo_users()
        self.create_demo_applications(demo_users)

        self.stdout.write(self.style.SUCCESS('Seed data completed successfully!'))

    def create_demo_users(self):
        users = {}

        user_data = [
            {
                'username': 'community_worker',
                'password': 'demo123456',
                'role': 'community_worker',
                'department': '阳光社区居委会',
                'phone': '13800138001'
            },
            {
                'username': 'street_clerk',
                'password': 'demo123456',
                'role': 'street_clerk',
                'department': '街道办事处民政科',
                'phone': '13800138002'
            },
            {
                'username': 'leader',
                'password': 'demo123456',
                'role': 'leader',
                'department': '街道办事处',
                'phone': '13800138003'
            }
        ]

        for data in user_data:
            user, created = User.objects.get_or_create(
                username=data['username'],
                defaults={
                    'first_name': data['role'],
                    'is_active': True
                }
            )
            if created:
                user.set_password(data['password'])
                user.save()

            profile, _ = UserProfile.objects.get_or_create(
                user=user,
                defaults={
                    'role': data['role'],
                    'department': data['department'],
                    'phone': data['phone']
                }
            )
            users[data['role']] = user
            self.stdout.write(f'User {data["username"]} created/verified')

        return users

    def create_demo_applications(self, users):
        community_worker = users['community_worker']
        street_clerk = users['street_clerk']
        leader = users['leader']

        now = timezone.now()

        demo_cases = [
            {
                'type': '正常流转-困难帮扶节点',
                'applicant_name': '张三',
                'applicant_id_card': '110101198001011234',
                'applicant_phone': '13900139001',
                'community': '阳光社区',
                'address': '阳光小区1号楼101室',
                'family_situation': '一家三口，妻子患病，孩子上学，仅申请人打零工维持生计',
                'difficulty_type': '低保边缘',
                'application_reason': '申请临时生活救助',
                'apply_amount': 3000.00,
                'current_node': 'difficulty_support',
                'status': 'pending',
                'current_handler': street_clerk,
                'node_deadline_days': 2,
                'attachments': [
                    {'name': '身份证复印件.pdf', 'type': 'identity_proof', 'required': True},
                    {'name': '低保证明.pdf', 'type': 'difficulty_proof', 'required': True},
                ],
                'records': [
                    {'node': 'difficulty_support', 'action': 'create', 'operator': community_worker,
                     'prev_status': '', 'new_status': 'pending', 'prev_handler': None, 'new_handler': community_worker,
                     'comment': '演示数据-正常流转', 'version': 1, 'time_offset': -180},
                    {'node': 'difficulty_support', 'action': 'submit', 'operator': community_worker,
                     'prev_status': 'pending', 'new_status': 'pending', 'prev_handler': community_worker, 'new_handler': street_clerk,
                     'comment': '演示数据-正常流转-提交申请', 'version': 2, 'time_offset': -170},
                ],
                'audit_notes': [],
                'exception_logs': [],
            },
            {
                'type': '缺材料-入户核实节点',
                'applicant_name': '李四',
                'applicant_id_card': '110101198502022345',
                'applicant_phone': '13900139002',
                'community': '阳光社区',
                'address': '阳光小区2号楼202室',
                'family_situation': '单亲家庭，独自抚养未成年子女，无固定收入',
                'difficulty_type': '单亲困难',
                'application_reason': '申请医疗救助',
                'apply_amount': 5000.00,
                'current_node': 'home_verification',
                'status': 'accepted',
                'current_handler': street_clerk,
                'street_clerk': street_clerk,
                'node_deadline_days': 3,
                'attachments': [
                    {'name': '身份证复印件.pdf', 'type': 'identity_proof', 'required': True},
                    {'name': '困难证明.pdf', 'type': 'difficulty_proof', 'required': True},
                ],
                'records': [
                    {'node': 'difficulty_support', 'action': 'create', 'operator': community_worker,
                     'prev_status': '', 'new_status': 'pending', 'prev_handler': None, 'new_handler': community_worker,
                     'comment': '演示数据-缺材料', 'version': 1, 'time_offset': -300},
                    {'node': 'difficulty_support', 'action': 'submit', 'operator': community_worker,
                     'prev_status': 'pending', 'new_status': 'pending', 'prev_handler': community_worker, 'new_handler': street_clerk,
                     'comment': '提交申请', 'version': 2, 'time_offset': -290},
                    {'node': 'difficulty_support', 'action': 'accept', 'operator': street_clerk,
                     'prev_status': 'pending', 'new_status': 'accepted', 'prev_handler': street_clerk, 'new_handler': street_clerk,
                     'comment': '接单处理', 'version': 3, 'time_offset': -280},
                    {'node': 'difficulty_support', 'action': 'process', 'operator': street_clerk,
                     'prev_status': 'accepted', 'new_status': 'pending', 'prev_handler': street_clerk, 'new_handler': street_clerk,
                     'comment': '材料齐全，流转到入户核实', 'version': 4, 'time_offset': -270},
                    {'node': 'home_verification', 'action': 'accept', 'operator': street_clerk,
                     'prev_status': 'pending', 'new_status': 'accepted', 'prev_handler': street_clerk, 'new_handler': street_clerk,
                     'comment': '接单开始入户核实', 'version': 5, 'time_offset': -260},
                ],
                'audit_notes': [
                    {'note_type': 'evidence_requirement', 'content': '需补充材料：走访记录、照片证据',
                     'operator': street_clerk, 'time_offset': -260},
                ],
                'exception_logs': [],
            },
            {
                'type': '超时逾期-救助确认节点',
                'applicant_name': '王五',
                'applicant_id_card': '110101197003033456',
                'applicant_phone': '13900139003',
                'community': '阳光社区',
                'address': '阳光小区3号楼303室',
                'family_situation': '孤寡老人，无子女，肢体残疾二级',
                'difficulty_type': '残疾人',
                'application_reason': '申请护理补贴',
                'apply_amount': 2000.00,
                'current_node': 'rescue_confirmation',
                'status': 'accepted',
                'current_handler': leader,
                'street_clerk': street_clerk,
                'leader': leader,
                'node_deadline_days': -2,
                'attachments': [
                    {'name': '身份证复印件.pdf', 'type': 'identity_proof', 'required': True},
                    {'name': '残疾证.pdf', 'type': 'difficulty_proof', 'required': True},
                    {'name': '走访记录.docx', 'type': 'visit_record', 'required': True},
                    {'name': '现场照片.jpg', 'type': 'photo_evidence', 'required': True},
                    {'name': '审批文件.pdf', 'type': 'approval_document', 'required': True},
                    {'name': '金额计算表.xlsx', 'type': 'amount_calculation', 'required': True},
                ],
                'records': [
                    {'node': 'difficulty_support', 'action': 'create', 'operator': community_worker,
                     'prev_status': '', 'new_status': 'pending', 'prev_handler': None, 'new_handler': community_worker,
                     'comment': '演示数据-逾期场景', 'version': 1, 'time_offset': -720},
                    {'node': 'difficulty_support', 'action': 'submit', 'operator': community_worker,
                     'prev_status': 'pending', 'new_status': 'pending', 'prev_handler': community_worker, 'new_handler': street_clerk,
                     'comment': '提交申请', 'version': 2, 'time_offset': -710},
                    {'node': 'difficulty_support', 'action': 'accept', 'operator': street_clerk,
                     'prev_status': 'pending', 'new_status': 'accepted', 'prev_handler': street_clerk, 'new_handler': street_clerk,
                     'comment': '接单', 'version': 3, 'time_offset': -700},
                    {'node': 'difficulty_support', 'action': 'process', 'operator': street_clerk,
                     'prev_status': 'accepted', 'new_status': 'pending', 'prev_handler': street_clerk, 'new_handler': street_clerk,
                     'comment': '流转到入户核实', 'version': 4, 'time_offset': -690},
                    {'node': 'home_verification', 'action': 'accept', 'operator': street_clerk,
                     'prev_status': 'pending', 'new_status': 'accepted', 'prev_handler': street_clerk, 'new_handler': street_clerk,
                     'comment': '接单入户核实', 'version': 5, 'time_offset': -680},
                    {'node': 'home_verification', 'action': 'verify', 'operator': street_clerk,
                     'prev_status': 'accepted', 'new_status': 'pending', 'prev_handler': street_clerk, 'new_handler': leader,
                     'comment': '核实完毕，流转到救助确认', 'version': 6, 'time_offset': -670},
                    {'node': 'rescue_confirmation', 'action': 'accept', 'operator': leader,
                     'prev_status': 'pending', 'new_status': 'accepted', 'prev_handler': leader, 'new_handler': leader,
                     'comment': '接单审批', 'version': 7, 'time_offset': -660},
                ],
                'audit_notes': [
                    {'note_type': 'overdue_notice', 'content': '该申请已逾期，分管领导应尽快处理或退回补正',
                     'operator': leader, 'time_offset': -48},
                ],
                'exception_logs': [
                    {'exception_type': 'overdue', 'error_code': 'OVERDUE_BLOCKED',
                     'error_message': '该申请已逾期，不可直接审批，请先退回补正或联系负责人处理',
                     'operator': leader, 'request_data': '{"action":"approve"}', 'time_offset': -24},
                ],
            },
            {
                'type': '退回补正-困难帮扶节点',
                'applicant_name': '赵六',
                'applicant_id_card': '110101199004044567',
                'applicant_phone': '13900139004',
                'community': '阳光社区',
                'address': '阳光小区4号楼404室',
                'family_situation': '失业人员，父母年迈多病，家庭负担重',
                'difficulty_type': '失业困难',
                'application_reason': '申请就业帮扶',
                'apply_amount': 1500.00,
                'current_node': 'difficulty_support',
                'status': 'returned',
                'current_handler': community_worker,
                'node_deadline_days': 5,
                'attachments': [
                    {'name': '身份证复印件.pdf', 'type': 'identity_proof', 'required': True},
                ],
                'records': [
                    {'node': 'difficulty_support', 'action': 'create', 'operator': community_worker,
                     'prev_status': '', 'new_status': 'pending', 'prev_handler': None, 'new_handler': community_worker,
                     'comment': '演示数据-退回补正', 'version': 1, 'time_offset': -200},
                    {'node': 'difficulty_support', 'action': 'submit', 'operator': community_worker,
                     'prev_status': 'pending', 'new_status': 'pending', 'prev_handler': community_worker, 'new_handler': street_clerk,
                     'comment': '提交申请', 'version': 2, 'time_offset': -190},
                    {'node': 'difficulty_support', 'action': 'accept', 'operator': street_clerk,
                     'prev_status': 'pending', 'new_status': 'accepted', 'prev_handler': street_clerk, 'new_handler': street_clerk,
                     'comment': '接单', 'version': 3, 'time_offset': -180},
                    {'node': 'difficulty_support', 'action': 'return', 'operator': street_clerk,
                     'prev_status': 'accepted', 'new_status': 'returned', 'prev_handler': street_clerk, 'new_handler': community_worker,
                     'comment': '缺少困难证明材料，退回补正', 'version': 4, 'time_offset': -170},
                ],
                'audit_notes': [
                    {'note_type': 'return_reason', 'content': '退回补正原因：缺少困难证明材料，退回补正',
                     'operator': street_clerk, 'time_offset': -170},
                    {'note_type': 'evidence_requirement', 'content': '需补充材料：困难证明',
                     'operator': street_clerk, 'time_offset': -170},
                ],
                'exception_logs': [],
            },
        ]

        for idx, case in enumerate(demo_cases, 1):
            app_no = f'BZDEMO{idx:04d}'

            app, created = AssistanceApplication.objects.get_or_create(
                application_no=app_no,
                defaults={
                    'applicant_name': case['applicant_name'],
                    'applicant_id_card': case['applicant_id_card'],
                    'applicant_phone': case['applicant_phone'],
                    'community': case['community'],
                    'address': case['address'],
                    'family_situation': case['family_situation'],
                    'difficulty_type': case['difficulty_type'],
                    'application_reason': case['application_reason'],
                    'apply_amount': case['apply_amount'],
                    'current_node': case['current_node'],
                    'status': case['status'],
                    'creator': community_worker,
                    'current_handler': case['current_handler'],
                    'street_clerk': case.get('street_clerk'),
                    'leader': case.get('leader'),
                    'node_deadline': now + timedelta(days=case['node_deadline_days']),
                    'warning_status': 'overdue' if case['node_deadline_days'] < 0 else
                                      ('approaching' if case['node_deadline_days'] <= 1 else 'normal'),
                    'version': case['records'][-1]['version'] if case.get('records') else 2,
                }
            )

            if created:
                for rec_data in case.get('records', []):
                    ProcessingRecord.objects.create(
                        application=app,
                        node=rec_data['node'],
                        action=rec_data['action'],
                        operator=rec_data['operator'],
                        previous_status=rec_data.get('prev_status', ''),
                        new_status=rec_data['new_status'],
                        previous_handler=rec_data.get('prev_handler'),
                        new_handler=rec_data.get('new_handler'),
                        comment=rec_data.get('comment', ''),
                        version=rec_data['version'],
                        processing_time=now + timedelta(minutes=rec_data.get('time_offset', 0)),
                    )

                for att_data in case['attachments']:
                    Attachment.objects.create(
                        application=app,
                        file_name=att_data['name'],
                        file_type='application/pdf',
                        file_path=f'/uploads/{app_no}/{att_data["name"]}',
                        file_size=1024 * 100,
                        uploaded_by=community_worker,
                        evidence_type=att_data['type'],
                        is_required=att_data['required']
                    )

                for note_data in case.get('audit_notes', []):
                    AuditNote.objects.create(
                        application=app,
                        node=app.current_node,
                        note_type=note_data['note_type'],
                        content=note_data['content'],
                        operator=note_data['operator'],
                        created_at=now + timedelta(minutes=note_data.get('time_offset', 0)),
                    )

                for exc_data in case.get('exception_logs', []):
                    ExceptionLog.objects.create(
                        application=app,
                        exception_type=exc_data['exception_type'],
                        error_code=exc_data['error_code'],
                        error_message=exc_data['error_message'],
                        operator=exc_data['operator'],
                        request_data=exc_data.get('request_data', ''),
                        resolved=False,
                        created_at=now + timedelta(minutes=exc_data.get('time_offset', 0)),
                    )

                self.stdout.write(f'Application {app_no} ({case["type"]}) created')
            else:
                self.stdout.write(f'Application {app_no} already exists')

        self.create_additional_test_cases(users, community_worker, street_clerk, leader)

    def create_additional_test_cases(self, users, community_worker, street_clerk, leader):
        now = timezone.now()

        additional_cases = [
            {
                'applicant_name': '钱七',
                'applicant_id_card': '110101197505055678',
                'applicant_phone': '13900139005',
                'community': '幸福社区',
                'address': '幸福小区5号楼505室',
                'family_situation': '身患重病，需长期服药治疗，家庭收入微薄',
                'difficulty_type': '重病困难',
                'application_reason': '申请医疗救助',
                'apply_amount': 8000.00,
                'current_node': 'home_verification',
                'status': 'pending',
                'current_handler': street_clerk,
                'street_clerk': street_clerk,
                'node_deadline_days': 4,
                'attachments': [
                    {'name': '身份证.pdf', 'type': 'identity_proof', 'required': True},
                    {'name': '医院诊断证明.pdf', 'type': 'difficulty_proof', 'required': True},
                    {'name': '走访记录.docx', 'type': 'visit_record', 'required': True},
                    {'name': '现场照片.jpg', 'type': 'photo_evidence', 'required': True},
                ],
                'records': [
                    {'node': 'difficulty_support', 'action': 'create', 'operator': community_worker,
                     'prev_status': '', 'new_status': 'pending', 'prev_handler': None, 'new_handler': community_worker,
                     'comment': '新建申请', 'version': 1, 'time_offset': -150},
                    {'node': 'difficulty_support', 'action': 'submit', 'operator': community_worker,
                     'prev_status': 'pending', 'new_status': 'pending', 'prev_handler': community_worker, 'new_handler': street_clerk,
                     'comment': '提交', 'version': 2, 'time_offset': -140},
                    {'node': 'difficulty_support', 'action': 'accept', 'operator': street_clerk,
                     'prev_status': 'pending', 'new_status': 'accepted', 'prev_handler': street_clerk, 'new_handler': street_clerk,
                     'comment': '接单', 'version': 3, 'time_offset': -130},
                    {'node': 'difficulty_support', 'action': 'process', 'operator': street_clerk,
                     'prev_status': 'accepted', 'new_status': 'pending', 'prev_handler': street_clerk, 'new_handler': street_clerk,
                     'comment': '流转到入户核实', 'version': 4, 'time_offset': -120},
                ],
            },
            {
                'applicant_name': '孙八',
                'applicant_id_card': '110101196506066789',
                'applicant_phone': '13900139006',
                'community': '和平社区',
                'address': '和平小区6号楼606室',
                'family_situation': '退休人员，老伴瘫痪在床，需要专人护理',
                'difficulty_type': '老年人',
                'application_reason': '申请护理补贴',
                'apply_amount': 2500.00,
                'current_node': 'difficulty_support',
                'status': 'accepted',
                'current_handler': street_clerk,
                'street_clerk': street_clerk,
                'node_deadline_days': 1,
                'attachments': [
                    {'name': '身份证.pdf', 'type': 'identity_proof', 'required': True},
                    {'name': '退休证.pdf', 'type': 'difficulty_proof', 'required': True},
                ],
                'records': [
                    {'node': 'difficulty_support', 'action': 'create', 'operator': community_worker,
                     'prev_status': '', 'new_status': 'pending', 'prev_handler': None, 'new_handler': community_worker,
                     'comment': '新建申请', 'version': 1, 'time_offset': -60},
                    {'node': 'difficulty_support', 'action': 'submit', 'operator': community_worker,
                     'prev_status': 'pending', 'new_status': 'pending', 'prev_handler': community_worker, 'new_handler': street_clerk,
                     'comment': '提交', 'version': 2, 'time_offset': -55},
                    {'node': 'difficulty_support', 'action': 'accept', 'operator': street_clerk,
                     'prev_status': 'pending', 'new_status': 'accepted', 'prev_handler': street_clerk, 'new_handler': street_clerk,
                     'comment': '接单处理中', 'version': 3, 'time_offset': -50},
                ],
            },
        ]

        for idx, case in enumerate(additional_cases, 5):
            app_no = f'BZDEMO{idx:04d}'
            app, created = AssistanceApplication.objects.get_or_create(
                application_no=app_no,
                defaults={
                    'applicant_name': case['applicant_name'],
                    'applicant_id_card': case['applicant_id_card'],
                    'applicant_phone': case['applicant_phone'],
                    'community': case['community'],
                    'address': case['address'],
                    'family_situation': case['family_situation'],
                    'difficulty_type': case['difficulty_type'],
                    'application_reason': case['application_reason'],
                    'apply_amount': case['apply_amount'],
                    'current_node': case['current_node'],
                    'status': case['status'],
                    'creator': community_worker,
                    'current_handler': case['current_handler'],
                    'street_clerk': case.get('street_clerk'),
                    'leader': case.get('leader'),
                    'node_deadline': now + timedelta(days=case['node_deadline_days']),
                    'warning_status': 'approaching' if case['node_deadline_days'] <= 1 else 'normal',
                    'version': case['records'][-1]['version'] if case.get('records') else 3,
                }
            )

            if created:
                for rec_data in case.get('records', []):
                    ProcessingRecord.objects.create(
                        application=app,
                        node=rec_data['node'],
                        action=rec_data['action'],
                        operator=rec_data['operator'],
                        previous_status=rec_data.get('prev_status', ''),
                        new_status=rec_data['new_status'],
                        previous_handler=rec_data.get('prev_handler'),
                        new_handler=rec_data.get('new_handler'),
                        comment=rec_data.get('comment', ''),
                        version=rec_data['version'],
                        processing_time=now + timedelta(minutes=rec_data.get('time_offset', 0)),
                    )

                for att_data in case['attachments']:
                    Attachment.objects.create(
                        application=app,
                        file_name=att_data['name'],
                        file_type='application/pdf',
                        file_path=f'/uploads/{app_no}/{att_data["name"]}',
                        file_size=1024 * 100,
                        uploaded_by=community_worker,
                        evidence_type=att_data['type'],
                        is_required=att_data['required']
                    )
                self.stdout.write(f'Application {app_no} created')
