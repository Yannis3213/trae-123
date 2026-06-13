from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from models import User, CareRecord, ProcessRecord, AuditNote, Attachment
from auth import (
    hash_password,
    ROLE_REGISTRAR, ROLE_AUDITOR, ROLE_REVIEWER,
    STATUS_PENDING_SUBMIT, STATUS_PENDING_AUDIT, STATUS_PENDING_REVIEW,
    STATUS_AUDITED_PASSED, STATUS_RETURNED, STATUS_SYNCED,
)

_SEEDED = False


def seed_database(db: Session):
    global _SEEDED
    if _SEEDED:
        return

    user_count = db.query(User).count()
    if user_count > 0:
        _SEEDED = True
        return

    users = [
        User(
            username="nurse01",
            password=hash_password("123456"),
            full_name="李护登记员",
            role=ROLE_REGISTRAR,
            department="照护部-登记组",
        ),
        User(
            username="nurse02",
            password=hash_password("123456"),
            full_name="王护理员",
            role=ROLE_REGISTRAR,
            department="照护部-登记组",
        ),
        User(
            username="shenzhang",
            password=hash_password("123456"),
            full_name="张护士长",
            role=ROLE_AUDITOR,
            department="照护部-审核组",
        ),
        User(
            username="yuanzhu",
            password=hash_password("123456"),
            full_name="陈院区主任",
            role=ROLE_REVIEWER,
            department="养老护理院-复核组",
        ),
    ]
    for u in users:
        db.add(u)
    db.flush()

    u_nurse1 = users[0]
    u_nurse2 = users[1]
    u_head = users[2]
    u_director = users[3]

    now = datetime.utcnow()

    records_spec = [
        {
            "tag": "normal_complete",
            "record_no": "CR202606100001",
            "elder_name": "赵奶奶",
            "elder_id_card": "310101194001012345",
            "room_no": "A-201",
            "bed_no": "1",
            "care_type": "日常护理",
            "care_content": "晨间洗漱、早餐协助、血压测量、午间巡视。老人精神状态良好，饮食正常。",
            "record_date": now - timedelta(days=4),
            "status": STATUS_SYNCED,
            "version": 5,
            "medication_issued": True,
            "medication_detail": [
                {"name": "硝苯地平缓释片", "dose": "10mg", "time": "08:00", "operator": "李护登记员"},
                {"name": "阿司匹林肠溶片", "dose": "100mg", "time": "08:00", "operator": "李护登记员"},
            ],
            "vital_signs": {"血压": "135/85 mmHg", "心率": "78次/分", "体温": "36.5℃", "血氧": "97%"},
            "vital_signs_corrected": False,
            "abnormal_reported": False,
            "abnormal_review_result": "",
            "abnormal_reason": "",
            "evidence_required": ["护理记录表", "用药签名单", "生命体征记录表"],
            "evidence_provided": ["护理记录表", "用药签名单", "生命体征记录表"],
            "missing_evidence": [],
            "submitter": u_nurse1,
            "submitted_at": now - timedelta(days=4, hours=2),
            "auditor": u_head,
            "audited_at": now - timedelta(days=4, hours=5),
            "audit_remark": "记录完整，信息准确，审核通过。",
            "reviewer": u_director,
            "reviewed_at": now - timedelta(days=3),
            "review_remark": "复核无误，已同步归档。",
            "sync_status": "SYNCED",
            "synced_at": now - timedelta(days=3),
            "due_date": now - timedelta(days=2),
            "overdue": False,
        },
        {
            "tag": "normal_pending_audit",
            "record_no": "CR202606110002",
            "elder_name": "钱爷爷",
            "elder_id_card": "310101193805056789",
            "room_no": "A-203",
            "bed_no": "2",
            "care_type": "康复护理",
            "care_content": "协助康复训练（上肢关节活动）30分钟，餐后散步15分钟。老人配合度良好。",
            "record_date": now - timedelta(days=2),
            "status": STATUS_PENDING_AUDIT,
            "version": 2,
            "medication_issued": True,
            "medication_detail": [
                {"name": "甲钴胺片", "dose": "0.5mg", "time": "08:00", "operator": "李护登记员"},
            ],
            "vital_signs": {"血压": "140/90 mmHg", "心率": "82次/分", "体温": "36.7℃", "血氧": "96%"},
            "vital_signs_corrected": False,
            "abnormal_reported": False,
            "abnormal_review_result": "",
            "abnormal_reason": "",
            "evidence_required": ["护理记录表", "康复训练记录", "用药签名单"],
            "evidence_provided": ["护理记录表", "康复训练记录", "用药签名单"],
            "missing_evidence": [],
            "submitter": u_nurse1,
            "submitted_at": now - timedelta(days=2, hours=3),
            "auditor": None,
            "audited_at": None,
            "audit_remark": "",
            "reviewer": None,
            "reviewed_at": None,
            "review_remark": "",
            "sync_status": "NOT_SYNCED",
            "synced_at": None,
            "due_date": now + timedelta(days=1),
            "overdue": False,
        },
        {
            "tag": "normal_pending_review",
            "record_no": "CR202606120003",
            "elder_name": "孙奶奶",
            "elder_id_card": "310101194203129876",
            "room_no": "B-105",
            "bed_no": "1",
            "care_type": "特护护理",
            "care_content": "卧床老人护理：翻身拍背q2h、皮肤检查（骶尾部完好）、口腔护理bid、鼻饲喂养。",
            "record_date": now - timedelta(days=1),
            "status": STATUS_PENDING_REVIEW,
            "version": 3,
            "medication_issued": True,
            "medication_detail": [
                {"name": "奥美拉唑肠溶胶囊", "dose": "20mg", "time": "07:00", "operator": "李护登记员"},
                {"name": "复方丹参滴丸", "dose": "10丸", "time": "08:00", "operator": "李护登记员"},
            ],
            "vital_signs": {"血压": "128/82 mmHg", "心率": "76次/分", "体温": "36.4℃", "血氧": "98%"},
            "vital_signs_corrected": False,
            "abnormal_reported": False,
            "abnormal_review_result": "",
            "abnormal_reason": "",
            "evidence_required": ["护理记录表", "皮肤评估表", "鼻饲记录", "用药签名单"],
            "evidence_provided": ["护理记录表", "皮肤评估表", "鼻饲记录", "用药签名单"],
            "missing_evidence": [],
            "submitter": u_nurse2,
            "submitted_at": now - timedelta(days=1, hours=5),
            "auditor": u_head,
            "audited_at": now - timedelta(days=1, hours=2),
            "audit_remark": "特护记录完整，皮肤状态良好，审核通过。",
            "reviewer": None,
            "reviewed_at": None,
            "review_remark": "",
            "sync_status": "NOT_SYNCED",
            "synced_at": None,
            "due_date": now + timedelta(days=2),
            "overdue": False,
        },
        {
            "tag": "missing_evidence",
            "record_no": "CR202606120004",
            "elder_name": "周爷爷",
            "elder_id_card": "310101193511154321",
            "room_no": "B-108",
            "bed_no": "2",
            "care_type": "日常护理",
            "care_content": "助行器辅助行走、个人卫生清洁、午餐协助。今日用药较多，已完成分发。",
            "record_date": now - timedelta(days=1),
            "status": STATUS_PENDING_AUDIT,
            "version": 2,
            "medication_issued": True,
            "medication_detail": [
                {"name": "二甲双胍片", "dose": "500mg", "time": "08:00", "operator": "王护理员"},
                {"name": "格列美脲片", "dose": "2mg", "time": "08:00", "operator": "王护理员"},
                {"name": "辛伐他汀片", "dose": "20mg", "time": "21:00", "operator": "王护理员"},
            ],
            "vital_signs": {"血压": "130/84 mmHg", "心率": "72次/分", "体温": "36.6℃", "血氧": "97%", "血糖": "8.2 mmol/L"},
            "vital_signs_corrected": False,
            "abnormal_reported": False,
            "abnormal_review_result": "",
            "abnormal_reason": "",
            "evidence_required": ["护理记录表", "用药签名单", "血糖监测记录", "家属知情同意书"],
            "evidence_provided": ["护理记录表", "用药签名单"],
            "missing_evidence": ["血糖监测记录", "家属知情同意书"],
            "submitter": u_nurse2,
            "submitted_at": now - timedelta(days=1, hours=8),
            "auditor": None,
            "audited_at": None,
            "audit_remark": "",
            "reviewer": None,
            "reviewed_at": None,
            "review_remark": "",
            "sync_status": "NOT_SYNCED",
            "synced_at": None,
            "due_date": now + timedelta(days=1),
            "overdue": False,
        },
        {
            "tag": "overdue_audit",
            "record_no": "CR202606080005",
            "elder_name": "吴奶奶",
            "elder_id_card": "310101193909098765",
            "room_no": "A-205",
            "bed_no": "1",
            "care_type": "慢病护理",
            "care_content": "高血压、糖尿病慢病日常监测。老人诉头昏，血压偏高，已通知值班医生。",
            "record_date": now - timedelta(days=6),
            "status": STATUS_PENDING_REVIEW,
            "version": 3,
            "medication_issued": True,
            "medication_detail": [
                {"name": "缬沙坦胶囊", "dose": "80mg", "time": "08:00", "operator": "王护理员"},
            ],
            "vital_signs": {"血压": "168/98 mmHg", "心率": "88次/分", "体温": "36.8℃", "血氧": "95%", "血糖": "7.8 mmol/L"},
            "vital_signs_corrected": True,
            "abnormal_reported": True,
            "abnormal_review_result": "血压偏高，建议调整降压方案",
            "abnormal_reason": "血压持续偏高，收缩压超过160mmHg，已上报值班医生。",
            "evidence_required": ["护理记录表", "生命体征记录表", "异常上报单", "用药签名单"],
            "evidence_provided": ["护理记录表", "生命体征记录表", "异常上报单", "用药签名单"],
            "missing_evidence": [],
            "submitter": u_nurse2,
            "submitted_at": now - timedelta(days=6, hours=3),
            "auditor": u_head,
            "audited_at": now - timedelta(days=6, hours=1),
            "audit_remark": "逾期推进审核通过",
            "reviewer": None,
            "reviewed_at": None,
            "review_remark": "",
            "sync_status": "NOT_SYNCED",
            "synced_at": None,
            "due_date": now - timedelta(days=3),
            "overdue": True,
        },
        {
            "tag": "overdue_review",
            "record_no": "CR202606070006",
            "elder_name": "郑爷爷",
            "elder_id_card": "310101193307073456",
            "room_no": "C-302",
            "bed_no": "1",
            "care_type": "临终关怀",
            "care_content": "舒适护理、疼痛评估、家属陪伴支持。生命体征平稳，疼痛评分3分。",
            "record_date": now - timedelta(days=7),
            "status": STATUS_SYNCED,
            "version": 4,
            "medication_issued": True,
            "medication_detail": [
                {"name": "盐酸吗啡缓释片", "dose": "30mg", "time": "08:00", "operator": "李护登记员"},
            ],
            "vital_signs": {"血压": "110/70 mmHg", "心率": "68次/分", "体温": "36.2℃", "血氧": "94%"},
            "vital_signs_corrected": False,
            "abnormal_reported": False,
            "abnormal_review_result": "",
            "abnormal_reason": "",
            "evidence_required": ["护理记录表", "疼痛评估表", "用药签名单"],
            "evidence_provided": ["护理记录表", "疼痛评估表", "用药签名单"],
            "missing_evidence": [],
            "submitter": u_nurse1,
            "submitted_at": now - timedelta(days=7, hours=2),
            "auditor": u_head,
            "audited_at": now - timedelta(days=7, hours=5),
            "audit_remark": "关怀记录完整。",
            "reviewer": u_director,
            "reviewed_at": now - timedelta(days=6),
            "review_remark": "逾期推进复核归档完成。",
            "sync_status": "SYNCED",
            "synced_at": now - timedelta(days=6),
            "due_date": now - timedelta(days=4),
            "overdue": True,
        },
        {
            "tag": "returned_correction",
            "record_no": "CR202606130007",
            "elder_name": "冯奶奶",
            "elder_id_card": "310101194502021234",
            "room_no": "B-102",
            "bed_no": "2",
            "care_type": "术后护理",
            "care_content": "髋关节置换术后第5天。伤口换药（干燥无渗液）、协助被动活动、防跌倒宣教。",
            "record_date": now - timedelta(hours=20),
            "status": STATUS_RETURNED,
            "version": 4,
            "medication_issued": True,
            "medication_detail": [
                {"name": "利伐沙班片", "dose": "10mg", "time": "08:00", "operator": "李护登记员"},
            ],
            "vital_signs": {"血压": "125/80 mmHg", "心率": "74次/分", "体温": "36.6℃", "血氧": "97%"},
            "vital_signs_corrected": False,
            "abnormal_reported": False,
            "abnormal_review_result": "",
            "abnormal_reason": "",
            "evidence_required": ["护理记录表", "伤口评估单", "康复评估记录", "用药签名单", "DVT预防记录"],
            "evidence_provided": ["护理记录表", "用药签名单"],
            "missing_evidence": ["伤口评估单", "康复评估记录", "DVT预防记录"],
            "submitter": u_nurse1,
            "submitted_at": now - timedelta(hours=16),
            "auditor": u_head,
            "audited_at": now - timedelta(hours=10),
            "audit_remark": "缺失伤口评估单、康复评估记录和DVT预防记录，请补正后重新提交。",
            "reviewer": None,
            "reviewed_at": None,
            "review_remark": "",
            "sync_status": "NOT_SYNCED",
            "synced_at": None,
            "due_date": now + timedelta(days=2),
            "overdue": False,
            "correction_history": [
                {
                    "time": (now - timedelta(hours=16)).isoformat(),
                    "operator": "张护士长",
                    "note": "首次退回：缺少术后相关评估单据",
                    "fields": ["missing_evidence", "audit_remark"],
                }
            ],
        },
        {
            "tag": "state_conflict_case",
            "record_no": "CR202606130008",
            "elder_name": "陈爷爷",
            "elder_id_card": "310101193606065678",
            "room_no": "C-305",
            "bed_no": "2",
            "care_type": "失智护理",
            "care_content": "失智老人定向力训练、情绪安抚。午间出现躁动，已予安抚，家属已告知。",
            "record_date": now - timedelta(hours=8),
            "status": STATUS_RETURNED,
            "version": 5,
            "medication_issued": True,
            "medication_detail": [
                {"name": "喹硫平片", "dose": "25mg", "time": "21:00", "operator": "王护理员"},
            ],
            "vital_signs": {"血压": "150/90 mmHg", "心率": "90次/分", "体温": "36.7℃", "血氧": "96%"},
            "vital_signs_corrected": True,
            "abnormal_reported": True,
            "abnormal_review_result": "躁动情况需密切观察，已建议夜间加派巡视频次",
            "abnormal_reason": "午间出现躁动情绪、攻击性行为，生命体征偏高，已上报并告知家属。",
            "evidence_required": ["护理记录表", "行为观察记录", "异常上报单", "家属告知记录", "用药签名单"],
            "evidence_provided": ["护理记录表", "行为观察记录"],
            "missing_evidence": ["家属告知记录", "异常上报单"],
            "submitter": u_nurse2,
            "submitted_at": now - timedelta(hours=6),
            "auditor": u_head,
            "audited_at": now - timedelta(hours=3),
            "audit_remark": "首次审核：缺失家属告知记录和异常上报单原件。补正后再次提交仍缺异常上报单，二次退回。",
            "reviewer": None,
            "reviewed_at": None,
            "review_remark": "",
            "sync_status": "NOT_SYNCED",
            "synced_at": None,
            "due_date": now + timedelta(days=2, hours=16),
            "overdue": False,
            "correction_history": [
                {
                    "time": (now - timedelta(hours=6)).isoformat(),
                    "operator": "张护士长",
                    "note": "第一次退回：缺少家属告知记录、异常上报单",
                    "fields": ["missing_evidence"],
                },
                {
                    "time": (now - timedelta(hours=4)).isoformat(),
                    "operator": "王护理员",
                    "note": "补正：添加了家属告知记录截图，但异常上报单未找到原件",
                    "fields": ["evidence_provided", "vital_signs_corrected"],
                },
                {
                    "time": (now - timedelta(hours=3)).isoformat(),
                    "operator": "张护士长",
                    "note": "第二次退回：仍缺失异常上报单原件，请与医生确认后补录",
                    "fields": ["missing_evidence", "audit_remark"],
                },
            ],
        },
        {
            "tag": "pending_submit_draft",
            "record_no": "CR202606140009",
            "elder_name": "褚奶奶",
            "elder_id_card": "310101194104047890",
            "room_no": "A-207",
            "bed_no": "1",
            "care_type": "日常护理",
            "care_content": "（草稿）晨间护理完成，准备下午协助洗澡。（还需补充用药记录）",
            "record_date": now,
            "status": STATUS_PENDING_SUBMIT,
            "version": 1,
            "medication_issued": False,
            "medication_detail": [],
            "vital_signs": {"血压": "", "心率": "", "体温": "", "血氧": ""},
            "vital_signs_corrected": False,
            "abnormal_reported": False,
            "abnormal_review_result": "",
            "abnormal_reason": "",
            "evidence_required": ["护理记录表", "用药签名单"],
            "evidence_provided": [],
            "missing_evidence": [],
            "submitter": u_nurse1,
            "submitted_at": None,
            "auditor": None,
            "audited_at": None,
            "audit_remark": "",
            "reviewer": None,
            "reviewed_at": None,
            "review_remark": "",
            "sync_status": "NOT_SYNCED",
            "synced_at": None,
            "due_date": now + timedelta(days=3),
            "overdue": False,
        },
        {
            "tag": "near_due_review",
            "record_no": "CR202606120010",
            "elder_name": "卫爷爷",
            "elder_id_card": "310101193710102345",
            "room_no": "C-308",
            "bed_no": "1",
            "care_type": "康复护理",
            "care_content": "脑卒中后遗症康复训练：平衡训练20分钟，言语训练15分钟。配合度良好。",
            "record_date": now - timedelta(days=2),
            "status": STATUS_PENDING_REVIEW,
            "version": 3,
            "medication_issued": True,
            "medication_detail": [
                {"name": "丁苯酞软胶囊", "dose": "0.2g", "time": "08:00, 16:00", "operator": "李护登记员"},
            ],
            "vital_signs": {"血压": "138/86 mmHg", "心率": "76次/分", "体温": "36.5℃", "血氧": "97%"},
            "vital_signs_corrected": False,
            "abnormal_reported": False,
            "abnormal_review_result": "",
            "abnormal_reason": "",
            "evidence_required": ["护理记录表", "康复训练记录", "用药签名单"],
            "evidence_provided": ["护理记录表", "康复训练记录", "用药签名单"],
            "missing_evidence": [],
            "submitter": u_nurse1,
            "submitted_at": now - timedelta(days=2, hours=5),
            "auditor": u_head,
            "audited_at": now - timedelta(days=1, hours=20),
            "audit_remark": "康复记录完整，训练有效。",
            "reviewer": None,
            "reviewed_at": None,
            "review_remark": "",
            "sync_status": "NOT_SYNCED",
            "synced_at": None,
            "due_date": now + timedelta(hours=36),
            "overdue": False,
        },
    ]

    seeded_records = []
    for spec in records_spec:
        r = CareRecord(
            record_no=spec["record_no"],
            elder_name=spec["elder_name"],
            elder_id_card=spec["elder_id_card"],
            room_no=spec["room_no"],
            bed_no=spec["bed_no"],
            care_type=spec["care_type"],
            care_content=spec["care_content"],
            record_date=spec["record_date"],
            status=spec["status"],
            version=spec["version"],
            medication_issued=spec["medication_issued"],
            medication_detail=spec["medication_detail"],
            vital_signs=spec["vital_signs"],
            vital_signs_corrected=spec["vital_signs_corrected"],
            abnormal_reported=spec["abnormal_reported"],
            abnormal_review_result=spec["abnormal_review_result"],
            abnormal_reason=spec["abnormal_reason"],
            evidence_required=spec["evidence_required"],
            evidence_provided=spec["evidence_provided"],
            missing_evidence=spec["missing_evidence"],
            submitter_id=spec["submitter"].id,
            submitter_name=spec["submitter"].full_name,
            submitted_at=spec["submitted_at"],
            auditor_id=spec["auditor"].id if spec["auditor"] else None,
            auditor_name=spec["auditor"].full_name if spec["auditor"] else "",
            audited_at=spec["audited_at"],
            audit_remark=spec["audit_remark"],
            reviewer_id=spec["reviewer"].id if spec["reviewer"] else None,
            reviewer_name=spec["reviewer"].full_name if spec["reviewer"] else "",
            reviewed_at=spec["reviewed_at"],
            review_remark=spec["review_remark"],
            sync_status=spec["sync_status"],
            synced_at=spec["synced_at"],
            due_date=spec["due_date"],
            overdue=spec["overdue"],
            correction_history=spec.get("correction_history", []),
        )
        db.add(r)
        db.flush()
        seeded_records.append((r, spec))

    db.flush()

    for r, spec in seeded_records:
        tag = spec["tag"]

        def add_pr(action, from_s, to_s, user, remark, result="success", err="", vs=None):
            db.add(ProcessRecord(
                care_record_id=r.id,
                action=action,
                from_status=from_s,
                to_status=to_s,
                operator_id=user.id,
                operator_name=user.full_name,
                operator_role=user.role,
                remark=remark,
                result=result,
                error_message=err,
                version_snapshot=vs if vs else r.version,
            ))

        def add_an(ntype, content, user):
            db.add(AuditNote(
                care_record_id=r.id,
                note_type=ntype,
                content=content,
                operator_id=user.id,
                operator_name=user.full_name,
            ))

        if tag == "normal_complete":
            add_pr("CREATE", "", STATUS_PENDING_SUBMIT, u_nurse1, "创建照护记录 CR202606100001", vs=1)
            add_pr("SUBMIT", STATUS_PENDING_SUBMIT, STATUS_PENDING_AUDIT, u_nurse1, "提交审核，版本 2", vs=2)
            add_pr("MEDICATION_ISSUE", STATUS_PENDING_AUDIT, STATUS_PENDING_AUDIT, u_nurse1, "新增药品发放：硝苯地平、阿司匹林", vs=2)
            add_pr("AUDIT_PASS", STATUS_PENDING_AUDIT, STATUS_PENDING_REVIEW, u_head, "审核通过，版本 3", vs=3)
            add_pr("REVIEW_SYNC", STATUS_PENDING_REVIEW, STATUS_SYNCED, u_director, "复核归档同步，版本 5", vs=5)
            add_an("evidence_state", "证据状态变更：COMPLETE→ARCHIVED（批量复核归档成功，状态已同步）", u_director)
            add_an("evidence_state", "证据齐全：护理记录表、用药签名单、生命体征表均已完整提供", u_head)

        elif tag == "normal_pending_audit":
            add_pr("CREATE", "", STATUS_PENDING_SUBMIT, u_nurse1, "创建照护记录", vs=1)
            add_pr("SUBMIT", STATUS_PENDING_SUBMIT, STATUS_PENDING_AUDIT, u_nurse1, "提交审核，版本 2", vs=2)
            add_an("evidence_state", "证据状态：证据齐全（等待审核中）", u_nurse1)
            add_an("evidence_state", "证据齐全：护理记录表、生命体征表均已提供，可正常审核", u_nurse1)

        elif tag == "normal_pending_review":
            add_pr("CREATE", "", STATUS_PENDING_SUBMIT, u_nurse2, "创建特护记录", vs=1)
            add_pr("SUBMIT", STATUS_PENDING_SUBMIT, STATUS_PENDING_AUDIT, u_nurse2, "提交审核", vs=2)
            add_pr("AUDIT_PASS", STATUS_PENDING_AUDIT, STATUS_PENDING_REVIEW, u_head, "特护记录完整，皮肤状态良好，审核通过。", vs=3)
            add_an("evidence_state", "证据状态：证据齐全（已通过审核，等待复核）", u_head)
            add_an("evidence_state", "证据齐全：特护记录表、皮肤评估表、翻身记录单均已完整", u_head)

        elif tag == "missing_evidence":
            add_pr("CREATE", "", STATUS_PENDING_SUBMIT, u_nurse2, "创建照护记录", vs=1)
            add_pr("SUBMIT", STATUS_PENDING_SUBMIT, STATUS_PENDING_AUDIT, u_nurse2, "提交审核，版本 2", vs=2)
            add_pr("EVIDENCE_WARNING", STATUS_PENDING_AUDIT, STATUS_PENDING_AUDIT, u_nurse2, "缺失证据: 血糖监测记录, 家属知情同意书", vs=2)
            add_an("missing_evidence", "提交时缺失证据: 血糖监测记录, 家属知情同意书", u_nurse2)
            add_an("evidence_state", "证据状态：有缺失（提交时缺失血糖监测记录、家属知情同意书）", u_nurse2)
            add_pr("BATCH_AUDIT_PASS_FAIL", STATUS_PENDING_AUDIT, STATUS_PENDING_AUDIT, u_head, "尝试批量审核通过，被缺证据拦截：血糖监测记录、家属知情同意书", result="failed", err="审核通过前需补齐证据: 血糖监测记录, 家属知情同意书，请先退回补正", vs=2)
            add_an("missing_evidence", "批量审核通过被拦截: 缺失血糖监测记录、家属知情同意书，已自动退回补正流程", u_head)
            add_an("evidence_state", "证据状态：有缺失（被批量审核通过拦截，需先退回补正）", u_head)

        elif tag == "overdue_audit":
            add_pr("CREATE", "", STATUS_PENDING_SUBMIT, u_nurse2, "创建慢病护理记录", vs=1)
            add_pr("VITAL_SIGNS_CORRECT", STATUS_PENDING_SUBMIT, STATUS_PENDING_SUBMIT, u_nurse2, "血压记录补正：初测172/100，复测168/98", vs=2)
            add_pr("SUBMIT", STATUS_PENDING_SUBMIT, STATUS_PENDING_AUDIT, u_nurse2, "提交审核", vs=2)
            add_pr("ABNORMAL_REPORT", STATUS_PENDING_AUDIT, STATUS_PENDING_AUDIT, u_nurse2, "异常上报：血压持续偏高，已上报值班医生", vs=2)
            add_an("abnormal", "异常复核: 血压偏高，建议调整降压方案", u_nurse2)
            add_an("evidence_state", "证据状态：OVERDUE_PENDING（逾期4天仍未审核，且缺失用药签名单）", u_head)
            add_an("overdue", "记录已逾期，需尽快审核处理", u_head)
            add_pr("OVERDUE_ADVANCE", STATUS_PENDING_AUDIT, STATUS_PENDING_REVIEW, u_head, "逾期推进：审核通过并送复核", vs=3)
            add_an("overdue_advance", "逾期记录审核推进成功，状态变更为待复核", u_head)
            add_an("abnormal", "逾期推进异常留痕: 血压持续偏高，收缩压超过160mmHg", u_head)
            add_an("evidence_state", "证据状态变更：OVERDUE_PENDING→OVERDUE_PENDING（逾期推进成功，状态变更待复核但仍逾期）", u_head)

        elif tag == "overdue_review":
            add_pr("CREATE", "", STATUS_PENDING_SUBMIT, u_nurse1, "创建临终关怀记录", vs=1)
            add_pr("SUBMIT", STATUS_PENDING_SUBMIT, STATUS_PENDING_AUDIT, u_nurse1, "提交审核", vs=2)
            add_pr("AUDIT_PASS", STATUS_PENDING_AUDIT, STATUS_PENDING_REVIEW, u_head, "关怀记录完整。", vs=3)
            add_an("evidence_state", "证据状态：OVERDUE_PENDING（逾期5天仍未复核归档，证据齐全）", u_director)
            add_an("overdue", "记录已逾期，需尽快复核归档", u_director)
            add_pr("OVERDUE_ADVANCE", STATUS_PENDING_REVIEW, STATUS_SYNCED, u_director, "逾期推进：复核归档同步完成", vs=4)
            add_an("overdue_advance", "逾期记录复核推进成功，已完成归档同步", u_director)
            add_an("evidence_state", "证据状态变更：OVERDUE_PENDING→ARCHIVED（逾期推进归档成功）", u_director)

        elif tag == "returned_correction":
            add_pr("CREATE", "", STATUS_PENDING_SUBMIT, u_nurse1, "创建术后护理记录", vs=1)
            add_pr("SUBMIT", STATUS_PENDING_SUBMIT, STATUS_PENDING_AUDIT, u_nurse1, "首次提交", vs=2)
            add_pr("AUDIT_REJECT", STATUS_PENDING_AUDIT, STATUS_RETURNED, u_head, "审核退回：缺失伤口评估单、康复评估记录", vs=3)
            add_an("missing_evidence", "审核退回缺失证据: 伤口评估单, 康复评估记录, DVT预防记录", u_head)
            add_an("evidence_state", "证据状态：有缺失（被退回补正，缺失伤口评估单、康复评估记录、DVT预防记录）", u_head)
            add_pr("OVERDUE_ADVANCE_FAIL", STATUS_RETURNED, STATUS_RETURNED, u_director, "逾期推进失败：记录处于退回状态且缺证据", result="failed", err="状态冲突：当前「已退回」不可逾期推进", vs=4)
            add_an("overdue_advance", "逾期推进被拦截: 记录处于退回补正状态，需护理员补正后重新提交", u_director)
            add_an("missing_evidence", "逾期推进仍缺失: 伤口评估单, 康复评估记录, DVT预防记录", u_director)
            add_an("evidence_state", "证据状态：有缺失（逾期推进被拦截，仍需补正缺失证据）", u_director)

        elif tag == "state_conflict_case":
            add_pr("CREATE", "", STATUS_PENDING_SUBMIT, u_nurse2, "创建失智护理记录", vs=1)
            add_pr("ABNORMAL_REPORT", STATUS_PENDING_SUBMIT, STATUS_PENDING_SUBMIT, u_nurse2, "异常上报：午间躁动情绪、攻击性行为", vs=1)
            add_pr("SUBMIT", STATUS_PENDING_SUBMIT, STATUS_PENDING_AUDIT, u_nurse2, "首次提交", vs=2)
            add_pr("AUDIT_REJECT", STATUS_PENDING_AUDIT, STATUS_RETURNED, u_head, "第一次退回：缺少家属告知记录、异常上报单", vs=3)
            add_pr("CORRECT", STATUS_RETURNED, STATUS_PENDING_AUDIT, u_nurse2, "补正：添加了家属告知记录截图，但异常上报单未找到原件", vs=4)
            add_pr("AUDIT_REJECT", STATUS_PENDING_AUDIT, STATUS_RETURNED, u_head, "第二次退回：仍缺失异常上报单原件，请与医生确认后补录", vs=5)
            add_an("missing_evidence", "二次退回仍缺失: 异常上报单原件", u_head)
            add_an("evidence_state", "证据状态：有缺失（二次退回仍缺失异常上报单原件）", u_head)
            add_an("abnormal", "躁动情况需密切观察，已建议夜间加派巡视频次", u_head)
            add_pr("STATUS_CONFLICT", STATUS_RETURNED, STATUS_RETURNED, u_head, "尝试在退回状态执行审核通过，状态冲突被拦截", result="failed", err="状态冲突：当前「已退回」不可审核通过", vs=5)
            add_an("status_conflict", "状态冲突留痕: 护士长尝试在退回状态下审核通过，被系统拦截。当前状态已退回，需护理员补正后重新提交", u_head)
            add_pr("VERSION_CONFLICT", STATUS_RETURNED, STATUS_RETURNED, u_director, "院区主任尝试复核，但版本号过旧被拦截", result="failed", err="版本冲突：当前 5 vs 提交 3", vs=5)
            add_an("status_conflict", "版本冲突留痕: 院区主任使用旧版本号尝试复核，被乐观锁拦截。当前版本5，提交版本3", u_director)
            add_an("evidence_state", "证据状态：有缺失（状态冲突和版本冲突留痕记录，仍缺失异常上报单原件）", u_director)

        elif tag == "pending_submit_draft":
            add_pr("CREATE", "", STATUS_PENDING_SUBMIT, u_nurse1, "创建草稿记录，待完善用药记录", vs=1)
            add_an("evidence_state", "证据状态：证据齐全（草稿状态，待提交后进入审核流程）", u_nurse1)

        elif tag == "near_due_review":
            add_pr("CREATE", "", STATUS_PENDING_SUBMIT, u_nurse1, "创建康复护理记录", vs=1)
            add_pr("SUBMIT", STATUS_PENDING_SUBMIT, STATUS_PENDING_AUDIT, u_nurse1, "提交审核", vs=2)
            add_pr("AUDIT_PASS", STATUS_PENDING_AUDIT, STATUS_PENDING_REVIEW, u_head, "康复记录完整，训练有效。", vs=3)
            add_an("due_warning", "记录即将到期（36小时内），请尽快复核归档", u_head)
            add_an("evidence_state", "证据状态：证据齐全（临期待复核，证据全部齐全）", u_head)

        if spec["evidence_provided"]:
            for idx, ev in enumerate(spec["evidence_provided"]):
                db.add(Attachment(
                    care_record_id=r.id,
                    file_name=f"{ev}_{spec['elder_name']}_{spec['record_no']}.pdf",
                    file_type="application/pdf",
                    file_size=102400 + idx * 5120,
                    uploaded_by=spec["submitter"].id,
                    evidence_type=ev,
                    uploaded_at=spec["submitted_at"] or spec["record_date"],
                ))

    db.commit()
    _SEEDED = True
