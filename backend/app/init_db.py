import asyncio
import sys
from pathlib import Path
from datetime import datetime, timedelta

sys.path.insert(0, str(Path(__file__).parent.parent))

from app.database import init_database, DB_PATH
from app.database import get_db
from app.security import USERS, get_password_hash
from app.services import init_users
from app.constants import ApplicationStatus, Roles, WarningLevel
import aiosqlite


async def init_sample_data():
    conn = await aiosqlite.connect(DB_PATH)
    conn.row_factory = aiosqlite.Row

    await init_users(conn, USERS)

    now = datetime.now()

    sample_applications = [
        {
            "application_no": "EX202406120001",
            "company_name": "正常流转科技有限公司",
            "contact_person": "张三",
            "contact_phone": "13800138001",
            "contact_email": "zhangsan@normal.com",
            "exhibition_type": "标准展位",
            "booth_area": 18.0,
            "booth_preference": "A区主通道旁",
            "status": ApplicationStatus.PENDING_AUDIT,
            "queue": Roles.QUEUES[Roles.AUDIT_SUPERVISOR],
            "current_handler": Roles.AUDIT_SUPERVISOR,
            "version": 2,
            "is_overdue": 0,
            "warning_level": WarningLevel.NORMAL,
            "deadline": (now + timedelta(days=5)).isoformat(),
            "submitted_at": (now - timedelta(days=2)).isoformat(),
            "last_updated_at": (now - timedelta(days=1)).isoformat(),
            "created_by": "registrar1",
            "sync_status": "pending",
            "description": "正常流转单据：展商登记员已提交，待展商审核主管审核"
        },
        {
            "application_no": "EX202406120002",
            "company_name": "缺材料实业有限公司",
            "contact_person": "李四",
            "contact_phone": "13800138002",
            "contact_email": "lisi@missing.com",
            "exhibition_type": "光地展位",
            "booth_area": 36.0,
            "booth_preference": "B区中央位置",
            "status": ApplicationStatus.CORRECTION_REQUIRED,
            "queue": Roles.QUEUES[Roles.REGISTRAR],
            "current_handler": Roles.REGISTRAR,
            "version": 3,
            "is_overdue": 0,
            "warning_level": WarningLevel.NORMAL,
            "deadline": (now + timedelta(days=3)).isoformat(),
            "submitted_at": (now - timedelta(days=5)).isoformat(),
            "last_updated_at": (now - timedelta(hours=12)).isoformat(),
            "created_by": "registrar1",
            "sync_status": "pending",
            "description": "缺材料单据：审核主管发现缺少营业执照副本，已退回补正"
        },
        {
            "application_no": "EX202406120003",
            "company_name": "临期逾期贸易有限公司",
            "contact_person": "王五",
            "contact_phone": "13800138003",
            "contact_email": "wangwu@overdue.com",
            "exhibition_type": "特装展位",
            "booth_area": 54.0,
            "booth_preference": "C区入口处",
            "status": ApplicationStatus.PENDING_REVIEW,
            "queue": Roles.QUEUES[Roles.REVIEW_LEADER],
            "current_handler": Roles.REVIEW_LEADER,
            "version": 4,
            "is_overdue": 1,
            "warning_level": WarningLevel.OVERDUE,
            "deadline": (now - timedelta(days=1)).isoformat(),
            "submitted_at": (now - timedelta(days=10)).isoformat(),
            "last_updated_at": (now - timedelta(days=2)).isoformat(),
            "created_by": "registrar1",
            "sync_status": "pending",
            "description": "超期逾期单据：审核主管已通过，待主办方复核，但已逾期1天"
        },
        {
            "application_no": "EX202406120004",
            "company_name": "状态冲突电子有限公司",
            "contact_person": "赵六",
            "contact_phone": "13800138004",
            "contact_email": "zhaoliu@conflict.com",
            "exhibition_type": "标准展位",
            "booth_area": 9.0,
            "booth_preference": "D区",
            "status": ApplicationStatus.PENDING_BOOTH_CONFIRM,
            "queue": Roles.QUEUES[Roles.REVIEW_LEADER],
            "current_handler": Roles.REVIEW_LEADER,
            "version": 5,
            "is_overdue": 0,
            "warning_level": WarningLevel.APPROACHING,
            "deadline": (now + timedelta(hours=18)).isoformat(),
            "submitted_at": (now - timedelta(days=7)).isoformat(),
            "last_updated_at": (now - timedelta(days=1)).isoformat(),
            "created_by": "registrar1",
            "booth_confirmation_evidence": None,
            "sync_status": "pending",
            "description": "退回补正/状态冲突单据：复核已通过，待展位确认，但缺少确认证据，临期预警"
        }
    ]

    async with conn.cursor() as cur:
        for app in sample_applications:
            await cur.execute(
                "SELECT id FROM exhibitor_applications WHERE application_no = ?",
                (app["application_no"],)
            )
            if not await cur.fetchone():
                desc = app.pop("description")
                columns = ", ".join(app.keys())
                placeholders = ", ".join(["?"] * len(app))
                values = list(app.values())

                await cur.execute(f"""
                    INSERT INTO exhibitor_applications ({columns})
                    VALUES ({placeholders})
                """, values)

                app_id = cur.lastrowid

                await cur.execute("""
                    INSERT INTO processing_records (
                        application_id, action, from_status, to_status, handler, handler_role,
                        comment, correction_reason, reject_reason, previous_handler, version
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    app_id, "create", None, ApplicationStatus.DRAFT,
                    "registrar1", Roles.REGISTRAR, f"创建申请: {desc}",
                    None, None, None, 1
                ))

                if app["application_no"] == "EX202406120001":
                    await cur.execute("""
                        INSERT INTO processing_records (
                            application_id, action, from_status, to_status, handler, handler_role,
                            comment, previous_handler, version
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """, (
                        app_id, "submit", ApplicationStatus.DRAFT, ApplicationStatus.PENDING_AUDIT,
                        "registrar1", Roles.REGISTRAR, "提交审核",
                        "registrar1", 2
                    ))

                elif app["application_no"] == "EX202406120002":
                    await cur.execute("""
                        INSERT INTO processing_records (
                            application_id, action, from_status, to_status, handler, handler_role,
                            comment, previous_handler, version
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """, (
                        app_id, "submit", ApplicationStatus.DRAFT, ApplicationStatus.PENDING_AUDIT,
                        "registrar1", Roles.REGISTRAR, "提交审核",
                        "registrar1", 2
                    ))
                    await cur.execute("""
                        INSERT INTO processing_records (
                            application_id, action, from_status, to_status, handler, handler_role,
                            comment, correction_reason, evidence_required, previous_handler, version
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """, (
                        app_id, "return_for_correction", ApplicationStatus.PENDING_AUDIT,
                        ApplicationStatus.CORRECTION_REQUIRED,
                        "supervisor1", Roles.AUDIT_SUPERVISOR,
                        "材料不齐全，请补充",
                        "缺少营业执照副本复印件",
                        "营业执照副本、法人授权委托书",
                        Roles.AUDIT_SUPERVISOR, 3
                    ))

                elif app["application_no"] == "EX202406120003":
                    await cur.execute("""
                        INSERT INTO processing_records (
                            application_id, action, from_status, to_status, handler, handler_role,
                            comment, previous_handler, version
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """, (
                        app_id, "submit", ApplicationStatus.DRAFT, ApplicationStatus.PENDING_AUDIT,
                        "registrar1", Roles.REGISTRAR, "提交审核",
                        "registrar1", 2
                    ))
                    await cur.execute("""
                        INSERT INTO processing_records (
                            application_id, action, from_status, to_status, handler, handler_role,
                            comment, previous_handler, version
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """, (
                        app_id, "approve_audit", ApplicationStatus.PENDING_AUDIT,
                        ApplicationStatus.PENDING_REVIEW,
                        "supervisor1", Roles.AUDIT_SUPERVISOR, "审核通过",
                        Roles.AUDIT_SUPERVISOR, 3
                    ))
                    await cur.execute("""
                        INSERT INTO processing_records (
                            application_id, action, from_status, to_status, handler, handler_role,
                            comment, previous_handler, version
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """, (
                        app_id, "approve_review", ApplicationStatus.PENDING_REVIEW,
                        ApplicationStatus.PENDING_BOOTH_CONFIRM,
                        "leader1", Roles.REVIEW_LEADER, "复核通过，待展位确认",
                        Roles.REVIEW_LEADER, 4
                    ))
                    await cur.execute("""
                        INSERT INTO processing_records (
                            application_id, action, from_status, to_status, handler, handler_role,
                            comment, previous_handler, version
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """, (
                        app_id, "approve_audit", ApplicationStatus.PENDING_BOOTH_CONFIRM,
                        ApplicationStatus.PENDING_REVIEW,
                        "leader1", Roles.REVIEW_LEADER, "状态异常，重新进入复核流程",
                        Roles.REVIEW_LEADER, 4
                    ))

                elif app["application_no"] == "EX202406120004":
                    await cur.execute("""
                        INSERT INTO processing_records (
                            application_id, action, from_status, to_status, handler, handler_role,
                            comment, previous_handler, version
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """, (
                        app_id, "submit", ApplicationStatus.DRAFT, ApplicationStatus.PENDING_AUDIT,
                        "registrar1", Roles.REGISTRAR, "提交审核",
                        "registrar1", 2
                    ))
                    await cur.execute("""
                        INSERT INTO processing_records (
                            application_id, action, from_status, to_status, handler, handler_role,
                            comment, correction_reason, previous_handler, version
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """, (
                        app_id, "return_for_correction", ApplicationStatus.PENDING_AUDIT,
                        ApplicationStatus.CORRECTION_REQUIRED,
                        "supervisor1", Roles.AUDIT_SUPERVISOR,
                        "请补充参展产品名录",
                        "缺少参展产品详细名录",
                        Roles.AUDIT_SUPERVISOR, 3
                    ))
                    await cur.execute("""
                        INSERT INTO processing_records (
                            application_id, action, from_status, to_status, handler, handler_role,
                            comment, previous_handler, version
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """, (
                        app_id, "correct", ApplicationStatus.CORRECTION_REQUIRED,
                        ApplicationStatus.PENDING_AUDIT,
                        "registrar1", Roles.REGISTRAR, "已补充产品名录",
                        Roles.REGISTRAR, 4
                    ))
                    await cur.execute("""
                        INSERT INTO processing_records (
                            application_id, action, from_status, to_status, handler, handler_role,
                            comment, previous_handler, version
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """, (
                        app_id, "approve_audit", ApplicationStatus.PENDING_AUDIT,
                        ApplicationStatus.PENDING_REVIEW,
                        "supervisor1", Roles.AUDIT_SUPERVISOR, "审核通过",
                        Roles.AUDIT_SUPERVISOR, 5
                    ))
                    await cur.execute("""
                        INSERT INTO processing_records (
                            application_id, action, from_status, to_status, handler, handler_role,
                            comment, previous_handler, version
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """, (
                        app_id, "approve_review", ApplicationStatus.PENDING_REVIEW,
                        ApplicationStatus.PENDING_BOOTH_CONFIRM,
                        "leader1", Roles.REVIEW_LEADER, "复核通过，请上传展位确认函",
                        Roles.REVIEW_LEADER, 5
                    ))

    await conn.commit()
    await conn.close()

    print("演示数据初始化完成！")
    print("四类演示单据：")
    for app in sample_applications:
        print(f"  - {app['application_no']}: {app['company_name']}")
        print(f"    状态: {ApplicationStatus.STATUS_NAMES[app['status']]} | 预警: {WarningLevel.LEVEL_NAMES[app['warning_level']]}")
        print(f"    说明: {app['description']}")
        print()


async def main():
    print("正在初始化数据库...")
    await init_database()
    print("数据库表结构创建完成！")

    print("正在初始化演示数据...")
    await init_sample_data()

    print("\n✅ 数据库初始化全部完成！")
    print(f"数据库文件位置: {DB_PATH}")


if __name__ == "__main__":
    asyncio.run(main())
