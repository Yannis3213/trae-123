import { Hono } from 'hono'
import db from '../db.js'
import { authMiddleware } from '../middleware/auth.js'
import { recordAuditLog } from '../services/followupService.js'

const medicationRouter = new Hono()

medicationRouter.use('/*', authMiddleware)

medicationRouter.get('/:idCard', async (c) => {
  const { idCard } = c.req.param()
  const reminders = await db.all(`
    SELECT * FROM medication_reminders 
    WHERE patient_id_card = ? AND deleted_at IS NULL
    ORDER BY created_at DESC
  `, [idCard])
  return c.json(reminders)
})

medicationRouter.post('/', async (c) => {
  const user = c.get('user')
  const data = await c.req.json()

  const result = await db.run(`
    INSERT INTO medication_reminders (
      patient_name, patient_id_card, drug_name, dosage,
      frequency, start_date, end_date, notes, creator_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    data.patient_name, data.patient_id_card, data.drug_name, data.dosage,
    data.frequency, data.start_date, data.end_date, data.notes, user.id
  ])
  await recordAuditLog(0, user.id, 'create_medication', `添加用药提醒: ${data.drug_name}`)
  return c.json({ id: result.lastID })
})

medicationRouter.put('/:id', async (c) => {
  const { id } = c.req.param()
  const user = c.get('user')
  const data = await c.req.json()

  await db.run(`
    UPDATE medication_reminders SET
      drug_name = ?, dosage = ?, frequency = ?,
      start_date = ?, end_date = ?, notes = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `, [
    data.drug_name, data.dosage, data.frequency,
    data.start_date, data.end_date, data.notes, id
  ])
  await recordAuditLog(0, user.id, 'update_medication', `更新用药提醒 ID: ${id}`)
  return c.json({ success: true })
})

medicationRouter.delete('/:id', async (c) => {
  const { id } = c.req.param()
  const user = c.get('user')

  await db.run(`
    UPDATE medication_reminders SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?
  `, [id])
  await recordAuditLog(0, user.id, 'delete_medication', `删除用药提醒 ID: ${id}`)
  return c.json({ success: true })
})

export { medicationRouter }
