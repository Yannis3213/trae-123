from django.core.management.base import BaseCommand
from django.utils import timezone
from datetime import timedelta
from apps.orders.models import (
    ForeignTradeOrder, ProcessingRecord, ExceptionReason, AuditNote,
    Role, OrderStatus, OrderStage, Priority, ProcessingAction
)


class Command(BaseCommand):
    help = '初始化外贸订单示例数据'

    def handle(self, *args, **options):
        ForeignTradeOrder.objects.all().delete()

        now = timezone.now()

        sample_orders = [
            {
                'customer_name': 'ABC Trading Co., Ltd.',
                'product_name': '电子元器件套装',
                'quantity': 5000,
                'amount': 125000,
                'country': 'USA',
                'inquiry_content': '客户询问5000套电子元器件的报价和交期，要求含包装和运输保险',
                'quote_content': '单价USD25/套，FOB上海，交期30天，含标准包装',
                'order_content': '已签订正式合同，订单号PO-2024-001',
                'quote_confirmed': True,
                'order_signed': True,
                'priority': Priority.HIGH,
                'responsible_person': '张经理',
                'current_handler': '',
                'current_handler_role': Role.REVIEWER,
                'status': OrderStatus.PROCESSING,
                'stage': OrderStage.ORDER_SIGNING,
                'due_time': now + timedelta(days=5),
                'is_exception': False,
                'exception_tags': [],
                'result': '',
                'return_reason': '',
            },
            {
                'customer_name': 'EuroTech GmbH',
                'product_name': '精密机械零件',
                'quantity': 2000,
                'amount': 86000,
                'country': 'Germany',
                'inquiry_content': '客户需要2000件精密机械零件，要求DIN标准，材质不锈钢304',
                'quote_content': '',
                'order_content': '',
                'quote_confirmed': False,
                'order_signed': False,
                'priority': Priority.URGENT,
                'responsible_person': '李主管',
                'current_handler': '',
                'current_handler_role': Role.SUPERVISOR,
                'status': OrderStatus.PROCESSING,
                'stage': OrderStage.QUOTE_CONFIRMATION,
                'due_time': now - timedelta(days=1),
                'is_exception': True,
                'exception_tags': ['逾期', '缺报价确认'],
                'result': '',
                'return_reason': '',
            },
            {
                'customer_name': 'Pacific Imports Pty Ltd',
                'product_name': '智能家居设备',
                'quantity': 1000,
                'amount': 45000,
                'country': 'Australia',
                'inquiry_content': '客户对智能家居套装感兴趣，询问功能和价格',
                'quote_content': '已报价，等待客户确认',
                'order_content': '',
                'quote_confirmed': False,
                'order_signed': False,
                'priority': Priority.MEDIUM,
                'responsible_person': '王登记',
                'current_handler': '王登记',
                'current_handler_role': Role.CLERK,
                'status': OrderStatus.PENDING_DISPATCH,
                'stage': OrderStage.INQUIRY,
                'due_time': now + timedelta(days=10),
                'is_exception': False,
                'exception_tags': [],
                'result': '',
                'return_reason': '',
            },
            {
                'customer_name': 'Global Commerce Inc.',
                'product_name': '工业自动化模块',
                'quantity': 300,
                'amount': 210000,
                'country': 'Canada',
                'inquiry_content': '客户需要300套工业自动化控制模块，含技术支持',
                'quote_content': '报价已确认，但细节待补充',
                'order_content': '',
                'quote_confirmed': True,
                'order_signed': False,
                'priority': Priority.MEDIUM,
                'responsible_person': '赵主管',
                'current_handler': '',
                'current_handler_role': Role.SUPERVISOR,
                'status': OrderStatus.PROCESSING,
                'stage': OrderStage.QUOTE_CONFIRMATION,
                'due_time': now + timedelta(days=1),
                'is_exception': False,
                'exception_tags': [],
                'result': '',
                'return_reason': '',
            },
            {
                'customer_name': 'Sunrise Exports LLP',
                'product_name': 'LED照明产品',
                'quantity': 10000,
                'amount': 68000,
                'country': 'India',
                'inquiry_content': '客户需要LED灯具10000件，含CE认证',
                'quote_content': '报价已发送，客户要求降价5%',
                'order_content': '',
                'quote_confirmed': False,
                'order_signed': False,
                'priority': Priority.LOW,
                'responsible_person': '孙登记',
                'current_handler': '',
                'current_handler_role': Role.CLERK,
                'status': OrderStatus.PROCESSING,
                'stage': OrderStage.INQUIRY,
                'due_time': now - timedelta(days=3),
                'is_exception': True,
                'exception_tags': ['逾期', '退回补正'],
                'result': '',
                'return_reason': '报价信息不完整，缺少客户还价的应对方案',
            },
        ]

        for idx, data in enumerate(sample_orders):
            seq = idx + 1
            order = ForeignTradeOrder.objects.create(
                order_no=f'FT{now.strftime("%Y%m%d")}{seq:04d}',
                customer_name=data['customer_name'],
                product_name=data['product_name'],
                quantity=data['quantity'],
                amount=data['amount'],
                country=data['country'],
                inquiry_content=data['inquiry_content'],
                quote_content=data['quote_content'],
                order_content=data['order_content'],
                quote_confirmed=data['quote_confirmed'],
                order_signed=data['order_signed'],
                priority=data['priority'],
                responsible_person=data['responsible_person'],
                current_handler=data['current_handler'],
                current_handler_role=data['current_handler_role'],
                status=data['status'],
                stage=data['stage'],
                due_time=data['due_time'],
                version=1,
                is_exception=data['is_exception'],
                exception_tags=data['exception_tags'],
                result=data['result'],
                return_reason=data['return_reason'],
            )

            ProcessingRecord.objects.create(
                order=order,
                action=ProcessingAction.CREATE,
                operator='系统初始化',
                operator_role=Role.CLERK,
                from_status='',
                to_status=order.status,
                from_stage='',
                to_stage=order.stage,
                comment=f'初始化示例订单 - {data["product_name"]}',
                version_before=0,
                version_after=1,
            )

            if data['is_exception']:
                ExceptionReason.objects.create(
                    order=order,
                    reason_type='初始化异常',
                    reason_detail=f'该订单为示例异常订单，异常标签: {", ".join(data["exception_tags"])}',
                    corrective_action='请按实际业务流程处理',
                    recorded_by='系统初始化',
                    recorded_by_role=Role.CLERK,
                )

            AuditNote.objects.create(
                order=order,
                note=f'系统初始化生成的示例订单，用于测试演示',
                noted_by='系统初始化',
                noted_by_role=Role.CLERK,
            )

        self.stdout.write(self.style.SUCCESS(f'成功初始化 {len(sample_orders)} 条外贸订单示例数据'))
