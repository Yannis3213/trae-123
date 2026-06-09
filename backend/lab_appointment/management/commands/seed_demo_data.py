from django.core.management.base import BaseCommand
from django.utils import timezone
from datetime import timedelta, date

from lab_appointment.models import (
    User, Role, LabAppointment, OrderStatus, Priority,
    Attachment, ProcessingRecord, AuditNote, ExceptionReason, ExceptionType
)


class Command(BaseCommand):
    help = '初始化演示数据：3类角色用户 + 4类异常测试预约单'

    def handle(self, *args, **options):
        self.stdout.write('=== 清空旧数据 ===')
        ExceptionReason.objects.all().delete()
        AuditNote.objects.all().delete()
        ProcessingRecord.objects.all().delete()
        Attachment.objects.all().delete()
        LabAppointment.objects.all().delete()
        User.objects.all().delete()

        self.stdout.write('=== 创建演示用户 ===')
        ta = User.objects.create(username='ta01', name='王助教', role=Role.TA)
        admin = User.objects.create(username='admin01', name='李管理员', role=Role.ADMIN)
        dean = User.objects.create(username='dean01', name='张院长', role=Role.DEAN)
        self.stdout.write(f'  ✅ 实验助教：{ta.username} / {ta.name}')
        self.stdout.write(f'  ✅ 实验室管理员：{admin.username} / {admin.name}')
        self.stdout.write(f'  ✅ 学院负责人：{dean.username} / {dean.name}')

        now = timezone.now()
        orders = []

        self.stdout.write('=== 1. 正常流转单据（草稿→待复核） ===')
        normal = LabAppointment.objects.create(
            order_no='LAB-NORMAL-001',
            title='有机化学实验-乙酸乙酯合成',
            experiment_name='乙酸乙酯合成实验',
            experiment_room='化学楼A-301',
            experiment_date=date.today() + timedelta(days=3),
            student_count=40,
            course_name='有机化学实验',
            teacher_name='陈教授',
            materials_requested='无水乙醇 500ml, 冰醋酸 500ml, 浓硫酸 100ml, 沸石若干',
            safety_confirmed=True,
            safety_note='已完成安全教育培训，学生已签署安全承诺书',
            priority=Priority.NORMAL,
            status=OrderStatus.PENDING,
            deadline=now + timedelta(days=5),
            owner=ta,
            current_handler=admin,
            version=2,
        )
        Attachment.objects.create(
            order=normal, file_name='安全承诺书.pdf', file_type='pdf',
            evidence_type='safety', description='学生安全承诺书扫描件', uploaded_by=ta
        )
        Attachment.objects.create(
            order=normal, file_name='耗材清单.xlsx', file_type='xlsx',
            evidence_type='material', description='实验耗材申领清单', uploaded_by=ta
        )
        ProcessingRecord.objects.create(
            order=normal, actor=ta, action='创建',
            from_status=OrderStatus.DRAFT, to_status=OrderStatus.DRAFT,
            comment='创建预约单', opinion=''
        )
        ProcessingRecord.objects.create(
            order=normal, actor=ta, action='提交复核',
            from_status=OrderStatus.DRAFT, to_status=OrderStatus.PENDING,
            comment='材料齐全，申请复核', opinion='同意提交'
        )
        AuditNote.objects.create(order=normal, author=ta, content='首次提交，所有材料齐备')
        orders.append(normal)
        self.stdout.write(f'  ✅ {normal.order_no}：{normal.title}')

        self.stdout.write('=== 2. 缺材料异常单据（草稿） ===')
        missing = LabAppointment.objects.create(
            order_no='LAB-MISSING-002',
            title='生物实验-细胞培养',
            experiment_name='细胞培养技术实验',
            experiment_room='生命科学楼B-205',
            experiment_date=date.today() + timedelta(days=5),
            student_count=25,
            course_name='细胞生物学实验',
            teacher_name='刘教授',
            materials_requested='',
            safety_confirmed=False,
            safety_note='',
            priority=Priority.HIGH,
            status=OrderStatus.DRAFT,
            deadline=now + timedelta(days=2),
            owner=ta,
            current_handler=ta,
            version=1,
        )
        ProcessingRecord.objects.create(
            order=missing, actor=ta, action='创建',
            from_status=OrderStatus.DRAFT, to_status=OrderStatus.DRAFT,
            comment='草稿未完成', opinion=''
        )
        ExceptionReason.objects.create(
            order=missing, exception_type=ExceptionType.MATERIAL,
            description='耗材申领清单为空，且未完成安全确认', reporter=ta
        )
        orders.append(missing)
        self.stdout.write(f'  ✅ {missing.order_no}：{missing.title}（缺材料）')

        self.stdout.write('=== 3. 超时逾期异常单据（待复核） ===')
        overdue = LabAppointment.objects.create(
            order_no='LAB-OVERDUE-003',
            title='物理实验-光学干涉测量',
            experiment_name='迈克尔逊干涉仪实验',
            experiment_room='物理楼C-102',
            experiment_date=date.today() - timedelta(days=2),
            student_count=30,
            course_name='大学物理实验',
            teacher_name='赵教授',
            materials_requested='迈克尔逊干涉仪 10台, 激光器 10台, 光学元件若干',
            safety_confirmed=True,
            safety_note='光学实验室安全规范已阅读',
            priority=Priority.URGENT,
            status=OrderStatus.PENDING,
            deadline=now - timedelta(days=1),
            owner=ta,
            current_handler=admin,
            version=3,
        )
        Attachment.objects.create(
            order=overdue, file_name='实验方案.pdf', file_type='pdf',
            evidence_type='plan', description='光学实验详细方案', uploaded_by=ta
        )
        ProcessingRecord.objects.create(
            order=overdue, actor=ta, action='创建',
            from_status=OrderStatus.DRAFT, to_status=OrderStatus.DRAFT, comment='创建', opinion=''
        )
        ProcessingRecord.objects.create(
            order=overdue, actor=ta, action='提交复核',
            from_status=OrderStatus.DRAFT, to_status=OrderStatus.PENDING,
            comment='紧急实验需尽快处理', opinion='加急'
        )
        ExceptionReason.objects.create(
            order=overdue, exception_type=ExceptionType.TIMELIMIT,
            description='预约单已超过截止时间，实验日期已过', reporter=admin
        )
        orders.append(overdue)
        self.stdout.write(f'  ✅ {overdue.order_no}：{overdue.title}（已逾期）')

        self.stdout.write('=== 4. 退回补正/状态冲突单据 ===')
        returned = LabAppointment.objects.create(
            order_no='LAB-RETURNED-004',
            title='材料力学实验-拉伸试验',
            experiment_name='金属材料拉伸试验',
            experiment_room='力学楼D-108',
            experiment_date=date.today() + timedelta(days=7),
            student_count=35,
            course_name='材料力学实验',
            teacher_name='孙教授',
            materials_requested='低碳钢试样 40根, 游标卡尺 20把',
            safety_confirmed=False,
            safety_note='',
            priority=Priority.LOW,
            status=OrderStatus.RETURNED,
            deadline=now + timedelta(hours=20),
            owner=ta,
            current_handler=ta,
            version=4,
        )
        ProcessingRecord.objects.create(
            order=returned, actor=ta, action='创建',
            from_status=OrderStatus.DRAFT, to_status=OrderStatus.DRAFT, comment='创建', opinion=''
        )
        ProcessingRecord.objects.create(
            order=returned, actor=ta, action='提交复核',
            from_status=OrderStatus.DRAFT, to_status=OrderStatus.PENDING,
            comment='提交审核', opinion='请审批'
        )
        ProcessingRecord.objects.create(
            order=returned, actor=admin, action='退回补正',
            from_status=OrderStatus.PENDING, to_status=OrderStatus.RETURNED,
            comment='缺少安全确认，请补全后重新提交', opinion='退回补正'
        )
        ExceptionReason.objects.create(
            order=returned, exception_type=ExceptionType.STATUS,
            description='退回补正：安全确认未完成，需要补充安全材料', reporter=admin
        )
        ExceptionReason.objects.create(
            order=returned, exception_type=ExceptionType.MATERIAL,
            description='安全确认缺失，需上传安全承诺书或勾选安全确认', reporter=admin
        )
        AuditNote.objects.create(order=returned, author=admin, content='退回原因：安全材料缺失')
        orders.append(returned)
        self.stdout.write(f'  ✅ {returned.order_no}：{returned.title}（退回补正）')

        self.stdout.write('=== 5. 已归档参考单据 ===')
        archived = LabAppointment.objects.create(
            order_no='LAB-ARCHIVED-005',
            title='已归档-分析化学滴定实验',
            experiment_name='酸碱滴定实验',
            experiment_room='化学楼A-205',
            experiment_date=date.today() - timedelta(days=10),
            student_count=45,
            course_name='分析化学实验',
            teacher_name='周教授',
            materials_requested='NaOH标准溶液, HCl标准溶液, 酚酞指示剂',
            safety_confirmed=True,
            safety_note='已完成安全培训',
            priority=Priority.NORMAL,
            status=OrderStatus.ARCHIVED,
            deadline=now - timedelta(days=8),
            owner=ta,
            current_handler=None,
            version=5,
        )
        ProcessingRecord.objects.create(
            order=archived, actor=ta, action='创建',
            from_status=OrderStatus.DRAFT, to_status=OrderStatus.DRAFT, comment='创建', opinion=''
        )
        ProcessingRecord.objects.create(
            order=archived, actor=ta, action='提交复核',
            from_status=OrderStatus.DRAFT, to_status=OrderStatus.PENDING, comment='提交', opinion=''
        )
        ProcessingRecord.objects.create(
            order=archived, actor=admin, action='办理中核验',
            from_status=OrderStatus.PENDING, to_status=OrderStatus.PENDING,
            comment='核验通过，材料齐全', opinion='同意'
        )
        ProcessingRecord.objects.create(
            order=archived, actor=dean, action='复核归档',
            from_status=OrderStatus.PENDING, to_status=OrderStatus.ARCHIVED,
            comment='最终审核通过，归档', opinion='同意归档'
        )
        AuditNote.objects.create(order=archived, author=admin, content='材料核验完成')
        AuditNote.objects.create(order=archived, author=dean, content='最终审核通过')
        self.stdout.write(f'  ✅ {archived.order_no}：{archived.title}（已归档）')

        self.stdout.write('')
        self.stdout.write('=== 演示数据初始化完成 ===')
        self.stdout.write(f'共创建 {len(orders) + 1} 张预约单，3 个用户账号。')
        self.stdout.write('登录账号：ta01 / admin01 / dean01（无需密码，直接选择角色登录）')
