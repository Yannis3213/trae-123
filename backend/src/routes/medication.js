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
  const { followup_id } = data

  const result = await db.run(`
    INSERT INTO medication_reminders (
      patient_name, patient_id_card, drug_name, dosage,
      frequency, start_date, end_date, notes, creator_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    data.patient_name, data.patient_id_card, data.drug_name, data.dosage,
    data.frequency, data.start_date, data.end_date, data.notes, user.id
  ])
  
  if (followup_id) {
    await recordAuditLog(followup_id, user.id, 'create_medication', 
      `补正用药提醒: ${data.drug_name}`, 
      { drug_name: data.drug_name, dosage: data.dosage, is_new: true }
    )
  } else {
    await recordAuditLog(0, user.id, 'create_medication', `添加用药提醒: ${data.drug_name}`)
  }
  
  const record = await db.get('SELECT * FROM medication_reminders WHERE id = ?', [result.lastID])
  return c.json({ id: result.lastID, record })
})

medicationRouter.put('/:id', async (c) => {
  const { id } = c.req.param()
  const user = c.get('user')
  const data = await c.req.json()
  const { followup_id } = data

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
  
  if (followup_id) {
    await recordAuditLog(followup_id, user.id, 'update_medication', 
      `补正用药提醒 ID: ${id}`, 
      { drug_name: data.drug_name, dosage: data.dosage }
    )
  } else {
    await recordAuditLog(0, user.id, 'update_medication', `更新用药提醒 ID: ${id}`)
  }
  
  const record = await db.get('SELECT * FROM medication_reminders WHERE id = ?', [id])
  return c.json({ success: true, record })
})

medicationRouter.delete('/:id', async (c) => {
  const { id } = c.req.param()
  const user = c.get('user')
  const { followup_id } = c.req.query()

  await db.run(`
    UPDATE medication_reminders SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?
  `, [id])
  
  if (followup_id) {
    await recordAuditLog(followup_id, user.id, 'delete_medication', 
      `删除用药提醒 ID: ${id}（从详情补正操作）`
    )
  } else {
    await recordAuditLog(0, user.id, 'delete_medication', `删除用药提醒 ID: ${id}`)
  }
  
  return c.json({ success: true })
})

export { medicationRouter }
