import sys
import os
import json
from datetime import datetime, timedelta, date

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.app.db import get_connection, init_database


def seed():
    init_database()
    with get_connection() as conn:
        cur = conn.cursor()

        cur.execute("DELETE FROM exception_records")
        cur.execute("DELETE FROM processing_records")
        cur.execute("DELETE FROM audit_notes")
        cur.execute("DELETE FROM attachments")
        cur.execute("DELETE FROM sale_contracts")
        cur.execute("DELETE FROM pricing_calculations")
        cur.execute("DELETE FROM customers")
        cur.execute("DELETE FROM users")

        users = [
            (1, "custmgr01", "123456", "张伟", "customer_manager"),
            (2, "trade01", "123456", "李娜", "trade_specialist"),
            (3, "risk01", "123456", "王强", "risk_manager"),
            (4, "admin", "admin", "系统管理员", "admin"),
        ]
        cur.executemany(
            "INSERT INTO users (id, username, password, real_name, role) VALUES (?,?,?,?,?)",
            users,
        )

        customers = [
            (1, "CUS001", "京东方光电科技有限公司", "刘经理", "13800138001", "北京市海淀区中关村大街1号", "10kV", 500000.0, "电子制造"),
            (2, "CUS002", "美的集团股份有限公司（北京工厂）", "赵总", "13800138002", "北京市顺义区工业开发区", "35kV", 2000000.0, "家电制造"),
            (3, "CUS003", "物美商业集团（北京大区）", "孙主管", None, "北京市西城区", None, 120000.0, "零售"),
            (4, "CUS004", "比亚迪汽车有限公司", "钱采购", "13800138004", "北京市通州区", "10kV", 1500000.0, "汽车制造"),
        ]
        cur.executemany(
            "INSERT INTO customers (id, customer_code, customer_name, contact_person, contact_phone, address, voltage_level, monthly_usage_kwh, industry) VALUES (?,?,?,?,?,?,?,?,?)",
            customers,
        )

        pricings = [
            (1, "PRC202601", 1, 12, 0.68, 0.95, 0.38, 6000000.0, 4080000.0, 5.0, "approved", 1),
            (2, "PRC202602", 2, 24, 0.65, 0.90, 0.35, 24000000.0, 15600000.0, 8.0, "approved", 1),
            (3, "PRC202603", 3, 12, 0.70, None, None, None, None, 0.0, "draft", 1),
            (4, "PRC202604", 4, 36, 0.62, 0.88, 0.33, 18000000.0, 11160000.0, 10.0, "approved", 1),
        ]
        cur.executemany(
            "INSERT INTO pricing_calculations (id, calculation_code, customer_id, contract_term_months, base_price, peak_price, valley_price, expected_annual_kwh, estimated_annual_amount, discount_rate, status, created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
            pricings,
        )

        today = date.today()

        contracts = [
            (
                "HT2026CASE001",
                "京东方光电年度购售电合同",
                1, 1, 4080000.0,
                str(today.replace(month=1, day=1) if today.month > 1 else date(today.year-1,1,1)),
                str(today.replace(month=12, day=31)),
                str(today - timedelta(days=15)),
                str(today + timedelta(days=15)),
                "risk_manager",
                "待复核",
                3,
                3, None,
                "材料齐全，交易专员已审核通过，建议复核",
                "风险经理王强待复核",
                1,
            ),
            (
                "HT2026CASE002",
                "美的集团北京工厂两年期购售电合同",
                2, None, 0.0,
                None, None, None,
                str(today - timedelta(days=1)),
                "customer_manager",
                "待提交",
                1,
                1, None, None, None,
                1,
            ),
            (
                "HT2026CASE003",
                "物美北京大区月度购售电合同",
                3, 3, 80000.0,
                str(today),
                str(today + timedelta(days=365)),
                str(today - timedelta(days=30)),
                str(today - timedelta(days=5)),
                "trade_specialist",
                "待审核",
                2,
                2, None, "客户经理已补正部分资料，仍需确认",
                "已逾期5天，需紧急处理",
                1,
            ),
            (
                "HT2026CASE004",
                "比亚迪三年期战略购售电合同",
                4, 4, 11160000.0,
                str(today),
                str(today + timedelta(days=3*365-1)),
                str(today - timedelta(days=20)),
                str(today + timedelta(days=25)),
                "customer_manager",
                "重新提交",
                3,
                1, 3,
                "风控复核中发现合同期限条款表述不清晰，需重新修订后提交",
                "风控退回，客户经理需重新补正合同条款",
                1,
            ),
        ]

        cur.executemany(
            """
            INSERT INTO sale_contracts
            (contract_no, contract_name, customer_id, pricing_id, contract_amount,
             term_start_date, term_end_date, sign_date, deadline,
             current_stage, status, version, current_handler_id,
             previous_handler_id, previous_opinion, audit_remark, created_by)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
            """,
            contracts,
        )

        cur.execute(
            "UPDATE sale_contracts SET version = 3, updated_at = CURRENT_TIMESTAMP WHERE contract_no = 'HT2026CASE003'"
        )
        cur.execute(
            "UPDATE sale_contracts SET version = 2, updated_at = CURRENT_TIMESTAMP WHERE contract_no = 'HT2026CASE004'"
        )

        attachments = [
            (1, "HT2026CASE001_合同扫描件.pdf", "application/pdf", 2048000, 1, "customer_manager"),
            (1, "HT2026CASE001_授权委托书.pdf", "application/pdf", 512000, 1, "customer_manager"),
            (1, "HT2026CASE001_交易确认单.pdf", "application/pdf", 1024000, 2, "trade_specialist"),
            (1, "HT2026CASE001_价格核查报告.xlsx", "application/vnd.ms-excel", 256000, 2, "trade_specialist"),
            (3, "物美授权书.pdf", "application/pdf", 300000, 1, "customer_manager"),
            (4, "比亚迪原合同版本v1.pdf", "application/pdf", 2500000, 1, "customer_manager"),
            (4, "比亚迪风控退回意见.pdf", "application/pdf", 180000, 3, "risk_manager"),
        ]
        cur.executemany(
            "INSERT INTO attachments (contract_id, file_name, file_type, file_size, uploaded_by, stage) VALUES (?,?,?,?,?,?)",
            attachments,
        )

        records = [
            (1, "customer_manager", "submit", "待提交", "待审核", 1, "张伟", "customer_manager",
             "材料齐全，报价测算完整，已通过客户经理初审",
             json.dumps({"contract_scan": True, "customer_authorization": True}, ensure_ascii=False), 2),
            (1, "trade_specialist", "approve", "待审核", "待复核", 2, "李娜", "trade_specialist",
             "价格合理，交易条款符合公司要求，提交风控复核",
             json.dumps({"trade_confirmation": True, "price_check_report": True}, ensure_ascii=False), 3),

            (3, "customer_manager", "submit", "待提交", "待审核", 1, "张伟", "customer_manager",
             "客户联系人信息暂缺，先进入审核",
             json.dumps({"contract_scan": True, "customer_authorization": False}, ensure_ascii=False), 2),

            (4, "customer_manager", "submit", "待提交", "待审核", 1, "张伟", "customer_manager",
             "大客户战略合同，提交审核",
             json.dumps({"contract_scan": True, "customer_authorization": True}, ensure_ascii=False), 2),
            (4, "trade_specialist", "approve", "待审核", "待复核", 2, "李娜", "trade_specialist",
             "价格优惠合理，战略意义重大，同意",
             json.dumps({"trade_confirmation": True, "price_check_report": True}, ensure_ascii=False), 3),
            (4, "risk_manager", "reject", "待复核", "重新提交", 3, "王强", "risk_manager",
             "合同期限条款表述不清晰，第3条第2款与附件不一致，需重新修订",
             json.dumps({"risk_assessment": False, "compliance_check": False, "issue_detail": "期限条款表述不清晰"}, ensure_ascii=False), 4),
        ]
        cur.executemany(
            """
            INSERT INTO processing_records
            (contract_id, stage, action, from_status, to_status, handler_id, handler_name,
             handler_role, opinion, evidence_json, version)
            VALUES (?,?,?,?,?,?,?,?,?,?,?)
            """,
            records,
        )

        audit_notes = [
            (1, "大客户部季度重点推进合同，预计贡献利润120万元", 2, "李娜"),
            (3, "物美联系人缺失，后续需补全，已标记逾期", 4, "系统管理员"),
            (4, "风控退回后需客户经理重新梳理合同条款附件，特别是第3条第2款期限表述", 3, "王强"),
        ]
        cur.executemany(
            "INSERT INTO audit_notes (contract_id, note, noted_by, noted_by_name) VALUES (?,?,?,?)",
            audit_notes,
        )

        exceptions = [
            (3, "时限问题", "E_DEADLINE_OVERDUE", f"合同单已逾期5天未完成交易专员审核", json.dumps({"overdue_days": 5, "responsible": "李娜"}, ensure_ascii=False), "trade_specialist", 4),
            (2, "材料问题", "E_MISSING_MATERIAL", "提交前检测缺项：用电客户(无)、报价测算未关联", json.dumps({"customer": [], "pricing": ["报价测算未关联"]}, ensure_ascii=False), "customer_manager", 1),
            (4, "状态问题", "E_STATUS_ACTION_INVALID", "风控阶段检测到状态冲突：期限条款与附件不一致", json.dumps({"conflict_fields": ["term_start_date", "附件期限条款"]}, ensure_ascii=False), "risk_manager", 3),
        ]
        cur.executemany(
            "INSERT INTO exception_records (contract_id, exception_type, exception_code, message, detail_json, stage, triggered_by) VALUES (?,?,?,?,?,?,?)",
            exceptions,
        )

        print("✅ SQLite 数据库初始化完成")
        print("📁 数据库文件位置：backend/data/electric_contracts.db")
        print("")
        print("👥 演示账号：")
        for u in users:
            print(f"   用户名: {u[1]}  密码: {u[2]}  姓名: {u[3]}  角色: {u[4]}")
        print("")
        print("📋 四类演示单据：")
        print("   1. HT2026CASE001 [正常流转]    京东方光电 → 已到风控待复核（材料齐全）")
        print("   2. HT2026CASE002 [缺材料]      美的集团 → 客户经理待提交（缺报价测算、联系人电话空）")
        print("   3. HT2026CASE003 [超时逾期]    物美商业 → 交易专员待审核（已逾期5天）")
        print("   4. HT2026CASE004 [退回补正/状态冲突] 比亚迪 → 客户经理重新提交（风控退回）")
        print("")
        print("⚠️  异常样例（exception_records 表可查）：")
        print("   1. HT2026CASE003 时限问题 - 已逾期5天，责任人李娜")
        print("   2. HT2026CASE002 材料问题 - 缺报价测算关联")
        print("   3. HT2026CASE004 状态问题 - 期限条款与附件不一致")


if __name__ == "__main__":
    seed()
