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

  insertPlan.run(plan001Id, "DP-2026-001", "1路", "2026-06-30", "京A-33001", "张师傅", "pending_review", "2026-07-15", 1, dispatcherId, supervisorId, "route_supervisor", "正常流转-1路月底发车计划", now, now);
  insertPlan.run(plan002Id, "DP-2026-002", "5路", "2026-06-30", "京A-33005", "李师傅", "pending_review", "2026-07-20", 1, dispatcherId, supervisorId, "route_supervisor", "缺材料-5路缺少司机签收单", now, now);
  insertPlan.run(plan003Id, "DP-2026-003", "12路", "2026-06-30", "京A-33012", "王师傅", "reviewing", "2026-06-05", 1, dispatcherId, supervisorId, "route_supervisor", "超时逾期-12路审核超时", now, now);
  insertPlan.run(plan004Id, "DP-2026-004", "23路", "2026-06-30", "京A-33023", "赵师傅", "returned", "2026-06-13", 2, dispatcherId, dispatcherId, "dispatcher", "退回补正-23路材料不完整已退回", now, now);

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

  const insertNote = db.prepare(
    `INSERT INTO audit_notes (id, plan_id, note_type, content, created_by, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  );

  insertNote.run(uuidv4(), plan001Id, "pending_sign", "计划已提交，等待审核主管签收", supervisorId, now);
  insertNote.run(uuidv4(), plan002Id, "pending_sign", "计划已提交，等待审核主管签收", supervisorId, now);
  insertNote.run(uuidv4(), plan003Id, "pending_sign", "审核中，超时未处理", supervisorId, now);
  insertNote.run(uuidv4(), plan004Id, "exception_return", "材料不完整，退回登记员补正", supervisorId, now);

  console.log("Seed data inserted successfully.");
}
