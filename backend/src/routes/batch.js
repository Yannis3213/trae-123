import { Hono } from 'hono'
import db from '../db.js'
import { authMiddleware, requireRole } from '../middleware/auth.js'
import { ROLES, STATUS, STATUS_NAMES } from '../constants.js'
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

const batchRouter = new Hono()

batchRouter.use('/*', authMiddleware)

batchRouter.post('/process', requireRole(ROLES.GENERAL_DOCTOR), async (c) => {
  const user = c.get('user')
  const body = await c.req.json()
  const { opinion, diagnosis, treatment_plan } = body
  let items = body.items
  if (!items && body.ids) {
    items = body.ids.map(id => ({ id, version: body.version || 1 }))
  }
  const results = []

  for (const item of items) {
    try {
      const { id, version } = item
      const form = await db.get('SELECT status, current_handler_id, due_date FROM followup_forms WHERE id = ?', [id])
      
      if (!form) {
        results.push({ id, success: false, reason: '随访单不存在' })
        continue
      }

      const overdue = checkOverdue(form.due_date)
      if (overdue.level === 'overdue') {
        results.push({ id, success: false, reason: `已逾期${overdue.days}天，需逐单处理，不得批量推进` })
        await recordInterception(id, user.id, 'batch_overdue', '逾期单据批量处理被拦截')
        continue
      }

      const versionCheck = await validateVersion(id, version)
      if (!versionCheck.valid) {
        await recordInterception(id, user.id, 'version_conflict', versionCheck.message)
        results.push({ id, success: false, reason: versionCheck.message })
        continue
      }

      if (form.current_handler_id && form.current_handler_id !== user.id) {
        await recordInterception(id, user.id, 'duplicate_processing', '该单据已被其他医生处理')
        results.push({ id, success: false, reason: '该单据已被其他医生处理' })
        continue
      }

      const transitionCheck = validateStatusTransition(user.role, form.status, STATUS.DOCTOR_PROCESSING)
      if (!transitionCheck.valid) {
        await recordInterception(id, user.id, 'status_transition', transitionCheck.message)
        results.push({ id, success: false, reason: transitionCheck.message })
        continue
      }

      const evidenceCheck = await validateEvidence(id, STATUS.DOCTOR_PROCESSING)
      if (!evidenceCheck.valid) {
        await recordInterception(id, user.id, 'missing_evidence', evidenceCheck.message)
        results.push({ id, success: false, reason: evidenceCheck.message })
        continue
      }

      await db.run(`
        UPDATE followup_forms SET
          status = ?, current_role = ?, current_handler_id = ?,
          diagnosis = ?, treatment_plan = ?, doctor_opinion = ?,
          doctor_processed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [STATUS.DOCTOR_PROCESSING, ROLES.MEDICAL_DIRECTOR, user.id, diagnosis, treatment_plan, opinion, id])

      await incrementVersion(id)
      await recordProcessing(id, user.id, user.role, opinion, STATUS.DOCTOR_PROCESSING)
      await recordAuditLog(id, user.id, 'batch_process', opinion || '批量处理完成', { toStatus: STATUS.DOCTOR_PROCESSING })
      
      results.push({ id, success: true, status: STATUS.DOCTOR_PROCESSING, statusName: STATUS_NAMES[STATUS.DOCTOR_PROCESSING] })
    } catch (err) {
      results.push({ id: item.id, success: false, reason: err.message })
    }
  }

  return c.json({ results })
})

batchRouter.post('/complete', requireRole(ROLES.MEDICAL_DIRECTOR), async (c) => {
  const user = c.get('user')
  const body = await c.req.json()
  const { opinion } = body
  let items = body.items
  if (!items && body.ids) {
    items = body.ids.map(id => ({ id, version: body.version || 1 }))
  }
  const results = []

  for (const item of items) {
    try {
      const { id, version } = item
      const form = await db.get('SELECT status, due_date FROM followup_forms WHERE id = ?', [id])
      
      if (!form) {
        results.push({ id, success: false, reason: '随访单不存在' })
        continue
      }

      const overdue = checkOverdue(form.due_date)
      if (overdue.level === 'overdue') {
        results.push({ id, success: false, reason: `已逾期${overdue.days}天，需逐单审核，不得批量完成` })
        await recordInterception(id, user.id, 'batch_overdue', '逾期单据批量完成被拦截')
        continue
      }

      const versionCheck = await validateVersion(id, version)
      if (!versionCheck.valid) {
        await recordInterception(id, user.id, 'version_conflict', versionCheck.message)
        results.push({ id, success: false, reason: versionCheck.message })
        continue
      }

      const transitionCheck = validateStatusTransition(user.role, form.status, STATUS.COMPLETED)
      if (!transitionCheck.valid) {
        await recordInterception(id, user.id, 'status_transition', transitionCheck.message)
        results.push({ id, success: false, reason: transitionCheck.message })
        continue
      }

      const evidenceCheck = await validateEvidence(id, STATUS.COMPLETED)
      if (!evidenceCheck.valid) {
        await recordInterception(id, user.id, 'missing_evidence', evidenceCheck.message)
        results.push({ id, success: false, reason: evidenceCheck.message })
        continue
      }

      await db.run(`
        UPDATE followup_forms SET
          status = ?, current_role = ?, current_handler_id = NULL,
          completed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [STATUS.COMPLETED, ROLES.MEDICAL_DIRECTOR, id])

      await incrementVersion(id)
      await recordProcessing(id, user.id, user.role, opinion || '批量审核通过', STATUS.COMPLETED)
      await recordAuditLog(id, user.id, 'batch_complete', opinion || '批量审核通过', { toStatus: STATUS.COMPLETED })
      
      results.push({ id, success: true, status: STATUS.COMPLETED, statusName: STATUS_NAMES[STATUS.COMPLETED] })
    } catch (err) {
      results.push({ id: item.id, success: false, reason: err.message })
    }
  }

  return c.json({ results })
})

batchRouter.post('/return', async (c) => {
  const user = c.get('user')
  const body = await c.req.json()
  const { reason, remark } = body
  let items = body.items
  if (!items && body.ids) {
    items = body.ids.map(id => ({ id, version: body.version || 1 }))
  }
  const results = []

  for (const item of items) {
    try {
      const { id, version } = item
      const form = await db.get('SELECT status FROM followup_forms WHERE id = ?', [id])
      
      if (!form) {
        results.push({ id, success: false, reason: '随访单不存在' })
        continue
      }

      const versionCheck = await validateVersion(id, version)
      if (!versionCheck.valid) {
        await recordInterception(id, user.id, 'version_conflict', versionCheck.message)
        results.push({ id, success: false, reason: versionCheck.message })
        continue
      }

      const transitionCheck = validateStatusTransition(user.role, form.status, STATUS.RETURNED)
      if (!transitionCheck.valid) {
        await recordInterception(id, user.id, 'status_transition', transitionCheck.message)
        results.push({ id, success: false, reason: transitionCheck.message })
        continue
      }

      await db.run(`
        UPDATE followup_forms SET
          status = ?, current_role = ?, current_handler_id = NULL,
          return_reason = ?, returned_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [STATUS.RETURNED, ROLES.TRIAGE_NURSE, reason, id])

      await incrementVersion(id)
      await recordProcessing(id, user.id, user.role, remark || '批量退回', STATUS.RETURNED)
      await recordException(id, 'returned', reason, user.id)
      await recordAuditLog(id, user.id, 'batch_return', reason, { toStatus: STATUS.RETURNED, reason })
      
      results.push({ id, success: true, status: STATUS.RETURNED, statusName: STATUS_NAMES[STATUS.RETURNED] })
    } catch (err) {
      results.push({ id: item.id, success: false, reason: err.message })
    }
  }

  return c.json({ results })
})

export { batchRouter }
