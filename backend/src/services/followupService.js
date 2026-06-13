import db from '../db.js'
import { STATUS, REQUIRED_EVIDENCE, ROLE_STATUS_TRANSITIONS, WARNING_THRESHOLD_DAYS, OVERDUE_THRESHOLD_DAYS } from '../constants.js'
import dayjs from 'dayjs'

export function validateStatusTransition(userRole, currentStatus, targetStatus) {
  const allowedTransitions = ROLE_STATUS_TRANSITIONS[userRole]
  if (!allowedTransitions.includes(targetStatus)) {
    return { valid: false, message: `当前角色无权限变更到该状态` }
  }

  const validTransitions = {
    [STATUS.DRAFT]: [STATUS.PENDING_SUBMIT],
    [STATUS.PENDING_SUBMIT]: [STATUS.DOCTOR_PROCESSING, STATUS.RETURNED],
    [STATUS.RETURNED]: [STATUS.RESUBMITTED],
    [STATUS.RESUBMITTED]: [STATUS.DOCTOR_PROCESSING, STATUS.RETURNED],
    [STATUS.DOCTOR_PROCESSING]: [STATUS.DIRECTOR_REVIEW, STATUS.RETURNED],
    [STATUS.DIRECTOR_REVIEW]: [STATUS.COMPLETED, STATUS.RETURNED],
    [STATUS.COMPLETED]: [STATUS.ARCHIVED],
    [STATUS.ARCHIVED]: []
  }

  if (!validTransitions[currentStatus]?.includes(targetStatus)) {
    return { valid: false, message: `状态流转不合法: ${currentStatus} -> ${targetStatus}` }
  }

  return { valid: true }
}

export async function validateEvidence(followupId, targetStatus) {
  const required = REQUIRED_EVIDENCE[targetStatus]
  if (!required || required.length === 0) {
    return { valid: true }
  }

  const evidence = await db.all(`
    SELECT type FROM attachments 
    WHERE followup_id = ? AND deleted_at IS NULL
  `, [followupId])

  const evidenceTypes = evidence.map(e => e.type)
  const missing = required.filter(r => !evidenceTypes.includes(r))

  if (missing.length > 0) {
    return { valid: false, message: `缺少必要证据: ${missing.join(', ')}`, missing }
  }

  return { valid: true }
}

export async function validateVersion(followupId, clientVersion) {
  const record = await db.get('SELECT version FROM followup_forms WHERE id = ?', [followupId])
  if (!record) {
    return { valid: false, message: '随访单不存在' }
  }
  if (record.version !== clientVersion) {
    return { valid: false, message: `版本冲突: 当前版本${record.version}, 提交版本${clientVersion}`, currentVersion: record.version }
  }
  return { valid: true }
}

export function checkOverdue(dueDate) {
  const now = dayjs()
  const due = dayjs(dueDate)
  const diffDays = due.diff(now, 'day')

  if (diffDays < OVERDUE_THRESHOLD_DAYS) {
    return { level: 'overdue', days: Math.abs(diffDays) }
  } else if (diffDays <= WARNING_THRESHOLD_DAYS) {
    return { level: 'warning', days: diffDays }
  }
  return { level: 'normal', days: diffDays }
}

export async function recordAuditLog(followupId, userId, action, remark, extra = {}) {
  await db.run(`
    INSERT INTO audit_logs (followup_id, user_id, action, remark, extra_data)
    VALUES (?, ?, ?, ?, ?)
  `, [followupId, userId, action, remark, JSON.stringify(extra)])
}

export async function recordProcessing(followupId, userId, role, opinion, status) {
  await db.run(`
    INSERT INTO processing_records (followup_id, user_id, role, opinion, status)
    VALUES (?, ?, ?, ?, ?)
  `, [followupId, userId, role, opinion, status])
}

export async function recordException(followupId, type, reason, operatorId) {
  await db.run(`
    INSERT INTO exception_reasons (followup_id, type, reason, operator_id)
    VALUES (?, ?, ?, ?)
  `, [followupId, type, reason, operatorId])
}

export async function recordInterception(followupId, userId, type, reason, extra = {}) {
  await recordException(followupId, type, reason, userId)
  await recordAuditLog(followupId, userId, 'intercept', reason, { type, ...extra })
}

export async function incrementVersion(followupId) {
  await db.run('UPDATE followup_forms SET version = version + 1 WHERE id = ?', [followupId])
}

export async function getCurrentHandler(followupId) {
  const form = await db.get(`
    SELECT current_handler_id, status FROM followup_forms WHERE id = ?
  `, [followupId])
  return form
}
