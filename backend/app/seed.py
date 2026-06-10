from datetime import datetime, timedelta
from sqlalchemy.orm import Session

from .database import Base, engine
from .models import (
    User, UserRole, FreshPurchaseOrder, PurchaseStatus,
    PriorityLevel, WarningLevel, Attachment, ProcessingRecord, AuditNote
)
from .auth import get_password_hash


def init_db():
    Base.metadata.create_all(bind=engine)


def seed_database(db: Session):
    init_db()

    existing_users = db.query(User).count()
    if existing_users > 0:
        print("数据库已存在数据，跳过seed...")
        return

    print("开始植入种子数据...")

    users_data = [
        {
            "username": "registrar1",
            "password": "registrar123",
            "full_name": "张登记员",
            "role": UserRole.REGISTRAR,
            "store": "生鲜超市-朝阳店"
        },
        {
            "username": "registrar2",
            "password": "registrar123",
            "full_name": "李采购员",
            "role": UserRole.REGISTRAR,
            "store": "生鲜超市-海淀店"
        },
        {
            "username": "supervisor1",
            "password": "supervisor123",
            "full_name": "王主管",
            "role": UserRole.SUPERVISOR,
            "store": "生鲜超市-朝阳店"
        },
        {
            "username": "supervisor2",
            "password": "supervisor123",
            "full_name": "赵门店经理",
            "role": UserRole.SUPERVISOR,
            "store": "生鲜超市-海淀店"
        },
        {
            "username": "reviewer1",
            "password": "reviewer123",
            "full_name": "陈区域督导",
            "role": UserRole.REVIEWER,
            "store": "生鲜超市-区域总部"
        }
    ]

    created_users = {}
    for u_data in users_data:
        user = User(
            username=u_data["username"],
            full_name=u_data["full_name"],
            hashed_password=get_password_hash(u_data["password"]),
            role=u_data["role"],
            store=u_data["store"],
            is_active=True
        )
        db.add(user)
        created_users[u_data["username"]] = user
    db.flush()

    now = datetime.utcnow()

    orders_data = [
        {
            "order_no": "FPO-2026-0001",
            "title": "6月新鲜蔬菜批量采购",
            "supplier_name": "绿源农产品有限公司",
            "store": "生鲜超市-朝阳店",
            "category": "叶菜类",
            "amount": "¥8,500",
            "priority": PriorityLevel.HIGH,
            "status": PurchaseStatus.PENDING_DISPATCH,
            "deadline": now + timedelta(days=3),
            "creator": "registrar1",
            "handler": "registrar1",
            "supplier_quotation": "绿源公司报价单：菠菜2元/斤，生菜2.5元/斤，油麦菜3元/斤，预计总金额8500元，含运费。",
            "has_quotation": True,
            "has_purchase": False,
            "has_arrival": False,
            "is_overdue": False,
            "has_exception": False,
            "attachments": [
                {"filename": "绿源报价单.pdf", "file_type": "application/pdf", "category": "供应商报价"}
            ],
            "type": "正常流转"
        },
        {
            "order_no": "FPO-2026-0002",
            "title": "进口水果采购-榴莲山竹",
            "supplier_name": "东南亚水果直供公司",
            "store": "生鲜超市-海淀店",
            "category": "进口水果",
            "amount": "¥32,000",
            "priority": PriorityLevel.URGENT,
            "status": PurchaseStatus.PENDING_DISPATCH,
            "deadline": now + timedelta(hours=12),
            "creator": "registrar2",
            "handler": "registrar2",
            "supplier_quotation": "东南亚水果报价（仅品名，缺单价详情）",
            "has_quotation": False,
            "has_purchase": False,
            "has_arrival": False,
            "is_overdue": False,
            "has_exception": True,
            "exception_reason": "供应商报价材料缺失，仅提供品名未附详细报价单",
            "attachments": [],
            "type": "缺材料"
        },
        {
            "order_no": "FPO-2026-0003",
            "title": "冷鲜肉品月度采购",
            "supplier_name": "双汇冷鲜肉批销中心",
            "store": "生鲜超市-朝阳店",
            "category": "冷鲜肉品",
            "amount": "¥55,000",
            "priority": PriorityLevel.MEDIUM,
            "status": PurchaseStatus.PROCESSING,
            "deadline": now - timedelta(days=2),
            "creator": "registrar1",
            "handler": "supervisor1",
            "supplier_quotation": "双汇报价单：五花肉28元/斤，后腿肉32元/斤，排骨45元/斤，总计55000元。",
            "purchase_order_content": "采购订单已传真至双汇销售部，确认发货日期6月8日。",
            "has_quotation": True,
            "has_purchase": True,
            "has_arrival": False,
            "is_overdue": True,
            "has_exception": True,
            "exception_reason": "到货验收单尚未签收，已超过约定到货日期2天",
            "attachments": [
                {"filename": "双汇报价单.pdf", "file_type": "application/pdf", "category": "供应商报价"},
                {"filename": "采购订单确认函.pdf", "file_type": "application/pdf", "category": "采购下单"}
            ],
            "type": "超时逾期"
        },
        {
            "order_no": "FPO-2026-0004",
            "title": "水产海鲜补货采购",
            "supplier_name": "东海渔牧养殖合作社",
            "store": "生鲜超市-海淀店",
            "category": "水产海鲜",
            "amount": "¥18,600",
            "priority": PriorityLevel.HIGH,
            "status": PurchaseStatus.PENDING_DISPATCH,
            "deadline": now + timedelta(days=1),
            "creator": "registrar2",
            "handler": "registrar2",
            "supplier_quotation": "东海渔牧报价：大虾38元/斤，鲈鱼25元/斤，扇贝18元/斤，合计18600元。",
            "has_quotation": True,
            "has_purchase": False,
            "has_arrival": False,
            "is_overdue": False,
            "has_exception": True,
            "exception_reason": "主管退回补正：报价单中缺少海鲜产地检疫证明编号",
            "reject_reason": "退回补正：请补充海鲜产地检疫证明编号及有效期",
            "attachments": [
                {"filename": "东海报价单.pdf", "file_type": "application/pdf", "category": "供应商报价"}
            ],
            "type": "退回补正"
        },
        {
            "order_no": "FPO-2026-0005",
            "title": "日常干货补货",
            "supplier_name": "南北干货批发市场",
            "store": "生鲜超市-朝阳店",
            "category": "干货调料",
            "amount": "¥6,200",
            "priority": PriorityLevel.LOW,
            "status": PurchaseStatus.CLOSED,
            "deadline": now - timedelta(days=5),
            "creator": "registrar1",
            "handler": None,
            "supplier_quotation": "干货报价：香菇60元/斤，木耳55元/斤，枸杞45元/斤，合计6200元。",
            "purchase_order_content": "采购订单已下达，送货日期6月3日。",
            "arrival_verification": "全部货物验收合格入库，数量准确，质量达标。",
            "has_quotation": True,
            "has_purchase": True,
            "has_arrival": True,
            "is_overdue": False,
            "has_exception": False,
            "attachments": [
                {"filename": "干货报价单.pdf", "file_type": "application/pdf", "category": "供应商报价"},
                {"filename": "采购订单.pdf", "file_type": "application/pdf", "category": "采购下单"},
                {"filename": "到货验收单.jpg", "file_type": "image/jpeg", "category": "到货验收"}
            ],
            "type": "正常流转已关闭"
        },
        {
            "order_no": "FPO-2026-0006",
            "title": "端午特色粽子礼盒采购",
            "supplier_name": "五芳斋华北经销处",
            "store": "生鲜超市-海淀店",
            "category": "节日特色",
            "amount": "¥42,000",
            "priority": PriorityLevel.URGENT,
            "status": PurchaseStatus.PROCESSING,
            "deadline": now + timedelta(hours=36),
            "creator": "registrar2",
            "handler": "supervisor2",
            "supplier_quotation": "五芳斋报价：鲜肉粽礼盒88元/盒*200，豆沙粽礼盒78元/盒*200，蛋黄粽礼盒98元/盒*100，合计42000元。",
            "purchase_order_content": "已下单，端午节前3天送货。",
            "has_quotation": True,
            "has_purchase": True,
            "has_arrival": False,
            "is_overdue": False,
            "has_exception": False,
            "attachments": [
                {"filename": "五芳斋报价单.pdf", "file_type": "application/pdf", "category": "供应商报价"},
                {"filename": "粽子采购合同.pdf", "file_type": "application/pdf", "category": "采购下单"}
            ],
            "type": "正常流转处理中"
        }
    ]

    for o_data in orders_data:
        creator = created_users.get(o_data["creator"])
        handler = created_users.get(o_data["handler"]) if o_data.get("handler") else None

        order = FreshPurchaseOrder(
            order_no=o_data["order_no"],
            title=o_data["title"],
            supplier_name=o_data["supplier_name"],
            store=o_data["store"],
            category=o_data["category"],
            amount=o_data["amount"],
            priority=o_data["priority"],
            status=o_data["status"],
            deadline=o_data["deadline"],
            creator_id=creator.id if creator else None,
            current_handler_id=handler.id if handler else None,
            supplier_quotation=o_data.get("supplier_quotation"),
            purchase_order_content=o_data.get("purchase_order_content"),
            arrival_verification=o_data.get("arrival_verification"),
            has_quotation_evidence=o_data.get("has_quotation", False),
            has_purchase_evidence=o_data.get("has_purchase", False),
            has_arrival_evidence=o_data.get("has_arrival", False),
            is_overdue=o_data.get("is_overdue", False),
            has_exception=o_data.get("has_exception", False),
            exception_reason=o_data.get("exception_reason"),
            reject_reason=o_data.get("reject_reason"),
            warning_level=WarningLevel.NORMAL,
            version=1,
            closed_at=now - timedelta(days=4) if o_data["status"] == PurchaseStatus.CLOSED else None
        )

        from .permissions import update_warning_level
        update_warning_level(order)

        db.add(order)
        db.flush()

        for att in o_data.get("attachments", []):
            attachment = Attachment(
                order_id=order.id,
                filename=att["filename"],
                file_type=att.get("file_type"),
                category=att.get("category"),
                uploader_id=creator.id if creator else None,
                description=f"类型：{att.get('category', '未分类')}"
            )
            db.add(attachment)

        if o_data["status"] != PurchaseStatus.PENDING_DISPATCH:
            record1 = ProcessingRecord(
                order_id=order.id,
                action="建单",
                from_status=None,
                to_status=PurchaseStatus.PENDING_DISPATCH.value,
                handler_id=creator.id if creator else None,
                handler_name=creator.full_name if creator else None,
                handler_role=creator.role.value if creator else None,
                result="success",
                comment=f"新建采购单，类型：{o_data.get('type', '正常')}",
                timestamp=now - timedelta(days=1)
            )
            db.add(record1)

        if o_data["status"] in [PurchaseStatus.PROCESSING, PurchaseStatus.CLOSED]:
            registrar = creator
            record2 = ProcessingRecord(
                order_id=order.id,
                action="派发处理",
                from_status=PurchaseStatus.PENDING_DISPATCH.value,
                to_status=PurchaseStatus.PROCESSING.value,
                handler_id=registrar.id if registrar else None,
                handler_name=registrar.full_name if registrar else None,
                handler_role=registrar.role.value if registrar else None,
                result="success",
                comment="供应商报价材料已齐全，派发至门店主管处理",
                evidence_checked="供应商报价单",
                timestamp=now - timedelta(hours=20)
            )
            db.add(record2)

        if o_data["status"] == PurchaseStatus.CLOSED:
            supervisor = created_users.get("supervisor1")
            record3 = ProcessingRecord(
                order_id=order.id,
                action="复核归档",
                from_status=PurchaseStatus.PROCESSING.value,
                to_status=PurchaseStatus.CLOSED.value,
                handler_id=supervisor.id if supervisor else None,
                handler_name=supervisor.full_name if supervisor else None,
                handler_role=supervisor.role.value if supervisor else None,
                result="success",
                comment="全部资料齐全，验收合格，予以关闭归档",
                evidence_checked="供应商报价单、采购订单、到货验收单",
                timestamp=now - timedelta(days=4)
            )
            db.add(record3)

        if o_data.get("type") == "退回补正":
            supervisor = created_users.get("supervisor2")
            record_reject = ProcessingRecord(
                order_id=order.id,
                action="退回补正",
                from_status=PurchaseStatus.PROCESSING.value,
                to_status=PurchaseStatus.PENDING_DISPATCH.value,
                handler_id=supervisor.id if supervisor else None,
                handler_name=supervisor.full_name if supervisor else None,
                handler_role=supervisor.role.value if supervisor else None,
                result="reject",
                comment=o_data.get("reject_reason"),
                exception_reason=o_data.get("exception_reason"),
                timestamp=now - timedelta(hours=6)
            )
            db.add(record_reject)

            audit = AuditNote(
                order_id=order.id,
                note="退回补正：报价单中缺少海鲜产地检疫证明编号，请采购登记员联系供应商补充完整后重新提交。",
                note_type="退回补正",
                author_id=supervisor.id if supervisor else None,
                author_name=supervisor.full_name if supervisor else None,
                author_role=supervisor.role.value if supervisor else None
            )
            db.add(audit)

        if o_data.get("type") == "超时逾期":
            audit_overdue = AuditNote(
                order_id=order.id,
                note="已超过约定到货日期2天，请主管尽快联系供应商确认发货情况，并补充到货验收凭证。",
                note_type="逾期预警",
                author_id=created_users["reviewer1"].id,
                author_name=created_users["reviewer1"].full_name,
                author_role=created_users["reviewer1"].role.value
            )
            db.add(audit_overdue)

    db.commit()
    print("种子数据植入完成！")
    print("\n=== 演示账号 ===")
    print("生鲜采购登记员: registrar1 / registrar123  (张登记员-朝阳店)")
    print("生鲜采购登记员: registrar2 / registrar123  (李采购员-海淀店)")
    print("生鲜采购审核主管: supervisor1 / supervisor123  (王主管-朝阳店)")
    print("生鲜采购审核主管: supervisor2 / supervisor123  (赵门店经理-海淀店)")
    print("生鲜超市复核负责人: reviewer1 / reviewer123  (陈区域督导)")
    print("\n=== 测试单据 ===")
    for o in orders_data:
        print(f"  {o['order_no']} - {o['title']} [{o['type']}] 状态: {o['status'].value}")
