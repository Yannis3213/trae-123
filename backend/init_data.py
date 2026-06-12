from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from models import User, TrainingProject, Attachment, ProcessingRecord, AuditNote
from auth_service import hash_password


def seed_demo_data(db: Session):
    users = _seed_users(db)
    _seed_projects(db, users)
    db.commit()


def _seed_users(db: Session) -> dict:
    existing = db.query(User).count()
    if existing > 0:
        users = db.query(User).all()
        return {u.role: u for u in users}

    user_list = [
        User(
            username="consultant",
            password_hash=hash_password("123456"),
            full_name="张老师",
            role=User.ROLE_REGISTRAR,
            department="市场部-课程顾问组"
        ),
        User(
            username="trainer_ops",
            password_hash=hash_password("123456"),
            full_name="李运营",
            role=User.ROLE_AUDITOR,
            department="运营部-讲师运营组"
        ),
        User(
            username="project_mgr",
            password_hash=hash_password("123456"),
            full_name="王经理",
            role=User.ROLE_REVIEWER,
            department="项目部-项目经理组"
        )
    ]
    for u in user_list:
        db.add(u)
    db.flush()
    return {u.role: u for u in user_list}


def _make_project_no(idx: int) -> str:
    now = datetime.utcnow()
    prefix = f"TP{now.strftime('%Y%m')}"
    return f"{prefix}{1000 + idx:04d}"


def _seed_projects(db: Session, users: dict):
    if db.query(TrainingProject).count() > 0:
        return

    reg = users[User.ROLE_REGISTRAR]
    aud = users[User.ROLE_AUDITOR]
    rev = users[User.ROLE_REVIEWER]
    now = datetime.utcnow()

    demo_cases = [
        {
            "name": "新员工入职培训项目",
            "company": "华星科技有限公司",
            "contact": "赵主管",
            "phone": "13800138001",
            "type": "通用类",
            "count": 50,
            "stage": TrainingProject.STAGE_CONTRACT,
            "status": TrainingProject.STATUS_DRAFT,
            "handler_role": User.ROLE_REGISTRAR,
            "handler": reg,
            "creator": reg,
            "deadline": now + timedelta(days=15),
            "desc": "新员工入职通用能力培训，包含公司文化、规章制度、基础业务知识等。",
            "plan": "第一阶段：通用通用通用通用阶段：公司文化、规章制度。第二阶段：岗位技能通用通用。",
            "amount": 125000.00,
            "contract_no": "HT-2026-0001",
            "contract_date": now - timedelta(days=2),
            "start": now + timedelta(days=20),
            "end": now + timedelta(days=25),
            "version": 1
        },
        {
            "name": "管理层通用通用通用管理能力提升",
            "company": "东方通用通用集团",
            "contact": "刘总监",
            "phone": "13800138002",
            "type": "管理类",
            "count": 30,
            "stage": TrainingProject.STAGE_PLAN,
            "status": TrainingProject.STATUS_PENDING_AUDIT,
            "handler_role": User.ROLE_AUDITOR,
            "handler": aud,
            "creator": reg,
            "deadline": now + timedelta(days=1),
            "desc": "管理层通用通用通用管理能力提升通用通用通用通用。",
            "plan": "管理通用通用通用提升通用通用通用，共 5 天通用。",
            "amount": 180000.00,
            "contract_no": None,
            "contract_date": None,
            "start": now + timedelta(days=10),
            "end": now + timedelta(days=15),
            "version": 2
        },
        {
            "name": "销售团队通用通用通用能力通用",
            "company": "盛世股份有限公司",
            "contact": "陈经理",
            "phone": "13800138003",
            "type": "销售类",
            "count": 40,
            "stage": TrainingProject.STAGE_DEMAND,
            "status": TrainingProject.STATUS_AUDIT_REJECTED,
            "handler_role": User.ROLE_REGISTRAR,
            "handler": reg,
            "creator": reg,
            "deadline": now - timedelta(days=1),
            "desc": "销售团队通用通用通用能力通用，缺乏通用需求通用描述。",
            "plan": None,
            "amount": 0,
            "contract_no": None,
            "contract_date": None,
            "start": None,
            "end": None,
            "version": 3
        },
        {
            "name": "技术团队通用通用通用通用通用",
            "company": "领先科技公司",
            "contact": "孙技术",
            "phone": "13800138004",
            "type": "技术类",
            "count": 25,
            "stage": TrainingProject.STAGE_CONTRACT,
            "status": TrainingProject.STATUS_AUDIT_PASSED,
            "handler_role": User.ROLE_REVIEWER,
            "handler": None,
            "creator": reg,
            "deadline": now + timedelta(days=7),
            "desc": "技术团队通用通用通用通用通用。",
            "plan": "通用通用通用通用通用通用通用通用通用通用。",
            "amount": 320000.00,
            "contract_no": "HT-2026-0004",
            "contract_date": now - timedelta(days=1),
            "start": now + timedelta(days=30),
            "end": now + timedelta(days=40),
            "version": 2
        },
        {
            "name": "通用通用通用通用通用通用通用通用",
            "company": "通用通用有限公司",
            "contact": "周总",
            "phone": "13800138005",
            "type": "通用类",
            "count": 60,
            "stage": TrainingProject.STAGE_CONTRACT,
            "status": TrainingProject.STATUS_SYNCED,
            "handler_role": User.ROLE_REVIEWER,
            "handler": rev,
            "creator": reg,
            "deadline": now - timedelta(days=3),
            "desc": "通用通用通用通用通用通用通用通用通用通用。",
            "plan": "通用通用通用通用通用通用通用通用通用通用。",
            "amount": 280000.00,
            "contract_no": "HT-2026-0005",
            "contract_date": now - timedelta(days=5),
            "start": now + timedelta(days=10),
            "end": now + timedelta(days=20),
            "version": 3
        },
        {
            "name": "通用通用通用通用通用通用通用",
            "company": "辉煌集团股份",
            "contact": "吴通用",
            "phone": "13800138006",
            "type": "管理类",
            "count": 35,
            "stage": TrainingProject.STAGE_PLAN,
            "status": TrainingProject.STATUS_DRAFT,
            "handler_role": User.ROLE_REGISTRAR,
            "handler": reg,
            "creator": reg,
            "deadline": now - timedelta(days=5),
            "desc": "通用通用通用通用通用通用通用通用通用通用。",
            "plan": "通用通用通用通用通用通用通用通用通用通用。",
            "amount": 0,
            "contract_no": None,
            "contract_date": None,
            "start": None,
            "end": None,
            "version": 1
        },
        {
            "name": "通用通用通用通用通用通用通用通用",
            "company": "通用通用通用公司",
            "contact": "郑通用",
            "phone": "13800138007",
            "type": "通用类",
            "count": 100,
            "stage": TrainingProject.STAGE_PLAN,
            "status": TrainingProject.STATUS_REVIEW_REJECTED,
            "handler_role": User.ROLE_AUDITOR,
            "handler": aud,
            "creator": reg,
            "deadline": now + timedelta(days=2),
            "desc": "通用通用通用通用通用通用通用通用通用通用。",
            "plan": "通用通用通用通用通用通用通用通用通用通用。",
            "amount": 500000.00,
            "contract_no": None,
            "contract_date": None,
            "start": now + timedelta(days=25),
            "end": now + timedelta(days=35),
            "version": 4
        },
        {
            "name": "通用通用通用通用通用通用",
            "company": "通用通用科技",
            "contact": "钱总",
            "phone": "13800138008",
            "type": "通用类",
            "count": 20,
            "stage": TrainingProject.STAGE_CONTRACT,
            "status": TrainingProject.STATUS_ARCHIVED,
            "handler_role": None,
            "handler": None,
            "creator": reg,
            "deadline": now - timedelta(days=10),
            "desc": "通用通用通用通用通用通用通用通用通用通用。",
            "plan": "通用通用通用通用通用通用通用通用通用通用。",
            "amount": 150000.00,
            "contract_no": "HT-2026-0008",
            "contract_date": now - timedelta(days=15),
            "start": now - timedelta(days=5),
            "end": now - timedelta(days=1),
            "version": 2
        }
    ]

    for idx, c in enumerate(demo_cases):
        p = TrainingProject(
            project_no=_make_project_no(idx + 1),
            project_name=c["name"],
            client_company=c["company"],
            contact_person=c["contact"],
            contact_phone=c["phone"],
            training_type=c["type"],
            training_count=c["count"],
            expected_start_date=c["start"],
            expected_end_date=c["end"],
            demand_description=c["desc"],
            plan_content=c["plan"],
            quotation_amount=c["amount"],
            contract_no=c["contract_no"],
            contract_date=c["contract_date"],
            stage=c["stage"],
            status=c["status"],
            current_handler_role=c["handler_role"],
            current_handler_id=c["handler"].id if c["handler"] else None,
            created_by_id=c["creator"].id,
            deadline=c["deadline"],
            version=c["version"],
            created_at=now - timedelta(days=8 - idx),
            updated_at=now - timedelta(days=4 - idx if idx < 4 else 0)
        )
        db.add(p)
        db.flush()

        _add_demo_attachments(db, p, c, reg)
        _add_demo_history(db, p, c, users)


def _add_demo_attachments(db: Session, p: TrainingProject, c: dict, reg: User):
    atts = []
    if c["desc"]:
        atts.append({
            "name": f"需求说明-{p.project_no}.docx",
            "category": Attachment.CATEGORY_DEMAND,
            "required": True,
            "size": 102400
        })
    if c["plan"]:
        atts.append({
            "name": f"方案方案-{p.project_no}.pdf",
            "category": Attachment.CATEGORY_PLAN,
            "required": True,
            "size": 204800
        })
    if c["contract_no"]:
        atts.append({
            "name": f"合同-{p.project_no}.pdf",
            "category": Attachment.CATEGORY_CONTRACT,
            "required": True,
            "size": 307200
        })
    atts.append({
        "name": f"通用材料-{p.project_no}.xlsx",
        "category": Attachment.CATEGORY_OTHER,
        "required": False,
        "size": 51200
    })
    for a in atts:
        db.add(Attachment(
            project_id=p.id,
            file_name=a["name"],
            file_type=a["name"].split(".")[-1],
            file_size=a["size"],
            file_path=f"/uploads/{p.project_no}/{a['name']}",
            category=a["category"],
            is_required=a["required"],
            uploaded_by_id=reg.id
        ))


def _add_demo_history(db: Session, p: TrainingProject, c: dict, users: dict):
    reg = users[User.ROLE_REGISTRAR]
    aud = users[User.ROLE_AUDITOR]
    rev = users[User.ROLE_REVIEWER]

    db.add(ProcessingRecord(
        project_id=p.id, action="create", action_name="创建",
        from_status=None, to_status=TrainingProject.STATUS_DRAFT,
        from_stage=None, to_stage=p.stage,
        operator_id=reg.id, operator_role=User.ROLE_REGISTRAR,
        remark="项目单创建", version_at_action=1
    ))
    db.add(AuditNote(
        project_id=p.id, note_type=AuditNote.TYPE_STATUS_CHANGE,
        note_content=f"项目单创建，状态：草稿，创建人：{reg.full_name}",
        created_by_id=reg.id
    ))

    if p.status in [TrainingProject.STATUS_PENDING_AUDIT,
                    TrainingProject.STATUS_AUDIT_REJECTED,
                    TrainingProject.STATUS_AUDIT_PASSED,
                    TrainingProject.STATUS_REVIEW_REJECTED,
                    TrainingProject.STATUS_SYNCED,
                    TrainingProject.STATUS_ARCHIVED]:
        db.add(ProcessingRecord(
            project_id=p.id, action="submit", action_name="提交审核",
            from_status=TrainingProject.STATUS_DRAFT, to_status=TrainingProject.STATUS_PENDING_AUDIT,
            operator_id=reg.id, operator_role=User.ROLE_REGISTRAR,
            remark="课程顾问提交审核", version_at_action=2
        ))
        db.add(AuditNote(
            project_id=p.id, note_type=AuditNote.TYPE_STATUS_CHANGE,
            note_content=f"课程顾问提交审核：草稿 -> 待审核", created_by_id=reg.id
        ))

    if p.status == TrainingProject.STATUS_AUDIT_REJECTED:
        db.add(ProcessingRecord(
            project_id=p.id, action="audit_reject", action_name="退回补正",
            from_status=TrainingProject.STATUS_PENDING_AUDIT, to_status=TrainingProject.STATUS_AUDIT_REJECTED,
            operator_id=aud.id, operator_role=User.ROLE_AUDITOR,
            remark="缺少必要方案内容和报价信息，请补正", version_at_action=3
        ))
        db.add(AuditNote(
            project_id=p.id, note_type=AuditNote.TYPE_SUPPLEMENT,
            note_content="讲师运营退回补正：缺少必要方案内容和报价信息，请补正", created_by_id=aud.id
        ))
        db.add(AuditNote(
            project_id=p.id, note_type=AuditNote.TYPE_EXCEPTION,
            note_content="[overdue] 项目已逾期，已逾期 1 天，责任人为课程顾问张老师"
        ))

    if p.status in [TrainingProject.STATUS_AUDIT_PASSED,
                    TrainingProject.STATUS_REVIEW_REJECTED,
                    TrainingProject.STATUS_SYNCED,
                    TrainingProject.STATUS_ARCHIVED]:
        db.add(ProcessingRecord(
            project_id=p.id, action="audit_pass", action_name="审核通过",
            from_status=TrainingProject.STATUS_PENDING_AUDIT, to_status=TrainingProject.STATUS_AUDIT_PASSED,
            operator_id=aud.id, operator_role=User.ROLE_AUDITOR,
            remark="审核通过，过程核对完成", version_at_action=2
        ))
        db.add(AuditNote(
            project_id=p.id, note_type=AuditNote.TYPE_STATUS_CHANGE,
            note_content="讲师运营审核通过：待审核 -> 审核通过", created_by_id=aud.id
        ))

    if p.status == TrainingProject.STATUS_REVIEW_REJECTED:
        db.add(ProcessingRecord(
            project_id=p.id, action="review_reject", action_name="复核退回",
            from_status=TrainingProject.STATUS_AUDIT_PASSED, to_status=TrainingProject.STATUS_REVIEW_REJECTED,
            operator_id=rev.id, operator_role=User.ROLE_REVIEWER,
            remark="合同阶段信息不完整，请重新核对合同相关信息", version_at_action=4
        ))
        db.add(AuditNote(
            project_id=p.id, note_type=AuditNote.TYPE_SUPPLEMENT,
            note_content="项目经理复核退回：合同阶段信息不完整，请重新核对", created_by_id=rev.id
        ))

    if p.status in [TrainingProject.STATUS_SYNCED, TrainingProject.STATUS_ARCHIVED]:
        db.add(ProcessingRecord(
            project_id=p.id, action="review_pass", action_name="复核通过并同步",
            from_status=TrainingProject.STATUS_AUDIT_PASSED, to_status=TrainingProject.STATUS_SYNCED,
            operator_id=rev.id, operator_role=User.ROLE_REVIEWER,
            remark="复核通过，已同步", version_at_action=3
        ))
        db.add(AuditNote(
            project_id=p.id, note_type=AuditNote.TYPE_STATUS_CHANGE,
            note_content="项目经理复核通过：审核通过 -> 已同步", created_by_id=rev.id
        ))

    if p.status == TrainingProject.STATUS_ARCHIVED:
        db.add(ProcessingRecord(
            project_id=p.id, action="archive", action_name="归档",
            from_status=TrainingProject.STATUS_SYNCED, to_status=TrainingProject.STATUS_ARCHIVED,
            operator_id=rev.id, operator_role=User.ROLE_REVIEWER,
            remark="项目完成归档", version_at_action=2
        ))
        db.add(AuditNote(
            project_id=p.id, note_type=AuditNote.TYPE_STATUS_CHANGE,
            note_content="项目经理归档：已同步 -> 已归档", created_by_id=rev.id
        ))
