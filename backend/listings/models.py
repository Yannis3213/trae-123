from django.db import models
from django.utils import timezone
from datetime import timedelta


class RoleChoices(models.TextChoices):
    CONSULTANT = 'CONSULTANT', '车源顾问'
    EVALUATOR = 'EVALUATOR', '评估师'
    MANAGER = 'MANAGER', '门店经理'


class ApplicationStatus(models.TextChoices):
    DRAFT = 'DRAFT', '草稿'
    PENDING_SUPPLEMENT = 'PENDING_SUPPLEMENT', '待补正'
    PENDING_PROCESS = 'PENDING_PROCESS', '待处理'
    PROCESSING = 'PROCESSING', '处理中'
    UNDER_REVIEW = 'UNDER_REVIEW', '复核中'
    COMPLETED = 'COMPLETED', '办结'
    RETURNED = 'RETURNED', '退回补正'


STATUS_LABEL_MAP = {
    ApplicationStatus.DRAFT: '待补正',
    ApplicationStatus.PENDING_SUPPLEMENT: '待补正',
    ApplicationStatus.RETURNED: '待补正',
    ApplicationStatus.PENDING_PROCESS: '待补正',
    ApplicationStatus.PROCESSING: '复核中',
    ApplicationStatus.UNDER_REVIEW: '复核中',
    ApplicationStatus.COMPLETED: '办结',
}

ROLE_DISPLAY_MAP = {
    RoleChoices.CONSULTANT: '车源顾问',
    RoleChoices.EVALUATOR: '评估师',
    RoleChoices.MANAGER: '门店经理',
}


class Operator(models.Model):
    id = models.AutoField(primary_key=True)
    username = models.CharField(max_length=50, unique=True)
    display_name = models.CharField(max_length=50)
    role = models.CharField(max_length=20, choices=RoleChoices.choices)
    store_name = models.CharField(max_length=100, default='')

    class Meta:
        verbose_name = '操作人'
        verbose_name_plural = '操作人'

    def __str__(self):
        return f'{self.display_name}({self.get_role_display()})'


class VehicleListingApplication(models.Model):
    id = models.AutoField(primary_key=True)
    application_no = models.CharField(max_length=32, unique=True)
    brand = models.CharField(max_length=50)
    model_name = models.CharField(max_length=50)
    year = models.IntegerField()
    vin = models.CharField(max_length=17)
    license_plate = models.CharField(max_length=20)
    mileage = models.IntegerField()
    status = models.CharField(
        max_length=30,
        choices=ApplicationStatus.choices,
        default=ApplicationStatus.DRAFT,
    )
    version = models.IntegerField(default=1)
    applicant = models.ForeignKey(
        Operator,
        on_delete=models.PROTECT,
        related_name='applications',
    )
    evaluator = models.ForeignKey(
        Operator,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='evaluated',
    )
    reviewer = models.ForeignKey(
        Operator,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='reviewed',
    )
    store_name = models.CharField(max_length=100)
    has_listing_evidence = models.BooleanField(default=False)
    missing_evidence_reason = models.TextField(blank=True, default='')
    supplement_remark = models.TextField(blank=True, default='')
    evaluation_result = models.TextField(blank=True, default='')
    review_result = models.TextField(blank=True, default='')
    reject_reason = models.TextField(blank=True, default='')
    deadline = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = '车源上架单'
        verbose_name_plural = '车源上架单'
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.application_no} - {self.brand} {self.model_name}'

    @property
    def page_label(self):
        return STATUS_LABEL_MAP.get(self.status, '未知')

    @property
    def expiry_status(self):
        if self.deadline is None:
            return 'normal'
        now = timezone.now()
        if now > self.deadline:
            return 'overdue'
        if now >= self.deadline - timedelta(days=3):
            return 'near_expiry'
        return 'normal'

    @property
    def responsible_person(self):
        status_person_map = {
            ApplicationStatus.DRAFT: self.applicant,
            ApplicationStatus.PENDING_SUPPLEMENT: self.applicant,
            ApplicationStatus.PENDING_PROCESS: self.evaluator,
            ApplicationStatus.PROCESSING: self.evaluator,
            ApplicationStatus.UNDER_REVIEW: self.reviewer,
            ApplicationStatus.COMPLETED: self.reviewer,
            ApplicationStatus.RETURNED: self.applicant,
        }
        return status_person_map.get(self.status)


class Attachment(models.Model):
    id = models.AutoField(primary_key=True)
    application = models.ForeignKey(
        VehicleListingApplication,
        on_delete=models.CASCADE,
        related_name='attachments',
    )
    file_name = models.CharField(max_length=255)
    file_type = models.CharField(max_length=50)
    uploaded_by = models.ForeignKey(
        Operator,
        on_delete=models.PROTECT,
    )
    uploaded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = '附件'
        verbose_name_plural = '附件'

    def __str__(self):
        return f'{self.file_name}({self.file_type})'


class ProcessingRecord(models.Model):
    id = models.AutoField(primary_key=True)
    application = models.ForeignKey(
        VehicleListingApplication,
        on_delete=models.CASCADE,
        related_name='processing_records',
    )
    operator = models.ForeignKey(
        Operator,
        on_delete=models.PROTECT,
    )
    operator_role = models.CharField(max_length=20)
    action = models.CharField(max_length=50)
    from_status = models.CharField(max_length=30)
    to_status = models.CharField(max_length=30)
    remark = models.TextField(blank=True, default='')
    failure_reason = models.TextField(blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = '处理记录'
        verbose_name_plural = '处理记录'
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.application.application_no} - {self.action}'


class AuditNote(models.Model):
    id = models.AutoField(primary_key=True)
    application = models.ForeignKey(
        VehicleListingApplication,
        on_delete=models.CASCADE,
        related_name='audit_notes',
    )
    operator = models.ForeignKey(
        Operator,
        on_delete=models.PROTECT,
    )
    operator_role = models.CharField(max_length=20)
    note = models.TextField()
    failure_reason = models.TextField(blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = '审计备注'
        verbose_name_plural = '审计备注'
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.application.application_no} - {self.note[:30]}'
