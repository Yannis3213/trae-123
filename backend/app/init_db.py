import asyncio
import sys
from pathlib import Path
from datetime import datetime, timedelta

sys.path.insert(0, str(Path(__file__).parent.parent))

from app.database import init_database, DB_PATH
from app.security import USERS, get_password_hash
from app.services import init_users, RESPONSIBLE_MAP, DEFAULT_EVIDENCE_CHECKLIST, STATUS_DEADLINE_HOURS
from app.constants import ApplicationStatus, Roles, WarningLevel
from app.middleware import calculate_warning_level
import aiosqlite
import json


async def calc_deadline_and_warning(status: str, hours_offset: float = 0):
    base_hours = STATUS_DEADLINE_HOURS.get(status, 48)
    deadline = datetime.now() + timedelta(hours=base_hours + hours_offset)
    warning_level, is_overdue = calculate_warning_level(deadline)
    return deadline, warning_level, is_overdue


def get_evidence_checklist_json(status: str, mark_present: list = None) -> str:
    items = DEFAULT_EVIDENCE_CHECKLIST.get(status, [])
    if mark_present:
        result = []
        for item in items:
            new_item = dict(item)
            if item["name"] in mark_present:
                new_item["has_evidence"] = True
            result.append(new_item)
        return json.dumps(result, ensure_ascii=False)
    return json.dumps(items, ensure_ascii=False)


async def init_sample_data():
    conn = await aiosqlite.connect(DB_PATH)
    conn.row_factory = aiosqlite.Row

    await init_users(conn, USERS)

    now = datetime.now()
    descriptions = {}

    sample_applications_meta = [
        {
            "application_no": "EX202406120001",
            "company_name": "正常流转科技有限公司",
            "contact_person": "张三",
            "contact_phone": "13800138001",
            "contact_email": "zhangsan@normal.com",
            "exhibition_type": "标准展位",
            "booth_area": 18.0,
            "booth_preference": "A区主通道旁",
            "status": ApplicationStatus.DRAFT,
            "queue": Roles.QUEUES[Roles.REGISTRAR],
            "current_handler": "registrar1",
            "version": 1,
            "deadline_offset": 0,
            "submitted_offset_days": 0,
            "updated_offset_days": 0,
            "created_by": "registrar1",
            "sync_status": "pending",
            "booth_confirmation_evidence": None,
            "evidence_status_present": [],
            "pending_corrections": None,
            "description": "【正常流转】完整流程演示单据：草稿状态，展商登记员可提交→展商审核主管审核→主办方复核→展位确认→归档→同步",
            "overdue_exception": False,
        },
        {
            "application_no": "EX202406120002",
            "company_name": "缺材料补正实业有限公司",
            "contact_person": "李四",
            "contact_phone": "13800138002",
            "contact_email": "lisi@correction.com",
            "exhibition_type": "光地展位",
            "booth_area": 36.0,
            "booth_preference": "B区中央位置",
            "status": ApplicationStatus.CORRECTION_REQUIRED,
            "queue": Roles.QUEUES[Roles.REGISTRAR],
            "current_handler": "registrar1",
            "version": 3,
            "deadline_offset": 24,
            "submitted_offset_days": 5,
            "updated_offset_hours": 12,
            "created_by": "registrar1",
            "sync_status": "pending",
            "booth_confirmation_evidence": None,
            "evidence_status_present": ["营业执照副本"],
            "pending_corrections": [
                {
                    "reason": "缺少法人授权委托书和参展产品详细名录",
                    "evidence_required": "1. 法人授权委托书(加盖公章)；2. 参展产品详细名录(含规格型号)",
                    "deadline_hours": 72,
                    "returned_by": "supervisor1",
                    "returned_by_name": "王审核主管",
                    "returned_at": (now - timedelta(hours=12)).isoformat(),
                }
            ],
            "description": "【退回补正】需补正材料：展商登记员补正后可重新提交→审核→复核→展位确认→归档→同步",
            "overdue_exception": False,
        },
        {
            "application_no": "EX202406120003",
            "company_name": "逾期预警贸易有限公司",
            "contact_person": "王五",
            "contact_phone": "13800138003",
            "contact_email": "wangwu@overdue.com",
            "exhibition_type": "特装展位",
            "booth_area": 54.0,
            "booth_preference": "C区入口处",
            "status": ApplicationStatus.PENDING_REVIEW,
            "queue": Roles.QUEUES[Roles.REVIEW_LEADER],
            "current_handler": "leader1",
            "version": 4,
            "deadline_offset": -36,
            "submitted_offset_days": 10,
            "updated_offset_days": 2,
            "created_by": "registrar1",
            "sync_status": "pending",
            "booth_confirmation_evidence": None,
            "evidence_status_present": ["营业执照副本", "法人授权委托书", "审核意见签字确认", "资质材料复核通过"],
            "pending_corrections": None,
            "description": "【已逾期】主办方复核环节已逾期36小时，批量操作会被拦截，需在详情页逐条处理并注明逾期原因→展位确认→归档→同步",
            "overdue_exception": True,
        },
        {
            "application_no": "EX202406120004",
            "company_name": "证据闭环电子有限公司",
            "contact_person": "赵六",
            "contact_phone": "13800138004",
            "contact_email": "zhaoliu@evidence.com",
            "exhibition_type": "标准展位",
            "booth_area": 9.0,
            "booth_preference": "D区精品展示区",
            "status": ApplicationStatus.PENDING_BOOTH_CONFIRM,
            "queue": Roles.QUEUES[Roles.REVIEW_LEADER],
            "current_handler": "leader1",
            "version": 5,
            "deadline_offset": 18,
            "submitted_offset_days": 7,
            "updated_offset_days": 1,
            "created_by": "registrar1",
            "sync_status": "pending",
            "booth_confirmation_evidence": None,
            "evidence_status_present": ["营业执照副本", "法人授权委托书", "审核意见签字确认", "资质材料复核通过"],
            "pending_corrections": None,
            "description": "【临期+证据闭环】待展位确认，临期预警18小时，缺少展位确认函证据，上传证据后→归档→同步",
            "overdue_exception": False,
        },
    ]

    async with conn.cursor() as cur:
        for meta in sample_applications_meta:
            await cur.execute(
                "SELECT id FROM exhibitor_applications WHERE application_no = ?",
                (meta["application_no"],)
            )
            if await cur.fetchone():
                continue

            status = meta["status"]
            responsible_role = Roles.REGISTRAR
            if status in [ApplicationStatus.PENDING_AUDIT]:
                responsible_role = Roles.AUDIT_SUPERVISOR
            elif status in [ApplicationStatus.PENDING_REVIEW, ApplicationStatus.PENDING_BOOTH_CONFIRM,
                           ApplicationStatus.AUDIT_PASSED, ApplicationStatus.BOOTH_CONFIRMED]:
                responsible_role = Roles.REVIEW_LEADER
            elif status == ApplicationStatus.CORRECTION_REQUIRED:
                responsible_role = Roles.REGISTRAR

            resp_username, resp_name = RESPONSIBLE_MAP.get(responsible_role, ("unknown", "未知责任人"))
            deadline, warning_level, is_overdue = await calc_deadline_and_warning(status, meta["deadline_offset"])

            submitted_at = (now - timedelta(days=meta.get("submitted_offset_days", 0))).isoformat()
            if "updated_offset_hours" in meta:
                last_updated_at = (now - timedelta(hours=meta["updated_offset_hours"])).isoformat()
            else:
                last_updated_at = (now - timedelta(days=meta.get("updated_offset_days", 0))).isoformat()

            evidence_json = get_evidence_checklist_json(
                ApplicationStatus.PENDING_AUDIT if status in [ApplicationStatus.DRAFT, ApplicationStatus.CORRECTION_REQUIRED]
                else (ApplicationStatus.PENDING_REVIEW if status == ApplicationStatus.PENDING_REVIEW
                      else (ApplicationStatus.PENDING_BOOTH_CONFIRM if status == ApplicationStatus.PENDING_BOOTH_CONFIRM
                            else ApplicationStatus.PENDING_AUDIT)),
                meta["evidence_status_present"]
            )

            pending_json = json.dumps(meta["pending_corrections"], ensure_ascii=False) if meta["pending_corrections"] else None

            await cur.execute(f"""
                INSERT INTO exhibitor_applications (
                    application_no, company_name, contact_person, contact_phone, contact_email,
                    exhibition_type, booth_area, booth_preference, status, queue,
                    current_handler, current_handler_name, responsible_person, responsible_person_name,
                    version, is_overdue, warning_level, deadline,
                    submitted_at, last_updated_at, created_by, booth_confirmation_evidence,
                    evidence_checklist, pending_correction_actions, sync_status
                ) VALUES ({','.join(['?'] * 25)})
            """, (
                meta["application_no"], meta["company_name"], meta["contact_person"],
                meta["contact_phone"], meta["contact_email"], meta["exhibition_type"],
                meta["booth_area"], meta["booth_preference"], status, meta["queue"],
                meta["current_handler"], "李登记员" if meta["current_handler"] == "registrar1"
                    else ("王审核主管" if meta["current_handler"] == "supervisor1" else "张复核负责人"),
                resp_username, resp_name,
                meta["version"], 1 if is_overdue else 0, warning_level, deadline.isoformat(),
                submitted_at, last_updated_at, meta["created_by"], meta["booth_confirmation_evidence"],
                evidence_json, pending_json, meta["sync_status"]
            ))

            app_id = cur.lastrowid
            descriptions[meta["application_no"]] = meta["description"]

            app_no = meta["application_no"]

            await cur.execute("""
                INSERT INTO processing_records (
                    application_id, action, from_status, to_status, handler, handler_role,
                    comment, correction_action, previous_handler_name, previous_handler_role,
                    previous_result, version
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                app_id, "create", None, ApplicationStatus.DRAFT,
                "registrar1", Roles.REGISTRAR, "创建展商申请",
                "步骤1：完善公司基础信息 步骤2：上传营业执照副本、法人授权委托书等资质 步骤3：提交进入审核流程",
                None, None, None, 1
            ))

            if app_no == "EX202406120001":
                pass

            elif app_no == "EX202406120002":
                await cur.execute("""
                    INSERT INTO processing_records (
                        application_id, action, from_status, to_status, handler, handler_role,
                        comment, correction_action, previous_handler_name, previous_handler_role,
                        previous_result, version
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    app_id, "submit", ApplicationStatus.DRAFT, ApplicationStatus.PENDING_AUDIT,
                    "registrar1", Roles.REGISTRAR, "提交审核，已上传营业执照副本",
                    "已完成：基础信息填写、营业执照副本上传；下一步：等待审核主管审核资质",
                    "李登记员", Roles.REGISTRAR, "信息填写完成，提交审核", 2
                ))
                await cur.execute("""
                    INSERT INTO processing_records (
                        application_id, action, from_status, to_status, handler, handler_role,
                        comment, correction_reason, evidence_required, correction_action,
                        previous_handler_name, previous_handler_role, previous_result, version
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    app_id, "return_for_correction", ApplicationStatus.PENDING_AUDIT,
                    ApplicationStatus.CORRECTION_REQUIRED,
                    "supervisor1", Roles.AUDIT_SUPERVISOR,
                    "资质审核发现材料缺失，退回补正",
                    "缺少【法人授权委托书】和【参展产品详细名录】，营业执照副本已核验通过",
                    "1. 法人授权委托书(需法人签字并加盖公章)；2. 参展产品详细名录(含产品名称、规格、图片)",
                    "请展商登记员在72小时内补充上述2份材料后重新提交审核",
                    "李登记员", Roles.REGISTRAR, "已提交，营业执照副本已核验", 3
                ))

            elif app_no == "EX202406120003":
                await cur.execute("""
                    INSERT INTO processing_records (
                        application_id, action, from_status, to_status, handler, handler_role,
                        comment, correction_action, previous_handler_name, previous_handler_role,
                        previous_result, version
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    app_id, "submit", ApplicationStatus.DRAFT, ApplicationStatus.PENDING_AUDIT,
                    "registrar1", Roles.REGISTRAR, "提交审核，资质材料齐全",
                    "完成全部资质材料上传：营业执照、法人授权委托书、产品名录",
                    "李登记员", Roles.REGISTRAR, "全部资质材料齐全，提交审核", 2
                ))
                await cur.execute("""
                    INSERT INTO processing_records (
                        application_id, action, from_status, to_status, handler, handler_role,
                        comment, correction_action, previous_handler_name, previous_handler_role,
                        previous_result, version
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    app_id, "approve_audit", ApplicationStatus.PENDING_AUDIT, ApplicationStatus.PENDING_REVIEW,
                    "supervisor1", Roles.AUDIT_SUPERVISOR, "审核通过，资质材料齐全",
                    "资质审核通过：营业执照有效、法人授权合规、参展产品符合展会主题；流转至主办方复核",
                    "李登记员", Roles.REGISTRAR, "提交完整资质材料", 3
                ))
                await cur.execute("""
                    INSERT INTO processing_records (
                        application_id, action, from_status, to_status, handler, handler_role,
                        comment, correction_action, previous_handler_name, previous_handler_role,
                        previous_result, version
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    app_id, "approve_review", ApplicationStatus.PENDING_REVIEW, ApplicationStatus.PENDING_BOOTH_CONFIRM,
                    "leader1", Roles.REVIEW_LEADER, "复核通过，待展位确认",
                    "主办方复核通过：审核意见签字齐全、资质材料复核通过；下一步：上传展位确认函后确认展位",
                    "王审核主管", Roles.AUDIT_SUPERVISOR, "审核通过，资质完整", 4
                ))
                await cur.execute("""
                    INSERT INTO processing_records (
                        application_id, action, from_status, to_status, handler, handler_role,
                        comment, correction_action, error_code, error_message, version
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    app_id, "error_record", ApplicationStatus.PENDING_BOOTH_CONFIRM, ApplicationStatus.PENDING_REVIEW,
                    "leader1", Roles.REVIEW_LEADER,
                    "展位确认证据缺失，回退至复核环节补确认函",
                    "需要：1)重新生成展位确认函 2)展会负责人签字 3)上传至附件后再执行确认展位操作",
                    "EVIDENCE_LOOP_INCOMPLETE", "证据闭环未完成：缺少展位确认函签字扫描件", 4
                ))

            elif app_no == "EX202406120004":
                await cur.execute("""
                    INSERT INTO processing_records (
                        application_id, action, from_status, to_status, handler, handler_role,
                        comment, correction_action, previous_handler_name, previous_handler_role,
                        previous_result, version
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    app_id, "submit", ApplicationStatus.DRAFT, ApplicationStatus.PENDING_AUDIT,
                    "registrar1", Roles.REGISTRAR, "提交审核",
                    "完成基础信息和资质材料上传",
                    "李登记员", Roles.REGISTRAR, "提交审核申请", 2
                ))
                await cur.execute("""
                    INSERT INTO processing_records (
                        application_id, action, from_status, to_status, handler, handler_role,
                        comment, correction_reason, evidence_required, correction_action,
                        previous_handler_name, previous_handler_role, previous_result, version
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    app_id, "return_for_correction", ApplicationStatus.PENDING_AUDIT,
                    ApplicationStatus.CORRECTION_REQUIRED,
                    "supervisor1", Roles.AUDIT_SUPERVISOR,
                    "请补充参展产品名录",
                    "缺少参展产品详细名录，其余材料齐全",
                    "参展产品详细名录(含产品名称、规格型号、图片说明)",
                    "补充产品名录后可重新提交",
                    "李登记员", Roles.REGISTRAR, "营业执照、授权委托书齐全，缺少产品名录", 3
                ))
                await cur.execute("""
                    INSERT INTO processing_records (
                        application_id, action, from_status, to_status, handler, handler_role,
                        comment, correction_action, previous_handler_name, previous_handler_role,
                        previous_result, version
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    app_id, "correct", ApplicationStatus.CORRECTION_REQUIRED, ApplicationStatus.PENDING_AUDIT,
                    "registrar1", Roles.REGISTRAR, "已补充参展产品名录",
                    "已上传《2024参展产品详细名录》PDF，含12款展品信息",
                    "王审核主管", Roles.AUDIT_SUPERVISOR, "退回补正：补充产品名录", 4
                ))
                await cur.execute("""
                    INSERT INTO processing_records (
                        application_id, action, from_status, to_status, handler, handler_role,
                        comment, correction_action, previous_handler_name, previous_handler_role,
                        previous_result, version
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    app_id, "approve_audit", ApplicationStatus.PENDING_AUDIT, ApplicationStatus.PENDING_REVIEW,
                    "supervisor1", Roles.AUDIT_SUPERVISOR, "审核通过，材料齐全",
                    "资质材料齐全：营业执照、法人授权委托书、参展产品名录全部核验通过",
                    "李登记员", Roles.REGISTRAR, "补正后重新提交，产品名录已补充", 5
                ))
                await cur.execute("""
                    INSERT INTO processing_records (
                        application_id, action, from_status, to_status, handler, handler_role,
                        comment, correction_action, previous_handler_name, previous_handler_role,
                        previous_result, version
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    app_id, "approve_review", ApplicationStatus.PENDING_REVIEW, ApplicationStatus.PENDING_BOOTH_CONFIRM,
                    "leader1", Roles.REVIEW_LEADER, "复核通过，待展位确认函签署",
                    "主办方复核通过：审核意见签字齐全、资质材料复核通过。临期提醒：请在18小时内完成展位确认函上传并确认展位",
                    "王审核主管", Roles.AUDIT_SUPERVISOR, "审核通过，材料完整核验", 5
                ))

            await conn.commit()

            if meta["overdue_exception"]:
                dl = deadline
                if dl.tzinfo:
                    dl = dl.replace(tzinfo=None)
                overdue_delta = now - dl
                overdue_hours = int(overdue_delta.total_seconds() / 3600)
                overdue_days = overdue_delta.days
                status_name = ApplicationStatus.STATUS_NAMES.get(status, status)
                correction_required = (
                    f"当前状态[{status_name}]已逾期{overdue_days}天{overdue_hours % 24}小时，"
                    f"责任人[张复核负责人]需立即处理。"
                    f"处理步骤：1) 进入详情页记录逾期原因 2) 上传展位确认函执行确认展位或退回补正 "
                    f"3) 在处理备注中注明逾期处理说明"
                )
                async with conn.cursor() as cur2:
                    await cur2.execute("""
                        INSERT INTO overdue_exceptions (
                            application_id, application_no, deadline, overdue_since,
                            overdue_days, overdue_hours, responsible_person, responsible_person_name,
                            responsible_person_role, status_at_overdue, queue_at_overdue,
                            correction_action_required
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """, (
                        app_id, meta["application_no"], dl.isoformat(), dl.isoformat(),
                        overdue_days, overdue_hours, resp_username, resp_name,
                        responsible_role, status, meta["queue"],
                        correction_required
                    ))

            await conn.commit()

    await conn.close()

    print("演示数据初始化完成！")
    print("=" * 80)
    print("四类演示单据（均可连续办理完整流程：报名→审核→展位确认→归档→同步）：")
    print("=" * 80)
    for meta in sample_applications_meta:
        print(f"\n📋 {meta['application_no']}: {meta['company_name']}")
        status_name = ApplicationStatus.STATUS_NAMES.get(meta["status"], meta["status"])
        wl = WarningLevel.LEVEL_NAMES
        deadline, warning_level, is_overdue = await calc_deadline_and_warning(meta["status"], meta["deadline_offset"])
        wl_name = wl.get(warning_level, warning_level)
        handler_name = "李登记员" if meta["current_handler"] == "registrar1" else (
            "王审核主管" if meta["current_handler"] == "supervisor1" else "张复核负责人")
        print(f"   当前状态: {status_name} | 预警: {wl_name} | 当前处理人: {handler_name}")
        resp_role = Roles.REGISTRAR
        s = meta["status"]
        if s in [ApplicationStatus.PENDING_AUDIT]:
            resp_role = Roles.AUDIT_SUPERVISOR
        elif s in [ApplicationStatus.PENDING_REVIEW, ApplicationStatus.PENDING_BOOTH_CONFIRM]:
            resp_role = Roles.REVIEW_LEADER
        _, rpn = RESPONSIBLE_MAP.get(resp_role, ("unknown", "未知责任人"))
        print(f"   逾期责任人: {rpn}")
        print(f"   演示说明: {descriptions.get(meta['application_no'], meta['description'])}")

    print("\n" + "=" * 80)
    print("角色切换建议演示路径：")
    print("=" * 80)
    print("""
【路径1：正常流转全流程】
registrar1 → 找到EX202406120001(草稿) → 提交审核 → 
supervisor1 → 审核通过 → 
leader1 → 复核通过 → 确认展位(上传证据) → 归档 → 同步

【路径2：退回补正连续办理】
registrar1 → 找到EX202406120002(需补正) → 查看补正要求 → 补正材料 → 
supervisor1 → 审核通过 → 
leader1 → 复核→确认→归档→同步

【路径3：逾期异常拦截】
leader1 → 选中EX202406120003(逾期) + EX202406120004(临期) → 批量"复核通过" → 
         查看：EX202406120003被拦截(OVERDUE_BLOCKED)+ 补正建议 → 
         进入EX202406120003详情 → 记录逾期原因 → 确认展位(上传证据) → 归档→同步

【路径4：证据闭环拦截】
leader1 → 进入EX202406120004详情 → 直接点"确认展位"(不填证据) → 
         查看：EVIDENCE_LOOP_INCOMPLETE拦截 + 补正建议 → 
         填写展位确认函编号 → 确认展位 → 归档 → 同步
""")


async def main():
    print("正在初始化数据库...")
    await init_database()
    print("✅ 数据库表结构创建完成（含逾期异常表、证据清单、批量结果扩展字段）")

    print("正在初始化演示数据...")
    await init_sample_data()

    print("\n" + "=" * 80)
    print("✅ 数据库初始化全部完成！")
    print(f"📁 数据库文件位置: {DB_PATH}")
    print("=" * 80)


if __name__ == "__main__":
    asyncio.run(main())
