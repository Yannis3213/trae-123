from django.db import models
from django.utils import timezone


class Role(models.TextChoices):
    TA = 'TA', '实验助教'
    ADMIN = 'ADMIN', '实验室管理员'
    DEAN = 'DEAN', '学院负责人'


class OrderStatus(models.TextChoices):
    DRAFT = 'DRAFT', '草稿'
    PENDING = 'PENDING', '待复核'
    ARCHIVED = 'ARCHIVED', '已归档'
    RETURNED = 'RETURNED', '退回补正'


class Priority(models.TextChoices):
    LOW = 'LOW', '低'
    NORMAL = 'NORMAL', '中'
    HIGH = 'HIGH', '高'
    URGENT = 'URGENT', '紧急'


class ExceptionType(models.TextChoices):
    MATERIAL = 'MATERIAL', '材料问题'
    PERMISSION = 'PERMISSION', '权限问题'
    TIMELIMIT = 'TIMELIMIT', '时限问题'
    STATUS = 'STATUS', '状态问题'


class User(models.Model):
    username = models.CharField(max_length=50, unique=True)
    name = models.CharField(max_length=50)
    role = models.CharField(max_length=20, choices=Role.choices)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = 'user'

    def __str__(self):
        return f'{self.name}({self.get_role_display()})'


class LabAppointment(models.Model):
    order_no = models.CharField(max_length=50, unique=True)
    title = models.CharField(max_length=200)
    experiment_name = models.CharField(max_length=200)
    experiment_room = models.CharField(max_length=100, default='')
    experiment_date = models.DateField(null=True, blank=True)
    student_count = models.IntegerField(default=0)
    course_name = models.CharField(max_length=200, default='')
    teacher_name = models.CharField(max_length=100, default='')

    materials_requested = models.TextField(default='', blank=True)
    safety_confirmed = models.BooleanField(default=False)
    safety_note = models.TextField(default='', blank=True)

    priority = models.CharField(max_length=20, choices=Priority.choices, default=Priority.NORMAL)
    status = models.CharField(max_length=20, choices=OrderStatus.choices, default=OrderStatus.DRAFT)
    deadline = models.DateTimeField(null=True, blank=True)

    owner = models.ForeignKey(User, on_delete=models.PROTECT, related_name='owned_orders', null=True, blank=True)
    current_handler = models.ForeignKey(User, on_delete=models.PROTECT, related_name='handling_orders', null=True, blank=True)

    version = models.IntegerField(default=1)
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'lab_appointment'
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.order_no} {self.title}'


class Attachment(models.Model):
    order = models.ForeignKey(LabAppointment, on_delete=models.CASCADE, related_name='attachments')
    file_name = models.CharField(max_length=200)
    file_type = models.CharField(max_length=50)
    uploaded_by = models.ForeignKey(User, on_delete=models.PROTECT)
    uploaded_at = models.DateTimeField(default=timezone.now)
    evidence_type = models.CharField(max_length=50, default='')
    description = models.CharField(max_length=200, default='')

    class Meta:
        db_table = 'attachment'


class ProcessingRecord(models.Model):
    order = models.ForeignKey(LabAppointment, on_delete=models.CASCADE, related_name='records')
    actor = models.ForeignKey(User, on_delete=models.PROTECT)
    action = models.CharField(max_length=50)
    from_status = models.CharField(max_length=20, choices=OrderStatus.choices)
    to_status = models.CharField(max_length=20, choices=OrderStatus.choices)
    comment = models.TextField(default='', blank=True)
    opinion = models.TextField(default='', blank=True)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = 'processing_record'


class AuditNote(models.Model):
    order = models.ForeignKey(LabAppointment, on_delete=models.CASCADE, related_name='audit_notes')
    author = models.ForeignKey(User, on_delete=models.PROTECT)
    content = models.TextField()
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = 'audit_note'


class ExceptionReason(models.Model):
    order = models.ForeignKey(LabAppointment, on_delete=models.CASCADE, related_name='exceptions')
    exception_type = models.CharField(max_length=20, choices=ExceptionType.choices)
    description = models.TextField()
    reporter = models.ForeignKey(User, on_delete=models.PROTECT)
    created_at = models.DateTimeField(default=timezone.now)
    resolved = models.BooleanField(default=False)

    class Meta:
        db_table = 'exception_reason'
