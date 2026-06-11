from django.db import models
from django.contrib.auth.models import User
from django.utils import timezone


ROLE_CHOICES = [
    ('community_worker', '社区专干'),
    ('street_clerk', '街道科员'),
    ('leader', '分管领导'),
]

NODE_CHOICES = [
    ('difficulty_support', '困难帮扶'),
    ('home_verification', '入户核实'),
    ('rescue_confirmation', '救助确认'),
]

STATUS_CHOICES = [
    ('pending', '待接单'),
    ('accepted', '已接单'),
    ('passed', '验收通过'),
    ('returned', '退回补正'),
    ('rejected', '不予通过'),
]

WARNING_STATUS_CHOICES = [
    ('normal', '正常'),
    ('approaching', '临期'),
    ('overdue', '逾期'),
]


class UserProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')
    role = models.CharField(max_length=20, choices=ROLE_CHOICES)
    department = models.CharField(max_length=100, blank=True)
    phone = models.CharField(max_length=20, blank=True)

    class Meta:
        db_table = 'user_profile'

    def __str__(self):
        return f'{self.user.username} - {self.get_role_display()}'


class AssistanceApplication(models.Model):
    application_no = models.CharField(max_length=50, unique=True)
    applicant_name = models.CharField(max_length=100)
    applicant_id_card = models.CharField(max_length=18)
    applicant_phone = models.CharField(max_length=20)
    community = models.CharField(max_length=100)
    address = models.TextField()
    family_situation = models.TextField()
    difficulty_type = models.CharField(max_length=50)
    application_reason = models.TextField()
    apply_amount = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)

    current_node = models.CharField(max_length=30, choices=NODE_CHOICES, default='difficulty_support')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    warning_status = models.CharField(max_length=20, choices=WARNING_STATUS_CHOICES, default='normal')

    current_handler = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True, related_name='handling_applications'
    )
    creator = models.ForeignKey(User, on_delete=models.PROTECT, related_name='created_applications')
    street_clerk = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True, related_name='clerk_applications'
    )
    leader = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True, related_name='leader_applications'
    )

    node_deadline = models.DateTimeField(null=True, blank=True)
    version = models.IntegerField(default=1)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'assistance_application'
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.application_no} - {self.applicant_name}'


class Attachment(models.Model):
    application = models.ForeignKey(AssistanceApplication, on_delete=models.CASCADE, related_name='attachments')
    file_name = models.CharField(max_length=255)
    file_type = models.CharField(max_length=50)
    file_path = models.CharField(max_length=500)
    file_size = models.BigIntegerField()
    uploaded_by = models.ForeignKey(User, on_delete=models.PROTECT)
    evidence_type = models.CharField(max_length=50, blank=True)
    is_required = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'attachment'

    def __str__(self):
        return self.file_name


class ProcessingRecord(models.Model):
    application = models.ForeignKey(AssistanceApplication, on_delete=models.CASCADE, related_name='processing_records')
    node = models.CharField(max_length=30, choices=NODE_CHOICES)
    action = models.CharField(max_length=50)
    operator = models.ForeignKey(User, on_delete=models.PROTECT, related_name='processing_records')
    previous_status = models.CharField(max_length=20, choices=STATUS_CHOICES, blank=True)
    new_status = models.CharField(max_length=20, choices=STATUS_CHOICES)
    previous_handler = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True, related_name='+'
    )
    new_handler = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True, related_name='+'
    )
    comment = models.TextField(blank=True)
    processing_time = models.DateTimeField(auto_now_add=True)
    version = models.IntegerField(default=1)

    class Meta:
        db_table = 'processing_record'
        ordering = ['-processing_time']


class AuditNote(models.Model):
    application = models.ForeignKey(AssistanceApplication, on_delete=models.CASCADE, related_name='audit_notes')
    node = models.CharField(max_length=30, choices=NODE_CHOICES)
    note_type = models.CharField(max_length=50)
    content = models.TextField()
    operator = models.ForeignKey(User, on_delete=models.PROTECT, related_name='audit_notes')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'audit_note'
        ordering = ['-created_at']


class ExceptionLog(models.Model):
    application = models.ForeignKey(
        AssistanceApplication, on_delete=models.CASCADE, related_name='exception_logs', null=True, blank=True
    )
    batch_id = models.CharField(max_length=50, blank=True)
    exception_type = models.CharField(max_length=100)
    error_code = models.CharField(max_length=50)
    error_message = models.TextField()
    operator = models.ForeignKey(User, on_delete=models.PROTECT, related_name='exception_logs')
    request_data = models.TextField(blank=True)
    resolved = models.BooleanField(default=False)
    resolved_at = models.DateTimeField(null=True, blank=True)
    resolved_note = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'exception_log'
        ordering = ['-created_at']
