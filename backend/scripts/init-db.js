import sqlite3 from 'sqlite3'
import bcrypt from 'bcryptjs'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const dataDir = path.join(__dirname, '..', 'data')
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true })
}

const dbPath = path.join(dataDir, 'chronic.db')
if (fs.existsSync(dbPath)) {
  fs.unlinkSync(dbPath)
}

const db = new sqlite3.Database(dbPath)

function exec(sql) {
  return new Promise((resolve, reject) => {
    db.exec(sql, (err) => {
      if (err) reject(err)
      else resolve()
    })
  })
}

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err)
      else resolve({ lastID: this.lastID, changes: this.changes })
    })
  })
}

function prepare(sql) {
  return {
    run: (...params) => {
      return new Promise((resolve, reject) => {
        const stmt = db.prepare(sql)
        stmt.run(...params, function (err) {
          if (err) {
            stmt.finalize()
            reject(err)
          } else {
            stmt.finalize()
            resolve({ lastID: this.lastID, changes: this.changes })
          }
        })
      })
    }
  }
}

function close() {
  return new Promise((resolve, reject) => {
    db.close((err) => {
      if (err) reject(err)
      else resolve()
    })
  })
}

async function init() {
  await exec(`
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE followup_forms (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_name TEXT NOT NULL,
  id_card TEXT NOT NULL,
  gender TEXT,
  age INTEGER,
  phone TEXT,
  address TEXT,
  chronic_type TEXT,
  followup_type TEXT,
  due_date DATETIME,
  blood_pressure TEXT,
  blood_sugar TEXT,
  heart_rate TEXT,
  weight TEXT,
  symptoms TEXT,
  lifestyle TEXT,
  medication_compliance TEXT,
  diagnosis TEXT,
  treatment_plan TEXT,
  doctor_opinion TEXT,
  director_opinion TEXT,
  return_reason TEXT,
  status TEXT NOT NULL,
  current_role TEXT NOT NULL,
  current_handler_id INTEGER,
  creator_id INTEGER NOT NULL,
  version INTEGER DEFAULT 1,
  submitted_at DATETIME,
  resubmitted_at DATETIME,
  doctor_processed_at DATETIME,
  director_reviewed_at DATETIME,
  completed_at DATETIME,
  returned_at DATETIME,
  archived_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (current_handler_id) REFERENCES users(id),
  FOREIGN KEY (creator_id) REFERENCES users(id)
);

CREATE TABLE attachments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  followup_id INTEGER NOT NULL,
  type TEXT NOT NULL,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  size INTEGER,
  uploader_id INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  deleted_at DATETIME,
  FOREIGN KEY (followup_id) REFERENCES followup_forms(id),
  FOREIGN KEY (uploader_id) REFERENCES users(id)
);

CREATE TABLE processing_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  followup_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  role TEXT NOT NULL,
  opinion TEXT,
  status TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (followup_id) REFERENCES followup_forms(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  followup_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  action TEXT NOT NULL,
  remark TEXT,
  extra_data TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (followup_id) REFERENCES followup_forms(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE exception_reasons (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  followup_id INTEGER NOT NULL,
  type TEXT NOT NULL,
  reason TEXT NOT NULL,
  operator_id INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (followup_id) REFERENCES followup_forms(id),
  FOREIGN KEY (operator_id) REFERENCES users(id)
);

CREATE TABLE chronic_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_name TEXT NOT NULL,
  patient_id_card TEXT UNIQUE NOT NULL,
  diagnosis_date DATE,
  chronic_type TEXT,
  severity TEXT,
  complications TEXT,
  treatment_history TEXT,
  creator_id INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (creator_id) REFERENCES users(id)
);

CREATE TABLE medication_reminders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_name TEXT NOT NULL,
  patient_id_card TEXT NOT NULL,
  drug_name TEXT NOT NULL,
  dosage TEXT,
  frequency TEXT,
  start_date DATE,
  end_date DATE,
  notes TEXT,
  creator_id INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  deleted_at DATETIME,
  FOREIGN KEY (creator_id) REFERENCES users(id)
);

CREATE INDEX idx_followup_status ON followup_forms(status);
CREATE INDEX idx_followup_role ON followup_forms(current_role);
CREATE INDEX idx_followup_due_date ON followup_forms(due_date);
CREATE INDEX idx_attachments_followup ON attachments(followup_id);
CREATE INDEX idx_processing_followup ON processing_records(followup_id);
CREATE INDEX idx_audit_followup ON audit_logs(followup_id);
CREATE INDEX idx_exception_followup ON exception_reasons(followup_id);
`)

  await exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
  `)

  const users = [
    { username: 'nurse1', password: '123456', name: '李护士', role: 'triage_nurse' },
    { username: 'doctor1', password: '123456', name: '王医生', role: 'general_doctor' },
    { username: 'director1', password: '123456', name: '张主任', role: 'medical_director' }
  ]

  const insertUser = prepare(`
    INSERT INTO users (username, password_hash, name, role)
    VALUES (?, ?, ?, ?)
  `)

  for (const u of users) {
    const hash = bcrypt.hashSync(u.password, 10)
    await insertUser.run(u.username, hash, u.name, u.role)
  }

  const today = new Date()
  const addDays = (date, days) => {
    const d = new Date(date)
    d.setDate(d.getDate() + days)
    return d.toISOString()
  }

  const sampleForms = [
    {
      patient_name: '张三', id_card: '110101199001011234', gender: '男', age: 35,
      phone: '13800138001', address: '北京市朝阳区',
      chronic_type: '高血压', followup_type: '常规随访',
      due_date: addDays(today, 7),
      blood_pressure: '130/85', blood_sugar: '6.5', heart_rate: '78', weight: '75',
      symptoms: '偶有头晕', lifestyle: '规律作息', medication_compliance: '良好',
      status: 'pending_submit', current_role: 'general_doctor',
      current_handler_id: null, creator_id: 1,
      submitted_at: addDays(today, 0),
      attachments: [
        { type: 'followup_form', name: '随访单_张三.pdf', url: '/files/followup_1.pdf' }
      ]
    },
    {
      patient_name: '李四', id_card: '110101198505055678', gender: '女', age: 40,
      phone: '13800138002', address: '北京市海淀区',
      chronic_type: '糖尿病', followup_type: '常规随访',
      due_date: addDays(today, -5),
      blood_pressure: '140/90', blood_sugar: '8.2', heart_rate: '82', weight: '68',
      symptoms: '多饮多尿', lifestyle: '饮食不规律', medication_compliance: '一般',
      status: 'pending_submit', current_role: 'general_doctor',
      current_handler_id: null, creator_id: 1,
      submitted_at: addDays(today, -6),
      attachments: [
        { type: 'followup_form', name: '随访单_李四.pdf', url: '/files/followup_2.pdf' },
        { type: 'vital_signs', name: '生命体征_李四.pdf', url: '/files/vital_2.pdf' }
      ]
    },
    {
      patient_name: '王五', id_card: '110101197010109012', gender: '男', age: 55,
      phone: '13800138003', address: '北京市西城区',
      chronic_type: '高血压', followup_type: '重点随访',
      due_date: addDays(today, -10),
      blood_pressure: '160/100', blood_sugar: '7.8', heart_rate: '88', weight: '85',
      symptoms: '头痛、胸闷', lifestyle: '吸烟饮酒', medication_compliance: '差',
      status: 'doctor_processing', current_role: 'medical_director',
      current_handler_id: 2, creator_id: 1,
      diagnosis: '高血压3级 高危', treatment_plan: '调整用药方案，增加监测频率',
      doctor_opinion: '血压控制不理想，建议调整用药',
      submitted_at: addDays(today, -11),
      doctor_processed_at: addDays(today, -8),
      attachments: [
        { type: 'followup_form', name: '随访单_王五.pdf', url: '/files/followup_3.pdf' },
        { type: 'vital_signs', name: '生命体征_王五.pdf', url: '/files/vital_3.pdf' },
        { type: 'medication_record', name: '用药记录_王五.pdf', url: '/files/med_3.pdf' }
      ],
      processing: { user_id: 2, role: 'general_doctor', opinion: '血压控制不理想，建议主任审核' }
    },
    {
      patient_name: '赵六', id_card: '110101197503153456', gender: '男', age: 49,
      phone: '13800138004', address: '北京市东城区',
      chronic_type: '糖尿病', followup_type: '常规随访',
      due_date: addDays(today, 2),
      blood_pressure: '135/88', blood_sugar: '7.2', heart_rate: '76', weight: '72',
      symptoms: '无明显不适', lifestyle: '规律运动', medication_compliance: '良好',
      status: 'returned', current_role: 'triage_nurse',
      current_handler_id: null, creator_id: 1,
      return_reason: '缺少用药记录附件，请补充后重新提交',
      submitted_at: addDays(today, -3),
      returned_at: addDays(today, -1),
      attachments: [
        { type: 'followup_form', name: '随访单_赵六.pdf', url: '/files/followup_4.pdf' }
      ],
      processing: { user_id: 2, role: 'general_doctor', opinion: '缺少用药记录附件，请补充' }
    },
    {
      patient_name: '孙七', id_card: '110101198808087890', gender: '女', age: 37,
      phone: '13800138005', address: '北京市丰台区',
      chronic_type: '高血压', followup_type: '常规随访',
      due_date: addDays(today, 5),
      blood_pressure: '125/80', blood_sugar: '5.8', heart_rate: '72', weight: '62',
      symptoms: '无不适', lifestyle: '健康', medication_compliance: '良好',
      status: 'completed', current_role: 'medical_director',
      current_handler_id: null, creator_id: 1,
      diagnosis: '高血压1级', treatment_plan: '维持现有治疗，定期监测',
      doctor_opinion: '血压控制良好，继续保持',
      director_opinion: '同意医生意见',
      submitted_at: addDays(today, -5),
      doctor_processed_at: addDays(today, -3),
      director_reviewed_at: addDays(today, -2),
      completed_at: addDays(today, -2),
      attachments: [
        { type: 'followup_form', name: '随访单_孙七.pdf', url: '/files/followup_5.pdf' },
        { type: 'vital_signs', name: '生命体征_孙七.pdf', url: '/files/vital_5.pdf' },
        { type: 'medication_record', name: '用药记录_孙七.pdf', url: '/files/med_5.pdf' },
        { type: 'treatment_plan', name: '治疗方案_孙七.pdf', url: '/files/treatment_5.pdf' }
      ],
      processing: [
        { user_id: 2, role: 'general_doctor', opinion: '血压控制良好，继续保持', status: 'doctor_processing' },
        { user_id: 3, role: 'medical_director', opinion: '同意医生意见', status: 'completed' }
      ]
    },
    {
      patient_name: '周八', id_card: '110101196512122345', gender: '男', age: 60,
      phone: '13800138006', address: '北京市石景山',
      chronic_type: '高血压、糖尿病', followup_type: '重点随访',
      due_date: addDays(today, 1),
      blood_pressure: '', blood_sugar: '', heart_rate: '', weight: '',
      symptoms: '', lifestyle: '', medication_compliance: '',
      status: 'draft', current_role: 'triage_nurse',
      current_handler_id: null, creator_id: 1,
      attachments: []
    }
  ]

  const insertForm = prepare(`
    INSERT INTO followup_forms (
      patient_name, id_card, gender, age, phone, address,
      chronic_type, followup_type, due_date,
      blood_pressure, blood_sugar, heart_rate, weight,
      symptoms, lifestyle, medication_compliance,
      diagnosis, treatment_plan, doctor_opinion, director_opinion, return_reason,
      status, current_role, current_handler_id, creator_id, version,
      submitted_at, resubmitted_at, doctor_processed_at, director_reviewed_at, completed_at, returned_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  const insertAttachment = prepare(`
    INSERT INTO attachments (followup_id, type, name, url, uploader_id)
    VALUES (?, ?, ?, ?, ?)
  `)

  const insertProcessing = prepare(`
    INSERT INTO processing_records (followup_id, user_id, role, opinion, status)
    VALUES (?, ?, ?, ?, ?)
  `)

  const insertAudit = prepare(`
    INSERT INTO audit_logs (followup_id, user_id, action, remark, extra_data)
    VALUES (?, ?, ?, ?, ?)
  `)

  for (let i = 0; i < sampleForms.length; i++) {
    const form = sampleForms[i]
    const result = await insertForm.run(
      form.patient_name, form.id_card, form.gender, form.age, form.phone, form.address,
      form.chronic_type, form.followup_type, form.due_date,
      form.blood_pressure, form.blood_sugar, form.heart_rate, form.weight,
      form.symptoms, form.lifestyle, form.medication_compliance,
      form.diagnosis || null, form.treatment_plan || null,
      form.doctor_opinion || null, form.director_opinion || null,
      form.return_reason || null,
      form.status, form.current_role, form.current_handler_id, form.creator_id, 1,
      form.submitted_at || null,
      null,
      form.doctor_processed_at || null,
      form.director_reviewed_at || null,
      form.completed_at || null,
      form.returned_at || null
    )

    const followupId = result.lastID

    for (const att of form.attachments) {
      await insertAttachment.run(followupId, att.type, att.name, att.url, form.creator_id)
    }

    await insertAudit.run(followupId, form.creator_id, 'create', `创建随访单: ${form.patient_name}`, JSON.stringify({ status: form.status }))

    if (form.processing) {
      const processList = Array.isArray(form.processing) ? form.processing : [form.processing]
      for (const p of processList) {
        await insertProcessing.run(followupId, p.user_id, p.role, p.opinion, p.status || form.status)
        await insertAudit.run(followupId, p.user_id, 'process', p.opinion, JSON.stringify({ toStatus: p.status || form.status }))
      }
    }
  }

  const chronicRecords = [
    { patient_name: '张三', patient_id_card: '110101199001011234', diagnosis_date: '2020-03-15', chronic_type: '高血压', severity: '轻度', complications: '无', treatment_history: '缬沙坦80mg qd' },
    { patient_name: '李四', patient_id_card: '110101198505055678', diagnosis_date: '2018-06-20', chronic_type: '2型糖尿病', severity: '中度', complications: '无', treatment_history: '二甲双胍500mg bid' },
    { patient_name: '王五', patient_id_card: '110101197010109012', diagnosis_date: '2015-01-10', chronic_type: '高血压3级', severity: '重度', complications: '冠心病', treatment_history: '氨氯地平5mg qd + 缬沙坦160mg qd' }
  ]

  const insertChronic = prepare(`
    INSERT INTO chronic_records (patient_name, patient_id_card, diagnosis_date, chronic_type, severity, complications, treatment_history, creator_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `)

  for (const r of chronicRecords) {
    await insertChronic.run(r.patient_name, r.patient_id_card, r.diagnosis_date, r.chronic_type, r.severity, r.complications, r.treatment_history, 1)
  }

  const medicationReminders = [
    { patient_name: '张三', patient_id_card: '110101199001011234', drug_name: '缬沙坦胶囊', dosage: '80mg', frequency: '每日1次', start_date: '2024-01-01', end_date: '2024-12-31', notes: '早餐后服用' },
    { patient_name: '李四', patient_id_card: '110101198505055678', drug_name: '盐酸二甲双胍片', dosage: '500mg', frequency: '每日2次', start_date: '2024-01-01', end_date: '2024-12-31', notes: '餐中服用' }
  ]

  const insertMedication = prepare(`
    INSERT INTO medication_reminders (patient_name, patient_id_card, drug_name, dosage, frequency, start_date, end_date, notes, creator_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  for (const m of medicationReminders) {
    await insertMedication.run(m.patient_name, m.patient_id_card, m.drug_name, m.dosage, m.frequency, m.start_date, m.end_date, m.notes, 1)
  }

  console.log('Database initialized successfully!')
  console.log('')
  console.log('Demo Accounts:')
  console.log('  导诊护士: nurse1 / 123456')
  console.log('  全科医生: doctor1 / 123456')
  console.log('  医务科主任: director1 / 123456')
  console.log('')
  console.log('Sample Data:')
  console.log('  6 sample followup forms created')
  console.log('  3 chronic records')
  console.log('  2 medication reminders')
  console.log('')
  console.log('Database file:', dbPath)

  await close()
}

init().catch(err => {
  console.error('Error initializing database:', err)
  process.exit(1)
})
