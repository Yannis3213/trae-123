from datetime import timedelta
from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
from django.utils import timezone
from apps.assistance.models import (
    UserProfile, AssistanceApplication, Attachment,
    ProcessingRecord, NODE_CHOICES, STATUS_CHOICES
)


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
                ]
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
                ]
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
                'status': 'pending',
                'current_handler': leader,
                'street_clerk': street_clerk,
                'leader': leader,
                'node_deadline_days': -1,
                'attachments': [
                    {'name': '身份证复印件.pdf', 'type': 'identity_proof', 'required': True},
                    {'name': '残疾证.pdf', 'type': 'difficulty_proof', 'required': True},
                    {'name': '走访记录.docx', 'type': 'visit_record', 'required': True},
                    {'name': '现场照片.jpg', 'type': 'photo_evidence', 'required': True},
                    {'name': '审批文件.pdf', 'type': 'approval_document', 'required': True},
                    {'name': '金额计算表.xlsx', 'type': 'amount_calculation', 'required': True},
                ]
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
                ]
            }
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
                    'node_deadline': timezone.now() + timedelta(days=case['node_deadline_days']),
                    'version': 2,
                }
            )

            if created:
                ProcessingRecord.objects.create(
                    application=app,
                    node=case['current_node'],
                    action='create',
                    operator=community_worker,
                    new_status='pending',
                    new_handler=community_worker,
                    version=1,
                    comment=f'演示数据-{case["type"]}'
                )

                ProcessingRecord.objects.create(
                    application=app,
                    node=case['current_node'],
                    action='submit',
                    operator=community_worker,
                    previous_status='pending',
                    new_status=case['status'],
                    previous_handler=community_worker,
                    new_handler=case['current_handler'],
                    version=2,
                    comment=f'演示数据-{case["type"]}'
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

                self.stdout.write(f'Application {app_no} ({case["type"]}) created')
            else:
                self.stdout.write(f'Application {app_no} already exists')

        self.create_additional_test_cases(users, community_worker, street_clerk, leader)

    def create_additional_test_cases(self, users, community_worker, street_clerk, leader):
        additional_cases = [
            {
                'applicant_name': '钱七',
                'applicant_id_card': '110101197505055678',
                'applicant_phone': '13900139005',
                'community': '阳光社区',
                'address': '阳光小区5号楼505室',
                'family_situation': '身患重病，需长期服药治疗，家庭收入微薄',
                'difficulty_type': '重病困难',
                'application_reason': '申请医疗救助',
                'apply_amount': 8000.00,
                'current_node': 'home_verification',
                'status': 'pending',
                'current_handler': leader,
                'street_clerk': street_clerk,
                'node_deadline_days': 4,
                'attachments': [
                    {'name': '身份证.pdf', 'type': 'identity_proof', 'required': True},
                    {'name': '医院诊断证明.pdf', 'type': 'difficulty_proof', 'required': True},
                    {'name': '走访记录.docx', 'type': 'visit_record', 'required': True},
                    {'name': '现场照片.jpg', 'type': 'photo_evidence', 'required': True},
                ]
            },
            {
                'applicant_name': '孙八',
                'applicant_id_card': '110101196506066789',
                'applicant_phone': '13900139006',
                'community': '阳光社区',
                'address': '阳光小区6号楼606室',
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
                ]
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
                    'node_deadline': timezone.now() + timedelta(days=case['node_deadline_days']),
                    'version': 3,
                }
            )

            if created:
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
