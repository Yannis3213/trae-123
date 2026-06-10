import db from "../database/init.js";
import { v4 as uuidv4 } from "uuid";
import type { DispatchPlan, Attachment, ProcessingRecord, AuditNote, Role, ExpiryStatus, AuditAction, NoteType, AttachmentCategory, ExceptionReason } from "../types/index.js";

function mapPlan(row: Record<string, unknown>): DispatchPlan {
  return {
    id: row.id as string,
    planNumber: row.plan_number as string,
    routeName: row.route_name as string,
    planDate: row.plan_date as string,
    vehicleId: row.vehicle_id as string,
    driverId: row.driver_id as string,
    status: row.status as DispatchPlan["status"],
    dueDate: row.due_date as string,
    version: row.version as number,
    createdBy: row.created_by as string,
    currentHandler: row.current_handler as string,
    currentRole: row.current_role as Role,
    notes: (row.notes as string) || "",
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function mapAttachment(row: Record<string, unknown>): Attachment {
  return {
    id: row.id as string,
    planId: row.plan_id as string,
    fileType: row.file_type as AttachmentCategory,
    fileName: row.file_name as string,
    uploadedBy: row.uploaded_by as string,
    uploadedAt: row.uploaded_at as string,
  };
}

function mapProcessingRecord(row: Record<string, unknown>): ProcessingRecord {
  return {
    id: row.id as string,
    planId: row.plan_id as string,
    action: row.action as AuditAction,
    handlerId: row.handler_id as string,
    handlerRole: row.handler_role as Role,
    comment: row.comment as string | null,
    version: row.version as number,
    createdAt: row.created_at as string,
  };
}

function mapAuditNote(row: Record<string, unknown>): AuditNote {
  return {
    id: row.id as string,
    planId: row.plan_id as string,
    noteType: row.note_type as NoteType,
    content: row.content as string,
    createdBy: row.created_by as string,
    createdAt: row.created_at as string,
  };
}

function mapExceptionReason(row: Record<string, unknown>): ExceptionReason {
  return {
    id: row.id as string,
    planId: row.plan_id as string,
    recordId: row.record_id as string | undefined,
    reasonCode: row.reason_code as string,
    reasonDetail: row.reason_detail as string,
    responsibleRole: row.responsible_role as Role,
    responsibleUserId: row.responsible_user_id as string,
    action: row.action as string,
    status: row.status as string,
    createdAt: row.created_at as string,
  };
}

export function computeExpiryStatus(dueDate: string): ExpiryStatus {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dueDate);
  due.setHours(0, 0, 0, 0);
  const diffDays = (due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24);
  if (diffDays < 0) return "overdue";
  if (diffDays <= 3) return "approaching";
  return "normal";
}

interface PlanFilters {
  role?: Role;
  status?: string;
  expiry?: ExpiryStatus;
  handler?: string;
  search?: string;
  page: number;
  limit: number;
}

interface QueryConditions {
  where: string;
  params: unknown[];
}

function buildWhereClause(filters: Partial<PlanFilters>): QueryConditions {
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (filters.role === "dispatcher") {
    conditions.push("(created_by = (SELECT id FROM users WHERE role = 'dispatcher' LIMIT 1) OR current_role = 'dispatcher')");
  } else if (filters.role === "route_supervisor") {
    conditions.push("(status = 'pending_review' OR status = 'reviewing')");
  } else if (filters.role === "ops_center") {
    conditions.push("(status = 'pending_approval' OR status = 'approving')");
  }

  if (filters.status) {
    conditions.push("status = ?");
    params.push(filters.status);
  }

  if (filters.handler) {
    conditions.push("current_handler = ?");
    params.push(filters.handler);
  }

  if (filters.search) {
    conditions.push("(plan_number LIKE ? OR route_name LIKE ?)");
    const searchTerm = `%${filters.search}%`;
    params.push(searchTerm, searchTerm);
  }

  if (filters.expiry) {
    const now = new Date();
    if (filters.expiry === "overdue") {
      conditions.push("due_date < ?");
      params.push(now.toISOString().split("T")[0]);
    } else if (filters.expiry === "approaching") {
      const threeDaysLater = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
      conditions.push("due_date >= ? AND due_date <= ?");
      params.push(now.toISOString().split("T")[0], threeDaysLater.toISOString().split("T")[0]);
    } else if (filters.expiry === "normal") {
      const threeDaysLater = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
      conditions.push("due_date > ?");
      params.push(threeDaysLater.toISOString().split("T")[0]);
    }
  }

  const where = conditions.length > 0 ? "WHERE " + conditions.join(" AND ") : "";
  return { where, params };
}

export function findAll(filters: PlanFilters): { plans: DispatchPlan[]; total: number } {
  const { where, params } = buildWhereClause(filters);

  const countRow = db.prepare(`SELECT COUNT(*) as count FROM dispatch_plans ${where}`).get(...params) as { count: number };
  const total = countRow.count;

  const offset = (filters.page - 1) * filters.limit;
  const rows = db.prepare(
    `SELECT * FROM dispatch_plans ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`
  ).all(...params, filters.limit, offset) as Record<string, unknown>[];

  const plans = rows.map(mapPlan);
  plans.forEach((p) => {
    p.expiryStatus = computeExpiryStatus(p.dueDate);
  });

  return { plans, total };
}

export function findById(id: string): DispatchPlan | undefined {
  const row = db.prepare("SELECT * FROM dispatch_plans WHERE id = ?").get(id) as Record<string, unknown> | undefined;
  if (!row) return undefined;

  const plan = mapPlan(row);
  plan.expiryStatus = computeExpiryStatus(plan.dueDate);

  const attachments = db.prepare("SELECT * FROM attachments WHERE plan_id = ? ORDER BY uploaded_at ASC").all(id) as Record<string, unknown>[];
  plan.attachments = attachments.map(mapAttachment);

  const records = db.prepare("SELECT * FROM processing_records WHERE plan_id = ? ORDER BY created_at ASC").all(id) as Record<string, unknown>[];
  plan.processingRecords = records.map(mapProcessingRecord);

  const notes = db.prepare("SELECT * FROM audit_notes WHERE plan_id = ? ORDER BY created_at ASC").all(id) as Record<string, unknown>[];
  plan.auditNotes = notes.map(mapAuditNote);

  const exceptionReasons = db.prepare("SELECT * FROM exception_reasons WHERE plan_id = ? ORDER BY created_at ASC").all(id) as Record<string, unknown>[];
  plan.exceptionReasons = exceptionReasons.map(mapExceptionReason);

  return plan;
}

export function create(data: {
  planNumber: string;
  routeName: string;
  planDate: string;
  vehicleId: string;
  driverId: string;
  dueDate: string;
  notes: string;
  createdBy: string;
  currentHandler: string;
  currentRole: Role;
}): DispatchPlan {
  const id = uuidv4();
  const now = new Date().toISOString();

  db.prepare(
    `INSERT INTO dispatch_plans (id, plan_number, route_name, plan_date, vehicle_id, driver_id, status, due_date, version, created_by, current_handler, current_role, notes, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, 'draft', ?, 1, ?, ?, ?, ?, ?, ?)`
  ).run(id, data.planNumber, data.routeName, data.planDate, data.vehicleId, data.driverId, data.dueDate, data.createdBy, data.currentHandler, data.currentRole, data.notes, now, now);

  return findById(id)!;
}

export function update(id: string, data: Partial<Pick<DispatchPlan, "status" | "currentRole" | "currentHandler" | "version" | "notes" | "routeName" | "vehicleId" | "driverId" | "planDate">>): boolean {
  const fields: string[] = [];
  const params: unknown[] = [];

  if (data.status !== undefined) { fields.push("status = ?"); params.push(data.status); }
  if (data.currentRole !== undefined) { fields.push("current_role = ?"); params.push(data.currentRole); }
  if (data.currentHandler !== undefined) { fields.push("current_handler = ?"); params.push(data.currentHandler); }
  if (data.version !== undefined) { fields.push("version = ?"); params.push(data.version); }
  if (data.notes !== undefined) { fields.push("notes = ?"); params.push(data.notes); }
  if (data.routeName !== undefined) { fields.push("route_name = ?"); params.push(data.routeName); }
  if (data.vehicleId !== undefined) { fields.push("vehicle_id = ?"); params.push(data.vehicleId); }
  if (data.driverId !== undefined) { fields.push("driver_id = ?"); params.push(data.driverId); }
  if (data.planDate !== undefined) { fields.push("plan_date = ?"); params.push(data.planDate); }

  fields.push("updated_at = ?");
  params.push(new Date().toISOString());
  params.push(id);

  const result = db.prepare(`UPDATE dispatch_plans SET ${fields.join(", ")} WHERE id = ?`).run(...params);
  return result.changes > 0;
}

export function createAttachment(data: { planId: string; fileType: AttachmentCategory; fileName: string; uploadedBy: string }): Attachment {
  const id = uuidv4();
  const now = new Date().toISOString();
  db.prepare("INSERT INTO attachments (id, plan_id, file_type, file_name, uploaded_by, uploaded_at) VALUES (?, ?, ?, ?, ?, ?)")
    .run(id, data.planId, data.fileType, data.fileName, data.uploadedBy, now);
  return { id, ...data, uploadedAt: now };
}

export function createProcessingRecord(data: { planId: string; action: AuditAction; handlerId: string; handlerRole: Role; comment: string | null; version: number }): ProcessingRecord {
  const id = uuidv4();
  const now = new Date().toISOString();
  db.prepare("INSERT INTO processing_records (id, plan_id, action, handler_id, handler_role, comment, version, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
    .run(id, data.planId, data.action, data.handlerId, data.handlerRole, data.comment, data.version, now);
  return { id, ...data, createdAt: now };
}

export function createAuditNote(data: { planId: string; noteType: NoteType; content: string; createdBy: string }): AuditNote {
  const id = uuidv4();
  const now = new Date().toISOString();
  db.prepare("INSERT INTO audit_notes (id, plan_id, note_type, content, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?)")
    .run(id, data.planId, data.noteType, data.content, data.createdBy, now);
  return { id, ...data, createdAt: now };
}

export function countByExpiryStatus(filters?: Partial<PlanFilters>): { normal: number; approaching: number; overdue: number } {
  const baseFilters: Partial<PlanFilters> = { ...filters };
  const { where, params } = buildWhereClause(baseFilters);

  const rows = db.prepare(`SELECT due_date FROM dispatch_plans ${where} AND status != 'archived'`.replace("WHERE AND", "WHERE")).all(...params) as { due_date: string }[];
  let normal = 0;
  let approaching = 0;
  let overdue = 0;
  for (const row of rows) {
    const status = computeExpiryStatus(row.due_date);
    if (status === "normal") normal++;
    else if (status === "approaching") approaching++;
    else overdue++;
  }
  return { normal, approaching, overdue };
}

export function countByStatus(filters?: Partial<PlanFilters>): { status: string; count: number }[] {
  const { where, params } = buildWhereClause(filters || {});
  const sql = `SELECT status, COUNT(*) as count FROM dispatch_plans ${where} GROUP BY status`;
  const rows = db.prepare(sql).all(...params) as { status: string; count: number }[];
  return rows;
}

export function countEvidence(filters?: Partial<PlanFilters>): { vehicleSchedule: number; driverCheckin: number; dispatchConfirm: number } {
  const { where, params } = buildWhereClause(filters || {});
  const planIdSql = `SELECT id FROM dispatch_plans ${where} AND status != 'archived'`.replace("WHERE AND", "WHERE");

  const vehicleSchedule = db.prepare(`SELECT COUNT(DISTINCT plan_id) as count FROM attachments WHERE file_type = 'vehicle_schedule' AND plan_id IN (${planIdSql})`).get(...params) as { count: number };
  const driverCheckin = db.prepare(`SELECT COUNT(DISTINCT plan_id) as count FROM attachments WHERE file_type = 'driver_checkin' AND plan_id IN (${planIdSql})`).get(...params) as { count: number };
  const dispatchConfirm = db.prepare(`SELECT COUNT(DISTINCT plan_id) as count FROM attachments WHERE file_type = 'dispatch_confirm' AND plan_id IN (${planIdSql})`).get(...params) as { count: number };

  return { vehicleSchedule: vehicleSchedule.count, driverCheckin: driverCheckin.count, dispatchConfirm: dispatchConfirm.count };
}

export function hasAttachment(planId: string, fileType: string): boolean {
  const row = db.prepare("SELECT COUNT(*) as count FROM attachments WHERE plan_id = ? AND file_type = ?").get(planId, fileType) as { count: number };
  return row.count > 0;
}

export function hasProcessingRecord(planId: string, handlerId: string, action: string): boolean {
  const row = db.prepare("SELECT COUNT(*) as count FROM processing_records WHERE plan_id = ? AND handler_id = ? AND action = ?").get(planId, handlerId, action) as { count: number };
  return row.count > 0;
}

export function createExceptionReason(data: {
  planId: string;
  recordId?: string;
  reasonCode: string;
  reasonDetail: string;
  responsibleRole: Role;
  responsibleUserId: string;
  action: string;
  status: string;
}): ExceptionReason {
  const id = uuidv4();
  const now = new Date().toISOString();
  db.prepare(
    "INSERT INTO exception_reasons (id, plan_id, record_id, reason_code, reason_detail, responsible_role, responsible_user_id, action, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
  ).run(id, data.planId, data.recordId || null, data.reasonCode, data.reasonDetail, data.responsibleRole, data.responsibleUserId, data.action, data.status, now);
  return { id, ...data, createdAt: now };
}

export function findExceptionReasonsByPlanId(planId: string): ExceptionReason[] {
  const rows = db.prepare("SELECT * FROM exception_reasons WHERE plan_id = ? ORDER BY created_at ASC").all(planId) as Record<string, unknown>[];
  return rows.map(mapExceptionReason);
}
