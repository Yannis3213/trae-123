import sqlite3
import os
from datetime import datetime, timedelta
from database import init_db

DB_PATH = os.path.join(os.path.dirname(__file__), "k12_service.db")


def seed_data():
    init_db()
    conn = sqlite3.connect(DB_PATH)
    conn.execute("PRAGMA foreign_keys = ON")
    c = conn.cursor()

    c.execute("DELETE FROM correction_actions")
    c.execute("DELETE FROM audit_notes")
    c.execute("DELETE FROM processing_records")
    c.execute("DELETE FROM attachments")
    c.execute("DELETE FROM service_orders")
    c.execute("DELETE FROM users")

    users = [
        (1, "jiaowu01", "123456", "jiaowu", "李教务"),
        (2, "banzhuren01", "123456", "banzhuren", "王班主任"),
        (3, "xiaozhang01", "123456", "xiaozhang", "张校长"),
    ]
    c.executemany(
        "INSERT INTO users (id, username, password, role, name) VALUES (?, ?, ?, ?, ?)",
        users,
    )

    now = datetime.now()
    orders = [
        (
            "FW202506001",
            "张小明",
            "S2025001",
            "初三数学冲刺班",
            "课后反馈缺记录补录",
            "学员张小明数学课时完成但课后反馈未登记，需补正反馈并复核归档",
            "待分派",
            1,
            1,
            None,
            (now + timedelta(days=5)).strftime("%Y-%m-%d %H:%M:%S"),
            None,
            now.strftime("%Y-%m-%d %H:%M:%S"),
            now.strftime("%Y-%m-%d %H:%M:%S"),
            None,
            0,
        ),
        (
            "FW202506002",
            "李小红",
            "S2025002",
            "高一英语强化班",
            "课程排班补正",
            "李小红本周英语课排班冲突，已调整，需班主任回访确认",
            "已转办",
            2,
            1,
            2,
            (now + timedelta(days=2)).strftime("%Y-%m-%d %H:%M:%S"),
            None,
            (now - timedelta(days=1)).strftime("%Y-%m-%d %H:%M:%S"),
            (now - timedelta(days=1)).strftime("%Y-%m-%d %H:%M:%S"),
            None,
            0,
        ),
        (
            "FW202506003",
            "王小刚",
            "S2025003",
            "初二物理实验课",
            "学员档案新增-补课回访",
            "王小刚因请假缺课，补课已安排并完成，需要回访确认效果",
            "已回访",
            3,
            1,
            3,
            (now - timedelta(days=1)).strftime("%Y-%m-%d %H:%M:%S"),
            now.strftime("%Y-%m-%d %H:%M:%S"),
            (now - timedelta(days=3)).strftime("%Y-%m-%d %H:%M:%S"),
            now.strftime("%Y-%m-%d %H:%M:%S"),
            None,
            0,
        ),
        (
            "FW202506004",
            "赵小雅",
            "S2025004",
            "小学五年级奥数班",
            "课后反馈缺材料-待补正",
            "赵小雅奥数课课后反馈登记表缺失家长签字，需退回补正",
            "待分派",
            1,
            1,
            None,
            (now - timedelta(days=1)).strftime("%Y-%m-%d %H:%M:%S"),
            None,
            (now - timedelta(days=4)).strftime("%Y-%m-%d %H:%M:%S"),
            (now - timedelta(days=4)).strftime("%Y-%m-%d %H:%M:%S"),
            "课后反馈缺家长签字",
            1,
        ),
        (
            "FW202506005",
            "刘小伟",
            "S2025005",
            "高三语文阅读特训",
            "课后反馈复核-临期",
            "刘小伟语文阅读课课后反馈已提交，需班主任回访后校长确认",
            "已转办",
            2,
            1,
            2,
            (now + timedelta(hours=6)).strftime("%Y-%m-%d %H:%M:%S"),
            None,
            (now - timedelta(days=2)).strftime("%Y-%m-%d %H:%M:%S"),
            (now - timedelta(days=2)).strftime("%Y-%m-%d %H:%M:%S"),
            None,
            0,
        ),
        (
            "FW202506006",
            "陈朵朵",
            "S2025006",
            "初中英语口语班",
            "逾期未处理-课程服务单",
            "陈朵朵课程服务单登记后逾期未分派，属于超时场景",
            "待分派",
            1,
            1,
            None,
            (now - timedelta(days=3)).strftime("%Y-%m-%d %H:%M:%S"),
            None,
            (now - timedelta(days=7)).strftime("%Y-%m-%d %H:%M:%S"),
            (now - timedelta(days=7)).strftime("%Y-%m-%d %H:%M:%S"),
            "逾期3天未分派",
            1,
        ),
        (
            "FW202506007",
            "孙浩然",
            "S2025007",
            "高中物理竞赛班",
            "退回补正-状态冲突场景",
            "孙浩然竞赛班课后反馈被退回，班主任需重新上传回访录音后再提交",
            "已转办",
            2,
            1,
            2,
            (now + timedelta(days=3)).strftime("%Y-%m-%d %H:%M:%S"),
            None,
            (now - timedelta(days=2)).strftime("%Y-%m-%d %H:%M:%S"),
            (now - timedelta(days=1)).strftime("%Y-%m-%d %H:%M:%S"),
            "回访录音不清晰，需重新提交",
            1,
        ),
    ]
    c.executemany(
        """INSERT INTO service_orders
        (order_no, student_name, student_id, course_name, service_type, description,
         status, version, created_by, current_handler, deadline, completed_at,
         created_at, updated_at, exception_reason, is_exception)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        orders,
    )

    attachments = [
        (3, "课后反馈表_王小刚.pdf", "pdf", "课后反馈", 2, (now - timedelta(days=2)).strftime("%Y-%m-%d %H:%M:%S")),
        (3, "补课回访录音.mp3", "audio", "回访记录", 2, (now - timedelta(days=1)).strftime("%Y-%m-%d %H:%M:%S")),
        (3, "家长确认签字扫描件.png", "image", "家长确认", 2, (now - timedelta(hours=12)).strftime("%Y-%m-%d %H:%M:%S")),
        (2, "课程调整排班表.xlsx", "xlsx", "课程排班", 1, (now - timedelta(days=1)).strftime("%Y-%m-%d %H:%M:%S")),
        (5, "课后反馈登记表.pdf", "pdf", "课后反馈", 1, (now - timedelta(days=2)).strftime("%Y-%m-%d %H:%M:%S")),
    ]
    c.executemany(
        """INSERT INTO attachments (order_id, filename, file_type, evidence_type, uploaded_by, uploaded_at)
        VALUES (?, ?, ?, ?, ?, ?)""",
        attachments,
    )

    records = [
        (3, "待分派", "已转办", "转办班主任", 1, 2, "课程服务单登记完成，转班主任处理回访", (now - timedelta(days=3)).strftime("%Y-%m-%d %H:%M:%S"), 2),
        (3, "已转办", "已回访", "回访完成转校长确认", 2, 3, "补课完成，家长满意，回访录音已上传", (now - timedelta(hours=12)).strftime("%Y-%m-%d %H:%M:%S"), 3),
        (2, "待分派", "已转办", "转办班主任", 1, 2, "排班表已调整，需班主任回访确认", (now - timedelta(days=1)).strftime("%Y-%m-%d %H:%M:%S"), 2),
        (5, "待分派", "已转办", "转办班主任", 1, 2, "课后反馈已提交，转班主任回访", (now - timedelta(days=2)).strftime("%Y-%m-%d %H:%M:%S"), 2),
        (7, "待分派", "已转办", "转办班主任", 1, 2, "竞赛班服务单转交班主任处理", (now - timedelta(days=2)).strftime("%Y-%m-%d %H:%M:%S"), 2),
    ]
    c.executemany(
        """INSERT INTO processing_records
        (order_id, from_status, to_status, action, operator_id, handler_id, remark, created_at, version)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        records,
    )

    audit_notes = [
        (3, 3, "复核通过，材料齐全，家长反馈良好，归档完成", now.strftime("%Y-%m-%d %H:%M:%S")),
        (4, 2, "教务发起时未上传家长签字，需补正后再分派", (now - timedelta(days=3)).strftime("%Y-%m-%d %H:%M:%S")),
        (7, 3, "回访录音听不清，请重新录制后再提交确认", (now - timedelta(days=1)).strftime("%Y-%m-%d %H:%M:%S")),
    ]
    c.executemany(
        "INSERT INTO audit_notes (order_id, user_id, content, created_at) VALUES (?, ?, ?, ?)",
        audit_notes,
    )

    corrections = [
        (4, "退回教务补传家长签字", "课后反馈缺家长签字", 2, (now - timedelta(days=3)).strftime("%Y-%m-%d %H:%M:%S")),
        (7, "退回班主任重新录制回访录音", "回访录音不清晰无法辨认", 3, (now - timedelta(days=1)).strftime("%Y-%m-%d %H:%M:%S")),
    ]
    c.executemany(
        "INSERT INTO correction_actions (order_id, action, reason, operator_id, created_at) VALUES (?, ?, ?, ?, ?)",
        corrections,
    )

    conn.commit()
    conn.close()
    print("演示数据已初始化完成")


if __name__ == "__main__":
    seed_data()
