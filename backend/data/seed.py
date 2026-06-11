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

        evidence_types_all = [
            EvidenceTypeEnum.MEMBERSHIP_FORM,
            EvidenceTypeEnum.CONTRACT_CONFIRMATION,
            EvidenceTypeEnum.CARD_BENEFITS,
        ]

        # 1. 陈小明 - 待核验（正常），资料齐全，等审核
        e1 = Enrollment(
            member_name="陈小明",
            member_phone="13800138001",
            member_id_card="110101199001010001",
            membership_type="年卡",
            card_level="金卡",
            amount=2999,
            contract_no="HT202506001",
            salesperson="会籍顾问-林销售",
            private_trainer="私教主管-陈教练",
            store="朝阳店",
            remark="新会员入会，推荐人老会员张伟",
            status=EnrollmentStatusEnum.PENDING,
            version=1,
            created_by_id=clerk1.id,
            current_handler_id=None,
            audit_by_id=None,
            review_by_id=None,
            created_at=now - datetime.timedelta(hours=6),
            submitted_at=now - datetime.timedelta(hours=6),
            audited_at=None,
            reviewed_at=None,
            due_at=now + datetime.timedelta(days=3),
        )
        db.add(e1)
        db.flush()

        for et in evidence_types_all:
            db.add(Attachment(
                enrollment_id=e1.id,
                evidence_type=et,
                file_name=f"chenxiaoming_{et.value}.pdf",
                file_url=f"/uploads/chenxiaoming_{et.value}.pdf",
                uploaded_by_id=clerk1.id,
                is_valid=True,
            ))
        db.add(AuditLog(
            enrollment_id=e1.id,
            user_id=clerk1.id,
            action_type=ActionTypeEnum.CREATE,
            old_status=None,
            new_status=EnrollmentStatusEnum.PENDING,
            comment="创建入会单并提交审核，资料齐全，会籍顾问林销售跟进，私教陈教练对接",
            created_at=now - datetime.timedelta(hours=6),
        ))

        # 2. 李小红 - 待核验（临期），资料齐全，等审核，剩12小时到期
        e2 = Enrollment(
            member_name="李小红",
            member_phone="13800138002",
            member_id_card="110101199002020002",
            membership_type="季卡",
            card_level="银卡",
            amount=999,
            contract_no="HT202506002",
            salesperson="会籍顾问-王销售",
            private_trainer="私教主管-李教练",
            store="朝阳店",
            remark="老会员续卡，享受9折优惠",
            status=EnrollmentStatusEnum.PENDING,
            version=1,
            created_by_id=clerk1.id,
            current_handler_id=None,
            audit_by_id=None,
            review_by_id=None,
            created_at=now - datetime.timedelta(days=2, hours=12),
            submitted_at=now - datetime.timedelta(days=2, hours=12),
            audited_at=None,
            reviewed_at=None,
            due_at=now + datetime.timedelta(hours=12),
        )
        db.add(e2)
        db.flush()

        for et in evidence_types_all:
            db.add(Attachment(
                enrollment_id=e2.id,
                evidence_type=et,
                file_name=f"lixiaohong_{et.value}.pdf",
                file_url=f"/uploads/lixiaohong_{et.value}.pdf",
                uploaded_by_id=clerk1.id,
                is_valid=True,
            ))
        db.add(AuditLog(
            enrollment_id=e2.id,
            user_id=clerk1.id,
            action_type=ActionTypeEnum.CREATE,
            old_status=None,
            new_status=EnrollmentStatusEnum.PENDING,
            comment="创建入会单并提交审核，老会员续季卡，会籍顾问王销售",
            created_at=now - datetime.timedelta(days=2, hours=12),
        ))

        # 3. 王小强 - 待核验（逾期），资料齐全，等审核，已逾期2天
        e3 = Enrollment(
            member_name="王小强",
            member_phone="13800138003",
            member_id_card="110101199003030003",
            membership_type="月卡",
            card_level="普通",
            amount=299,
            contract_no="HT202506003",
            salesperson="会籍顾问-林销售",
            private_trainer=None,
            store="海淀店",
            remark="体验卡升级月卡，逾期未审核",
            status=EnrollmentStatusEnum.PENDING,
            version=1,
            created_by_id=clerk2.id,
            current_handler_id=None,
            audit_by_id=None,
            review_by_id=None,
            created_at=now - datetime.timedelta(days=5),
            submitted_at=now - datetime.timedelta(days=5),
            audited_at=None,
            reviewed_at=None,
            due_at=now - datetime.timedelta(days=2),
        )
        db.add(e3)
        db.flush()

        for et in evidence_types_all:
            db.add(Attachment(
                enrollment_id=e3.id,
                evidence_type=et,
                file_name=f"wangxiaoqiang_{et.value}.pdf",
                file_url=f"/uploads/wangxiaoqiang_{et.value}.pdf",
                uploaded_by_id=clerk2.id,
                is_valid=True,
            ))
        db.add(AuditLog(
            enrollment_id=e3.id,
            user_id=clerk2.id,
            action_type=ActionTypeEnum.CREATE,
            old_status=None,
            new_status=EnrollmentStatusEnum.PENDING,
            comment="创建入会单并提交审核，体验卡升级月卡，已逾期未审核",
            created_at=now - datetime.timedelta(days=5),
        ))
        db.add(ExceptionLog(
            enrollment_id=e3.id,
            exception_type=ExceptionTypeEnum.OVERDUE,
            description="超期未处理：待审核状态已逾期2天，责任人为审核主管（待分配）",
            detected_by="system",
            detected_at=now - datetime.timedelta(days=2),
            resolved=False,
        ))

        # 4. 赵小美 - 核验失败（资料缺失），有补正记录，经历过一次补正又被退回
        e4 = Enrollment(
            member_name="赵小美",
            member_phone="13800138004",
            member_id_card="110101199004040004",
            membership_type="年卡",
            card_level="钻石卡",
            amount=5999,
            contract_no="HT202506004",
            salesperson="会籍顾问-张销售",
            private_trainer="私教主管-刘教练",
            store="朝阳店",
            remark="高端会员，第一次提交资料不全，补正后仍缺卡权益",
            status=EnrollmentStatusEnum.FAILED,
            version=3,
            created_by_id=clerk1.id,
            current_handler_id=clerk1.id,
            audit_by_id=supervisor1.id,
            review_by_id=None,
            created_at=now - datetime.timedelta(days=7),
            submitted_at=now - datetime.timedelta(days=7),
            audited_at=now - datetime.timedelta(days=1),
            reviewed_at=None,
            due_at=now + datetime.timedelta(days=5),
        )
        db.add(e4)
        db.flush()

        db.add(Attachment(
            enrollment_id=e4.id,
            evidence_type=EvidenceTypeEnum.MEMBERSHIP_FORM,
            file_name="zhaoxiaomei_membership_v2.pdf",
            file_url="/uploads/zhaoxiaomei_membership_v2.pdf",
            uploaded_by_id=clerk1.id,
            is_valid=True,
        ))
        db.add(Attachment(
            enrollment_id=e4.id,
            evidence_type=EvidenceTypeEnum.CONTRACT_CONFIRMATION,
            file_name="zhaoxiaomei_contract_v2.pdf",
            file_url="/uploads/zhaoxiaomei_contract_v2.pdf",
            uploaded_by_id=clerk1.id,
            is_valid=True,
        ))
        db.add(Attachment(
            enrollment_id=e4.id,
            evidence_type=EvidenceTypeEnum.MEMBERSHIP_FORM,
            file_name="zhaoxiaomei_membership_v1.pdf",
            file_url="/uploads/zhaoxiaomei_membership_v1.pdf",
            uploaded_by_id=clerk1.id,
            is_valid=False,
        ))

        db.add(AuditLog(
            enrollment_id=e4.id,
            user_id=clerk1.id,
            action_type=ActionTypeEnum.CREATE,
            old_status=None,
            new_status=EnrollmentStatusEnum.PENDING,
            comment="创建入会单并提交，钻石卡年卡，会籍张销售，私教刘教练",
            created_at=now - datetime.timedelta(days=7),
        ))
        db.add(AuditLog(
            enrollment_id=e4.id,
            user_id=supervisor1.id,
            action_type=ActionTypeEnum.AUDIT_FAIL,
            old_status=EnrollmentStatusEnum.PENDING,
            new_status=EnrollmentStatusEnum.FAILED,
            comment="第一次审核退回：缺少合同确认和卡权益启用证据，请补正",
            created_at=now - datetime.timedelta(days=5),
        ))
        db.add(AuditLog(
            enrollment_id=e4.id,
            user_id=clerk1.id,
            action_type=ActionTypeEnum.CORRECT,
            old_status=EnrollmentStatusEnum.FAILED,
            new_status=EnrollmentStatusEnum.PENDING,
            comment="第一次补正：补充了合同确认证据，卡权益还在办理中稍后补",
            created_at=now - datetime.timedelta(days=3),
        ))
        db.add(AuditLog(
            enrollment_id=e4.id,
            user_id=supervisor1.id,
            action_type=ActionTypeEnum.AUDIT_FAIL,
            old_status=EnrollmentStatusEnum.PENDING,
            new_status=EnrollmentStatusEnum.FAILED,
            comment="第二次审核退回：卡权益启用证据仍缺失，高端会员必须三类齐全",
            created_at=now - datetime.timedelta(days=1),
        ))

        db.add(ExceptionLog(
            enrollment_id=e4.id,
            exception_type=ExceptionTypeEnum.MISSING_MATERIALS,
            description="资料缺失：缺少卡权益启用证据（高端钻石卡要求三类齐全）",
            detected_by="王审核",
            detected_at=now - datetime.timedelta(days=1),
            resolved=False,
        ))
        db.add(ExceptionLog(
            enrollment_id=e4.id,
            exception_type=ExceptionTypeEnum.STATUS_CONFLICT,
            description="状态冲突：第二次审核退回，需补正后重新提交",
            detected_by="王审核",
            detected_at=now - datetime.timedelta(days=1),
            resolved=False,
        ))
        db.add(ExceptionLog(
            enrollment_id=e4.id,
            exception_type=ExceptionTypeEnum.MISSING_MATERIALS,
            description="资料缺失：第一次审核缺少合同和卡权益证据",
            detected_by="王审核",
            detected_at=now - datetime.timedelta(days=5),
            resolved=True,
            resolved_at=now - datetime.timedelta(days=3),
            resolution_note="补正提交了合同确认证据，卡权益仍缺失",
        ))
        db.add(ExceptionLog(
            enrollment_id=e4.id,
            exception_type=ExceptionTypeEnum.STATUS_CONFLICT,
            description="状态冲突：第一次审核退回",
            detected_by="王审核",
            detected_at=now - datetime.timedelta(days=5),
            resolved=True,
            resolved_at=now - datetime.timedelta(days=3),
            resolution_note="登记员补正提交，状态转回待核验",
        ))

        # 5. 孙大壮 - 核验失败（逾期），资料齐全，但逾期未补正
        e5 = Enrollment(
            member_name="孙大壮",
            member_phone="13800138005",
            member_id_card="110101199005050005",
            membership_type="半年卡",
            card_level="金卡",
            amount=1699,
            contract_no="HT202506005",
            salesperson="会籍顾问-王销售",
            private_trainer="私教主管-陈教练",
            store="海淀店",
            remark="审核退回待补正，信息有误需要修改，已逾期",
            status=EnrollmentStatusEnum.FAILED,
            version=2,
            created_by_id=clerk2.id,
            current_handler_id=clerk2.id,
            audit_by_id=supervisor1.id,
            review_by_id=None,
            created_at=now - datetime.timedelta(days=6),
            submitted_at=now - datetime.timedelta(days=6),
            audited_at=now - datetime.timedelta(days=4),
            reviewed_at=None,
            due_at=now - datetime.timedelta(days=1),
        )
        db.add(e5)
        db.flush()

        for et in evidence_types_all:
            db.add(Attachment(
                enrollment_id=e5.id,
                evidence_type=et,
                file_name=f"sunudazhuang_{et.value}.pdf",
                file_url=f"/uploads/sundazhuang_{et.value}.pdf",
                uploaded_by_id=clerk2.id,
                is_valid=True,
            ))

        db.add(AuditLog(
            enrollment_id=e5.id,
            user_id=clerk2.id,
            action_type=ActionTypeEnum.CREATE,
            old_status=None,
            new_status=EnrollmentStatusEnum.PENDING,
            comment="创建入会单并提交审核，半年金卡，会籍王销售，私教陈教练",
            created_at=now - datetime.timedelta(days=6),
        ))
        db.add(AuditLog(
            enrollment_id=e5.id,
            user_id=supervisor1.id,
            action_type=ActionTypeEnum.AUDIT_FAIL,
            old_status=EnrollmentStatusEnum.PENDING,
            new_status=EnrollmentStatusEnum.FAILED,
            comment="审核退回：身份证号与会员信息不一致，请核对后补正",
            created_at=now - datetime.timedelta(days=4),
        ))

        db.add(ExceptionLog(
            enrollment_id=e5.id,
            exception_type=ExceptionTypeEnum.STATUS_CONFLICT,
            description="状态冲突：审核退回，身份证信息不一致待补正",
            detected_by="王审核",
            detected_at=now - datetime.timedelta(days=4),
            resolved=False,
        ))
        db.add(ExceptionLog(
            enrollment_id=e5.id,
            exception_type=ExceptionTypeEnum.OVERDUE,
            description="超期未处理：核验失败后补正已逾期1天，责任人为登记员李文员",
            detected_by="system",
            detected_at=now - datetime.timedelta(days=1),
            resolved=False,
        ))

        # 6. 周小丽 - 待核验（待复核），资料齐全，已审核通过，等复核
        e6 = Enrollment(
            member_name="周小丽",
            member_phone="13800138006",
            member_id_card="110101199006060006",
            membership_type="年卡",
            card_level="银卡",
            amount=2599,
            contract_no="HT202506006",
            salesperson="会籍顾问-林销售",
            private_trainer="私教主管-李教练",
            store="朝阳店",
            remark="已审核通过，待复核",
            status=EnrollmentStatusEnum.PENDING,
            version=2,
            created_by_id=clerk1.id,
            current_handler_id=None,
            audit_by_id=supervisor1.id,
            review_by_id=None,
            created_at=now - datetime.timedelta(days=4),
            submitted_at=now - datetime.timedelta(days=4),
            audited_at=now - datetime.timedelta(days=2),
            reviewed_at=None,
            due_at=now + datetime.timedelta(days=2),
        )
        db.add(e6)
        db.flush()

        for et in evidence_types_all:
            db.add(Attachment(
                enrollment_id=e6.id,
                evidence_type=et,
                file_name=f"zhouxiaoli_{et.value}.pdf",
                file_url=f"/uploads/zhouxiaoli_{et.value}.pdf",
                uploaded_by_id=clerk1.id,
                is_valid=True,
            ))

        db.add(AuditLog(
            enrollment_id=e6.id,
            user_id=clerk1.id,
            action_type=ActionTypeEnum.CREATE,
            old_status=None,
            new_status=EnrollmentStatusEnum.PENDING,
            comment="创建入会单并提交，年卡银卡，会籍林销售，私教李教练",
            created_at=now - datetime.timedelta(days=4),
        ))
        db.add(AuditLog(
            enrollment_id=e6.id,
            user_id=supervisor1.id,
            action_type=ActionTypeEnum.AUDIT_PASS,
            old_status=EnrollmentStatusEnum.PENDING,
            new_status=EnrollmentStatusEnum.PENDING,
            comment="审核通过：资料齐全，信息无误，提交复核负责人复核",
            created_at=now - datetime.timedelta(days=2),
        ))

        # 7. 吴大勇 - 核验完成，资料齐全，已审核通过并复核完成
        e7 = Enrollment(
            member_name="吴大勇",
            member_phone="13800138007",
            member_id_card="110101199007070007",
            membership_type="季卡",
            card_level="普通",
            amount=799,
            contract_no="HT202506007",
            salesperson="会籍顾问-张销售",
            private_trainer=None,
            store="海淀店",
            remark="已完成归档",
            status=EnrollmentStatusEnum.COMPLETED,
            version=3,
            created_by_id=clerk1.id,
            current_handler_id=None,
            audit_by_id=supervisor1.id,
            review_by_id=lead1.id,
            created_at=now - datetime.timedelta(days=10),
            submitted_at=now - datetime.timedelta(days=10),
            audited_at=now - datetime.timedelta(days=8),
            reviewed_at=now - datetime.timedelta(days=6),
            due_at=now - datetime.timedelta(days=4),
        )
        db.add(e7)
        db.flush()

        for et in evidence_types_all:
            db.add(Attachment(
                enrollment_id=e7.id,
                evidence_type=et,
                file_name=f"wudayong_{et.value}.pdf",
                file_url=f"/uploads/wudayong_{et.value}.pdf",
                uploaded_by_id=clerk1.id,
                is_valid=True,
            ))

        db.add(AuditLog(
            enrollment_id=e7.id,
            user_id=clerk1.id,
            action_type=ActionTypeEnum.CREATE,
            old_status=None,
            new_status=EnrollmentStatusEnum.PENDING,
            comment="创建入会单并提交，季卡普通会员，会籍张销售",
            created_at=now - datetime.timedelta(days=10),
        ))
        db.add(AuditLog(
            enrollment_id=e7.id,
            user_id=supervisor1.id,
            action_type=ActionTypeEnum.AUDIT_PASS,
            old_status=EnrollmentStatusEnum.PENDING,
            new_status=EnrollmentStatusEnum.PENDING,
            comment="审核通过：资料齐全，信息准确",
            created_at=now - datetime.timedelta(days=8),
        ))
        db.add(AuditLog(
            enrollment_id=e7.id,
            user_id=lead1.id,
            action_type=ActionTypeEnum.REVIEW_PASS,
            old_status=EnrollmentStatusEnum.PENDING,
            new_status=EnrollmentStatusEnum.COMPLETED,
            comment="复核通过，已归档。会籍顾问张销售、私教暂无记录，核对无误",
            created_at=now - datetime.timedelta(days=6),
        ))
        db.add(ExceptionLog(
            enrollment_id=e7.id,
            exception_type=ExceptionTypeEnum.MISSING_MATERIALS,
            description="资料缺失：创建时卡权益证据未及时上传",
            detected_by="system",
            detected_at=now - datetime.timedelta(days=10),
            resolved=True,
            resolved_at=now - datetime.timedelta(days=9),
            resolution_note="登记员补传卡权益启用证据",
        ))

        # 8. 郑小芳 - 待核验（资料缺失），刚创建，资料不全，系统检测到
        e8 = Enrollment(
            member_name="郑小芳",
            member_phone="13800138008",
            member_id_card="110101199008080008",
            membership_type="年卡",
            card_level="金卡",
            amount=2999,
            contract_no="HT202506008",
            salesperson="会籍顾问-王销售",
            private_trainer="私教主管-刘教练",
            store="朝阳店",
            remark="刚提交，资料不全，等登记员补充",
            status=EnrollmentStatusEnum.PENDING,
            version=1,
            created_by_id=clerk2.id,
            current_handler_id=None,
            audit_by_id=None,
            review_by_id=None,
            created_at=now - datetime.timedelta(hours=4),
            submitted_at=now - datetime.timedelta(hours=4),
            audited_at=None,
            reviewed_at=None,
            due_at=now + datetime.timedelta(days=4),
        )
        db.add(e8)
        db.flush()

        db.add(Attachment(
            enrollment_id=e8.id,
            evidence_type=EvidenceTypeEnum.MEMBERSHIP_FORM,
            file_name="zhengxiaofang_membership.pdf",
            file_url="/uploads/zhengxiaofang_membership.pdf",
            uploaded_by_id=clerk2.id,
            is_valid=True,
        ))

        db.add(AuditLog(
            enrollment_id=e8.id,
            user_id=clerk2.id,
            action_type=ActionTypeEnum.CREATE,
            old_status=None,
            new_status=EnrollmentStatusEnum.PENDING,
            comment="创建入会单，暂时只上传了入会申请表，合同和卡权益稍后补",
            created_at=now - datetime.timedelta(hours=4),
        ))
        db.add(ExceptionLog(
            enrollment_id=e8.id,
            exception_type=ExceptionTypeEnum.MISSING_MATERIALS,
            description="资料缺失：缺少合同确认、卡权益启用证据",
            detected_by="system",
            detected_at=now - datetime.timedelta(hours=3),
            resolved=False,
        ))

        db.commit()

        print("\n===== 数据库初始化完成 =====")
        print("\n演示账号：")
        print("  登记员：clerk1 / 123456  （张登记）")
        print("  登记员：clerk2 / 123456  （李文员）")
        print("  审核主管：supervisor1 / 123456  （王审核）")
        print("  复核负责人：lead1 / 123456  （赵复核）")
        print("\n样例数据（8条）：")
        print("  1. 陈小明 - 待核验（正常）- 资料齐全 - 等审核")
        print("  2. 李小红 - 待核验（临期）- 资料齐全 - 剩12小时")
        print("  3. 王小强 - 待核验（逾期）- 资料齐全 - 逾期2天")
        print("  4. 赵小美 - 核验失败（资料缺失）- 2次退回 - 有补正记录")
        print("  5. 孙大壮 - 核验失败（逾期）- 资料齐全 - 补正逾期")
        print("  6. 周小丽 - 待核验（待复核）- 已审核 - 等复核")
        print("  7. 吴大勇 - 核验完成 - 已归档 - 有历史异常")
        print("  8. 郑小芳 - 待核验（资料缺失）- 刚创建 - 缺两类证据")
        print("\n四类异常样例：")
        print("  1. 资料缺失 - 赵小美、郑小芳")
        print("  2. 状态冲突 - 赵小美（2次退回）、孙大壮")
        print("  3. 越权推进 - 需登录非对应角色操作触发")
        print("  4. 超期未处理 - 王小强、孙大壮")
        print("\n月底重点：")
        print("  ✅ 正常/临期/逾期三队分列")
        print("  ✅ 节点超时算责任人")
        print("  ✅ 逾期批量推进逐条拦截")
        print("  ✅ 详情可见补正动作和异常原因")

    finally:
        db.close()


if __name__ == "__main__":
    data_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data")
    os.makedirs(data_dir, exist_ok=True)
    seed_database()
