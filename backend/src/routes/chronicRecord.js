import { Hono } from 'hono'
import db from '../db.js'
import { authMiddleware } from '../middleware/auth.js'
import { recordAuditLog } from '../services/followupService.js'

const chronicRecordRouter = new Hono()

chronicRecordRouter.use('/*', authMiddleware)

chronicRecordRouter.get('/:idCard', async (c) => {
  const { idCard } = c.req.param()
  const record = await db.get('SELECT * FROM chronic_records WHERE patient_id_card = ?', [idCard])
  return c.json(record || null)
})

chronicRecordRouter.post('/', async (c) => {
  const user = c.get('user')
  const data = await c.req.json()
  const { followup_id } = data

  const existing = await db.get('SELECT id FROM chronic_records WHERE patient_id_card = ?', [data.patient_id_card])
  if (existing) {
    await db.run(`
      UPDATE chronic_records SET
        patient_name = ?, diagnosis_date = ?, chronic_type = ?,
        severity = ?, complications = ?, treatment_history = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE patient_id_card = ?
    `, [
      data.patient_name, data.diagnosis_date, data.chronic_type,
      data.severity, data.complications, data.treatment_history,
      data.patient_id_card
    ])
    const record = await db.get('SELECT * FROM chronic_records WHERE id = ?', [existing.id])
    if (followup_id) {
      await recordAuditLog(followup_id, user.id, 'update_chronic_record', 
        `补正慢病档案: ${data.patient_name}`, 
        { chronic_type: data.chronic_type, severity: data.severity }
      )
    } else {
      await recordAuditLog(0, user.id, 'update_chronic_record', `更新慢病档案: ${data.patient_name}`)
    }
    return c.json({ id: existing.id, ...record })
  }

  const result = await db.run(`
    INSERT INTO chronic_records (
      patient_name, patient_id_card, diagnosis_date, chronic_type,
      severity, complications, treatment_history, creator_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    data.patient_name, data.patient_id_card, data.diagnosis_date, data.chronic_type,
    data.severity, data.complications, data.treatment_history, user.id
  ])
  if (followup_id) {
    await recordAuditLog(followup_id, user.id, 'create_chronic_record', 
      `补正慢病档案: ${data.patient_name}`, 
      { chronic_type: data.chronic_type, severity: data.severity, is_new: true }
    )
  } else {
    await recordAuditLog(0, user.id, 'create_chronic_record', `创建慢病档案: ${data.patient_name}`)
  }
  return c.json({ id: result.lastID })
})

chronicRecordRouter.put('/:id', async (c) => {
  const { id } = c.req.param()
  const user = c.get('user')
  const data = await c.req.json()
  const { followup_id } = data

  await db.run(`
    UPDATE chronic_records SET
      patient_name = ?, diagnosis_date = ?, chronic_type = ?,
      severity = ?, complications = ?, treatment_history = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `, [
    data.patient_name, data.diagnosis_date, data.chronic_type,
    data.severity, data.complications, data.treatment_history, id
  ])
  
  if (followup_id) {
    await recordAuditLog(followup_id, user.id, 'update_chronic_record', 
      `补正慢病档案 ID: ${id}`, 
      { chronic_type: data.chronic_type, severity: data.severity }
    )
  } else {
    await recordAuditLog(0, user.id, 'update_chronic_record', `更新慢病档案 ID: ${id}`)
  }
  
  const record = await db.get('SELECT * FROM chronic_records WHERE id = ?', [id])
  return c.json({ success: true, record })
})

export { chronicRecordRouter }
