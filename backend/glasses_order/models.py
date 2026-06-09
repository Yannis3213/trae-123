from django.db import models
from django.contrib.auth.models import User
from django.utils import timezone


class UserProfile(models.Model):
    ROLE_OPTOMETRIST = 'optometrist'
    ROLE_OPHTHALMOLOGIST = 'ophthalmologist'
    ROLE_OPERATIONS_MANAGER = 'operations_manager'

    ROLE_CHOICES = [
        (ROLE_OPTOMETRIST, '验光师'),
        (ROLE_OPHTHALMOLOGIST, '眼科医生'),
        (ROLE_OPERATIONS_MANAGER, '运营主管'),
    ]

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')
    role = models.CharField(max_length=50, choices=ROLE_CHOICES)
    real_name = models.CharField(max_length=100)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'user_profile'

    def __str__(self):
        return f'{self.real_name} - {self.get_role_display()}'


class GlassesOrder(models.Model):
    STATUS_PENDING_REVIEW = 'pending_review'
    STATUS_REVIEW_APPROVED = 'review_approved'
    STATUS_SYNCED = 'synced'
    STATUS_RETURNED_FOR_CORRECTION = 'returned_for_correction'

    STATUS_CHOICES = [
        (STATUS_PENDING_REVIEW, '待审核'),
        (STATUS_REVIEW_APPROVED, '审核通过'),
        (STATUS_SYNCED, '已同步'),
        (STATUS_RETURNED_FOR_CORRECTION, '退回补正'),
    ]

    URGENCY_NORMAL = 'normal'
    URGENCY_WARNING = 'warning'
    URGENCY_OVERDUE = 'overdue'

    order_no = models.CharField(max_length=50, unique=True)
    customer_name = models.CharField(max_length=100)
    customer_phone = models.CharField(max_length=20)
    business_area = models.CharField(max_length=100, verbose_name='业务区')

    status = models.CharField(max_length=50, choices=STATUS_CHOICES, default=STATUS_PENDING_REVIEW)
    version = models.IntegerField(default=1)

    submitted_by = models.ForeignKey(User, on_delete=models.PROTECT, related_name='submitted_orders', null=True, blank=True)
    current_handler = models.ForeignKey(User, on_delete=models.PROTECT, related_name='handling_orders', null=True, blank=True)
    reviewed_by = models.ForeignKey(User, on_delete=models.PROTECT, related_name='reviewed_orders', null=True, blank=True)
    synced_by = models.ForeignKey(User, on_delete=models.PROTECT, related_name='synced_orders', null=True, blank=True)

    submitted_at = models.DateTimeField(null=True, blank=True)
    review_due_at = models.DateTimeField(null=True, blank=True)
    sync_due_at = models.DateTimeField(null=True, blank=True)
    reviewed_at = models.DateTimeField(null=True, blank=True)
    synced_at = models.DateTimeField(null=True, blank=True)

    last_opinion = models.TextField(blank=True, default='')
    last_operator = models.ForeignKey(User, on_delete=models.PROTECT, related_name='last_operated_orders', null=True, blank=True)

    has_defect = models.BooleanField(default=False)
    defect_description = models.TextField(blank=True, default='')

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'glasses_order'
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.order_no} - {self.customer_name}'

    def get_urgency_status(self):
        now = timezone.now()
        if self.status == self.STATUS_PENDING_REVIEW and self.review_due_at:
            if now > self.review_due_at:
                return self.URGENCY_OVERDUE
            elif (self.review_due_at - now).days <= 2:
                return self.URGENCY_WARNING
        if self.status == self.STATUS_REVIEW_APPROVED and self.sync_due_at:
            if now > self.sync_due_at:
                return self.URGENCY_OVERDUE
            elif (self.sync_due_at - now).days <= 2:
                return self.URGENCY_WARNING
        return self.URGENCY_NORMAL

    def get_responsible_user(self):
        if self.status in [self.STATUS_PENDING_REVIEW, self.STATUS_RETURNED_FOR_CORRECTION]:
            return self.current_handler or self.reviewed_by
        if self.status == self.STATUS_REVIEW_APPROVED:
            return self.current_handler or self.synced_by
        return None


class OptometryRecord(models.Model):
    order = models.OneToOneField(GlassesOrder, on_delete=models.CASCADE, related_name='optometry_record')
    optometrist = models.ForeignKey(User, on_delete=models.PROTECT, related_name='optometry_records')

    left_sphere = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    left_cylinder = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    left_axis = models.IntegerField(null=True, blank=True)
    left_visual_acuity = models.CharField(max_length=20, blank=True, default='')

    right_sphere = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    right_cylinder = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    right_axis = models.IntegerField(null=True, blank=True)
    right_visual_acuity = models.CharField(max_length=20, blank=True, default='')

    pd = models.DecimalField(max_digits=5, decimal_places=1, null=True, blank=True)
    exam_notes = models.TextField(blank=True, default='')

    is_complete = models.BooleanField(default=False)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'optometry_record'

    def check_complete(self):
        required = [
            self.left_sphere, self.right_sphere, self.pd
        ]
        self.is_complete = all(v is not None for v in required)
        return self.is_complete


class LensOrder(models.Model):
    order = models.OneToOneField(GlassesOrder, on_delete=models.CASCADE, related_name='lens_order')

    left_lens_type = models.CharField(max_length=100, blank=True, default='')
    left_lens_brand = models.CharField(max_length=100, blank=True, default='')
    left_lens_price = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)

    right_lens_type = models.CharField(max_length=100, blank=True, default='')
    right_lens_brand = models.CharField(max_length=100, blank=True, default='')
    right_lens_price = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)

    frame_brand = models.CharField(max_length=100, blank=True, default='')
    frame_model = models.CharField(max_length=100, blank=True, default='')
    frame_price = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)

    total_price = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    supplier = models.CharField(max_length=100, blank=True, default='')

    is_complete = models.BooleanField(default=False)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'lens_order'

    def check_complete(self):
        required = [
            self.left_lens_type, self.right_lens_type,
            self.frame_brand, self.total_price
        ]
        self.is_complete = all(v for v in required)
        return self.is_complete


class OrderRegistration(models.Model):
    order = models.OneToOneField(GlassesOrder, on_delete=models.CASCADE, related_name='registration')

    sales_person = models.CharField(max_length=100, blank=True, default='')
    registered_at = models.DateTimeField(null=True, blank=True)
    payment_method = models.CharField(max_length=50, blank=True, default='')
    deposit_amount = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    delivery_method = models.CharField(max_length=50, blank=True, default='')
    expected_delivery = models.DateField(null=True, blank=True)
    notes = models.TextField(blank=True, default='')

    is_complete = models.BooleanField(default=False)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'order_registration'

    def check_complete(self):
        required = [
            self.sales_person, self.registered_at, self.total_price
        ]
        self.is_complete = all(v for v in required)
        return self.is_complete

    @property
    def total_price(self):
        return self.order.lens_order.total_price if hasattr(self.order, 'lens_order') and self.order.lens_order else None


class Attachment(models.Model):
    CATEGORY_OPTOMETRY = 'optometry'
    CATEGORY_LENS = 'lens'
    CATEGORY_REGISTRATION = 'registration'
    CATEGORY_OTHER = 'other'

    CATEGORY_CHOICES = [
        (CATEGORY_OPTOMETRY, '验光档案'),
        (CATEGORY_LENS, '镜片订购'),
        (CATEGORY_REGISTRATION, '订单登记'),
        (CATEGORY_OTHER, '其他'),
    ]

    order = models.ForeignKey(GlassesOrder, on_delete=models.CASCADE, related_name='attachments')
    category = models.CharField(max_length=50, choices=CATEGORY_CHOICES)
    file_name = models.CharField(max_length=255)
    file_path = models.CharField(max_length=500)
    file_size = models.IntegerField(default=0)
    uploaded_by = models.ForeignKey(User, on_delete=models.PROTECT, related_name='uploaded_attachments')
    description = models.TextField(blank=True, default='')
    is_required = models.BooleanField(default=False)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'attachment'


class ProcessingRecord(models.Model):
    ACTION_SUBMIT = 'submit'
    ACTION_REVIEW = 'review'
    ACTION_APPROVE = 'approve'
    ACTION_RETURN = 'return'
    ACTION_SYNC = 'sync'
    ACTION_CORRECT = 'correct'
    ACTION_ADD_ATTACHMENT = 'add_attachment'

    ACTION_CHOICES = [
        (ACTION_SUBMIT, '提交'),
        (ACTION_REVIEW, '审核'),
        (ACTION_APPROVE, '通过'),
        (ACTION_RETURN, '退回补正'),
        (ACTION_SYNC, '同步'),
        (ACTION_CORRECT, '补正'),
        (ACTION_ADD_ATTACHMENT, '添加附件'),
    ]

    order = models.ForeignKey(GlassesOrder, on_delete=models.CASCADE, related_name='processing_records')
    action = models.CharField(max_length=50, choices=ACTION_CHOICES)
    operator = models.ForeignKey(User, on_delete=models.PROTECT, related_name='processing_records')
    from_status = models.CharField(max_length=50, blank=True, default='')
    to_status = models.CharField(max_length=50, blank=True, default='')
    opinion = models.TextField(blank=True, default='')
    version = models.IntegerField(default=1)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'processing_record'
        ordering = ['-created_at']


class AuditNote(models.Model):
    order = models.ForeignKey(GlassesOrder, on_delete=models.CASCADE, related_name='audit_notes')
    operator = models.ForeignKey(User, on_delete=models.PROTECT, related_name='audit_notes')
    note_type = models.CharField(max_length=50, default='general')
    content = models.TextField()
    related_record = models.ForeignKey(ProcessingRecord, on_delete=models.SET_NULL, null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'audit_note'
        ordering = ['-created_at']


class ExceptionReason(models.Model):
    TYPE_MISSING_OPTOMETRY = 'missing_optometry'
    TYPE_MISSING_LENS = 'missing_lens'
    TYPE_MISSING_ATTACHMENT = 'missing_attachment'
    TYPE_STATUS_CONFLICT = 'status_conflict'
    TYPE_VERSION_CONFLICT = 'version_conflict'
    TYPE_PERMISSION_DENIED = 'permission_denied'
    TYPE_TIMEOUT = 'timeout'
    TYPE_DUPLICATE_SUBMISSION = 'duplicate_submission'
    TYPE_OTHER = 'other'

    TYPE_CHOICES = [
        (TYPE_MISSING_OPTOMETRY, '验光档案缺项'),
        (TYPE_MISSING_LENS, '镜片订购缺项'),
        (TYPE_MISSING_ATTACHMENT, '缺少必填附件'),
        (TYPE_STATUS_CONFLICT, '状态冲突'),
        (TYPE_VERSION_CONFLICT, '版本冲突'),
        (TYPE_PERMISSION_DENIED, '权限不足'),
        (TYPE_TIMEOUT, '处理超时'),
        (TYPE_DUPLICATE_SUBMISSION, '重复提交'),
        (TYPE_OTHER, '其他异常'),
    ]

    order = models.ForeignKey(GlassesOrder, on_delete=models.CASCADE, related_name='exceptions')
    exception_type = models.CharField(max_length=50, choices=TYPE_CHOICES)
    description = models.TextField()
    detected_by = models.ForeignKey(User, on_delete=models.PROTECT, related_name='detected_exceptions')
    resolved = models.BooleanField(default=False)
    resolved_by = models.ForeignKey(User, on_delete=models.PROTECT, related_name='resolved_exceptions', null=True, blank=True)
    resolved_at = models.DateTimeField(null=True, blank=True)
    resolution_note = models.TextField(blank=True, default='')

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'exception_reason'
        ordering = ['-created_at']
