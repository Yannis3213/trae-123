from django.db import models
from django.utils import timezone


class Role(models.TextChoices):
    CLERK = 'clerk', '外贸登记员'
    SUPERVISOR = 'supervisor', '外贸审核主管'
    REVIEWER = 'reviewer', '外贸公司复核负责人'


class OrderStatus(models.TextChoices):
    PENDING_DISPATCH = 'pending_dispatch', '待派发'
    PROCESSING = 'processing', '处理中'
    CLOSED = 'closed', '已关闭'


class OrderStage(models.TextChoices):
    INQUIRY = 'inquiry', '客户询盘'
    QUOTE_CONFIRMATION = 'quote_confirmation', '报价确认'
    ORDER_SIGNING = 'order_signing', '订单签订'
    ARCHIVED = 'archived', '已归档'


class Priority(models.TextChoices):
    LOW = 'low', '低'
    MEDIUM = 'medium', '中'
    HIGH = 'high', '高'
    URGENT = 'urgent', '紧急'


class WarningLevel(models.TextChoices):
    NORMAL = 'normal', '正常'
    APPROACHING = 'approaching', '临期'
    OVERDUE = 'overdue', '逾期'


class ProcessingAction(models.TextChoices):
    CREATE = 'create', '创建'
    SUBMIT = 'submit', '提交'
    DISPATCH = 'dispatch', '派发'
    PROCESS = 'process', '办理'
    REVIEW = 'review', '复核'
    RETURN = 'return', '退回补正'
    CORRECT = 'correct', '补正'
    CLOSE = 'close', '关闭归档'
    BATCH_PROCESS = 'batch_process', '批量处理'


class ForeignTradeOrder(models.Model):
    order_no = models.CharField('订单编号', max_length=50, unique=True)
    customer_name = models.CharField('客户名称', max_length=200)
    product_name = models.CharField('产品名称', max_length=200)
    quantity = models.DecimalField('数量', max_digits=15, decimal_places=2, default=0)
    amount = models.DecimalField('金额(USD)', max_digits=15, decimal_places=2, default=0)
    country = models.CharField('目的国', max_length=100, blank=True, default='')

    inquiry_content = models.TextField('客户询盘内容', blank=True, default='')
    quote_content = models.TextField('报价确认信息', blank=True, default='')
    order_content = models.TextField('订单签订信息', blank=True, default='')

    quote_confirmed = models.BooleanField('报价已确认', default=False)
    order_signed = models.BooleanField('订单已签订', default=False)

    status = models.CharField('状态', max_length=30, choices=OrderStatus.choices, default=OrderStatus.PENDING_DISPATCH)
    stage = models.CharField('当前阶段', max_length=30, choices=OrderStage.choices, default=OrderStage.INQUIRY)
    priority = models.CharField('优先级', max_length=20, choices=Priority.choices, default=Priority.MEDIUM)

    responsible_person = models.CharField('责任人', max_length=100, blank=True, default='')
    current_handler = models.CharField('当前处理人', max_length=100, blank=True, default='')
    current_handler_role = models.CharField('当前处理人角色', max_length=30, choices=Role.choices, blank=True, default='')

    create_time = models.DateTimeField('创建时间', auto_now_add=True)
    update_time = models.DateTimeField('更新时间', auto_now=True)
    due_time = models.DateTimeField('截止时间', null=True, blank=True)

    version = models.IntegerField('版本号', default=1)
    is_exception = models.BooleanField('是否异常', default=False)
    exception_tags = models.JSONField('异常标签', default=list, blank=True)

    result = models.TextField('办理结果', blank=True, default='')
    return_reason = models.TextField('退回原因', blank=True, default='')

    class Meta:
        db_table = 'foreign_trade_order'
        ordering = ['-create_time']
        verbose_name = '外贸订单'
        verbose_name_plural = verbose_name

    def __str__(self):
        return f'{self.order_no} - {self.customer_name}'

    def get_warning_level(self):
        if not self.due_time:
            return WarningLevel.NORMAL
        now = timezone.now()
        due = self.due_time
        if timezone.is_naive(due):
            due = timezone.make_aware(due)
        if timezone.is_naive(now):
            now = timezone.make_aware(now)
        delta = due - now
        if delta.total_seconds() < 0:
            return WarningLevel.OVERDUE
        if delta.total_seconds() < 24 * 3600 * 2:
            return WarningLevel.APPROACHING
        return WarningLevel.NORMAL

    def can_process(self, role: str) -> bool:
        if self.status == OrderStatus.CLOSED:
            return False
        if self.status == OrderStatus.PENDING_DISPATCH:
            return role in [Role.CLERK, Role.SUPERVISOR]
        if self.status == OrderStatus.PROCESSING:
            if self.stage == OrderStage.INQUIRY:
                return role == Role.CLERK
            if self.stage == OrderStage.QUOTE_CONFIRMATION:
                return role == Role.SUPERVISOR
            if self.stage == OrderStage.ORDER_SIGNING:
                return role == Role.REVIEWER
        return False


class OrderAttachment(models.Model):
    order = models.ForeignKey(ForeignTradeOrder, on_delete=models.CASCADE, related_name='attachments', verbose_name='外贸订单')
    file_name = models.CharField('文件名', max_length=255)
    file_path = models.CharField('文件路径', max_length=500)
    file_type = models.CharField('文件类型', max_length=50, blank=True, default='')
    file_size = models.IntegerField('文件大小', default=0)
    uploaded_by = models.CharField('上传人', max_length=100)
    uploaded_by_role = models.CharField('上传人角色', max_length=30, choices=Role.choices)
    upload_time = models.DateTimeField('上传时间', auto_now_add=True)
    description = models.CharField('说明', max_length=500, blank=True, default='')
    stage = models.CharField('所属阶段', max_length=30, choices=OrderStage.choices, blank=True, default='')

    class Meta:
        db_table = 'order_attachment'
        ordering = ['-upload_time']
        verbose_name = '订单附件'
        verbose_name_plural = verbose_name

    def __str__(self):
        return f'{self.order.order_no} - {self.file_name}'


class ProcessingRecord(models.Model):
    order = models.ForeignKey(ForeignTradeOrder, on_delete=models.CASCADE, related_name='processing_records', verbose_name='外贸订单')
    action = models.CharField('操作动作', max_length=30, choices=ProcessingAction.choices)
    operator = models.CharField('操作人', max_length=100)
    operator_role = models.CharField('操作人角色', max_length=30, choices=Role.choices)
    operate_time = models.DateTimeField('操作时间', auto_now_add=True)
    from_status = models.CharField('原状态', max_length=30, choices=OrderStatus.choices, blank=True, default='')
    to_status = models.CharField('新状态', max_length=30, choices=OrderStatus.choices, blank=True, default='')
    from_stage = models.CharField('原阶段', max_length=30, choices=OrderStage.choices, blank=True, default='')
    to_stage = models.CharField('新阶段', max_length=30, choices=OrderStage.choices, blank=True, default='')
    comment = models.TextField('操作说明', blank=True, default='')
    evidence_required = models.BooleanField('是否需证据', default=False)
    evidence_provided = models.BooleanField('是否已提供证据', default=False)
    version_before = models.IntegerField('操作前版本', default=0)
    version_after = models.IntegerField('操作后版本', default=0)

    class Meta:
        db_table = 'processing_record'
        ordering = ['-operate_time']
        verbose_name = '处理记录'
        verbose_name_plural = verbose_name

    def __str__(self):
        return f'{self.order.order_no} - {self.get_action_display()} - {self.operator}'


class AuditNote(models.Model):
    order = models.ForeignKey(ForeignTradeOrder, on_delete=models.CASCADE, related_name='audit_notes', verbose_name='外贸订单')
    note = models.TextField('审计备注')
    noted_by = models.CharField('备注人', max_length=100)
    noted_by_role = models.CharField('备注人角色', max_length=30, choices=Role.choices)
    note_time = models.DateTimeField('备注时间', auto_now_add=True)

    class Meta:
        db_table = 'audit_note'
        ordering = ['-note_time']
        verbose_name = '审计备注'
        verbose_name_plural = verbose_name

    def __str__(self):
        return f'{self.order.order_no} - {self.noted_by}'


class ExceptionReason(models.Model):
    order = models.ForeignKey(ForeignTradeOrder, on_delete=models.CASCADE, related_name='exception_reasons', verbose_name='外贸订单')
    reason_type = models.CharField('异常类型', max_length=50)
    reason_detail = models.TextField('异常详情')
    corrective_action = models.TextField('补正动作', blank=True, default='')
    recorded_by = models.CharField('记录人', max_length=100)
    recorded_by_role = models.CharField('记录人角色', max_length=30, choices=Role.choices)
    record_time = models.DateTimeField('记录时间', auto_now_add=True)
    resolved = models.BooleanField('是否已解决', default=False)
    resolve_time = models.DateTimeField('解决时间', null=True, blank=True)

    class Meta:
        db_table = 'exception_reason'
        ordering = ['-record_time']
        verbose_name = '异常原因'
        verbose_name_plural = verbose_name

    def __str__(self):
        return f'{self.order.order_no} - {self.reason_type}'
