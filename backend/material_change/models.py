from django.db import models
from django.contrib.auth.models import User
from django.utils import timezone


ROLE_CHOICES = [
    ('registrar', '物料变更登记员'),
    ('material_officer', '物料员'),
    ('quality_engineer', '品质工程师'),
    ('auditor', '物料变更审核主管'),
    ('production_manager', '生产经理'),
    ('factory_reviewer', '电子元器件工厂复核负责人'),
]

STATUS_CHOICES = [
    ('draft', '待提交'),
    ('returned', '已退回'),
    ('resubmitted', '重新提交'),
    ('bom_pending', 'BOM待确认'),
    ('bom_confirmed', 'BOM已确认'),
    ('substitute_pending', '替代待核对'),
    ('substitute_checked', '替代已核对'),
    ('pilot_pending', '待试产验证'),
    ('pilot_passed', '试产已通过'),
    ('audit_pending', '待主管审核'),
    ('audit_passed', '主管审核通过'),
    ('pm_review_pending', '待生产经理复核'),
    ('pm_review_passed', '生产经理复核通过'),
    ('factory_review_pending', '待工厂复核'),
    ('archived', '已归档'),
]

CHANGE_TYPE_CHOICES = [
    ('bom_change', 'BOM变更'),
    ('material_substitute', '物料替代'),
    ('pilot_verify', '试产验证'),
]

URGENCY_CHOICES = [
    ('normal', '正常'),
    ('urgent', '紧急'),
    ('critical', '特急'),
]

WARN_STATUS_CHOICES = [
    ('normal', '正常'),
    ('near_deadline', '临期'),
    ('overdue', '逾期'),
]


class UserProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')
    role = models.CharField(max_length=32, choices=ROLE_CHOICES)
    real_name = models.CharField(max_length=64)
    department = models.CharField(max_length=64, blank=True, default='')
    phone = models.CharField(max_length=32, blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'user_profile'

    def __str__(self):
        return f'{self.real_name}({self.get_role_display()})'


class MaterialChangeOrder(models.Model):
    order_no = models.CharField(max_length=32, unique=True, db_index=True)
    title = models.CharField(max_length=256)
    change_type = models.CharField(max_length=32, choices=CHANGE_TYPE_CHOICES, default='bom_change')
    urgency = models.CharField(max_length=16, choices=URGENCY_CHOICES, default='normal')
    status = models.CharField(max_length=32, choices=STATUS_CHOICES, default='draft')
    version = models.IntegerField(default=1)

    old_material_code = models.CharField(max_length=128)
    old_material_name = models.CharField(max_length=256)
    old_material_spec = models.CharField(max_length=512, blank=True, default='')
    new_material_code = models.CharField(max_length=128, blank=True, default='')
    new_material_name = models.CharField(max_length=256, blank=True, default='')
    new_material_spec = models.CharField(max_length=512, blank=True, default='')

    bom_reference = models.CharField(max_length=256, blank=True, default='')
    product_model = models.CharField(max_length=128, blank=True, default='')

    change_reason = models.TextField(blank=True, default='')
    change_description = models.TextField(blank=True, default='')

    current_handler = models.ForeignKey(
        UserProfile,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='handling_orders'
    )
    created_by = models.ForeignKey(
        UserProfile,
        on_delete=models.SET_NULL,
        null=True,
        related_name='created_orders'
    )

    submit_time = models.DateTimeField(null=True, blank=True)
    deadline = models.DateTimeField(null=True, blank=True)
    last_approve_time = models.DateTimeField(null=True, blank=True)

    bom_evidence_ready = models.BooleanField(default=False)
    substitute_evidence_ready = models.BooleanField(default=False)
    pilot_evidence_ready = models.BooleanField(default=False)

    return_reason = models.TextField(blank=True, default='')
    correction_reason = models.TextField(blank=True, default='')

    warn_status = models.CharField(max_length=16, choices=WARN_STATUS_CHOICES, default='normal')

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'material_change_order'
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.order_no} - {self.title}'

    def update_warn_status(self):
        if not self.deadline or self.status in ['archived', 'draft', 'returned']:
            self.warn_status = 'normal'
            return
        now = timezone.now()
        remaining = self.deadline - now
        total_seconds = remaining.total_seconds()
        if total_seconds < 0:
            self.warn_status = 'overdue'
        elif total_seconds < 24 * 3600:
            self.warn_status = 'near_deadline'
        else:
            self.warn_status = 'normal'


class Attachment(models.Model):
    order = models.ForeignKey(MaterialChangeOrder, on_delete=models.CASCADE, related_name='attachments')
    file_name = models.CharField(max_length=256)
    file_url = models.CharField(max_length=512)
    file_type = models.CharField(max_length=64, blank=True, default='')
    file_size = models.IntegerField(default=0)
    category = models.CharField(max_length=32, blank=True, default='')
    uploaded_by = models.ForeignKey(UserProfile, on_delete=models.SET_NULL, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'attachment'
        ordering = ['-created_at']


class ProcessingRecord(models.Model):
    order = models.ForeignKey(MaterialChangeOrder, on_delete=models.CASCADE, related_name='processing_records')
    operator = models.ForeignKey(UserProfile, on_delete=models.SET_NULL, null=True)
    action = models.CharField(max_length=64)
    action_display = models.CharField(max_length=128)
    from_status = models.CharField(max_length=32, blank=True, default='')
    to_status = models.CharField(max_length=32, blank=True, default='')
    comment = models.TextField(blank=True, default='')
    version = models.IntegerField(default=1)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'processing_record'
        ordering = ['-created_at']


class AuditRemark(models.Model):
    order = models.ForeignKey(MaterialChangeOrder, on_delete=models.CASCADE, related_name='audit_remarks')
    operator = models.ForeignKey(UserProfile, on_delete=models.SET_NULL, null=True)
    content = models.TextField()
    remark_type = models.CharField(max_length=32, default='general')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'audit_remark'
        ordering = ['-created_at']


class ExceptionRecord(models.Model):
    order = models.ForeignKey(MaterialChangeOrder, on_delete=models.CASCADE, related_name='exception_records')
    exception_type = models.CharField(max_length=64)
    exception_code = models.CharField(max_length=32)
    description = models.TextField()
    responsible_role = models.CharField(max_length=32, blank=True, default='')
    responsible_user = models.ForeignKey(UserProfile, on_delete=models.SET_NULL, null=True, related_name='+')
    resolved = models.BooleanField(default=False)
    resolved_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'exception_record'
        ordering = ['-created_at']


class BOMChangeRecord(models.Model):
    order = models.ForeignKey(MaterialChangeOrder, on_delete=models.CASCADE, related_name='bom_change_records')
    bom_no = models.CharField(max_length=128)
    bom_version = models.CharField(max_length=32, blank=True, default='')
    change_items = models.TextField(blank=True, default='')
    confirmed_by = models.ForeignKey(UserProfile, on_delete=models.SET_NULL, null=True, related_name='+')
    confirmed_at = models.DateTimeField(null=True, blank=True)
    evidence_url = models.CharField(max_length=512, blank=True, default='')
    remark = models.TextField(blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'bom_change_record'


class MaterialSubstituteRecord(models.Model):
    order = models.ForeignKey(MaterialChangeOrder, on_delete=models.CASCADE, related_name='substitute_records')
    substitute_plan = models.TextField(blank=True, default='')
    substitute_result = models.TextField(blank=True, default='')
    checked_by = models.ForeignKey(UserProfile, on_delete=models.SET_NULL, null=True, related_name='+')
    checked_at = models.DateTimeField(null=True, blank=True)
    evidence_url = models.CharField(max_length=512, blank=True, default='')
    remark = models.TextField(blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'material_substitute_record'


class PilotVerifyRecord(models.Model):
    order = models.ForeignKey(MaterialChangeOrder, on_delete=models.CASCADE, related_name='pilot_records')
    pilot_plan = models.TextField(blank=True, default='')
    pilot_result = models.TextField(blank=True, default='')
    pilot_quantity = models.IntegerField(default=0)
    pass_rate = models.FloatField(default=0.0)
    verified_by = models.ForeignKey(UserProfile, on_delete=models.SET_NULL, null=True, related_name='+')
    verified_at = models.DateTimeField(null=True, blank=True)
    evidence_url = models.CharField(max_length=512, blank=True, default='')
    remark = models.TextField(blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'pilot_verify_record'
