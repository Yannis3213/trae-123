import { Hono } from 'hono'
import db from '../db.js'
import { authMiddleware } from '../middleware/auth.js'
import { STATUS_NAMES, ROLE_NAMES } from '../constants.js'

const auditRouter = new Hono()

auditRouter.use('/*', authMiddleware)

auditRouter.get('/followup/:id', async (c) => {
  const { id } = c.req.param()
  const logs = await db.all(`
    SELECT a.*, u.name as user_name
    FROM audit_logs a
    LEFT JOIN users u ON a.user_id = u.id
    WHERE a.followup_id = ?
    ORDER BY a.created_at DESC
  `, [id])

  return c.json(logs.map(l => ({
    ...l,
    extraData: l.extra_data ? JSON.parse(l.extra_data) : null
  })))
})

auditRouter.get('/processing/:id', async (c) => {
  const { id } = c.req.param()
  const records = await db.all(`
    SELECT p.*, u.name as user_name
    FROM processing_records p
    LEFT JOIN users u ON p.user_id = u.id
    WHERE p.followup_id = ?
    ORDER BY p.created_at DESC
  `, [id])

  return c.json(records.map(r => ({
    ...r,
    statusName: STATUS_NAMES[r.status],
    roleName: ROLE_NAMES[r.role]
  })))
})

auditRouter.get('/exceptions/:id', async (c) => {
  const { id } = c.req.param()
  const exceptions = await db.all(`
    SELECT e.*, u.name as operator_name
    FROM exception_reasons e
    LEFT JOIN users u ON e.operator_id = u.id
    WHERE e.followup_id = ?
    ORDER BY e.created_at DESC
  `, [id])

  return c.json(exceptions)
})

export { auditRouter }
