import asyncio
from database import get_db, init_db
from auth import hash_password
from datetime import date, timedelta


async def seed_data():
    await init_db()
    db = await get_db()
    try:
        users = [
            ("wang_cm", hash_password("123456"), "王建国", "客户经理", "城东支行"),
            ("li_cm", hash_password("123456"), "李美丽", "客户经理", "城东支行"),
            ("zhang_os", hash_password("123456"), "张伟", "运营主管", "城东支行"),
            ("liu_bm", hash_password("123456"), "刘芳", "支行行长", "城东支行"),
        ]
        for username, pwd_hash, real_name, role, branch in users:
            await db.execute(
                "INSERT OR IGNORE INTO users (username, password_hash, real_name, role, branch) VALUES (?, ?, ?, ?, ?)",
                (username, pwd_hash, real_name, role, branch),
            )

        today = date.today()
        far_future = today + timedelta(days=30)
        approaching = today + timedelta(days=2)
        overdue = today - timedelta(days=5)
        long_overdue = today - timedelta(days=15)

        applications = [
            {
                "no": "KH2026060001",
                "name": "陈小明",
                "idcard": "110101199001011234",
                "phone": "13800000001",
                "address": "北京市朝阳区建国路88号",
                "type": "个人储蓄卡",
                "amount": 50000,
                "status": "待签收",
                "handler": None,
                "handler_role": "运营主管",
                "cm": "王建国",
                "branch": "城东支行",
                "version": 1,
                "due": far_future.isoformat(),
            },
            {
                "no": "KH2026060002",
                "name": "赵大伟",
                "idcard": "110101198505055678",
                "phone": "13800000002",
                "address": "北京市海淀区中关村大街1号",
                "type": "个人储蓄卡",
                "amount": 100000,
                "status": "待签收",
                "handler": None,
                "handler_role": "运营主管",
                "cm": "王建国",
                "branch": "城东支行",
                "version": 1,
                "due": approaching.isoformat(),
            },
            {
                "no": "KH2026060003",
                "name": "孙小红",
                "idcard": "110101199203039012",
                "phone": "13800000003",
                "address": "北京市西城区金融街15号",
                "type": "个人储蓄卡",
                "amount": 20000,
                "status": "待签收",
                "handler": None,
                "handler_role": "运营主管",
                "cm": "李美丽",
                "branch": "城东支行",
                "version": 1,
                "due": overdue.isoformat(),
            },
            {
                "no": "KH2026060004",
                "name": "周志强",
                "idcard": "110101198807073456",
                "phone": "13800000004",
                "address": "北京市东城区王府井大街201号",
                "type": "定期存单",
                "amount": 500000,
                "status": "异常回传",
                "handler": "王建国",
                "handler_role": "客户经理",
                "cm": "王建国",
                "branch": "城东支行",
                "version": 3,
                "due": far_future.isoformat(),
            },
            {
                "no": "KH2026060005",
                "name": "吴秀兰",
                "idcard": "110101197502027890",
                "phone": "13800000005",
                "address": "北京市丰台区南三环西路16号",
                "type": "个人储蓄卡",
                "amount": 80000,
                "status": "待签收",
                "handler": "张伟",
                "handler_role": "运营主管",
                "cm": "李美丽",
                "branch": "城东支行",
                "version": 2,
                "due": long_overdue.isoformat(),
            },
            {
                "no": "KH2026060006",
                "name": "郑海涛",
                "idcard": "110101199508082345",
                "phone": "13800000006",
                "address": "北京市通州区新华大街99号",
                "type": "个人储蓄卡",
                "amount": 15000,
                "status": "待签收",
                "handler": "刘芳",
                "handler_role": "支行行长",
                "cm": "王建国",
                "branch": "城东支行",
                "version": 3,
                "due": far_future.isoformat(),
            },
            {
                "no": "KH2026060007",
                "name": "黄晓峰",
                "idcard": "110101199101016789",
                "phone": "13800000007",
                "address": "北京市石景山区古城大街100号",
                "type": "理财账户",
                "amount": 300000,
                "status": "待签收",
                "handler": "张伟",
                "handler_role": "运营主管",
                "cm": "王建国",
                "branch": "城东支行",
                "version": 2,
                "due": approaching.isoformat(),
            },
            {
                "no": "KH2026060008",
                "name": "林美玲",
                "idcard": "110101199706063456",
                "phone": "13800000008",
                "address": "北京市昌平区回龙观西大街8号",
                "type": "个人储蓄卡",
                "amount": 5000,
                "status": "异常回传",
                "handler": "李美丽",
                "handler_role": "客户经理",
                "cm": "李美丽",
                "branch": "城东支行",
                "version": 2,
                "due": far_future.isoformat(),
            },
            {
                "no": "KH2026060009",
                "name": "许文强",
                "idcard": "310101198012129012",
                "phone": "13800000009",
                "address": "上海市浦东新区陆家嘴环路1000号",
                "type": "定期存单",
                "amount": 1000000,
                "status": "待签收",
                "handler": None,
                "handler_role": "运营主管",
                "cm": "李美丽",
                "branch": "城东支行",
                "version": 1,
                "due": far_future.isoformat(),
            },
            {
                "no": "KH2026060010",
                "name": "何雨萱",
                "idcard": "110101200001014567",
                "phone": "13800000010",
                "address": "北京市顺义区天竺镇府前街1号",
                "type": "个人储蓄卡",
                "amount": 3000,
                "status": "签收完成",
                "handler": None,
                "handler_role": None,
                "cm": "王建国",
                "branch": "城东支行",
                "version": 3,
                "due": far_future.isoformat(),
            },
        ]

        for app in applications:
            await db.execute(
                """INSERT OR IGNORE INTO account_applications
                   (application_no, customer_name, id_card_no, phone, address, account_type,
                    amount, status, current_handler, current_role, customer_manager,
                    branch, version, due_date)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    app["no"], app["name"], app["idcard"], app["phone"], app["address"],
                    app["type"], app["amount"], app["status"], app["handler"], app["handler_role"],
                    app["cm"], app["branch"], app["version"], app["due"],
                ),
            )

        await db.commit()

        await db.execute("SELECT id, application_no FROM account_applications")
        rows = await db.fetchall()
        app_map = {row["application_no"]: row["id"] for row in rows}

        records = [
            {
                "app_no": "KH2026060005",
                "action": "提交申请",
                "from_status": None,
                "to_status": "待签收",
                "operator": "王建国",
                "role": "客户经理",
                "remark": "客户吴秀兰开户申请提交",
                "version_before": None,
                "version_after": 1,
            },
            {
                "app_no": "KH2026060005",
                "action": "签收",
                "from_status": "待签收",
                "to_status": "待签收",
                "operator": "张伟",
                "role": "运营主管",
                "remark": "运营主管签收处理中",
                "version_before": 1,
                "version_after": 2,
            },
            {
                "app_no": "KH2026060006",
                "action": "提交申请",
                "from_status": None,
                "to_status": "待签收",
                "operator": "王建国",
                "role": "客户经理",
                "remark": "客户郑海涛开户申请",
                "version_before": None,
                "version_after": 1,
            },
            {
                "app_no": "KH2026060006",
                "action": "审核通过",
                "from_status": "待签收",
                "to_status": "待签收",
                "operator": "张伟",
                "role": "运营主管",
                "remark": "资料齐全，审核通过",
                "evidence_required": "身份证复印件、住址证明、收入证明",
                "evidence_provided": "身份证复印件、住址证明、收入证明",
                "version_before": 1,
                "version_after": 2,
            },
            {
                "app_no": "KH2026060006",
                "action": "签收",
                "from_status": "待签收",
                "to_status": "待签收",
                "operator": "刘芳",
                "role": "支行行长",
                "remark": "支行行长签收复核中",
                "version_before": 2,
                "version_after": 3,
            },
            {
                "app_no": "KH2026060004",
                "action": "提交申请",
                "from_status": None,
                "to_status": "待签收",
                "operator": "王建国",
                "role": "客户经理",
                "remark": "周志强定期存单开户",
                "version_before": None,
                "version_after": 1,
            },
            {
                "app_no": "KH2026060004",
                "action": "退回补正",
                "from_status": "待签收",
                "to_status": "异常回传",
                "operator": "张伟",
                "role": "运营主管",
                "remark": "缺少资金来源证明，退回客户经理补正",
                "evidence_required": "身份证复印件、资金来源证明",
                "evidence_provided": "身份证复印件",
                "version_before": 1,
                "version_after": 2,
            },
            {
                "app_no": "KH2026060004",
                "action": "补正重提",
                "from_status": "异常回传",
                "to_status": "异常回传",
                "operator": "王建国",
                "role": "客户经理",
                "remark": "已补充收入证明，请再次审核",
                "version_before": 2,
                "version_after": 3,
            },
            {
                "app_no": "KH2026060007",
                "action": "提交申请",
                "from_status": None,
                "to_status": "待签收",
                "operator": "王建国",
                "role": "客户经理",
                "remark": "黄晓峰理财账户申请",
                "version_before": None,
                "version_after": 1,
            },
            {
                "app_no": "KH2026060007",
                "action": "签收",
                "from_status": "待签收",
                "to_status": "待签收",
                "operator": "张伟",
                "role": "运营主管",
                "remark": "运营主管签收处理中",
                "version_before": 1,
                "version_after": 2,
            },
            {
                "app_no": "KH2026060008",
                "action": "提交申请",
                "from_status": None,
                "to_status": "待签收",
                "operator": "李美丽",
                "role": "客户经理",
                "remark": "林美玲储蓄卡开户",
                "version_before": None,
                "version_after": 1,
            },
            {
                "app_no": "KH2026060008",
                "action": "退回补正",
                "from_status": "待签收",
                "to_status": "异常回传",
                "operator": "张伟",
                "role": "运营主管",
                "remark": "身份证照片模糊，且缺少住址证明",
                "evidence_required": "身份证复印件、住址证明",
                "evidence_provided": "模糊身份证照片",
                "version_before": 1,
                "version_after": 2,
            },
            {
                "app_no": "KH2026060010",
                "action": "提交申请",
                "from_status": None,
                "to_status": "待签收",
                "operator": "王建国",
                "role": "客户经理",
                "remark": "何雨萱储蓄卡开户",
                "version_before": None,
                "version_after": 1,
            },
            {
                "app_no": "KH2026060010",
                "action": "审核通过",
                "from_status": "待签收",
                "to_status": "待签收",
                "operator": "张伟",
                "role": "运营主管",
                "remark": "资料齐全",
                "evidence_required": "身份证、学生证、住址证明",
                "evidence_provided": "身份证、学生证、住址证明",
                "version_before": 1,
                "version_after": 2,
            },
            {
                "app_no": "KH2026060010",
                "action": "复核通过",
                "from_status": "待签收",
                "to_status": "签收完成",
                "operator": "刘芳",
                "role": "支行行长",
                "remark": "通过",
                "version_before": 2,
                "version_after": 3,
            },
        ]

        for rec in records:
            app_id = app_map.get(rec["app_no"])
            if app_id:
                await db.execute(
                    """INSERT INTO processing_records
                       (application_id, action, from_status, to_status, operator, operator_role,
                        remark, evidence_required, evidence_provided, version_before, version_after)
                       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                    (
                        app_id, rec["action"], rec["from_status"], rec["to_status"],
                        rec["operator"], rec["role"], rec["remark"],
                        rec.get("evidence_required"), rec.get("evidence_provided"),
                        rec["version_before"], rec["version_after"],
                    ),
                )

        exceptions = [
            {
                "app_no": "KH2026060004",
                "type": "缺材料",
                "desc": "缺少资金来源证明，定期存单50万元需提供收入或资产证明",
                "by": "张伟",
                "role": "运营主管",
                "resolved": 0,
            },
            {
                "app_no": "KH2026060008",
                "type": "缺材料",
                "desc": "身份证照片模糊无法识别，且缺少住址证明文件",
                "by": "张伟",
                "role": "运营主管",
                "resolved": 0,
            },
            {
                "app_no": "KH2026060005",
                "type": "逾期",
                "desc": "该申请已逾期15天未处理，节点超时责任人：运营主管张伟",
                "by": "系统",
                "role": "系统",
                "resolved": 0,
            },
            {
                "app_no": "KH2026060003",
                "type": "逾期",
                "desc": "该申请已逾期5天未签收处理，节点超时责任人：待分配",
                "by": "系统",
                "role": "系统",
                "resolved": 0,
            },
        ]

        for exc in exceptions:
            app_id = app_map.get(exc["app_no"])
            if app_id:
                await db.execute(
                    """INSERT INTO exception_reasons
                       (application_id, reason_type, description, reported_by, reported_by_role, is_resolved)
                       VALUES (?, ?, ?, ?, ?, ?)""",
                    (app_id, exc["type"], exc["desc"], exc["by"], exc["role"], exc["resolved"]),
                )

        audit_notes = [
            {
                "app_no": "KH2026060004",
                "note": "客户周志强调取50万定期存单，需特别关注资金来源合规性",
                "by": "张伟",
                "role": "运营主管",
            },
            {
                "app_no": "KH2026060006",
                "note": "大额存款客户，已完成面签，资料齐全",
                "by": "刘芳",
                "role": "支行行长",
            },
        ]

        for note in audit_notes:
            app_id = app_map.get(note["app_no"])
            if app_id:
                await db.execute(
                    """INSERT INTO audit_notes
                       (application_id, note, noted_by, noted_by_role)
                       VALUES (?, ?, ?, ?)""",
                    (app_id, note["note"], note["by"], note["role"]),
                )

        attachments = [
            {"app_no": "KH2026060006", "name": "身份证正面.jpg", "type": "image/jpeg", "by": "王建国"},
            {"app_no": "KH2026060006", "name": "身份证反面.jpg", "type": "image/jpeg", "by": "王建国"},
            {"app_no": "KH2026060006", "name": "住址证明.pdf", "type": "application/pdf", "by": "王建国"},
            {"app_no": "KH2026060006", "name": "收入证明.pdf", "type": "application/pdf", "by": "王建国"},
            {"app_no": "KH2026060004", "name": "身份证复印件.pdf", "type": "application/pdf", "by": "王建国"},
            {"app_no": "KH2026060004", "name": "收入证明.pdf", "type": "application/pdf", "by": "王建国"},
        ]

        for att in attachments:
            app_id = app_map.get(att["app_no"])
            if app_id:
                await db.execute(
                    """INSERT INTO attachments
                       (application_id, file_name, file_type, uploaded_by)
                       VALUES (?, ?, ?, ?)""",
                    (app_id, att["name"], att["type"], att["by"]),
                )

        await db.commit()
        print("Seed data inserted successfully!")
    finally:
        await db.close()


if __name__ == "__main__":
    asyncio.run(seed_data())
