import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from datetime import datetime, timedelta
from sqlalchemy.orm import Session

from database import engine, Base, SessionLocal
from models import User, TransportOrder, Attachment, ProcessingRecord, ExceptionReason, AuditNote
from auth import get_password_hash


def init_db():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    print("数据库表创建成功")


def create_users(db: Session):
    users = [
        {
            "username": "kefu",
            "full_name": "张客服",
            "password": "123456",
            "role": User.ROLE_CUSTOMER_SERVICE,
        },
        {
            "username": "diaodu",
            "full_name": "李调度",
            "password": "123456",
            "role": User.ROLE_DISPATCH_SUPERVISOR,
        },
        {
            "username": "yunying",
            "full_name": "王运营",
            "password": "123456",
            "role": User.ROLE_OPERATIONS_MANAGER,
        },
    ]

    for u in users:
        existing = db.query(User).filter(User.username == u["username"]).first()
        if not existing:
            user = User(
                username=u["username"],
                full_name=u["full_name"],
                hashed_password=get_password_hash(u["password"]),
                role=u["role"],
            )
            db.add(user)
            print(f"创建用户: {u['username']} / {u['password']} ({u['role']})")

    db.commit()


def create_demo_orders(db: Session):
    now = datetime.utcnow()

    orders = [
        {
            "order_no": "YT20240601001",
            "status": TransportOrder.STATUS_PENDING_CORRECTION,
            "priority": TransportOrder.PRIORITY_HIGH,
            "responsible_person": "张客服",
            "deadline": now + timedelta(days=5),
            "current_handler": "张客服",
            "consignor_name": "华东电子科技有限公司",
            "consignor_contact": "赵经理",
            "consignor_phone": "13800138001",
            "consignee_name": "华南贸易股份公司",
            "consignee_contact": "钱主任",
            "consignee_phone": "13800138002",
            "cargo_name": "精密电子元器件",
            "cargo_weight": "500kg",
            "cargo_volume": "2.5立方米",
            "cargo_quantity": "100箱",
            "departure": "上海浦东新区",
            "destination": "广州天河区",
            "transport_requirements": "需恒温运输，轻拿轻放",
            "vehicle_plate": None,
            "vehicle_type": None,
            "driver_name": None,
            "driver_phone": None,
            "dispatch_time": None,
            "estimated_arrival": None,
            "receipt_signer": None,
            "receipt_time": None,
            "receipt_status": None,
            "receipt_remark": None,
            "version": 1,
            "demo_type": "正常流转-待补正",
            "records": [
                {"action": "创建订单", "operator": "张客服", "operator_role": User.ROLE_CUSTOMER_SERVICE,
                 "new_status": TransportOrder.STATUS_PENDING_CORRECTION,
                 "remark": "客服专员创建运输订单", "evidence_summary": "待上传运输委托单"},
            ],
        },
        {
            "order_no": "YT20240601002",
            "status": TransportOrder.STATUS_UNDER_REVIEW,
            "priority": TransportOrder.PRIORITY_MEDIUM,
            "responsible_person": "李调度",
            "deadline": now + timedelta(days=3),
            "current_handler": "李调度",
            "consignor_name": "北方重工集团",
            "consignor_contact": "孙总",
            "consignor_phone": "13900139001",
            "consignee_name": "西部建设工程公司",
            "consignee_contact": "周工",
            "consignee_phone": "13900139002",
            "cargo_name": "大型机械设备配件",
            "cargo_weight": "3000kg",
            "cargo_volume": "15立方米",
            "cargo_quantity": "20件",
            "departure": "北京昌平区",
            "destination": "成都高新区",
            "transport_requirements": "需大型平板车，固定加固",
            "vehicle_plate": "京A·88888",
            "vehicle_type": "重型平板货车",
            "driver_name": "陈师傅",
            "driver_phone": "13700137001",
            "dispatch_time": now - timedelta(hours=2),
            "estimated_arrival": now + timedelta(days=2),
            "receipt_signer": "周工",
            "receipt_time": now - timedelta(hours=1),
            "receipt_status": "已签收",
            "receipt_remark": "货物完好，签收确认",
            "version": 2,
            "demo_type": "正常流转-复核中",
            "attachments": [
                {"file_name": "运输委托单-YT20240601002.pdf", "file_type": Attachment.TYPE_CONSIGNMENT, "uploaded_by": "张客服"},
                {"file_name": "车辆调度单-YT20240601002.pdf", "file_type": Attachment.TYPE_DISPATCH, "uploaded_by": "李调度"},
                {"file_name": "签收回单-YT20240601002.pdf", "file_type": Attachment.TYPE_RECEIPT, "uploaded_by": "李调度"},
            ],
            "records": [
                {"action": ProcessingRecord.ACTION_SUBMIT, "operator": "张客服", "operator_role": User.ROLE_CUSTOMER_SERVICE,
                 "previous_status": None, "new_status": TransportOrder.STATUS_UNDER_REVIEW,
                 "remark": "提交订单并上传运输委托单", "evidence_summary": "运输委托单已上传"},
                {"action": ProcessingRecord.ACTION_SAVE, "operator": "李调度", "operator_role": User.ROLE_DISPATCH_SUPERVISOR,
                 "previous_status": TransportOrder.STATUS_UNDER_REVIEW, "new_status": TransportOrder.STATUS_UNDER_REVIEW,
                 "remark": "填写车辆调度信息和签收回单信息", "evidence_summary": "车辆调度单、签收回单已上传"},
            ],
        },
        {
            "order_no": "YT20240601003",
            "status": TransportOrder.STATUS_PENDING_CORRECTION,
            "priority": TransportOrder.PRIORITY_HIGH,
            "responsible_person": "张客服",
            "deadline": now - timedelta(days=1),
            "current_handler": "张客服",
            "is_overdue": True,
            "overdue_reason": "截止时间已过，缺少签收回单",
            "consignor_name": "沿海食品有限公司",
            "consignor_contact": "吴经理",
            "consignor_phone": "13600136001",
            "consignee_name": "内陆超市连锁",
            "consignee_contact": "郑店长",
            "consignee_phone": "13600136002",
            "cargo_name": "冷链冷藏食品",
            "cargo_weight": "1200kg",
            "cargo_volume": "6立方米",
            "cargo_quantity": "300箱",
            "departure": "青岛黄岛区",
            "destination": "西安雁塔区",
            "transport_requirements": "全程冷链，-18℃以下",
            "vehicle_plate": "鲁B·66666",
            "vehicle_type": "冷藏车",
            "driver_name": "马师傅",
            "driver_phone": "13500135001",
            "dispatch_time": now - timedelta(days=3),
            "estimated_arrival": now - timedelta(days=1),
            "receipt_signer": None,
            "receipt_time": None,
            "receipt_status": None,
            "receipt_remark": "客户未及时签收，缺少回单",
            "demo_type": "超时逾期-待补正",
            "version": 3,
            "attachments": [
                {"file_name": "运输委托单-YT20240601003.pdf", "file_type": Attachment.TYPE_CONSIGNMENT, "uploaded_by": "张客服"},
                {"file_name": "车辆调度单-YT20240601003.pdf", "file_type": Attachment.TYPE_DISPATCH, "uploaded_by": "李调度"},
            ],
            "records": [
                {"action": ProcessingRecord.ACTION_SUBMIT, "operator": "张客服", "operator_role": User.ROLE_CUSTOMER_SERVICE,
                 "previous_status": None, "new_status": TransportOrder.STATUS_UNDER_REVIEW,
                 "remark": "提交冷链运输订单", "evidence_summary": "运输委托单已上传"},
                {"action": ProcessingRecord.ACTION_REVIEW, "operator": "李调度", "operator_role": User.ROLE_DISPATCH_SUPERVISOR,
                 "previous_status": TransportOrder.STATUS_UNDER_REVIEW, "new_status": TransportOrder.STATUS_UNDER_REVIEW,
                 "remark": "已安排冷藏车辆，上传调度单", "evidence_summary": "车辆调度单已上传"},
                {"action": ProcessingRecord.ACTION_REJECT, "operator": "王运营", "operator_role": User.ROLE_OPERATIONS_MANAGER,
                 "previous_status": TransportOrder.STATUS_UNDER_REVIEW, "new_status": TransportOrder.STATUS_PENDING_CORRECTION,
                 "remark": "缺少签收回单，退回补正。截止时间已临近，请尽快处理", "evidence_summary": "签收回单缺失"},
            ],
            "exceptions": [
                {"category": ExceptionReason.CATEGORY_DEADLINE,
                 "reason": "订单已逾期1天，节点超时责任人：张客服（待补正阶段）",
                 "reported_by": "系统",
                 "node_handler": "张客服"},
                {"category": ExceptionReason.CATEGORY_MATERIAL,
                 "reason": "缺少签收回单证据材料，办结前必须上传",
                 "reported_by": "王运营"},
                {"category": ExceptionReason.CATEGORY_STATUS,
                 "reason": "已从复核中退回待补正，需补充材料后重新提交",
                 "reported_by": "王运营"},
            ],
        },
        {
            "order_no": "YT20240601004",
            "status": TransportOrder.STATUS_PENDING_CORRECTION,
            "priority": TransportOrder.PRIORITY_LOW,
            "responsible_person": "张客服",
            "deadline": now + timedelta(days=7),
            "current_handler": "张客服",
            "consignor_name": "山区农产品合作社",
            "consignor_contact": "冯社长",
            "consignor_phone": "13400134001",
            "consignee_name": "城市生鲜配送中心",
            "consignee_contact": "蒋主管",
            "consignee_phone": "13400134002",
            "cargo_name": "新鲜蔬菜水果",
            "cargo_weight": "800kg",
            "cargo_volume": "4立方米",
            "cargo_quantity": "50筐",
            "departure": "云南昆明",
            "destination": "深圳南山区",
            "transport_requirements": "需保鲜运输，避免挤压",
            "vehicle_plate": None,
            "vehicle_type": None,
            "driver_name": None,
            "driver_phone": None,
            "dispatch_time": None,
            "estimated_arrival": None,
            "receipt_signer": None,
            "receipt_time": None,
            "receipt_status": None,
            "receipt_remark": None,
            "version": 3,
            "demo_type": "缺材料-退回补正",
            "attachments": [
                {"file_name": "运输委托单（不完整）-YT20240601004.pdf", "file_type": Attachment.TYPE_CONSIGNMENT, "uploaded_by": "张客服"},
            ],
            "records": [
                {"action": ProcessingRecord.ACTION_SUBMIT, "operator": "张客服", "operator_role": User.ROLE_CUSTOMER_SERVICE,
                 "previous_status": None, "new_status": TransportOrder.STATUS_UNDER_REVIEW,
                 "remark": "提交农产品运输订单", "evidence_summary": "运输委托单已上传（不完整）"},
                {"action": ProcessingRecord.ACTION_REJECT, "operator": "李调度", "operator_role": User.ROLE_DISPATCH_SUPERVISOR,
                 "previous_status": TransportOrder.STATUS_UNDER_REVIEW, "new_status": TransportOrder.STATUS_PENDING_CORRECTION,
                 "remark": "运输委托单内容不完整，缺少货物明细和保险信息，退回补正", "evidence_summary": "材料不完整"},
                {"action": ProcessingRecord.ACTION_SAVE, "operator": "张客服", "operator_role": User.ROLE_CUSTOMER_SERVICE,
                 "previous_status": TransportOrder.STATUS_PENDING_CORRECTION, "new_status": TransportOrder.STATUS_PENDING_CORRECTION,
                 "remark": "更新委托单内容，补充部分货物信息", "evidence_summary": "待重新审核"},
            ],
            "exceptions": [
                {"category": ExceptionReason.CATEGORY_MATERIAL,
                 "reason": "运输委托单内容不完整，缺少货物明细和保险信息",
                 "reported_by": "李调度"},
                {"category": ExceptionReason.CATEGORY_STATUS,
                 "reason": "已退回补正，需客服专员补充材料后重新提交",
                 "reported_by": "李调度"},
                {"category": ExceptionReason.CATEGORY_PERMISSION,
                 "reason": "越权操作尝试：王运营（运营经理）试图在待补正阶段处理订单，当前处理人为张客服（客服专员）",
                 "reported_by": "系统",
                 "node_handler": "张客服"},
                {"category": ExceptionReason.CATEGORY_STATUS,
                 "reason": "版本冲突：提交版本号2与当前版本号3不一致，可能重复提交",
                 "reported_by": "系统"},
            ],
        },
        {
            "order_no": "YT20240601005",
            "status": TransportOrder.STATUS_PENDING_CORRECTION,
            "priority": "中",
            "responsible_person": "张客服",
            "deadline": now + timedelta(days=10),
            "current_handler": "张客服",
            "consignor_name": "杭州电子科技有限公司",
            "consignor_contact": "王经理",
            "consignor_phone": "13700137000",
            "consignee_name": "武汉智能制造产业园",
            "consignee_contact": "赵工",
            "consignee_phone": "13600136000",
            "cargo_name": "精密电子元器件",
            "cargo_weight": "300kg",
            "cargo_volume": "5立方米",
            "cargo_quantity": "200件",
            "departure": "杭州滨江区",
            "destination": "武汉东湖高新区",
            "transport_requirements": "需防震、防潮运输，避免剧烈震动",
            "vehicle_plate": None,
            "vehicle_type": None,
            "driver_name": None,
            "driver_phone": None,
            "dispatch_time": None,
            "estimated_arrival": None,
            "receipt_signer": None,
            "receipt_time": None,
            "receipt_status": None,
            "receipt_remark": None,
            "version": 1,
            "demo_type": "新建登记-待补正",
            "records": [
                {"action": ProcessingRecord.ACTION_SAVE, "operator": "张客服", "operator_role": User.ROLE_CUSTOMER_SERVICE,
                 "previous_status": None, "new_status": TransportOrder.STATUS_PENDING_CORRECTION,
                 "remark": "创建运输订单，已填写基础信息", "evidence_summary": "待上传运输委托单"},
                {"action": ProcessingRecord.ACTION_SAVE, "operator": "张客服", "operator_role": User.ROLE_CUSTOMER_SERVICE,
                 "previous_status": TransportOrder.STATUS_PENDING_CORRECTION, "new_status": TransportOrder.STATUS_PENDING_CORRECTION,
                 "remark": "补充运输要求和货物明细", "evidence_summary": "待上传运输委托单"},
            ],
            "audit_notes": [
                {"note": "客户加急，优先安排运输方案", "noted_by": "张客服"},
                {"note": "需确认车辆是否有防震设施", "noted_by": "张客服"},
            ],
            "exceptions": [
                {"category": ExceptionReason.CATEGORY_MATERIAL,
                 "reason": "缺少运输委托单证据，待补正阶段必须上传",
                 "reported_by": "系统",
                 "node_handler": "张客服"},
            ],
        },
    ]

    for o in orders:
        existing = db.query(TransportOrder).filter(TransportOrder.order_no == o["order_no"]).first()
        if existing:
            print(f"跳过已存在订单: {o['order_no']}")
            continue

        demo_type = o.pop("demo_type", "")
        attachments_data = o.pop("attachments", [])
        records_data = o.pop("records", [])
        exceptions_data = o.pop("exceptions", [])
        audit_notes_data = o.pop("audit_notes", [])

        order = TransportOrder(**o)
        db.add(order)
        db.flush()
        print(f"创建演示订单[{demo_type}]: {o['order_no']} - {o['status']}")

        for att_data in attachments_data:
            att = Attachment(
                order_id=order.id,
                file_name=att_data["file_name"],
                file_type=att_data["file_type"],
                uploaded_by=att_data["uploaded_by"],
                description=att_data.get("description")
            )
            db.add(att)

        for rec_data in records_data:
            rec = ProcessingRecord(
                order_id=order.id,
                action=rec_data["action"],
                operator=rec_data["operator"],
                operator_role=rec_data["operator_role"],
                previous_status=rec_data.get("previous_status"),
                new_status=rec_data.get("new_status", order.status),
                remark=rec_data.get("remark"),
                evidence_summary=rec_data.get("evidence_summary"),
            )
            db.add(rec)

        for exc_data in exceptions_data:
            exc = ExceptionReason(
                order_id=order.id,
                category=exc_data["category"],
                reason=exc_data["reason"],
                reported_by=exc_data["reported_by"],
                node_handler=exc_data.get("node_handler"),
            )
            db.add(exc)

        for note_data in audit_notes_data:
            note = AuditNote(
                order_id=order.id,
                note=note_data["note"],
                noted_by=note_data["noted_by"],
            )
            db.add(note)

    db.commit()


def main():
    print("=" * 60)
    print("货运物流公司-月底集中处理运输订单系统 - 数据库初始化")
    print("=" * 60)

    init_db()

    db = SessionLocal()
    try:
        create_users(db)
        create_demo_orders(db)
        print("\n" + "=" * 60)
        print("初始化完成！")
        print("=" * 60)
        print("\n演示账号:")
        print("  客服专员:  kefu    / 123456")
        print("  调度主管:  diaodu  / 123456")
        print("  运营经理:  yunying / 123456")
        print("\n四类演示单据:")
        print("  1. YT20240601001 - 正常流转-待补正 (客服专员补正后提交)")
        print("  2. YT20240601002 - 正常流转-复核中 (调度主管核验后提交)")
        print("  3. YT20240601003 - 超时逾期-待补正 (已逾期1天，缺少回单)")
        print("  4. YT20240601004 - 缺材料-退回补正 (委托单内容不完整)")
    finally:
        db.close()


if __name__ == "__main__":
    main()
