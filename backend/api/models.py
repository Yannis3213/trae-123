from django.db import models
from django.contrib.auth.models import AbstractUser
from django.utils import timezone


class RoleChoices(models.TextChoices):
    PROJECT_ASSISTANT = 'PROJECT_ASSISTANT', '项目助理'
    DELIVERY_REGISTRAR = 'DELIVERY_REGISTRAR', '需求交付登记员'
    DEV_LEAD = 'DEV_LEAD', '开发负责人'
    AUDIT_SUPERVISOR = 'AUDIT_SUPERVISOR', '需求交付审核主管'
    DELIVERY_MANAGER = 'DELIVERY_MANAGER', '交付经理'
    REVIEW_LEADER = 'REVIEW_LEADER', '软件外包项目组复核负责人'


class OrderStatusChoices(models.TextChoices):
    PENDING_VERIFY = 'PENDING_VERIFY', '待核验'
    VERIFY_FAILED = 'VERIFY_FAILED', '核验失败'
    VERIFY_COMPLETED = 'VERIFY_COMPLETED', '核验完成'
    REQUIREMENT_SUBMITTED = 'REQUIREMENT_SUBMITTED', '需求确认待审核'
    REQUIREMENT_AUDITED = 'REQUIREMENT_AUDITED', '需求确认已审核'
    SCHEDULE_SUBMITTED = 'SCHEDULE_SUBMITTED', '排期评估待审核'
    SCHEDULE_AUDITED = 'SCHEDULE_AUDITED', '排期评估已审核'
    DELIVERY_SUBMITTED = 'DELIVERY_SUBMITTED', '交付验收待审核'
    DELIVERY_AUDITED = 'DELIVERY_AUDITED', '交付验收已审核'
    REVIEW_PENDING = 'REVIEW_PENDING', '待复核'
    REVIEW_COMPLETED = 'REVIEW_COMPLETED', '复核完成'
    ARCHIVED = 'ARCHIVED', '已归档'


class RequirementStatusChoices(models.TextChoices):
    NOT_STARTED = 'NOT_STARTED', '未开始'
    IN_PROGRESS = 'IN_PROGRESS', '进行中'
    COMPLETED = 'COMPLETED', '已完成'
    EXCEPTION = 'EXCEPTION', '异常'


class ModuleTypeChoices(models.TextChoices):
    REQUIREMENT = 'REQUIREMENT', '需求确认'
    SCHEDULE = 'SCHEDULE', '排期评估'
    DELIVERY = 'DELIVERY', '交付验收'


class ActionChoices(models.TextChoices):
    SUBMIT = 'SUBMIT', '提交'
    APPROVE = 'APPROVE', '审核通过'
    REJECT = 'REJECT', '审核驳回'
    CORRECT = 'CORRECT', '补正'
    ADVANCE = 'ADVANCE', '推进'
    REVIEW = 'REVIEW', '复核'
    ARCHIVE = 'ARCHIVE', '归档'


class User(AbstractUser):
    role = models.CharField(max_length=50, choices=RoleChoices.choices, verbose_name='角色')

    class Meta:
        verbose_name = '用户'
        verbose_name_plural = verbose_name

    def __str__(self):
        return f'{self.username} - {self.get_role_display()}'


class RequirementDeliveryOrder(models.Model):
    order_no = models.CharField(max_length=50, unique=True, verbose_name='单据编号')
    title = models.CharField(max_length=200, verbose_name='标题')
    project_name = models.CharField(max_length=200, verbose_name='项目名称')
    requirement_confirmation_clue = models.CharField(max_length=500, verbose_name='需求确认线索')
    status = models.CharField(max_length=50, choices=OrderStatusChoices.choices, default=OrderStatusChoices.PENDING_VERIFY, verbose_name='状态')
    current_handler = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='handling_orders', verbose_name='当前处理人')
    version = models.IntegerField(default=1, verbose_name='版本号')
    requirement_status = models.CharField(max_length=50, choices=RequirementStatusChoices.choices, default=RequirementStatusChoices.NOT_STARTED, verbose_name='需求确认状态')
    schedule_status = models.CharField(max_length=50, choices=RequirementStatusChoices.choices, default=RequirementStatusChoices.NOT_STARTED, verbose_name='排期评估状态')
    delivery_status = models.CharField(max_length=50, choices=RequirementStatusChoices.choices, default=RequirementStatusChoices.NOT_STARTED, verbose_name='交付验收状态')
    requirement_evidence = models.JSONField(default=dict, blank=True, verbose_name='需求确认证据')
    schedule_evidence = models.JSONField(default=dict, blank=True, verbose_name='排期评估证据')
    delivery_evidence = models.JSONField(default=dict, blank=True, verbose_name='交付验收证据')
    requirement_deadline = models.DateField(null=True, blank=True, verbose_name='需求确认截止日期')
    schedule_deadline = models.DateField(null=True, blank=True, verbose_name='排期评估截止日期')
    delivery_deadline = models.DateField(null=True, blank=True, verbose_name='交付验收截止日期')
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='created_orders', verbose_name='创建人')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新时间')

    class Meta:
        verbose_name = '需求交付单'
        verbose_name_plural = verbose_name
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.order_no} - {self.title}'


class Attachment(models.Model):
    order = models.ForeignKey(RequirementDeliveryOrder, on_delete=models.CASCADE, related_name='attachments', verbose_name='关联单据')
    module_type = models.CharField(max_length=50, choices=ModuleTypeChoices.choices, verbose_name='模块类型')
    file_name = models.CharField(max_length=200, verbose_name='文件名')
    file_url = models.URLField(max_length=500, verbose_name='文件地址')
    uploaded_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, verbose_name='上传人')
    uploaded_at = models.DateTimeField(default=timezone.now, editable=False, verbose_name='上传时间')

    class Meta:
        verbose_name = '附件'
        verbose_name_plural = verbose_name
        ordering = ['-uploaded_at']

    def __str__(self):
        return f'{self.file_name} - {self.get_module_type_display()}'


class ProcessingRecord(models.Model):
    order = models.ForeignKey(RequirementDeliveryOrder, on_delete=models.CASCADE, related_name='processing_records', verbose_name='关联单据')
    action = models.CharField(max_length=50, choices=ActionChoices.choices, verbose_name='操作动作')
    operator = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, verbose_name='操作人')
    role = models.CharField(max_length=50, choices=RoleChoices.choices, verbose_name='角色')
    from_status = models.CharField(max_length=50, choices=OrderStatusChoices.choices, verbose_name='原状态')
    to_status = models.CharField(max_length=50, choices=OrderStatusChoices.choices, verbose_name='目标状态')
    remark = models.TextField(blank=True, verbose_name='备注')
    created_at = models.DateTimeField(default=timezone.now, editable=False, verbose_name='操作时间')

    class Meta:
        verbose_name = '处理记录'
        verbose_name_plural = verbose_name
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.order.order_no} - {self.get_action_display()}'


class AuditNote(models.Model):
    order = models.ForeignKey(RequirementDeliveryOrder, on_delete=models.CASCADE, related_name='audit_notes', verbose_name='关联单据')
    note = models.TextField(verbose_name='备注内容')
    author = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, verbose_name='作者')
    created_at = models.DateTimeField(default=timezone.now, editable=False, verbose_name='创建时间')

    class Meta:
        verbose_name = '审核备注'
        verbose_name_plural = verbose_name
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.order.order_no} - {self.note[:30]}'


class ExceptionReason(models.Model):
    order = models.ForeignKey(RequirementDeliveryOrder, on_delete=models.CASCADE, related_name='exception_reasons', verbose_name='关联单据')
    module_type = models.CharField(max_length=50, choices=ModuleTypeChoices.choices, verbose_name='模块类型')
    reason = models.TextField(verbose_name='异常原因')
    handler = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='handling_exceptions', verbose_name='处理人')
    created_at = models.DateTimeField(default=timezone.now, editable=False, verbose_name='创建时间')
    resolved = models.BooleanField(default=False, verbose_name='是否已解决')
    resolved_at = models.DateTimeField(null=True, blank=True, verbose_name='解决时间')

    class Meta:
        verbose_name = '异常原因'
        verbose_name_plural = verbose_name
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.order.order_no} - {self.get_module_type_display()}'
