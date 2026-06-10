from datetime import datetime, timedelta
from uuid import uuid4
import os

from sqlalchemy.orm import Session

from models import (
    User, Inspection, ChargingPileInspection, FaultReport,
    ProcessingRecord, AuditRemark, CorrectionRecord, ExceptionReason,
    Attachment,
)

ATTACHMENTS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data", "attachments")
os.makedirs(ATTACHMENTS_DIR, exist_ok=True)


def _create_demo_attachment(db: Session, insp_id: str, user_id: str,
                            file_name: str, created_at: datetime) -> Attachment:
    insp_dir = os.path.join(ATTACHMENTS_DIR, insp_id)
    os.makedirs(insp_dir, exist_ok=True)
    safe_name = f"{uuid4()}_{file_name}"
    save_path = os.path.join(insp_dir, safe_name)
    with open(save_path, "w", encoding="utf-8") as f:
        f.write(f"演示附件文件: {file_name}\n巡检单ID: {insp_id}\n上传时间: {created_at}\n")
    rel_path = f"data/attachments/{insp_id}/{safe_name}"
    att = Attachment(
        id=str(uuid4()),
        inspection_id=insp_id,
        file_name=file_name,
        file_path=rel_path,
        uploaded_by=user_id,
        created_at=created_at,
    )
    db.add(att)
    return att


def seed_demo_data(db: Session) -> None:
    if db.query(User).first():
        return

    users = [
        User(id="user_001", name="站点值班员", role="duty_officer", password_hash="user_001"),
        User(id="user_002", name="运维工程师", role="maintenance_engineer", password_hash="user_002"),
        User(id="user_003", name="运营经理", role="operations_manager", password_hash="user_003"),
    ]
    for u in users:
        db.add(u)
    db.flush()

    now = datetime.utcnow()

    # Inspection 1: Normal flow completed
    insp1_id = str(uuid4())
    cpi1_id = str(uuid4())
    fr1_id = str(uuid4())
    insp1 = Inspection(
        id=insp1_id,
        title="充电桩A区日常巡检",
        description="A区充电桩日常巡检，包含设备外观、充电接口、显示屏等检查项目",
        status="completed",
        creator_id="user_001",
        processor_id="user_002",
        reviewer_id="user_003",
        version=4,
        deadline=(now + timedelta(days=7)).strftime("%Y-%m-%dT%H:%M:%S"),
        created_at=now - timedelta(days=5),
        updated_at=now - timedelta(days=1),
    )
    cpi1 = ChargingPileInspection(
        id=cpi1_id,
        pile_code="CP-A-001",
        inspection_items="外观检查,充电接口检查,显示屏检查,通信模块检查",
        result="正常",
        inspection_id=insp1_id,
        created_by="user_001",
        created_at=now - timedelta(days=5),
    )
    fr1 = FaultReport(
        id=fr1_id,
        equipment_code="CP-A-001",
        description="充电接口轻微松动，需要紧固",
        severity="low",
        inspection_id=insp1_id,
        created_by="user_001",
        created_at=now - timedelta(days=5),
    )
    db.add_all([insp1, cpi1, fr1])
    db.flush()

    pr1_1 = ProcessingRecord(
        id=str(uuid4()), inspection_id=insp1_id, operator_id="user_001",
        operator_role="duty_officer", from_status="pending_submit", to_status="pending_process",
        opinion="提交巡检单，请处理", version=2, created_at=now - timedelta(days=4),
    )
    pr1_2 = ProcessingRecord(
        id=str(uuid4()), inspection_id=insp1_id, operator_id="user_002",
        operator_role="maintenance_engineer", from_status="pending_process", to_status="pending_review",
        opinion="已处理完毕，充电接口已紧固", version=3, created_at=now - timedelta(days=2),
    )
    pr1_3 = ProcessingRecord(
        id=str(uuid4()), inspection_id=insp1_id, operator_id="user_003",
        operator_role="operations_manager", from_status="pending_review", to_status="completed",
        opinion="审核通过", version=4, created_at=now - timedelta(days=1),
    )
    db.add_all([pr1_1, pr1_2, pr1_3])
    db.flush()

    ar1_1 = AuditRemark(
        id=str(uuid4()), inspection_id=insp1_id, processing_record_id=pr1_1.id,
        operator_id="user_001", from_status="pending_submit", to_status="pending_process",
        remark="值班员提交巡检单", created_at=now - timedelta(days=4),
    )
    ar1_2 = AuditRemark(
        id=str(uuid4()), inspection_id=insp1_id, processing_record_id=pr1_2.id,
        operator_id="user_002", from_status="pending_process", to_status="pending_review",
        remark="运维工程师处理完成", created_at=now - timedelta(days=2),
    )
    ar1_3 = AuditRemark(
        id=str(uuid4()), inspection_id=insp1_id, processing_record_id=pr1_3.id,
        operator_id="user_003", from_status="pending_review", to_status="completed",
        remark="运营经理审核通过", created_at=now - timedelta(days=1),
    )
    db.add_all([ar1_1, ar1_2, ar1_3])

    _create_demo_attachment(db, insp1_id, "user_002", "充电接口紧固前照片.jpg", now - timedelta(days=2, hours=1))
    _create_demo_attachment(db, insp1_id, "user_002", "充电接口紧固后照片.jpg", now - timedelta(days=2))
    _create_demo_attachment(db, insp1_id, "user_002", "处理报告.pdf", now - timedelta(days=2))

    # Inspection 2: Missing material (pending_process with exception)
    insp2_id = str(uuid4())
    cpi2_id = str(uuid4())
    fr2_id = str(uuid4())
    insp2 = Inspection(
        id=insp2_id,
        title="充电桩B区故障巡检",
        description="B区充电桩发现故障，需要处理",
        status="pending_process",
        creator_id="user_001",
        processor_id="user_002",
        version=2,
        deadline=(now + timedelta(days=3)).strftime("%Y-%m-%dT%H:%M:%S"),
        created_at=now - timedelta(days=2),
        updated_at=now - timedelta(days=2),
    )
    cpi2 = ChargingPileInspection(
        id=cpi2_id,
        pile_code="CP-B-003",
        inspection_items="外观检查,充电接口检查,通信模块检查",
        result="异常",
        inspection_id=insp2_id,
        created_by="user_001",
        created_at=now - timedelta(days=2),
    )
    fr2 = FaultReport(
        id=fr2_id,
        equipment_code="CP-B-003",
        description="充电模块通信故障，无法正常充电",
        severity="high",
        inspection_id=insp2_id,
        created_by="user_001",
        created_at=now - timedelta(days=2),
    )
    db.add_all([insp2, cpi2, fr2])
    db.flush()

    pr2_1 = ProcessingRecord(
        id=str(uuid4()), inspection_id=insp2_id, operator_id="user_001",
        operator_role="duty_officer", from_status="pending_submit", to_status="pending_process",
        opinion="发现故障，提交处理", version=2, created_at=now - timedelta(days=2),
    )
    db.add(pr2_1)
    db.flush()

    ar2_1 = AuditRemark(
        id=str(uuid4()), inspection_id=insp2_id, processing_record_id=pr2_1.id,
        operator_id="user_001", from_status="pending_submit", to_status="pending_process",
        remark="值班员提交故障巡检", created_at=now - timedelta(days=2),
    )
    er2_1 = ExceptionReason(
        id=str(uuid4()), inspection_id=insp2_id, type="material",
        description="缺少备件：通信模块备件未到货，暂时无法更换", created_at=now - timedelta(days=1),
    )
    db.add_all([ar2_1, er2_1])

    _create_demo_attachment(db, insp2_id, "user_002", "通信模块检测报告.pdf", now - timedelta(days=1, hours=3))
    _create_demo_attachment(db, insp2_id, "user_002", "故障现场照片.jpg", now - timedelta(days=1, hours=2))

    # Inspection 3: Overdue (pending_process with past deadline)
    insp3_id = str(uuid4())
    cpi3_id = str(uuid4())
    fr3_id = str(uuid4())
    insp3 = Inspection(
        id=insp3_id,
        title="充电桩C区月度巡检",
        description="C区充电桩月度巡检，已超过截止日期",
        status="pending_process",
        creator_id="user_001",
        processor_id="user_002",
        version=2,
        deadline=(now - timedelta(days=2)).strftime("%Y-%m-%dT%H:%M:%S"),
        created_at=now - timedelta(days=10),
        updated_at=now - timedelta(days=8),
    )
    cpi3 = ChargingPileInspection(
        id=cpi3_id,
        pile_code="CP-C-002",
        inspection_items="外观检查,充电接口检查,显示屏检查",
        result="待处理",
        inspection_id=insp3_id,
        created_by="user_001",
        created_at=now - timedelta(days=10),
    )
    fr3 = FaultReport(
        id=fr3_id,
        equipment_code="CP-C-002",
        description="显示屏闪烁，可能需要更换",
        severity="medium",
        inspection_id=insp3_id,
        created_by="user_001",
        created_at=now - timedelta(days=10),
    )
    db.add_all([insp3, cpi3, fr3])
    db.flush()

    pr3_1 = ProcessingRecord(
        id=str(uuid4()), inspection_id=insp3_id, operator_id="user_001",
        operator_role="duty_officer", from_status="pending_submit", to_status="pending_process",
        opinion="提交月度巡检", version=2, created_at=now - timedelta(days=8),
    )
    db.add(pr3_1)
    db.flush()

    ar3_1 = AuditRemark(
        id=str(uuid4()), inspection_id=insp3_id, processing_record_id=pr3_1.id,
        operator_id="user_001", from_status="pending_submit", to_status="pending_process",
        remark="值班员提交月度巡检单", created_at=now - timedelta(days=8),
    )
    er3_1 = ExceptionReason(
        id=str(uuid4()), inspection_id=insp3_id, type="deadline",
        description="处理超时：已超过截止日期2天", created_at=now,
    )
    db.add_all([ar3_1, er3_1])

    _create_demo_attachment(db, insp3_id, "user_002", "显示屏闪烁记录.mp4", now - timedelta(days=3))
    _create_demo_attachment(db, insp3_id, "user_002", "初步排查报告.pdf", now - timedelta(days=2, hours=5))

    # Inspection 4: Returned then resubmitted
    insp4_id = str(uuid4())
    cpi4_id = str(uuid4())
    fr4_id = str(uuid4())
    insp4 = Inspection(
        id=insp4_id,
        title="充电桩D区专项巡检",
        description="D区充电桩专项巡检，之前被退回修改",
        status="resubmitted",
        creator_id="user_001",
        processor_id="user_002",
        reviewer_id="user_003",
        version=5,
        deadline=(now + timedelta(days=5)).strftime("%Y-%m-%dT%H:%M:%S"),
        created_at=now - timedelta(days=7),
        updated_at=now - timedelta(hours=2),
    )
    cpi4 = ChargingPileInspection(
        id=cpi4_id,
        pile_code="CP-D-001",
        inspection_items="外观检查,充电接口检查,安全装置检查",
        result="待复核",
        inspection_id=insp4_id,
        created_by="user_001",
        created_at=now - timedelta(days=7),
    )
    fr4 = FaultReport(
        id=fr4_id,
        equipment_code="CP-D-001",
        description="安全装置报警，需要排查原因",
        severity="critical",
        inspection_id=insp4_id,
        created_by="user_001",
        created_at=now - timedelta(days=7),
    )
    db.add_all([insp4, cpi4, fr4])
    db.flush()

    pr4_1 = ProcessingRecord(
        id=str(uuid4()), inspection_id=insp4_id, operator_id="user_001",
        operator_role="duty_officer", from_status="pending_submit", to_status="pending_process",
        opinion="提交专项巡检", version=2, created_at=now - timedelta(days=6),
    )
    pr4_2 = ProcessingRecord(
        id=str(uuid4()), inspection_id=insp4_id, operator_id="user_002",
        operator_role="maintenance_engineer", from_status="pending_process", to_status="pending_review",
        opinion="已排查安全装置，初步判断为传感器误报", version=3, created_at=now - timedelta(days=4),
    )
    pr4_3 = ProcessingRecord(
        id=str(uuid4()), inspection_id=insp4_id, operator_id="user_003",
        operator_role="operations_manager", from_status="pending_review", to_status="returned",
        opinion="处理意见不充分，需要补充排查过程", version=4, created_at=now - timedelta(days=3),
    )
    pr4_4 = ProcessingRecord(
        id=str(uuid4()), inspection_id=insp4_id, operator_id="user_001",
        operator_role="duty_officer", from_status="returned", to_status="resubmitted",
        opinion="已修改，补充了详细排查过程", version=5, created_at=now - timedelta(hours=2),
    )
    db.add_all([pr4_1, pr4_2, pr4_3, pr4_4])
    db.flush()

    ar4_1 = AuditRemark(
        id=str(uuid4()), inspection_id=insp4_id, processing_record_id=pr4_1.id,
        operator_id="user_001", from_status="pending_submit", to_status="pending_process",
        remark="值班员提交专项巡检单", created_at=now - timedelta(days=6),
    )
    ar4_2 = AuditRemark(
        id=str(uuid4()), inspection_id=insp4_id, processing_record_id=pr4_2.id,
        operator_id="user_002", from_status="pending_process", to_status="pending_review",
        remark="运维工程师处理完毕，提交审核", created_at=now - timedelta(days=4),
    )
    ar4_3 = AuditRemark(
        id=str(uuid4()), inspection_id=insp4_id, processing_record_id=pr4_3.id,
        operator_id="user_003", from_status="pending_review", to_status="returned",
        remark="运营经理退回：处理意见不充分，需要补充排查过程", created_at=now - timedelta(days=3),
    )
    ar4_4 = AuditRemark(
        id=str(uuid4()), inspection_id=insp4_id, processing_record_id=pr4_4.id,
        operator_id="user_001", from_status="returned", to_status="resubmitted",
        remark="值班员修改后重新提交", created_at=now - timedelta(hours=2),
    )
    db.add_all([ar4_1, ar4_2, ar4_3, ar4_4])
    db.flush()

    cr4_1 = CorrectionRecord(
        id=str(uuid4()), inspection_id=insp4_id, corrector_id="user_001",
        reason="运营经理要求补充排查过程", field="description",
        old_value="D区充电桩专项巡检，之前被退回修改",
        new_value="D区充电桩专项巡检，之前被退回修改，已补充详细排查过程：1.检查传感器连接 2.测试传感器灵敏度 3.确认环境干扰因素",
        created_at=now - timedelta(hours=2),
    )
    db.add(cr4_1)

    _create_demo_attachment(db, insp4_id, "user_002", "传感器检查记录表.pdf", now - timedelta(days=4, hours=1))
    _create_demo_attachment(db, insp4_id, "user_002", "安全装置排查照片.jpg", now - timedelta(days=4))
    _create_demo_attachment(db, insp4_id, "user_003", "退回意见补充说明.pdf", now - timedelta(days=3))
    _create_demo_attachment(db, insp4_id, "user_001", "补正说明.pdf", now - timedelta(hours=2))
    _create_demo_attachment(db, insp4_id, "user_001", "补充排查过程记录.pdf", now - timedelta(hours=1, minutes=50))

    db.commit()
