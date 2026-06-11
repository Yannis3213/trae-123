import datetime
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.auth import get_password_hash
from app.database import Base, SessionLocal, engine
from app.models import (
    ActionTypeEnum,
    Attachment,
    AuditLog,
    Enrollment,
    EnrollmentStatusEnum,
    EvidenceTypeEnum,
    ExceptionLog,
    ExceptionTypeEnum,
    RoleEnum,
    User,
)


def seed_database():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    try:
        print("正在创建演示账号...")

        clerk1 = User(
            username="clerk1",
            full_name="张登记",
            hashed_password=get_password_hash("123456"),
            role=RoleEnum.REGISTRATION_CLERK,
            is_active=True,
        )
        clerk2 = User(
            username="clerk2",
            full_name="李文员",
            hashed_password=get_password_hash("123456"),
            role=RoleEnum.REGISTRATION_CLERK,
            is_active=True,
        )

        supervisor1 = User(
            username="supervisor1",
            full_name="王审核",
            hashed_password=get_password_hash("123456"),
            role=RoleEnum.AUDIT_SUPERVISOR,
            is_active=True,
        )

        lead1 = User(
            username="lead1",
            full_name="赵复核",
            hashed_password=get_password_hash("123456"),
            role=RoleEnum.REVIEW_LEAD,
            is_active=True,
        )

        db.add_all([clerk1, clerk2, supervisor1, lead1])
        db.flush()

        print("正在创建会员入会单样例...")
        now = datetime.datetime.utcnow()

        enrollments_data = [
            {
                "member_name": "陈小明",
                "member_phone": "13800138001",
                "member_id_card": "110101199001010001",
                "membership_type": "年卡",
                "card_level": "金卡",
                "amount": 2999,
                "contract_no": "HT202506001",
                "salesperson": "销售A",
                "private_trainer": "私教A",
                "store": "朝阳店",
                "remark": "新会员入会",
                "status": EnrollmentStatusEnum.PENDING,
                "created_by": clerk1,
                "current_handler": clerk1,
                "due_offset_days": 3,
                "has_full_evidence": True,
                "stage": "pending_audit",
            },
            {
                "member_name": "李小红",
                "member_phone": "13800138002",
                "member_id_card": "110101199002020002",
                "membership_type": "季卡",
                "card_level": "银卡",
                "amount": 999,
                "contract_no": "HT202506002",
                "salesperson": "销售B",
                "private_trainer": "私教B",
                "store": "朝阳店",
                "remark": "老会员续卡",
                "status": EnrollmentStatusEnum.PENDING,
                "created_by": clerk1,
                "current_handler": clerk1,
                "due_offset_days": 0.5,
                "has_full_evidence": True,
                "stage": "pending_audit_approaching",
            },
            {
                "member_name": "王小强",
                "member_phone": "13800138003",
                "member_id_card": "110101199003030003",
                "membership_type": "月卡",
                "card_level": "普通",
                "amount": 299,
                "contract_no": "HT202506003",
                "salesperson": "销售A",
                "private_trainer": None,
                "store": "海淀店",
                "remark": "体验卡升级",
                "status": EnrollmentStatusEnum.PENDING,
                "created_by": clerk2,
                "current_handler": clerk2,
                "due_offset_days": -2,
                "has_full_evidence": True,
                "stage": "overdue_pending",
            },
            {
                "member_name": "赵小美",
                "member_phone": "13800138004",
                "member_id_card": "110101199004040004",
                "membership_type": "年卡",
                "card_level": "钻石卡",
                "amount": 5999,
                "contract_no": "HT202506004",
                "salesperson": "销售C",
                "private_trainer": "私教C",
                "store": "朝阳店",
                "remark": "高端会员",
                "status": EnrollmentStatusEnum.FAILED,
                "created_by": clerk1,
                "current_handler": clerk1,
                "due_offset_days": 5,
                "has_full_evidence": False,
                "stage": "failed_missing_materials",
                "audit_by": supervisor1,
            },
            {
                "member_name": "孙大壮",
                "member_phone": "13800138005",
                "member_id_card": "110101199005050005",
                "membership_type": "半年卡",
                "card_level": "金卡",
                "amount": 1699,
                "contract_no": "HT202506005",
                "salesperson": "销售B",
                "private_trainer": "私教A",
                "store": "海淀店",
                "remark": "审核退回待补正",
                "status": EnrollmentStatusEnum.FAILED,
                "created_by": clerk2,
                "current_handler": clerk2,
                "due_offset_days": -1,
                "has_full_evidence": True,
                "stage": "failed_overdue",
                "audit_by": supervisor1,
            },
            {
                "member_name": "周小丽",
                "member_phone": "13800138006",
                "member_id_card": "110101199006060006",
                "membership_type": "年卡",
                "card_level": "银卡",
                "amount": 2599,
                "contract_no": "HT202506006",
                "salesperson": "销售A",
                "private_trainer": "私教B",
                "store": "朝阳店",
                "remark": "待复核",
                "status": EnrollmentStatusEnum.PENDING,
                "created_by": clerk1,
                "current_handler": None,
                "due_offset_days": 2,
                "has_full_evidence": True,
                "stage": "pending_review",
                "audit_by": supervisor1,
                "audited": True,
            },
            {
                "member_name": "吴大勇",
                "member_phone": "13800138007",
                "member_id_card": "110101199007070007",
                "membership_type": "季卡",
                "card_level": "普通",
                "amount": 799,
                "contract_no": "HT202506007",
                "salesperson": "销售C",
                "private_trainer": None,
                "store": "海淀店",
                "remark": "已完成",
                "status": EnrollmentStatusEnum.COMPLETED,
                "created_by": clerk1,
                "current_handler": None,
                "due_offset_days": 10,
                "has_full_evidence": True,
                "stage": "completed",
                "audit_by": supervisor1,
                "review_by": lead1,
                "audited": True,
                "reviewed": True,
            },
            {
                "member_name": "郑小芳",
                "member_phone": "13800138008",
                "member_id_card": "110101199008080008",
                "membership_type": "年卡",
                "card_level": "金卡",
                "amount": 2999,
                "contract_no": "HT202506008",
                "salesperson": "销售B",
                "private_trainer": "私教C",
                "store": "朝阳店",
                "remark": "资料缺失待处理",
                "status": EnrollmentStatusEnum.PENDING,
                "created_by": clerk2,
                "current_handler": clerk2,
                "due_offset_days": 4,
                "has_full_evidence": False,
                "stage": "pending_missing_evidence",
            },
        ]

        for edata in enrollments_data:
            stage = edata.pop("stage")
            has_full_evidence = edata.pop("has_full_evidence")
            due_offset = edata.pop("due_offset_days")
            created_by = edata.pop("created_by")
            current_handler = edata.pop("current_handler")
            audit_by = edata.pop("audit_by", None)
            review_by = edata.pop("review_by", None)
            audited = edata.pop("audited", False)
            reviewed = edata.pop("reviewed", False)

            due_at = now + datetime.timedelta(days=due_offset)

            enrollment = Enrollment(
                **edata,
                created_by_id=created_by.id,
                current_handler_id=current_handler.id if current_handler else None,
                audit_by_id=audit_by.id if audit_by else None,
                review_by_id=review_by.id if review_by else None,
                version=1,
                created_at=now - datetime.timedelta(days=2),
                submitted_at=now - datetime.timedelta(days=1) if stage != "failed_missing_materials" else None,
                audited_at=now - datetime.timedelta(hours=12) if audited else None,
                reviewed_at=now - datetime.timedelta(hours=6) if reviewed else None,
                due_at=due_at,
            )
            db.add(enrollment)
            db.flush()

            evidence_types = [
                EvidenceTypeEnum.MEMBERSHIP_FORM,
                EvidenceTypeEnum.CONTRACT_CONFIRMATION,
                EvidenceTypeEnum.CARD_BENEFITS,
            ]

            if has_full_evidence:
                for idx, et in enumerate(evidence_types):
                    att = Attachment(
                        enrollment_id=enrollment.id,
                        evidence_type=et,
                        file_name=f"evidence_{et.value}_{enrollment.id}.pdf",
                        file_url=f"/uploads/evidence_{et.value}_{enrollment.id}.pdf",
                        uploaded_by_id=created_by.id,
                        is_valid=True,
                    )
                    db.add(att)
            else:
                att = Attachment(
                    enrollment_id=enrollment.id,
                    evidence_type=EvidenceTypeEnum.MEMBERSHIP_FORM,
                    file_name=f"membership_form_{enrollment.id}.pdf",
                    file_url=f"/uploads/membership_form_{enrollment.id}.pdf",
                    uploaded_by_id=created_by.id,
                    is_valid=True,
                )
                db.add(att)

            create_log = AuditLog(
                enrollment_id=enrollment.id,
                user_id=created_by.id,
                action_type=ActionTypeEnum.CREATE,
                old_status=None,
                new_status=EnrollmentStatusEnum.PENDING,
                comment="创建入会单",
                created_at=now - datetime.timedelta(days=2),
            )
            db.add(create_log)

            if stage == "pending_review":
                audit_log = AuditLog(
                    enrollment_id=enrollment.id,
                    user_id=supervisor1.id,
                    action_type=ActionTypeEnum.AUDIT_PASS,
                    old_status=EnrollmentStatusEnum.PENDING,
                    new_status=EnrollmentStatusEnum.PENDING,
                    comment="审核通过，提交复核",
                    created_at=now - datetime.timedelta(hours=12),
                )
                db.add(audit_log)

            if stage == "failed_missing_materials":
                audit_log = AuditLog(
                    enrollment_id=enrollment.id,
                    user_id=supervisor1.id,
                    action_type=ActionTypeEnum.AUDIT_FAIL,
                    old_status=EnrollmentStatusEnum.PENDING,
                    new_status=EnrollmentStatusEnum.FAILED,
                    comment="资料不全，缺少合同确认和卡权益证据，请补正后重新提交",
                    created_at=now - datetime.timedelta(hours=8),
                )
                db.add(audit_log)

                exc = ExceptionLog(
                    enrollment_id=enrollment.id,
                    exception_type=ExceptionTypeEnum.MISSING_MATERIALS,
                    description="资料缺失：缺少合同确认、卡权益启用证据",
                    detected_by="王审核",
                    detected_at=now - datetime.timedelta(hours=8),
                )
                db.add(exc)

            if stage == "failed_overdue":
                audit_log = AuditLog(
                    enrollment_id=enrollment.id,
                    user_id=supervisor1.id,
                    action_type=ActionTypeEnum.AUDIT_FAIL,
                    old_status=EnrollmentStatusEnum.PENDING,
                    new_status=EnrollmentStatusEnum.FAILED,
                    comment="信息有误，需要补正",
                    created_at=now - datetime.timedelta(days=1),
                )
                db.add(audit_log)

                exc1 = ExceptionLog(
                    enrollment_id=enrollment.id,
                    exception_type=ExceptionTypeEnum.OVERDUE,
                    description="超期未处理：核验失败后补正已超时",
                    detected_by="system",
                    detected_at=now - datetime.timedelta(hours=2),
                )
                db.add(exc1)

                exc2 = ExceptionLog(
                    enrollment_id=enrollment.id,
                    exception_type=ExceptionTypeEnum.STATUS_CONFLICT,
                    description="状态冲突：审核退回，需要补正",
                    detected_by="王审核",
                    detected_at=now - datetime.timedelta(days=1),
                )
                db.add(exc2)

            if stage == "completed":
                audit_log = AuditLog(
                    enrollment_id=enrollment.id,
                    user_id=supervisor1.id,
                    action_type=ActionTypeEnum.AUDIT_PASS,
                    old_status=EnrollmentStatusEnum.PENDING,
                    new_status=EnrollmentStatusEnum.PENDING,
                    comment="审核通过",
                    created_at=now - datetime.timedelta(days=1),
                )
                db.add(audit_log)

                review_log = AuditLog(
                    enrollment_id=enrollment.id,
                    user_id=lead1.id,
                    action_type=ActionTypeEnum.REVIEW_PASS,
                    old_status=EnrollmentStatusEnum.PENDING,
                    new_status=EnrollmentStatusEnum.COMPLETED,
                    comment="复核通过，归档完成",
                    created_at=now - datetime.timedelta(hours=6),
                )
                db.add(review_log)

            if stage == "pending_missing_evidence":
                exc = ExceptionLog(
                    enrollment_id=enrollment.id,
                    exception_type=ExceptionTypeEnum.MISSING_MATERIALS,
                    description="资料缺失：缺少合同确认、卡权益启用证据",
                    detected_by="system",
                    detected_at=now - datetime.timedelta(hours=1),
                )
                db.add(exc)

            if stage == "overdue_pending":
                exc = ExceptionLog(
                    enrollment_id=enrollment.id,
                    exception_type=ExceptionTypeEnum.OVERDUE,
                    description="超期未处理：已超过审核时限",
                    detected_by="system",
                    detected_at=now - datetime.timedelta(hours=3),
                )
                db.add(exc)

            if stage == "pending_audit_approaching":
                pass

            db.flush()

        db.commit()
        print("\n===== 数据库初始化完成 =====")
        print("\n演示账号：")
        print("  登记员：clerk1 / 123456  （张登记）")
        print("  登记员：clerk2 / 123456  （李文员）")
        print("  审核主管：supervisor1 / 123456  （王审核）")
        print("  复核负责人：lead1 / 123456  （赵复核）")
        print("\n样例数据：")
        print("  - 待核验（正常）：陈小明")
        print("  - 待核验（临期）：李小红")
        print("  - 待核验（逾期）：王小强")
        print("  - 待核验（资料缺失）：郑小芳")
        print("  - 待复核：周小丽")
        print("  - 核验失败（资料缺失）：赵小美")
        print("  - 核验失败（逾期）：孙大壮")
        print("  - 核验完成：吴大勇")
        print("\n四类异常样例：")
        print("  1. 资料缺失 - 赵小美、郑小芳")
        print("  2. 状态冲突 - 赵小美（审核退回）、孙大壮")
        print("  3. 越权推进 - 需登录非对应角色操作触发")
        print("  4. 超期未处理 - 王小强、孙大壮")

    finally:
        db.close()


if __name__ == "__main__":
    data_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data")
    os.makedirs(data_dir, exist_ok=True)
    seed_database()
