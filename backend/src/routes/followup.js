import { Hono } from 'hono'
import db from '../db.js'
import { authMiddleware, requireRole } from '../middleware/auth.js'
import { ROLES, STATUS, STATUS_NAMES, ROLE_NAMES } from '../constants.js'
import {
  validateStatusTransition,
  validateEvidence,
  validateVersion,
  checkOverdue,
  recordAuditLog,
  recordProcessing,
  recordException,
  recordInterception,
  incrementVersion
} from '../services/followupService.js'
import dayjs from 'dayjs'

const followupRouter = new Hono()

followupRouter.use('/*', authMiddleware)

followupRouter.get('/', async (c) => {
  const user = c.get('user')
  const { status, keyword, page = 1, pageSize = 20 } = c.req.query()

  let whereConditions = []
  let params = []

  if (user.role === ROLES.TRIAGE_NURSE) {
    whereConditions.push('status IN (?, ?, ?)')
    params.push(STATUS.DRAFT, STATUS.PENDING_SUBMIT, STATUS.RETURNED)
  } else if (user.role === ROLES.GENERAL_DOCTOR) {
    whereConditions.push('status IN (?, ?, ?)')
    params.push(STATUS.PENDING_SUBMIT, STATUS.RESUBMITTED, STATUS.DOCTOR_PROCESSING)
  } else if (user.role === ROLES.MEDICAL_DIRECTOR) {
    whereConditions.push('status IN (?, ?, ?, ?)')
    params.push(STATUS.DOCTOR_PROCESSING, STATUS.DIRECTOR_REVIEW, STATUS.COMPLETED, STATUS.ARCHIVED)
  }

  if (status) {
    whereConditions.push('status = ?')
    params.push(status)
  }

  if (keyword) {
    whereConditions.push('(patient_name LIKE ? OR id_card LIKE ?)')
    params.push(`%${keyword}%`, `%${keyword}%`)
  }

  const whereClause = whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : ''

  const countSql = `SELECT COUNT(*) as total FROM followup_forms ${whereClause}`
  const { total } = await db.get(countSql, params)

  const sql = `
    SELECT f.*, 
           u.name as creator_name,
           cu.name as current_handler_name
    FROM followup_forms f
    LEFT JOIN users u ON f.creator_id = u.id
    LEFT JOIN users cu ON f.current_handler_id = cu.id
    ${whereClause}
    ORDER BY f.created_at DESC
    LIMIT ? OFFSET ?
  `
  params.push(Number(pageSize), (page - 1) * pageSize)
  const list = await db.all(sql, params)

  const result = list.map(item => {
    const overdue = checkOverdue(item.due_date)
    return {
      ...item,
      statusName: STATUS_NAMES[item.status],
      overdueLevel: overdue.level,
      overdueDays: overdue.days,
      roleName: ROLE_NAMES[item.current_role]
    }
  })

  return c.json({ list: result, total, page: Number(page), pageSize: Number(pageSize) })
})

followupRouter.get('/stats', async (c) => {
  const user = c.get('user')
  
  let statusFilter = []
  let params = []

  if (user.role === ROLES.TRIAGE_NURSE) {
    statusFilter = [STATUS.DRAFT, STATUS.PENDING_SUBMIT, STATUS.RETURNED]
  } else if (user.role === ROLES.GENERAL_DOCTOR) {
    statusFilter = [STATUS.PENDING_SUBMIT, STATUS.RESUBMITTED, STATUS.DOCTOR_PROCESSING]
  } else if (user.role === ROLES.MEDICAL_DIRECTOR) {
    statusFilter = [STATUS.DOCTOR_PROCESSING, STATUS.DIRECTOR_REVIEW, STATUS.COMPLETED]
  }

  const placeholders = statusFilter.map(() => '?').join(', ')
  params = [...statusFilter]

  const stats = await db.all(`
    SELECT status, COUNT(*) as count
    FROM followup_forms
    WHERE status IN (${placeholders})
    GROUP BY status
  `, params)

  const overdueCount = await db.get(`
    SELECT COUNT(*) as count
    FROM followup_forms
    WHERE status IN (${placeholders})
    AND due_date < ?
  `, [...params, dayjs().toISOString()])

  const warningCount = await db.get(`
    SELECT COUNT(*) as count
    FROM followup_forms
    WHERE status IN (${placeholders})
    AND due_date >= ? AND due_date <= ?
  `, [...params, dayjs().toISOString(), dayjs().add(3, 'day').toISOString()])

  return c.json({
    byStatus: stats.reduce((acc, s) => {
      acc[s.status] = { count: s.count, name: STATUS_NAMES[s.status] }
      return acc
    }, {}),
    overdue: overdueCount.count,
    warning: warningCount.count
  })
})

followupRouter.get('/:id', async (c) => {
  const { id } = c.req.param()
  const user = c.get('user')

  const form = await db.get(`
    SELECT f.*,
           u.name as creator_name,
           cu.name as current_handler_name
    FROM followup_forms f
    LEFT JOIN users u ON f.creator_id = u.id
    LEFT JOIN users cu ON f.current_handler_id = cu.id
    WHERE f.id = ?
  `, [id])

  if (!form) {
    return c.json({ error: '随访单不存在' }, 404)
  }

  const overdue = checkOverdue(form.due_date)
  
  const attachments = await db.all(`
    SELECT a.*, u.name as uploader_name
    FROM attachments a
    LEFT JOIN users u ON a.uploader_id = u.id
    WHERE a.followup_id = ? AND a.deleted_at IS NULL
    ORDER BY a.created_at DESC
  `, [id])

  const processingRecords = await db.all(`
    SELECT p.*, u.name as user_name
    FROM processing_records p
    LEFT JOIN users u ON p.user_id = u.id
    WHERE p.followup_id = ?
    ORDER BY p.created_at DESC
  `, [id])

  const auditLogs = await db.all(`
    SELECT a.*, u.name as user_name
    FROM audit_logs a
    LEFT JOIN users u ON a.user_id = u.id
    WHERE a.followup_id = ?
    ORDER BY a.created_at DESC
  `, [id])

  const exceptions = await db.all(`
    SELECT e.*, u.name as operator_name
    FROM exception_reasons e
    LEFT JOIN users u ON e.operator_id = u.id
    WHERE e.followup_id = ?
    ORDER BY e.created_at DESC
  `, [id])

  const interceptLogs = auditLogs.filter(l => l.action === 'intercept')
  const lastInterception = interceptLogs.length > 0 ? {
    ...interceptLogs[0],
    extraData: interceptLogs[0].extra_data ? JSON.parse(interceptLogs[0].extra_data) : null
  } : null

  const lastProcessing = processingRecords.length > 0 ? {
    ...processingRecords[0],
    statusName: STATUS_NAMES[processingRecords[0].status],
    roleName: ROLE_NAMES[processingRecords[0].role]
  } : null

  const permissions = {
    canEdit: [STATUS.DRAFT, STATUS.RETURNED].includes(form.status) && user.role === ROLES.TRIAGE_NURSE,
    canSubmit: form.status === STATUS.DRAFT && user.role === ROLES.TRIAGE_NURSE,
    canResubmit: form.status === STATUS.RETURNED && user.role === ROLES.TRIAGE_NURSE,
    canProcess: [STATUS.PENDING_SUBMIT, STATUS.RESUBMITTED].includes(form.status) && user.role === ROLES.GENERAL_DOCTOR,
    canReview: form.status === STATUS.DOCTOR_PROCESSING && user.role === ROLES.MEDICAL_DIRECTOR,
    canReturn: [STATUS.PENDING_SUBMIT, STATUS.RESUBMITTED, STATUS.DOCTOR_PROCESSING, STATUS.DIRECTOR_REVIEW].includes(form.status),
    canComplete: form.status === STATUS.DIRECTOR_REVIEW && user.role === ROLES.MEDICAL_DIRECTOR,
    canArchive: form.status === STATUS.COMPLETED && user.role === ROLES.MEDICAL_DIRECTOR
  }

  const availableActions = []
  if (permissions.canEdit) availableActions.push({ key: 'edit', label: '编辑' })
  if (permissions.canSubmit) availableActions.push({ key: 'submit', label: '提交' })
  if (permissions.canResubmit) availableActions.push({ key: 'resubmit', label: '重新提交' })
  if (permissions.canProcess) availableActions.push({ key: 'process', label: '处理' })
  if (permissions.canReview) availableActions.push({ key: 'review', label: '审核' })
  if (permissions.canReturn) availableActions.push({ key: 'return', label: '退回' })
  if (permissions.canComplete) availableActions.push({ key: 'complete', label: '完成' })
  if (permissions.canArchive) availableActions.push({ key: 'archive', label: '归档' })

  const actionSummary = {
    currentStatus: form.status,
    currentStatusName: STATUS_NAMES[form.status],
    currentRole: form.current_role,
    currentRoleName: ROLE_NAMES[form.current_role],
    overdueLevel: overdue.level,
    overdueDays: overdue.days,
    availableActions
  }

  const chronicRecord = await db.get('SELECT * FROM chronic_records WHERE patient_id_card = ?', [form.id_card])
  const medicationReminders = await db.all('SELECT * FROM medication_reminders WHERE patient_id_card = ?', [form.id_card])

  return c.json({
    form: {
      ...form,
      statusName: STATUS_NAMES[form.status],
      roleName: ROLE_NAMES[form.current_role],
      overdueLevel: overdue.level,
      overdueDays: overdue.days
    },
    attachments,
    processingRecords: processingRecords.map(r => ({
      ...r,
      statusName: STATUS_NAMES[r.status],
      roleName: ROLE_NAMES[r.role]
    })),
    auditLogs: auditLogs.map(l => ({
      ...l,
      extraData: l.extra_data ? JSON.parse(l.extra_data) : null
    })),
    exceptions,
    lastInterception,
    lastProcessing,
    actionSummary,
    chronicRecord,
    medicationReminders,
    permissions
  })
})

followupRouter.post('/', requireRole(ROLES.TRIAGE_NURSE), async (c) => {
  const user = c.get('user')
  const data = await c.req.json()

  const result = await db.run(`
    INSERT INTO followup_forms (
      patient_name, id_card, gender, age, phone, address,
      chronic_type, followup_type, due_date,
      blood_pressure, blood_sugar, heart_rate, weight,
      symptoms, lifestyle, medication_compliance,
      status, current_role, current_handler_id, creator_id, version
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    data.patient_name, data.id_card, data.gender, data.age, data.phone, data.address,
    data.chronic_type, data.followup_type, data.due_date,
    data.blood_pressure, data.blood_sugar, data.heart_rate, data.weight,
    data.symptoms, data.lifestyle, data.medication_compliance,
    STATUS.DRAFT, ROLES.TRIAGE_NURSE, user.id, user.id, 1
  ])

  await recordAuditLog(result.lastID, user.id, 'create', '创建慢病随访单')

  return c.json({ id: result.lastID })
})

followupRouter.put('/:id', async (c) => {
  const { id } = c.req.param()
  const user = c.get('user')
  const data = await c.req.json()

  const current = await db.get('SELECT status, version, current_handler_id FROM followup_forms WHERE id = ?', [id])
  
  const versionCheck = await validateVersion(id, data.version)
  if (!versionCheck.valid) {
    await recordInterception(id, user.id, 'version_conflict', versionCheck.message)
    await recordAuditLog(id, user.id, 'error', versionCheck.message)
    return c.json({ error: versionCheck.message, currentVersion: versionCheck.currentVersion }, 409)
  }

  if (current.status !== STATUS.DRAFT && current.status !== STATUS.RETURNED) {
    const message = '当前状态不可编辑，仅草稿或已退回状态可编辑'
    await recordInterception(id, user.id, 'invalid_status', message, { current_status: current.status })
    return c.json({ error: message }, 400)
  }

  if (user.role !== ROLES.TRIAGE_NURSE) {
    const message = '只有导诊护士可以编辑随访单'
    await recordInterception(id, user.id, 'unauthorized_action', message, { user_role: user.role })
    return c.json({ error: message }, 403)
  }

  await db.run(`
    UPDATE followup_forms SET
      patient_name = ?, id_card = ?, gender = ?, age = ?, phone = ?, address = ?,
      chronic_type = ?, followup_type = ?, due_date = ?,
      blood_pressure = ?, blood_sugar = ?, heart_rate = ?, weight = ?,
      symptoms = ?, lifestyle = ?, medication_compliance = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `, [
    data.patient_name, data.id_card, data.gender, data.age, data.phone, data.address,
    data.chronic_type, data.followup_type, data.due_date,
    data.blood_pressure, data.blood_sugar, data.heart_rate, data.weight,
    data.symptoms, data.lifestyle, data.medication_compliance,
    id
  ])

  await incrementVersion(id)
  await recordAuditLog(id, user.id, 'update', '更新随访单信息')

  return c.json({ success: true })
})

followupRouter.post('/:id/submit', requireRole(ROLES.TRIAGE_NURSE), async (c) => {
  const { id } = c.req.param()
  const user = c.get('user')
  const { version, remark } = await c.req.json()

  const current = await db.get('SELECT status FROM followup_forms WHERE id = ?', [id])
  
  const versionCheck = await validateVersion(id, version)
  if (!versionCheck.valid) {
    await recordInterception(id, user.id, 'version_conflict', versionCheck.message)
    return c.json({ error: versionCheck.message }, 409)
  }

  const transitionCheck = validateStatusTransition(user.role, current.status, STATUS.PENDING_SUBMIT)
  if (!transitionCheck.valid) {
    await recordInterception(id, user.id, 'status_transition', transitionCheck.message)
    return c.json({ error: transitionCheck.message }, 400)
  }

  const evidenceCheck = await validateEvidence(id, STATUS.PENDING_SUBMIT)
  if (!evidenceCheck.valid) {
    await recordInterception(id, user.id, 'missing_evidence', evidenceCheck.message)
    return c.json({ error: evidenceCheck.message, missing: evidenceCheck.missing }, 400)
  }

  await db.run(`
    UPDATE followup_forms SET
      status = ?,
      current_role = ?,
      current_handler_id = NULL,
      submitted_at = CURRENT_TIMESTAMP,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `, [STATUS.PENDING_SUBMIT, ROLES.GENERAL_DOCTOR, id])

  await incrementVersion(id)
  await recordProcessing(id, user.id, user.role, remark || '提交审核', STATUS.PENDING_SUBMIT)
  await recordAuditLog(id, user.id, 'submit', remark || '提交到全科医生处理', { toStatus: STATUS.PENDING_SUBMIT })

  return c.json({ success: true })
})

followupRouter.post('/:id/resubmit', requireRole(ROLES.TRIAGE_NURSE), async (c) => {
  const { id } = c.req.param()
  const user = c.get('user')
  const { version, remark } = await c.req.json()

  const current = await db.get('SELECT status FROM followup_forms WHERE id = ?', [id])
  
  const versionCheck = await validateVersion(id, version)
  if (!versionCheck.valid) {
    await recordInterception(id, user.id, 'version_conflict', versionCheck.message)
    return c.json({ error: versionCheck.message }, 409)
  }

  const transitionCheck = validateStatusTransition(user.role, current.status, STATUS.RESUBMITTED)
  if (!transitionCheck.valid) {
    await recordInterception(id, user.id, 'status_transition', transitionCheck.message)
    return c.json({ error: transitionCheck.message }, 400)
  }

  const evidenceCheck = await validateEvidence(id, STATUS.RESUBMITTED)
  if (!evidenceCheck.valid) {
    await recordInterception(id, user.id, 'missing_evidence', evidenceCheck.message)
    return c.json({ error: evidenceCheck.message, missing: evidenceCheck.missing }, 400)
  }

  await db.run(`
    UPDATE followup_forms SET
      status = ?,
      current_role = ?,
      current_handler_id = NULL,
      resubmitted_at = CURRENT_TIMESTAMP,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `, [STATUS.RESUBMITTED, ROLES.GENERAL_DOCTOR, id])

  await incrementVersion(id)
  await recordProcessing(id, user.id, user.role, remark || '重新提交', STATUS.RESUBMITTED)
  await recordAuditLog(id, user.id, 'resubmit', remark || '重新提交审核', { toStatus: STATUS.RESUBMITTED })

  return c.json({ success: true })
})

followupRouter.post('/:id/process', requireRole(ROLES.GENERAL_DOCTOR), async (c) => {
  const { id } = c.req.param()
  const user = c.get('user')
  const { version, opinion, diagnosis, treatment_plan } = await c.req.json()

  const current = await db.get('SELECT status, current_handler_id FROM followup_forms WHERE id = ?', [id])
  
  const versionCheck = await validateVersion(id, version)
  if (!versionCheck.valid) {
    await recordInterception(id, user.id, 'version_conflict', versionCheck.message)
    return c.json({ error: versionCheck.message }, 409)
  }

  if (current.current_handler_id && current.current_handler_id !== user.id) {
    await recordInterception(id, user.id, 'duplicate_processing', '该单据已被其他医生处理')
    return c.json({ error: '该单据已被其他医生处理' }, 409)
  }

  const transitionCheck = validateStatusTransition(user.role, current.status, STATUS.DOCTOR_PROCESSING)
  if (!transitionCheck.valid) {
    await recordInterception(id, user.id, 'status_transition', transitionCheck.message)
    return c.json({ error: transitionCheck.message }, 400)
  }

  const evidenceCheck = await validateEvidence(id, STATUS.DOCTOR_PROCESSING)
  if (!evidenceCheck.valid) {
    await recordInterception(id, user.id, 'missing_evidence', evidenceCheck.message)
    return c.json({ error: evidenceCheck.message, missing: evidenceCheck.missing }, 400)
  }

  await db.run(`
    UPDATE followup_forms SET
      status = ?,
      current_role = ?,
      current_handler_id = ?,
      diagnosis = ?,
      treatment_plan = ?,
      doctor_opinion = ?,
      doctor_processed_at = CURRENT_TIMESTAMP,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `, [STATUS.DOCTOR_PROCESSING, ROLES.MEDICAL_DIRECTOR, user.id, diagnosis, treatment_plan, opinion, id])

  await incrementVersion(id)
  await recordProcessing(id, user.id, user.role, opinion, STATUS.DOCTOR_PROCESSING)
  await recordAuditLog(id, user.id, 'process', opinion || '医生处理完成', { toStatus: STATUS.DOCTOR_PROCESSING })

  return c.json({ success: true })
})

followupRouter.post('/:id/review', requireRole(ROLES.MEDICAL_DIRECTOR), async (c) => {
  const { id } = c.req.param()
  const user = c.get('user')
  const { version, opinion } = await c.req.json()

  const current = await db.get('SELECT status FROM followup_forms WHERE id = ?', [id])
  
  const versionCheck = await validateVersion(id, version)
  if (!versionCheck.valid) {
    await recordInterception(id, user.id, 'version_conflict', versionCheck.message)
    return c.json({ error: versionCheck.message }, 409)
  }

  const transitionCheck = validateStatusTransition(user.role, current.status, STATUS.DIRECTOR_REVIEW)
  if (!transitionCheck.valid) {
    await recordInterception(id, user.id, 'status_transition', transitionCheck.message)
    return c.json({ error: transitionCheck.message }, 400)
  }

  const evidenceCheck = await validateEvidence(id, STATUS.DIRECTOR_REVIEW)
  if (!evidenceCheck.valid) {
    await recordInterception(id, user.id, 'missing_evidence', evidenceCheck.message)
    return c.json({ error: evidenceCheck.message, missing: evidenceCheck.missing }, 400)
  }

  await db.run(`
    UPDATE followup_forms SET
      status = ?,
      current_role = ?,
      current_handler_id = ?,
      director_opinion = ?,
      director_reviewed_at = CURRENT_TIMESTAMP,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `, [STATUS.DIRECTOR_REVIEW, ROLES.MEDICAL_DIRECTOR, user.id, opinion, id])

  await incrementVersion(id)
  await recordProcessing(id, user.id, user.role, opinion, STATUS.DIRECTOR_REVIEW)
  await recordAuditLog(id, user.id, 'review', opinion || '主任审核', { toStatus: STATUS.DIRECTOR_REVIEW })

  return c.json({ success: true })
})

followupRouter.post('/:id/complete', requireRole(ROLES.MEDICAL_DIRECTOR), async (c) => {
  const { id } = c.req.param()
  const user = c.get('user')
  const { version, opinion } = await c.req.json()

  const current = await db.get('SELECT status FROM followup_forms WHERE id = ?', [id])
  
  const versionCheck = await validateVersion(id, version)
  if (!versionCheck.valid) {
    await recordInterception(id, user.id, 'version_conflict', versionCheck.message)
    return c.json({ error: versionCheck.message }, 409)
  }

  const transitionCheck = validateStatusTransition(user.role, current.status, STATUS.COMPLETED)
  if (!transitionCheck.valid) {
    await recordInterception(id, user.id, 'status_transition', transitionCheck.message)
    return c.json({ error: transitionCheck.message }, 400)
  }

  const evidenceCheck = await validateEvidence(id, STATUS.COMPLETED)
  if (!evidenceCheck.valid) {
    await recordInterception(id, user.id, 'missing_evidence', evidenceCheck.message)
    return c.json({ error: evidenceCheck.message, missing: evidenceCheck.missing }, 400)
  }

  await db.run(`
    UPDATE followup_forms SET
      status = ?,
      current_role = ?,
      current_handler_id = NULL,
      completed_at = CURRENT_TIMESTAMP,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `, [STATUS.COMPLETED, ROLES.MEDICAL_DIRECTOR, id])

  await incrementVersion(id)
  await recordProcessing(id, user.id, user.role, opinion || '审核通过', STATUS.COMPLETED)
  await recordAuditLog(id, user.id, 'complete', opinion || '审核通过，流程完成', { toStatus: STATUS.COMPLETED })

  return c.json({ success: true })
})

followupRouter.post('/:id/return', async (c) => {
  const { id } = c.req.param()
  const user = c.get('user')
  const { version, reason, remark } = await c.req.json()

  const current = await db.get('SELECT status, current_role FROM followup_forms WHERE id = ?', [id])
  
  const versionCheck = await validateVersion(id, version)
  if (!versionCheck.valid) {
    await recordInterception(id, user.id, 'version_conflict', versionCheck.message)
    return c.json({ error: versionCheck.message }, 409)
  }

  const transitionCheck = validateStatusTransition(user.role, current.status, STATUS.RETURNED)
  if (!transitionCheck.valid) {
    await recordInterception(id, user.id, 'status_transition', transitionCheck.message)
    return c.json({ error: transitionCheck.message }, 400)
  }

  await db.run(`
    UPDATE followup_forms SET
      status = ?,
      current_role = ?,
      current_handler_id = NULL,
      return_reason = ?,
      returned_at = CURRENT_TIMESTAMP,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `, [STATUS.RETURNED, ROLES.TRIAGE_NURSE, reason, id])

  await incrementVersion(id)
  await recordProcessing(id, user.id, user.role, remark || '退回补正', STATUS.RETURNED)
  await recordException(id, 'returned', reason, user.id)
  await recordAuditLog(id, user.id, 'return', reason, { toStatus: STATUS.RETURNED, reason })

  return c.json({ success: true })
})

followupRouter.post('/:id/archive', requireRole(ROLES.MEDICAL_DIRECTOR), async (c) => {
  const { id } = c.req.param()
  const user = c.get('user')
  const { version } = await c.req.json()

  const current = await db.get('SELECT status FROM followup_forms WHERE id = ?', [id])
  
  const versionCheck = await validateVersion(id, version)
  if (!versionCheck.valid) {
    await recordInterception(id, user.id, 'version_conflict', versionCheck.message)
    return c.json({ error: versionCheck.message }, 409)
  }

  if (current.status !== STATUS.COMPLETED) {
    const message = '只有已完成的单据可以归档'
    await recordInterception(id, user.id, 'invalid_status', message, { current_status: current.status, target: 'archive' })
    return c.json({ error: message }, 400)
  }

  await db.run(`
    UPDATE followup_forms SET
      status = ?,
      archived_at = CURRENT_TIMESTAMP,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `, [STATUS.ARCHIVED, id])

  await incrementVersion(id)
  await recordAuditLog(id, user.id, 'archive', '归档随访单', { toStatus: STATUS.ARCHIVED })

  return c.json({ success: true })
})

followupRouter.post('/:id/attachment', authMiddleware, async (c) => {
  const { id } = c.req.param()
  const user = c.get('user')
  const { type, name, url, size } = await c.req.json()

  const result = await db.run(`
    INSERT INTO attachments (followup_id, type, name, url, size, uploader_id)
    VALUES (?, ?, ?, ?, ?, ?)
  `, [id, type, name, url, size, user.id])

  await recordAuditLog(id, user.id, 'upload_attachment', `上传附件: ${name}`, { type })

  return c.json({ id: result.lastID })
})

followupRouter.delete('/:id/attachment/:attId', authMiddleware, async (c) => {
  const { id, attId } = c.req.param()
  const user = c.get('user')

  await db.run(`
    UPDATE attachments SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?
  `, [attId])

  await recordAuditLog(id, user.id, 'delete_attachment', '删除附件')

  return c.json({ success: true })
})

export { followupRouter }
