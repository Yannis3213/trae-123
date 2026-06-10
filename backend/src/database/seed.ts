import { v4 as uuidv4 } from "uuid";
import db from "./init.js";

export function seed() {
  const userCount = db.prepare("SELECT COUNT(*) as count FROM users").get() as { count: number };
  if (userCount.count > 0) return;

  const now = new Date().toISOString();

  const insertUser = db.prepare(
    "INSERT INTO users (id, username, password, display_name, role) VALUES (?, ?, ?, ?, ?)"
  );

  const dispatcherId = uuidv4();
  const supervisorId = uuidv4();
  const opsCenterId = uuidv4();

  insertUser.run(dispatcherId, "dispatcher", "demo123", "发车登记员", "dispatcher");
  insertUser.run(supervisorId, "route_supervisor", "demo123", "发车审核主管", "route_supervisor");
  insertUser.run(opsCenterId, "ops_center", "demo123", "复核负责人", "ops_center");

  const insertPlan = db.prepare(
    `INSERT INTO dispatch_plans (id, plan_number, route_name, plan_date, vehicle_id, driver_id, status, due_date, version, created_by, current_handler, current_role, notes, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );

  const plan001Id = uuidv4();
  const plan002Id = uuidv4();
  const plan003Id = uuidv4();
  const plan004Id = uuidv4();
  const plan005Id = uuidv4();
  const plan006Id = uuidv4();
  const plan007Id = uuidv4();
  const plan008Id = uuidv4();
  const plan009Id = uuidv4();
  const plan010Id = uuidv4();

  insertPlan.run(plan001Id, "DP-2026-001", "1路", "2026-06-30", "京A-33001", "张师傅", "pending_review", "2026-07-15", 1, dispatcherId, supervisorId, "route_supervisor", "正常流转-1路月底发车计划", now, now);
  insertPlan.run(plan002Id, "DP-2026-002", "5路", "2026-06-30", "京A-33005", "李师傅", "pending_review", "2026-07-20", 1, dispatcherId, supervisorId, "route_supervisor", "缺材料-5路缺少司机签收单", now, now);
  insertPlan.run(plan003Id, "DP-2026-003", "12路", "2026-06-30", "京A-33012", "王师傅", "reviewing", "2026-06-05", 1, dispatcherId, supervisorId, "route_supervisor", "超时逾期-12路审核超时", now, now);
  insertPlan.run(plan004Id, "DP-2026-004", "23路", "2026-06-30", "京A-33023", "赵师傅", "returned", "2026-06-13", 2, dispatcherId, dispatcherId, "dispatcher", "退回补正-23路材料不完整已退回", now, now);

  const threeDaysLater = new Date();
  threeDaysLater.setDate(threeDaysLater.getDate() + 2);
  const threeDaysLaterStr = threeDaysLater.toISOString().split("T")[0];

  const oneMonthLater = new Date();
  oneMonthLater.setMonth(oneMonthLater.getMonth() + 1);
  const oneMonthLaterStr = oneMonthLater.toISOString().split("T")[0];

  const tenDaysAgo = new Date();
  tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);
  const tenDaysAgoStr = tenDaysAgo.toISOString().split("T")[0];

  insertPlan.run(plan005Id, "DP-2026-005", "8路", "2026-07-01", "京A-33008", "刘师傅", "draft", oneMonthLaterStr, 1, dispatcherId, dispatcherId, "dispatcher", "草稿-8路新计划待提交", now, now);
  insertPlan.run(plan006Id, "DP-2026-006", "15路", "2026-07-01", "京A-33015", "孙师傅", "returned", "2026-07-10", 2, dispatcherId, dispatcherId, "dispatcher", "退回补正-15路缺少凭证已退回", now, now);
  insertPlan.run(plan007Id, "DP-2026-007", "28路", "2026-07-02", "京A-33028", "周师傅", "pending_review", "2026-07-20", 1, dispatcherId, supervisorId, "route_supervisor", "待审核-28路缺司机签到", now, now);
  insertPlan.run(plan008Id, "DP-2026-008", "36路", "2026-07-02", "京A-33036", "吴师傅", "reviewing", threeDaysLaterStr, 1, dispatcherId, supervisorId, "route_supervisor", "审核中-36路临期待完成", now, now);
  insertPlan.run(plan009Id, "DP-2026-009", "49路", "2026-07-03", "京A-33049", "郑师傅", "pending_approval", "2026-07-25", 1, dispatcherId, opsCenterId, "ops_center", "待复核-49路证据完整", now, now);
  insertPlan.run(plan010Id, "DP-2026-010", "57路", "2026-07-03", "京A-33057", "冯师傅", "approving", tenDaysAgoStr, 1, dispatcherId, opsCenterId, "ops_center", "复核中-57路已逾期", now, now);

  const insertAttachment = db.prepare(
    `INSERT INTO attachments (id, plan_id, file_type, file_name, uploaded_by, uploaded_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  );

  insertAttachment.run(uuidv4(), plan001Id, "vehicle_schedule", "1路车辆排班表.pdf", dispatcherId, now);
  insertAttachment.run(uuidv4(), plan001Id, "driver_checkin", "1路司机签收单.pdf", dispatcherId, now);
  insertAttachment.run(uuidv4(), plan001Id, "dispatch_confirm", "1路发车确认单.pdf", dispatcherId, now);

  insertAttachment.run(uuidv4(), plan002Id, "vehicle_schedule", "5路车辆排班表.pdf", dispatcherId, now);

  insertAttachment.run(uuidv4(), plan003Id, "vehicle_schedule", "12路车辆排班表.pdf", dispatcherId, now);
  insertAttachment.run(uuidv4(), plan003Id, "driver_checkin", "12路司机签收单.pdf", dispatcherId, now);

  insertAttachment.run(uuidv4(), plan004Id, "vehicle_schedule", "23路车辆排班表.pdf", dispatcherId, now);
  insertAttachment.run(uuidv4(), plan004Id, "driver_checkin", "23路司机签收单.pdf", dispatcherId, now);

  insertAttachment.run(uuidv4(), plan005Id, "vehicle_schedule", "8路车辆排班表.pdf", dispatcherId, now);

  insertAttachment.run(uuidv4(), plan006Id, "vehicle_schedule", "15路车辆排班表.pdf", dispatcherId, now);

  insertAttachment.run(uuidv4(), plan007Id, "vehicle_schedule", "28路车辆排班表.pdf", dispatcherId, now);

  insertAttachment.run(uuidv4(), plan008Id, "vehicle_schedule", "36路车辆排班表.pdf", dispatcherId, now);
  insertAttachment.run(uuidv4(), plan008Id, "driver_checkin", "36路司机签收单.pdf", dispatcherId, now);
  insertAttachment.run(uuidv4(), plan008Id, "dispatch_confirm", "36路发车确认单.pdf", dispatcherId, now);

  insertAttachment.run(uuidv4(), plan009Id, "vehicle_schedule", "49路车辆排班表.pdf", dispatcherId, now);
  insertAttachment.run(uuidv4(), plan009Id, "driver_checkin", "49路司机签收单.pdf", dispatcherId, now);
  insertAttachment.run(uuidv4(), plan009Id, "dispatch_confirm", "49路发车确认单.pdf", dispatcherId, now);

  insertAttachment.run(uuidv4(), plan010Id, "vehicle_schedule", "57路车辆排班表.pdf", dispatcherId, now);
  insertAttachment.run(uuidv4(), plan010Id, "driver_checkin", "57路司机签收单.pdf", dispatcherId, now);
  insertAttachment.run(uuidv4(), plan010Id, "dispatch_confirm", "57路发车确认单.pdf", dispatcherId, now);

  const insertRecord = db.prepare(
    `INSERT INTO processing_records (id, plan_id, action, handler_id, handler_role, comment, version, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  );

  insertRecord.run(uuidv4(), plan001Id, "created", dispatcherId, "dispatcher", null, 1, now);
  insertRecord.run(uuidv4(), plan001Id, "submitted", dispatcherId, "dispatcher", "提交审核", 1, now);

  insertRecord.run(uuidv4(), plan002Id, "created", dispatcherId, "dispatcher", null, 1, now);
  insertRecord.run(uuidv4(), plan002Id, "submitted", dispatcherId, "dispatcher", "提交审核", 1, now);

  insertRecord.run(uuidv4(), plan003Id, "created", dispatcherId, "dispatcher", null, 1, now);
  insertRecord.run(uuidv4(), plan003Id, "submitted", dispatcherId, "dispatcher", "提交审核", 1, now);
  insertRecord.run(uuidv4(), plan003Id, "reviewing", supervisorId, "route_supervisor", "开始审核", 1, now);

  insertRecord.run(uuidv4(), plan004Id, "created", dispatcherId, "dispatcher", null, 1, now);
  insertRecord.run(uuidv4(), plan004Id, "submitted", dispatcherId, "dispatcher", "提交审核", 1, now);
  insertRecord.run(uuidv4(), plan004Id, "reviewing", supervisorId, "route_supervisor", "审核中", 1, now);
  insertRecord.run(uuidv4(), plan004Id, "rejected", supervisorId, "route_supervisor", "材料不完整，退回补充", 1, now);

  insertRecord.run(uuidv4(), plan005Id, "created", dispatcherId, "dispatcher", null, 1, now);

  insertRecord.run(uuidv4(), plan006Id, "created", dispatcherId, "dispatcher", null, 1, now);
  insertRecord.run(uuidv4(), plan006Id, "submitted", dispatcherId, "dispatcher", "提交审核", 1, now);
  insertRecord.run(uuidv4(), plan006Id, "reviewing", supervisorId, "route_supervisor", "开始审核", 1, now);
  insertRecord.run(uuidv4(), plan006Id, "rejected", supervisorId, "route_supervisor", "缺少必要凭证，退回补正", 1, now);

  insertRecord.run(uuidv4(), plan007Id, "created", dispatcherId, "dispatcher", null, 1, now);
  insertRecord.run(uuidv4(), plan007Id, "submitted", dispatcherId, "dispatcher", "提交审核", 1, now);

  insertRecord.run(uuidv4(), plan008Id, "created", dispatcherId, "dispatcher", null, 1, now);
  insertRecord.run(uuidv4(), plan008Id, "submitted", dispatcherId, "dispatcher", "提交审核", 1, now);
  insertRecord.run(uuidv4(), plan008Id, "reviewing", supervisorId, "route_supervisor", "开始审核", 1, now);

  insertRecord.run(uuidv4(), plan009Id, "created", dispatcherId, "dispatcher", null, 1, now);
  insertRecord.run(uuidv4(), plan009Id, "submitted", dispatcherId, "dispatcher", "提交审核", 1, now);
  insertRecord.run(uuidv4(), plan009Id, "reviewing", supervisorId, "route_supervisor", "审核通过", 1, now);
  insertRecord.run(uuidv4(), plan009Id, "approved", supervisorId, "route_supervisor", "提交复核", 1, now);

  insertRecord.run(uuidv4(), plan010Id, "created", dispatcherId, "dispatcher", null, 1, now);
  insertRecord.run(uuidv4(), plan010Id, "submitted", dispatcherId, "dispatcher", "提交审核", 1, now);
  insertRecord.run(uuidv4(), plan010Id, "reviewing", supervisorId, "route_supervisor", "审核通过", 1, now);
  insertRecord.run(uuidv4(), plan010Id, "approved", supervisorId, "route_supervisor", "提交复核", 1, now);
  insertRecord.run(uuidv4(), plan010Id, "reviewing", opsCenterId, "ops_center", "开始复核", 1, now);

  const insertNote = db.prepare(
    `INSERT INTO audit_notes (id, plan_id, note_type, content, created_by, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  );

  insertNote.run(uuidv4(), plan001Id, "pending_sign", "计划已提交，等待审核主管签收", supervisorId, now);
  insertNote.run(uuidv4(), plan002Id, "pending_sign", "计划已提交，等待审核主管签收", supervisorId, now);
  insertNote.run(uuidv4(), plan003Id, "pending_sign", "审核中，超时未处理", supervisorId, now);
  insertNote.run(uuidv4(), plan004Id, "exception_return", "材料不完整，退回登记员补正", supervisorId, now);
  insertNote.run(uuidv4(), plan005Id, "pending_sign", "草稿待提交", dispatcherId, now);
  insertNote.run(uuidv4(), plan006Id, "exception_return", "缺少司机签收单，退回登记员补正", supervisorId, now);
  insertNote.run(uuidv4(), plan007Id, "pending_sign", "计划已提交，等待审核主管签收", supervisorId, now);
  insertNote.run(uuidv4(), plan008Id, "pending_sign", "审核中，临近截止日期请尽快处理", supervisorId, now);
  insertNote.run(uuidv4(), plan009Id, "pending_sign", "审核通过，等待运营中心复核", opsCenterId, now);
  insertNote.run(uuidv4(), plan010Id, "pending_sign", "复核中，已逾期请尽快处理", opsCenterId, now);

  const insertExceptionReason = db.prepare(
    `INSERT INTO exception_reasons (id, plan_id, record_id, reason_code, reason_detail, responsible_role, responsible_user_id, action, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );

  insertExceptionReason.run(uuidv4(), plan006Id, null, "MISSING_EVIDENCE", "缺少必要凭证：vehicle_schedule=true, driver_checkin=false", "route_supervisor", supervisorId, "review", "pending_review", now);
  insertExceptionReason.run(uuidv4(), plan010Id, null, "OVERDUE", `计划已逾期，截止日期 ${tenDaysAgoStr}`, "ops_center", opsCenterId, "archive", "approving", now);

  console.log("Seed data inserted successfully.");
}
