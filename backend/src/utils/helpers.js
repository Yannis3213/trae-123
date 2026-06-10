import { v4 as uuidv4 } from 'uuid';
import dayjs from 'dayjs';
import { getDb } from '../db/init.js';
import { ACTION_MAP, STATUS_LABEL, EVIDENCE_LABEL, ROLE_LABEL } from '../config.js';

export function nowIso() {
  return new Date().toISOString();
}

export function nextId(prefix = 'id') {
  return `${prefix}_${uuidv4().replace(/-/g, '').slice(0, 10)}`;
}

export function logProcessingRecord(db, payload) {
  const stmt = db.prepare(`
    INSERT INTO processing_records (id, order_id, action, action_label, from_status, to_status,
      operator_id, operator_name, operator_role, handler_before, handler_after,
      deadline_before, deadline_after, evidence_required, evidence_provided, remark,
      version_before, version_after, created_at)
    VALUES (@id, @order_id, @action, @action_label, @from_status, @to_status,
      @operator_id, @operator_name, @operator_role, @handler_before, @handler_after,
      @deadline_before, @deadline_after, @evidence_required, @evidence_provided, @remark,
      @version_before, @version_after, @created_at)
  `);
  stmt.run({
    id: nextId('r'),
    action_label: ACTION_MAP[payload.action] || payload.action,
    created_at: nowIso(),
    ...payload,
  });
}

export function bumpOrderVersion(db, orderId, patch) {
  const fields = Object.keys(patch).filter(k => patch[k] !== undefined);
  const sets = fields.map(f => `${f} = @${f}`).join(', ');
  const stmt = db.prepare(`
    UPDATE orders SET version = version + 1, updated_at = @updated_at, ${sets}
    WHERE id = @id
  `);
  stmt.run({ ...patch, id: orderId, updated_at: nowIso() });
  return db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
}

export function computeUrgency(deadlineStr) {
  if (!deadlineStr) return { level: 'none', label: '无期限', remainingMs: 0 };
  const now = Date.now();
  const dl = new Date(deadlineStr).getTime();
  const diff = dl - now;
  if (diff < 0) return { level: 'overdue', label: '逾期', remainingMs: diff, overdueDays: Math.ceil(-diff / 86400000) };
  if (diff < 3600 * 1000) return { level: 'warning', label: '临期', remainingMs: diff, minutesLeft: Math.ceil(diff / 60000) };
  return { level: 'normal', label: '正常', remainingMs: diff, hoursLeft: Math.round(diff / 3600000 * 10) / 10 };
}

export function getOrderEvidenceTypes(db, orderId) {
  const rows = db.prepare('SELECT DISTINCT evidence_type FROM attachments WHERE order_id = ?').all(orderId);
  return rows.map(r => r.evidence_type);
}

export function formatOrderDetail(db, order) {
  const evidence = getOrderEvidenceTypes(db, order.id);
  const urgency = computeUrgency(order.deadline);
  return {
    ...order,
    status_label: STATUS_LABEL[order.status] || order.status,
    deadline_urgency: urgency,
    evidence_types: evidence,
    evidence_labels: evidence.map(e => EVIDENCE_LABEL[e] || e),
  };
}

export function addAuditNote(db, orderId, noteType, content, user) {
  db.prepare(`
    INSERT INTO audit_notes (id, order_id, note_type, content, created_by, created_by_name, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(nextId('n'), orderId, noteType, content, user.id, user.display_name, nowIso());
}

export function addException(db, orderId, code, label, desc, severity, user, resolved = 0) {
  db.prepare(`
    INSERT INTO exception_reasons (id, order_id, reason_code, reason_label, description, severity,
      reported_by, reported_by_name, resolved, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(nextId('e'), orderId, code, label, desc, severity, user.id, user.display_name, resolved, nowIso());
}

export function resolveException(db, exceptionId, user) {
  db.prepare(`
    UPDATE exception_reasons SET resolved = 1, resolved_by = ?, resolved_at = ? WHERE id = ?
  `).run(user.id, nowIso(), exceptionId);
}

export function buildOrderSummary(order) {
  return {
    id: order.id,
    order_no: order.order_no,
    status: order.status,
    status_label: STATUS_LABEL[order.status] || order.status,
    version: order.version,
    current_handler: order.current_handler,
    current_role: order.current_role,
    current_role_label: order.current_role ? (ROLE_LABEL[order.current_role] || order.current_role) : null,
    deadline: order.deadline,
    updated_at: order.updated_at,
  };
}
