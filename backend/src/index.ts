import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { serve } from '@hono/node-server'
import Database from 'better-sqlite3'
import { mkdirSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const dataDir = join(__dirname, '..', 'data')
if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true })

const dbPath = join(dataDir, 'safety.db')
const db = new Database(dbPath)

db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

db.exec(`
  CREATE TABLE IF NOT EXISTS safety_orders (
    id TEXT PRIMARY KEY,
    order_no TEXT UNIQUE NOT NULL,
    address TEXT NOT NULL,
    resident_name TEXT NOT NULL DEFAULT '',
    resident_phone TEXT NOT NULL DEFAULT '',
    resident_id_card TEXT NOT NULL DEFAULT '',
    gas_meter_no TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'pending_correction',
    current_step TEXT NOT NULL DEFAULT 'home_inspection',
    current_handler TEXT NOT NULL,
    current_handler_role TEXT NOT NULL,
    deadline TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
  );

  CREATE TABLE IF NOT EXISTS home_inspections (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id TEXT NOT NULL,
    inspector TEXT NOT NULL DEFAULT '',
    inspection_date TEXT NOT NULL DEFAULT '',
    inspection_result TEXT NOT NULL DEFAULT '',
    anomalies TEXT NOT NULL DEFAULT '',
    submitted INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
    FOREIGN KEY (order_id) REFERENCES safety_orders(id)
  );

  CREATE TABLE IF NOT EXISTS hazard_rectifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id TEXT NOT NULL,
    hazard_level TEXT NOT NULL DEFAULT '',
    rectification_measures TEXT NOT NULL DEFAULT '',
    rectification_date TEXT NOT NULL DEFAULT '',
    completed INTEGER NOT NULL DEFAULT 0,
    approved INTEGER DEFAULT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
    FOREIGN KEY (order_id) REFERENCES safety_orders(id)
  );

  CREATE TABLE IF NOT EXISTS recheck_closures (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id TEXT NOT NULL,
    recheck_result TEXT NOT NULL DEFAULT '',
    recheck_date TEXT NOT NULL DEFAULT '',
    closed INTEGER NOT NULL DEFAULT 0,
    confirmed INTEGER DEFAULT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
    FOREIGN KEY (order_id) REFERENCES safety_orders(id)
  );

  CREATE TABLE IF NOT EXISTS attachments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id TEXT NOT NULL,
    step TEXT NOT NULL,
    file_name TEXT NOT NULL,
    file_type TEXT NOT NULL DEFAULT '',
    file_data TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
    FOREIGN KEY (order_id) REFERENCES safety_orders(id)
  );

  CREATE TABLE IF NOT EXISTS processing_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id TEXT NOT NULL,
    step TEXT NOT NULL,
    action TEXT NOT NULL,
    handler TEXT NOT NULL,
    handler_role TEXT NOT NULL DEFAULT '',
    remark TEXT,
    anomaly_reason TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
    FOREIGN KEY (order_id) REFERENCES safety_orders(id)
  );
`)

const now = new Date()
const fmt = (d: Date) => {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}
const addDays = (d: Date, days: number) => { const r = new Date(d); r.setDate(r.getDate() + days); return r }

const ROLE_HANDLERS: Record<string, { handler: string; role: string }> = {
  agent: { handler: '坐席-张三', role: 'agent' },
  supervisor: { handler: '主管-李四', role: 'supervisor' },
  manager: { handler: '负责人-王五', role: 'manager' },
}

const ACTION_ROLE_MAP: Record<string, string> = {
  submit_inspection: 'agent',
  submit: 'agent',
  approve: 'supervisor',
  reject: 'supervisor',
  confirm: 'manager',
  return: 'manager',
  close: 'manager',
}

const ACTION_STATUS_MAP: Record<string, string[]> = {
  submit_inspection: ['pending_correction'],
  submit: ['pending_correction'],
  approve: ['under_review'],
  reject: ['under_review'],
  confirm: ['under_review'],
  return: ['under_review'],
  close: ['under_review'],
}

const ACTION_STEP_MAP: Record<string, string[]> = {
  submit_inspection: ['home_inspection'],
  submit: ['home_inspection'],
  approve: ['hazard_rectification'],
  reject: ['hazard_rectification'],
  confirm: ['recheck_closure'],
  return: ['recheck_closure'],
  close: ['recheck_closure'],
}

function getExpiryStatus(deadline: string): string {
  const dl = new Date(deadline).getTime()
  const n = Date.now()
  const threeDays = 3 * 24 * 60 * 60 * 1000
  const oneDay = 24 * 60 * 60 * 1000
  if (dl <= n + oneDay) return 'overdue'
  if (dl <= n + threeDays) return 'near_expiry'
  return 'normal'
}

function mapOrderToApi(row: any) {
  return {
    id: row.id,
    order_no: row.order_no,
    address: row.address,
    resident_name: row.resident_name,
    resident_phone: row.resident_phone,
    resident_id_card: row.resident_id_card,
    gas_meter_no: row.gas_meter_no,
    status: row.status,
    current_step: row.current_step,
    current_handler: row.current_handler,
    current_handler_role: row.current_handler_role,
    deadline: row.deadline,
    expiry_status: getExpiryStatus(row.deadline),
    version: row.version,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}

function mapHomeInspection(row: any) {
  return {
    inspector: row.inspector,
    inspection_date: row.inspection_date,
    inspection_result: row.inspection_result,
    anomalies: row.anomalies,
    submitted: !!row.submitted,
  }
}

function mapHazardRectification(row: any) {
  return {
    hazard_level: row.hazard_level,
    rectification_measures: row.rectification_measures,
    rectification_date: row.rectification_date,
    approved: row.approved === null ? null : !!row.approved,
  }
}

function mapRecheckClosure(row: any) {
  return {
    recheck_result: row.recheck_result,
    recheck_date: row.recheck_date,
    confirmed: row.confirmed === null ? null : !!row.confirmed,
  }
}

function mapProcessingRecord(row: any) {
  return {
    step: row.step,
    action: row.action,
    handler: row.handler,
    handler_role: row.handler_role,
    remark: row.remark || '',
    anomaly_reason: row.anomaly_reason || '',
    timestamp: row.created_at,
  }
}

function mapAttachment(row: any) {
  return {
    id: row.id,
    step: row.step,
    file_name: row.file_name,
    file_type: row.file_type,
    created_at: row.created_at,
  }
}

const orderCount = db.prepare('SELECT COUNT(*) as c FROM safety_orders').get() as { c: number }
if (orderCount.c === 0) {
  const nowStr = fmt(now)

  const orders = [
    {
      id: 'ORD-2026-001', order_no: 'AQ-2026-0601-001',
      address: '北京市朝阳区建国路88号SOHO现代城A座1203室',
      resident_name: '刘淑华', resident_phone: '13800138001', resident_id_card: '110105196503128821',
      gas_meter_no: 'BJ-CA-2024-00856',
      status: 'pending_correction', current_step: 'home_inspection',
      current_handler: '坐席-张三', current_handler_role: 'agent',
      deadline: fmt(addDays(now, 0)),
      version: 1
    },
    {
      id: 'ORD-2026-002', order_no: 'AQ-2026-0601-002',
      address: '北京市海淀区中关村南大街5号院2号楼502室',
      resident_name: '陈大明', resident_phone: '13900139002', resident_id_card: '110108197208156734',
      gas_meter_no: 'BJ-HD-2023-12043',
      status: 'pending_correction', current_step: 'home_inspection',
      current_handler: '坐席-张三', current_handler_role: 'agent',
      deadline: fmt(addDays(now, 2)),
      version: 1
    },
    {
      id: 'ORD-2026-003', order_no: 'AQ-2026-0602-003',
      address: '北京市西城区德胜门外大街15号院3号楼801室',
      resident_name: '王秀兰', resident_phone: '13700137003', resident_id_card: '110102195807204518',
      gas_meter_no: 'BJ-XC-2024-03291',
      status: 'under_review', current_step: 'hazard_rectification',
      current_handler: '主管-李四', current_handler_role: 'supervisor',
      deadline: fmt(addDays(now, 5)),
      version: 2
    },
    {
      id: 'ORD-2026-004', order_no: 'AQ-2026-0602-004',
      address: '北京市东城区东直门内大街78号院1单元602室',
      resident_name: '赵德强', resident_phone: '13600136004', resident_id_card: '110101197505093127',
      gas_meter_no: 'BJ-DC-2024-01567',
      status: 'under_review', current_step: 'hazard_rectification',
      current_handler: '主管-李四', current_handler_role: 'supervisor',
      deadline: fmt(addDays(now, 2)),
      version: 2
    },
    {
      id: 'ORD-2026-005', order_no: 'AQ-2026-0603-005',
      address: '北京市丰台区方庄路6号院芳城园三区5号楼1102室',
      resident_name: '孙丽萍', resident_phone: '13500135005', resident_id_card: '110106198309182546',
      gas_meter_no: 'BJ-FT-2023-07823',
      status: 'completed', current_step: 'recheck_closure',
      current_handler: '负责人-王五', current_handler_role: 'manager',
      deadline: fmt(addDays(now, 7)),
      version: 5
    },
    {
      id: 'ORD-2026-006', order_no: 'AQ-2026-0603-006',
      address: '北京市通州区新华西街58号院万达广场B区3号楼401室',
      resident_name: '周国强', resident_phone: '13400134006', resident_id_card: '110112196811057832',
      gas_meter_no: 'BJ-TZ-2024-04561',
      status: 'completed', current_step: 'recheck_closure',
      current_handler: '负责人-王五', current_handler_role: 'manager',
      deadline: fmt(addDays(now, 7)),
      version: 5
    },
    {
      id: 'ORD-2026-007', order_no: 'AQ-2026-0604-007',
      address: '北京市昌平区回龙观东大街88号龙泽苑东区6号楼1503室',
      resident_name: '吴美珍', resident_phone: '13300133007', resident_id_card: '110114197203289156',
      gas_meter_no: 'BJ-CP-2024-06234',
      status: 'under_review', current_step: 'recheck_closure',
      current_handler: '负责人-王五', current_handler_role: 'manager',
      deadline: fmt(addDays(now, 4)),
      version: 4
    }
  ]

  const insertOrder = db.prepare(`
    INSERT INTO safety_orders (id, order_no, address, resident_name, resident_phone, resident_id_card, gas_meter_no, status, current_step, current_handler, current_handler_role, deadline, version)
    VALUES (@id, @order_no, @address, @resident_name, @resident_phone, @resident_id_card, @gas_meter_no, @status, @current_step, @current_handler, @current_handler_role, @deadline, @version)
  `)

  const insertHI = db.prepare(`
    INSERT INTO home_inspections (order_id, inspector, inspection_date, inspection_result, anomalies, submitted, created_at, updated_at)
    VALUES (@order_id, @inspector, @inspection_date, @inspection_result, @anomalies, @submitted, @created_at, @updated_at)
  `)

  const insertHR = db.prepare(`
    INSERT INTO hazard_rectifications (order_id, hazard_level, rectification_measures, rectification_date, completed, approved, created_at, updated_at)
    VALUES (@order_id, @hazard_level, @rectification_measures, @rectification_date, @completed, @approved, @created_at, @updated_at)
  `)

  const insertRC = db.prepare(`
    INSERT INTO recheck_closures (order_id, recheck_result, recheck_date, closed, confirmed, created_at, updated_at)
    VALUES (@order_id, @recheck_result, @recheck_date, @closed, @confirmed, @created_at, @updated_at)
  `)

  const insertRecord = db.prepare(`
    INSERT INTO processing_records (order_id, step, action, handler, handler_role, remark, anomaly_reason, created_at)
    VALUES (@order_id, @step, @action, @handler, @handler_role, @remark, @anomaly_reason, @created_at)
  `)

  const seed = db.transaction(() => {
    for (const o of orders) {
      insertOrder.run(o)
    }

    insertRecord.run({ order_id: 'ORD-2026-001', step: 'home_inspection', action: 'create', handler: '坐席-张三', handler_role: 'agent', remark: '创建安检工单', anomaly_reason: null, created_at: nowStr })
    insertRecord.run({ order_id: 'ORD-2026-002', step: 'home_inspection', action: 'create', handler: '坐席-张三', handler_role: 'agent', remark: '创建安检工单', anomaly_reason: null, created_at: nowStr })

    insertHI.run({
      order_id: 'ORD-2026-003', inspector: '坐席-张三', inspection_date: fmt(addDays(now, -3)),
      inspection_result: 'unqualified', anomalies: '橡胶软管老化龟裂，存在泄漏风险；燃气灶具已超过8年使用年限',
      submitted: 1, created_at: fmt(addDays(now, -3)), updated_at: fmt(addDays(now, -2))
    })
    insertRecord.run({ order_id: 'ORD-2026-003', step: 'home_inspection', action: 'create', handler: '坐席-张三', handler_role: 'agent', remark: '创建安检工单', anomaly_reason: null, created_at: fmt(addDays(now, -3)) })
    insertRecord.run({ order_id: 'ORD-2026-003', step: 'home_inspection', action: 'submit_inspection', handler: '坐席-张三', handler_role: 'agent', remark: '提交入户安检结果，发现2项隐患', anomaly_reason: null, created_at: fmt(addDays(now, -2)) })

    insertHI.run({
      order_id: 'ORD-2026-004', inspector: '坐席-张三', inspection_date: fmt(addDays(now, -2)),
      inspection_result: 'unqualified', anomalies: '热水器烟道未有效伸出室外，存在一氧化碳中毒风险',
      submitted: 1, created_at: fmt(addDays(now, -2)), updated_at: fmt(addDays(now, -1))
    })
    insertRecord.run({ order_id: 'ORD-2026-004', step: 'home_inspection', action: 'create', handler: '坐席-张三', handler_role: 'agent', remark: '创建安检工单', anomaly_reason: null, created_at: fmt(addDays(now, -2)) })
    insertRecord.run({ order_id: 'ORD-2026-004', step: 'home_inspection', action: 'submit_inspection', handler: '坐席-张三', handler_role: 'agent', remark: '提交入户安检结果，发现1项重大隐患', anomaly_reason: null, created_at: fmt(addDays(now, -1)) })

    insertHI.run({
      order_id: 'ORD-2026-005', inspector: '坐席-张三', inspection_date: fmt(addDays(now, -10)),
      inspection_result: 'unqualified', anomalies: '灶具连接管老化，建议更换',
      submitted: 1, created_at: fmt(addDays(now, -10)), updated_at: fmt(addDays(now, -9))
    })
    insertRecord.run({ order_id: 'ORD-2026-005', step: 'home_inspection', action: 'create', handler: '坐席-张三', handler_role: 'agent', remark: '创建安检工单', anomaly_reason: null, created_at: fmt(addDays(now, -10)) })
    insertRecord.run({ order_id: 'ORD-2026-005', step: 'home_inspection', action: 'submit_inspection', handler: '坐席-张三', handler_role: 'agent', remark: '提交入户安检结果', anomaly_reason: null, created_at: fmt(addDays(now, -9)) })
    insertRecord.run({ order_id: 'ORD-2026-005', step: 'hazard_rectification', action: 'approve', handler: '主管-李四', handler_role: 'supervisor', remark: '审批通过，进入隐患整改阶段', anomaly_reason: null, created_at: fmt(addDays(now, -8)) })

    insertHR.run({
      order_id: 'ORD-2026-005', hazard_level: 'medium', rectification_measures: '更换不锈钢波纹管',
      rectification_date: fmt(addDays(now, -6)), completed: 1, approved: 1,
      created_at: fmt(addDays(now, -8)), updated_at: fmt(addDays(now, -6))
    })
    insertRecord.run({ order_id: 'ORD-2026-005', step: 'recheck_closure', action: 'confirm', handler: '负责人-王五', handler_role: 'manager', remark: '确认整改完成，进入复查闭环', anomaly_reason: null, created_at: fmt(addDays(now, -5)) })

    insertRC.run({
      order_id: 'ORD-2026-005', recheck_result: 'pass', recheck_date: fmt(addDays(now, -4)),
      closed: 1, confirmed: 1, created_at: fmt(addDays(now, -5)), updated_at: fmt(addDays(now, -4))
    })
    insertRecord.run({ order_id: 'ORD-2026-005', step: 'recheck_closure', action: 'close', handler: '负责人-王五', handler_role: 'manager', remark: '复查合格，工单关闭', anomaly_reason: null, created_at: fmt(addDays(now, -4)) })

    insertHI.run({
      order_id: 'ORD-2026-006', inspector: '坐席-张三', inspection_date: fmt(addDays(now, -12)),
      inspection_result: 'unqualified', anomalies: '户外引入管锈蚀严重，需更换',
      submitted: 1, created_at: fmt(addDays(now, -12)), updated_at: fmt(addDays(now, -11))
    })
    insertRecord.run({ order_id: 'ORD-2026-006', step: 'home_inspection', action: 'create', handler: '坐席-张三', handler_role: 'agent', remark: '创建安检工单', anomaly_reason: null, created_at: fmt(addDays(now, -12)) })
    insertRecord.run({ order_id: 'ORD-2026-006', step: 'home_inspection', action: 'submit_inspection', handler: '坐席-张三', handler_role: 'agent', remark: '提交入户安检结果', anomaly_reason: null, created_at: fmt(addDays(now, -11)) })
    insertRecord.run({ order_id: 'ORD-2026-006', step: 'hazard_rectification', action: 'approve', handler: '主管-李四', handler_role: 'supervisor', remark: '审批通过', anomaly_reason: null, created_at: fmt(addDays(now, -10)) })

    insertHR.run({
      order_id: 'ORD-2026-006', hazard_level: 'high', rectification_measures: '更换镀锌钢管引入管',
      rectification_date: fmt(addDays(now, -8)), completed: 1, approved: 1,
      created_at: fmt(addDays(now, -10)), updated_at: fmt(addDays(now, -8))
    })
    insertRecord.run({ order_id: 'ORD-2026-006', step: 'recheck_closure', action: 'confirm', handler: '负责人-王五', handler_role: 'manager', remark: '确认整改完成，进入复查闭环', anomaly_reason: null, created_at: fmt(addDays(now, -7)) })

    insertRC.run({
      order_id: 'ORD-2026-006', recheck_result: 'pass', recheck_date: fmt(addDays(now, -6)),
      closed: 1, confirmed: 1, created_at: fmt(addDays(now, -7)), updated_at: fmt(addDays(now, -6))
    })
    insertRecord.run({ order_id: 'ORD-2026-006', step: 'recheck_closure', action: 'close', handler: '负责人-王五', handler_role: 'manager', remark: '复查合格，工单关闭', anomaly_reason: null, created_at: fmt(addDays(now, -6)) })

    insertHI.run({
      order_id: 'ORD-2026-007', inspector: '坐席-张三', inspection_date: fmt(addDays(now, -7)),
      inspection_result: 'unqualified', anomalies: '立管三通接口处检测到微量泄漏',
      submitted: 1, created_at: fmt(addDays(now, -7)), updated_at: fmt(addDays(now, -6))
    })
    insertRecord.run({ order_id: 'ORD-2026-007', step: 'home_inspection', action: 'create', handler: '坐席-张三', handler_role: 'agent', remark: '创建安检工单', anomaly_reason: null, created_at: fmt(addDays(now, -7)) })
    insertRecord.run({ order_id: 'ORD-2026-007', step: 'home_inspection', action: 'submit_inspection', handler: '坐席-张三', handler_role: 'agent', remark: '提交入户安检结果，发现管道接口泄漏', anomaly_reason: null, created_at: fmt(addDays(now, -6)) })
    insertRecord.run({ order_id: 'ORD-2026-007', step: 'hazard_rectification', action: 'approve', handler: '主管-李四', handler_role: 'supervisor', remark: '审批通过，进入隐患整改阶段', anomaly_reason: null, created_at: fmt(addDays(now, -5)) })

    insertHR.run({
      order_id: 'ORD-2026-007', hazard_level: 'high', rectification_measures: '更换三通接头并做密封处理',
      rectification_date: fmt(addDays(now, -3)), completed: 1, approved: 1,
      created_at: fmt(addDays(now, -5)), updated_at: fmt(addDays(now, -3))
    })
    insertRecord.run({ order_id: 'ORD-2026-007', step: 'recheck_closure', action: 'confirm', handler: '负责人-王五', handler_role: 'manager', remark: '确认整改完成，进入复查闭环', anomaly_reason: null, created_at: fmt(addDays(now, -2)) })
  })

  seed()
  console.log('种子数据已插入')
}

function validateAction(order: any, action: string, role: string, handler: string, version: number, body: any): string | null {
  if (!action) return '缺少必要参数: action'

  const requiredRole = ACTION_ROLE_MAP[action]
  if (!requiredRole) return `不支持的操作: ${action}`
  if (role !== requiredRole) return `角色无权执行此操作: ${action} 需要 ${requiredRole} 角色，当前为 ${role} 角色`

  if (order.current_handler !== handler) return `当前处理人不匹配: 工单当前处理人为 ${order.current_handler}，请求处理人为 ${handler}`

  const validStatuses = ACTION_STATUS_MAP[action]
  if (!validStatuses.includes(order.status)) return `工单状态不允许此操作: ${action} 要求状态为 ${validStatuses.join('/')}，当前状态为 ${order.status}`

  const validSteps = ACTION_STEP_MAP[action]
  if (validSteps && !validSteps.includes(order.current_step)) return `当前步骤不允许此操作: ${action} 要求步骤为 ${validSteps.join('/')}，当前步骤为 ${order.current_step}`

  if (order.version !== version) return `版本冲突: 工单版本为 ${order.version}，请求版本为 ${version}`

  if (order.status === 'completed') return '工单已完成，无法操作'

  if (action === 'approve' && order.current_step === 'hazard_rectification') {
    const hi = db.prepare('SELECT id, submitted FROM home_inspections WHERE order_id = ? ORDER BY id DESC LIMIT 1').get(order.id) as any
    if (!hi || !hi.submitted) return '入户安检尚未提交，无法审批'
  }

  if (action === 'confirm' && order.current_step === 'recheck_closure') {
    const hr = db.prepare('SELECT id, completed FROM hazard_rectifications WHERE order_id = ? ORDER BY id DESC LIMIT 1').get(order.id) as any
    if (!hr || !hr.completed) return '隐患整改尚未完成，无法确认'
  }

  if (action === 'close' && order.current_step === 'recheck_closure') {
    const rc = db.prepare('SELECT id, closed FROM recheck_closures WHERE order_id = ? ORDER BY id DESC LIMIT 1').get(order.id) as any
    if (!rc || !rc.closed) return '复查尚未关闭，无法关闭工单'
  }

  const expiryStatus = getExpiryStatus(order.deadline)
  if ((action === 'submit_inspection' || action === 'submit' || action === 'approve' || action === 'confirm') && expiryStatus === 'overdue') {
    return '工单已逾期，需先申请延期后再操作'
  }

  if (action === 'submit_inspection' || action === 'submit') {
    const hi = body?.home_inspection || {}
    if (!hi.inspector || String(hi.inspector).trim() === '') return '请填写安检员'
    if (!hi.inspection_date || String(hi.inspection_date).trim() === '') return '请填写安检日期'
    if (!hi.inspection_result || String(hi.inspection_result).trim() === '') return '请选择安检结果'

    const hasAnomalyText = hi.anomalies && String(hi.anomalies).trim() !== ''
    const hasEvidence = body?.evidence && (
      (Array.isArray(body.evidence.evidence_photos) && body.evidence.evidence_photos.length > 0) ||
      (Array.isArray(body.evidence.attachments) && body.evidence.attachments.length > 0)
    )
    const hasAttachments = Array.isArray(body?.attachments) && body.attachments.length > 0
    const hasHiPhotos = Array.isArray(hi?.evidence_photos) && hi.evidence_photos.length > 0
    const hasAnomalyReason = body?.anomaly_reason && String(body.anomaly_reason).trim() !== ''

    if (hi.inspection_result === 'unqualified' || hasAnomalyText) {
      if (!hasAnomalyText && !hasEvidence && !hasAttachments && !hasHiPhotos && !hasAnomalyReason) {
        return '发现异常时必须填写异常情况或上传证据'
      }
    }
  }

  if (action === 'approve') {
    const hr = body?.hazard_rectification || {}
    if (!hr.hazard_level || String(hr.hazard_level).trim() === '') return '请填写隐患等级'
    if (!hr.rectification_measures || String(hr.rectification_measures).trim() === '') return '请填写整改措施'
    if (!hr.rectification_date || String(hr.rectification_date).trim() === '') return '请填写整改日期'
  }

  if (action === 'confirm') {
    const rc = body?.recheck_closure || {}
    if (!rc.recheck_result || String(rc.recheck_result).trim() === '') return '请选择复查结果'
    if (!rc.recheck_date || String(rc.recheck_date).trim() === '') return '请填写复查日期'

    if (rc.recheck_result === 'fail') {
      const hasReason = (body?.anomaly_reason && String(body.anomaly_reason).trim() !== '') ||
        (body?.remark && String(body.remark).trim() !== '')
      if (!hasReason) return '复查未通过请填写异常原因'
    }
  }

  if (action === 'reject') {
    const hasReason = (body?.anomaly_reason && String(body.anomaly_reason).trim() !== '') ||
      (body?.remark && String(body.remark).trim() !== '')
    if (!hasReason) return '驳回必须填写原因'
  }

  if (action === 'return') {
    const hasReason = (body?.anomaly_reason && String(body.anomaly_reason).trim() !== '') ||
      (body?.remark && String(body.remark).trim() !== '')
    if (!hasReason) return '退回必须填写原因'
  }

  return null
}

function executeAction(order: any, action: string, handler: string, role: string, body: any) {
  const nowStr = fmt(new Date())
  const remark = body.remark || null
  const anomalyReason = body.anomaly_reason || body.anomalyReason || null
  const expectedVersion = order.version

  const checkUpdate = (result: any, actionName: string) => {
    if (!result || result.changes === 0) {
      throw new Error(`版本冲突或已被他人处理: ${actionName}，请刷新后重试`)
    }
  }

  const insertAttachmentStmt = db.prepare(`
    INSERT INTO attachments (order_id, step, file_name, file_type, file_data, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `)

  const saveAttachments = (attachments: any[], step: string) => {
    if (!Array.isArray(attachments)) return
    for (const att of attachments) {
      if (!att) continue
      const fileName = att.file_name || att.name || `attachment_${Date.now()}`
      const fileType = att.file_type || att.type || ''
      const fileData = att.file_data || att.data || (typeof att === 'string' ? att : '')
      insertAttachmentStmt.run(order.id, step, fileName, fileType, fileData, nowStr)
    }
  }

  const saveEvidencePhotos = (photos: any[], step: string) => {
    if (!Array.isArray(photos)) return
    for (let i = 0; i < photos.length; i++) {
      const p = photos[i]
      if (!p) continue
      const fileName = `evidence_${step}_${i + 1}_${Date.now()}.jpg`
      const fileData = typeof p === 'string' ? p : (p.file_data || p.data || p.url || '')
      insertAttachmentStmt.run(order.id, step, fileName, 'image/jpeg', fileData, nowStr)
    }
  }

  const currentStep = order.current_step

  if (Array.isArray(body.attachments)) {
    saveAttachments(body.attachments, currentStep)
  }

  if (body.home_inspection && Array.isArray(body.home_inspection.evidence_photos)) {
    saveEvidencePhotos(body.home_inspection.evidence_photos, 'home_inspection')
  }

  if (body.hazard_rectification && Array.isArray(body.hazard_rectification.evidence_photos)) {
    saveEvidencePhotos(body.hazard_rectification.evidence_photos, 'hazard_rectification')
  }

  if (body.recheck_closure && Array.isArray(body.recheck_closure.evidence_photos)) {
    saveEvidencePhotos(body.recheck_closure.evidence_photos, 'recheck_closure')
  }

  if (body.evidence) {
    if (Array.isArray(body.evidence.evidence_photos)) {
      saveEvidencePhotos(body.evidence.evidence_photos, currentStep)
    }
    if (Array.isArray(body.evidence.attachments)) {
      saveAttachments(body.evidence.attachments, currentStep)
    }
  }

  if (action === 'submit_inspection' || action === 'submit') {
    const hi = body.home_inspection || {}
    db.prepare(`
      INSERT INTO home_inspections (order_id, inspector, inspection_date, inspection_result, anomalies, submitted, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 1, ?, ?)
    `).run(
      order.id,
      hi.inspector || handler,
      hi.inspection_date || nowStr,
      hi.inspection_result || 'qualified',
      hi.anomalies || anomalyReason || '',
      nowStr, nowStr
    )
    const r = db.prepare(`
      UPDATE safety_orders SET status = 'under_review', current_step = 'hazard_rectification',
        current_handler = '主管-李四', current_handler_role = 'supervisor',
        version = version + 1, updated_at = ?
      WHERE id = ? AND version = ?
    `).run(nowStr, order.id, expectedVersion)
    checkUpdate(r, '提交安检')
  }

  if (action === 'approve') {
    const hr = body.hazard_rectification || {}
    db.prepare(`
      INSERT INTO hazard_rectifications (order_id, hazard_level, rectification_measures, rectification_date, completed, approved, created_at, updated_at)
      VALUES (?, ?, ?, ?, 1, 1, ?, ?)
    `).run(
      order.id,
      hr.hazard_level || 'medium',
      hr.rectification_measures || '已审批通过',
      hr.rectification_date || nowStr,
      nowStr, nowStr
    )
    const r = db.prepare(`
      UPDATE safety_orders SET current_step = 'recheck_closure',
        current_handler = '负责人-王五', current_handler_role = 'manager',
        version = version + 1, updated_at = ?
      WHERE id = ? AND version = ?
    `).run(nowStr, order.id, expectedVersion)
    checkUpdate(r, '审核通过')
  }

  if (action === 'reject') {
    const hr = db.prepare('SELECT id FROM hazard_rectifications WHERE order_id = ? ORDER BY id DESC LIMIT 1').get(order.id) as any
    if (hr) {
      db.prepare('UPDATE hazard_rectifications SET approved = 0, updated_at = ? WHERE id = ?').run(nowStr, hr.id)
    }
    const r = db.prepare(`
      UPDATE safety_orders SET status = 'pending_correction', current_step = 'home_inspection',
        current_handler = '坐席-张三', current_handler_role = 'agent',
        version = version + 1, updated_at = ?
      WHERE id = ? AND version = ?
    `).run(nowStr, order.id, expectedVersion)
    checkUpdate(r, '驳回')
  }

  if (action === 'confirm') {
    const rc = body.recheck_closure || {}
    db.prepare(`
      INSERT INTO recheck_closures (order_id, recheck_result, recheck_date, closed, confirmed, created_at, updated_at)
      VALUES (?, ?, ?, 1, 1, ?, ?)
    `).run(
      order.id,
      rc.recheck_result || 'pass',
      rc.recheck_date || nowStr,
      nowStr, nowStr
    )
    if (order.current_step === 'recheck_closure') {
      const r = db.prepare(`
        UPDATE safety_orders SET status = 'completed',
          version = version + 1, updated_at = ?
        WHERE id = ? AND version = ?
      `).run(nowStr, order.id, expectedVersion)
      checkUpdate(r, '确认办结')
    } else {
      const r = db.prepare(`
        UPDATE safety_orders SET
          version = version + 1, updated_at = ?
        WHERE id = ? AND version = ?
      `).run(nowStr, order.id, expectedVersion)
      checkUpdate(r, '确认')
    }
  }

  if (action === 'return') {
    if (order.current_step === 'recheck_closure') {
      const r = db.prepare(`
        UPDATE safety_orders SET status = 'under_review', current_step = 'hazard_rectification',
          current_handler = '主管-李四', current_handler_role = 'supervisor',
          version = version + 1, updated_at = ?
        WHERE id = ? AND version = ?
      `).run(nowStr, order.id, expectedVersion)
      checkUpdate(r, '退回整改')
    } else {
      const r = db.prepare(`
        UPDATE safety_orders SET status = 'pending_correction', current_step = 'home_inspection',
          current_handler = '坐席-张三', current_handler_role = 'agent',
          version = version + 1, updated_at = ?
        WHERE id = ? AND version = ?
      `).run(nowStr, order.id, expectedVersion)
      checkUpdate(r, '退回')
    }
  }

  if (action === 'close') {
    const r = db.prepare(`
      UPDATE safety_orders SET status = 'completed',
        version = version + 1, updated_at = ?
      WHERE id = ? AND version = ?
    `).run(nowStr, order.id, expectedVersion)
    checkUpdate(r, '关闭工单')
  }

  db.prepare(`
    INSERT INTO processing_records (order_id, step, action, handler, handler_role, remark, anomaly_reason, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(order.id, order.current_step, action, handler, role, remark, anomalyReason, nowStr)
}

function processSingleOrder(order: any, action: string, role: string, handler: string, version: number, body: any): { ok: boolean; error?: string } {
  if (!order) return { ok: false, error: '工单不存在' }

  if (role !== order.current_handler_role) {
    return { ok: false, error: `越权操作: 当前角色为${role}，工单需要${order.current_handler_role}角色处理` }
  }
  if (handler !== order.current_handler) {
    return { ok: false, error: `处理人不匹配: ${handler} ≠ ${order.current_handler}` }
  }

  const mergedBody = { ...(body || {}) }
  const nowStr = fmt(new Date())

  if ((action === 'submit_inspection' || action === 'submit') && !mergedBody.home_inspection) {
    const hi = db.prepare('SELECT * FROM home_inspections WHERE order_id = ? ORDER BY id DESC LIMIT 1').get(order.id) as any
    if (hi) {
      mergedBody.home_inspection = {
        inspector: hi.inspector,
        inspection_date: hi.inspection_date || nowStr,
        inspection_result: hi.inspection_result || 'qualified',
        anomalies: hi.anomalies || '',
      }
    } else {
      mergedBody.home_inspection = {
        inspector: handler,
        inspection_date: nowStr,
        inspection_result: 'qualified',
        anomalies: '',
      }
    }
  }

  if (action === 'approve' && !mergedBody.hazard_rectification) {
    const hr = db.prepare('SELECT * FROM hazard_rectifications WHERE order_id = ? ORDER BY id DESC LIMIT 1').get(order.id) as any
    if (hr) {
      mergedBody.hazard_rectification = {
        hazard_level: hr.hazard_level || 'medium',
        rectification_measures: hr.rectification_measures || '已审批通过',
        rectification_date: hr.rectification_date || nowStr,
      }
    } else {
      mergedBody.hazard_rectification = {
        hazard_level: 'medium',
        rectification_measures: '已审批通过',
        rectification_date: nowStr,
      }
    }
  }

  if (action === 'confirm' && !mergedBody.recheck_closure) {
    const rc = db.prepare('SELECT * FROM recheck_closures WHERE order_id = ? ORDER BY id DESC LIMIT 1').get(order.id) as any
    if (rc) {
      mergedBody.recheck_closure = {
        recheck_result: rc.recheck_result || 'pass',
        recheck_date: rc.recheck_date || nowStr,
      }
    } else {
      mergedBody.recheck_closure = {
        recheck_result: 'pass',
        recheck_date: nowStr,
      }
    }
  }

  const error = validateAction(order, action, role, handler, version, mergedBody)
  if (error) return { ok: false, error }

  try {
    const tx = db.transaction(() => executeAction(order, action, handler, role, mergedBody))
    tx()
    return { ok: true }
  } catch (e: any) {
    return { ok: false, error: e.message || '操作失败' }
  }
}

function getOrderDetail(id: string) {
  const order = db.prepare('SELECT * FROM safety_orders WHERE id = ?').get(id) as any
  if (!order) return null

  const hi = db.prepare('SELECT * FROM home_inspections WHERE order_id = ? ORDER BY id DESC LIMIT 1').get(id) as any
  const hr = db.prepare('SELECT * FROM hazard_rectifications WHERE order_id = ? ORDER BY id DESC LIMIT 1').get(id) as any
  const rc = db.prepare('SELECT * FROM recheck_closures WHERE order_id = ? ORDER BY id DESC LIMIT 1').get(id) as any
  const records = db.prepare('SELECT * FROM processing_records WHERE order_id = ? ORDER BY id').all(id) as any[]
  const attachments = db.prepare('SELECT * FROM attachments WHERE order_id = ? ORDER BY id').all(id) as any[]

  return {
    ...mapOrderToApi(order),
    home_inspection: hi ? mapHomeInspection(hi) : null,
    hazard_rectification: hr ? mapHazardRectification(hr) : null,
    recheck_closure: rc ? mapRecheckClosure(rc) : null,
    processing_records: records.map(mapProcessingRecord),
    attachments: attachments.map(mapAttachment),
  }
}

const app = new Hono()

app.use('*', cors({
  origin: 'http://localhost:3004',
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}))

app.get('/api/health', (c) => c.json({ status: 'ok' }))

app.get('/api/orders/stats', (c) => {
  const rows = db.prepare('SELECT status, deadline, current_handler FROM safety_orders').all() as any[]

  let pending_correction = 0
  let under_review = 0
  let completed = 0
  let normal = 0
  let near_expiry = 0
  let overdue = 0
  const handlerMap: Record<string, number> = {}

  for (const row of rows) {
    if (row.status === 'pending_correction') pending_correction++
    else if (row.status === 'under_review') under_review++
    else if (row.status === 'completed') completed++

    const exp = getExpiryStatus(row.deadline)
    if (exp === 'normal') normal++
    else if (exp === 'near_expiry') near_expiry++
    else if (exp === 'overdue') overdue++

    if (row.current_handler) {
      handlerMap[row.current_handler] = (handlerMap[row.current_handler] || 0) + 1
    }
  }

  const by_handler = Object.entries(handlerMap).map(([handler, count]) => ({ handler, count }))

  return c.json({ pending_correction, under_review, completed, normal, near_expiry, overdue, by_handler })
})

app.get('/api/orders', (c) => {
  const { status, handler, expiry_status, keyword } = c.req.query()

  let sql = 'SELECT * FROM safety_orders WHERE 1=1'
  const params: any[] = []

  if (status) { sql += ' AND status = ?'; params.push(status) }
  if (handler) { sql += ' AND current_handler = ?'; params.push(handler) }
  if (keyword) {
    sql += ' AND (order_no LIKE ? OR address LIKE ? OR resident_name LIKE ? OR gas_meter_no LIKE ?)'
    const kw = `%${keyword}%`
    params.push(kw, kw, kw, kw)
  }

  sql += ' ORDER BY created_at DESC'

  let rows = db.prepare(sql).all(...params) as any[]

  if (expiry_status) {
    rows = rows.filter(r => getExpiryStatus(r.deadline) === expiry_status)
  }

  return c.json(rows.map(mapOrderToApi))
})

app.get('/api/orders/:id', (c) => {
  const { id } = c.req.param()
  const detail = getOrderDetail(id)
  if (!detail) return c.json({ error: '工单不存在' }, 404)
  return c.json(detail)
})

app.post('/api/orders', (c) => {
  return (async () => {
    const body = await c.req.json()
    const { address, deadline } = body
    const inspector = body.inspector || '坐席-张三'

    if (!address || !deadline) {
      return c.json({ error: '缺少必要字段: address, deadline' }, 400)
    }

    const nowStr = fmt(new Date())
    const count = (db.prepare("SELECT COUNT(*) as c FROM safety_orders WHERE date(created_at) = date('now', 'localtime')").get() as any).c + 1
    const id = `ORD-${new Date().getFullYear()}-${String(count).padStart(3, '0')}`
    const orderNo = `AQ-${nowStr.slice(0, 10).replace(/-/g, '')}-${String(count).padStart(3, '0')}`

    const currentHandler = '坐席-张三'
    const currentHandlerRole = 'agent'

    db.prepare(`
      INSERT INTO safety_orders (id, order_no, address, status, current_step, current_handler, current_handler_role, deadline, version)
      VALUES (?, ?, ?, 'pending_correction', 'home_inspection', ?, ?, ?, 1)
    `).run(id, orderNo, address, currentHandler, currentHandlerRole, deadline)

    db.prepare(`
      INSERT INTO processing_records (order_id, step, action, handler, handler_role, remark, anomaly_reason, created_at)
      VALUES (?, 'home_inspection', 'create', ?, ?, '创建安检工单', NULL, ?)
    `).run(id, currentHandler, currentHandlerRole, nowStr)

    const detail = getOrderDetail(id)
    return c.json(detail, 201)
  })()
})

app.post('/api/orders/:id/action', (c) => {
  const { id } = c.req.param()

  return (async () => {
    const body = await c.req.json()
    const order = db.prepare('SELECT * FROM safety_orders WHERE id = ?').get(id) as any
    if (!order) return c.json({ error: '工单不存在' }, 404)

    const action = body.action
    const version = body.version
    const requestRole = body.role
    const requestHandler = body.handler

    if (!action) return c.json({ error: '缺少必要参数: action' }, 400)
    if (version === undefined) return c.json({ error: '缺少必要参数: version' }, 400)
    if (!requestRole) return c.json({ error: '缺少必要参数: role' }, 400)
    if (!requestHandler) return c.json({ error: '缺少必要参数: handler' }, 400)

    const result = processSingleOrder(order, action, requestRole, requestHandler, version, body)
    if (!result.ok) {
      const isAuth = (result.error || '').includes('越权') || (result.error || '').includes('不匹配')
      return c.json({ error: result.error }, isAuth ? 403 : 400)
    }

    const detail = getOrderDetail(id)
    return c.json(detail)
  })()
})

app.post('/api/orders/batch', (c) => {
  return (async () => {
    const { order_ids, action, remark, anomaly_reason, role: requestRole, handler: requestHandler } = await c.req.json()

    if (!order_ids || !Array.isArray(order_ids) || !action) {
      return c.json({ error: '缺少必要参数: order_ids, action' }, 400)
    }
    if (!requestRole || !requestHandler) {
      return c.json({ error: '缺少必要参数: role, handler' }, 400)
    }

    const results: { order_id: string; order_no: string; success: boolean; message: string }[] = []
    const batchBody = { remark: remark || null, anomaly_reason: anomaly_reason || null }

    for (const orderId of order_ids) {
      const order = db.prepare('SELECT * FROM safety_orders WHERE id = ?').get(orderId) as any
      if (!order) {
        results.push({ order_id: orderId, order_no: '', success: false, message: '工单不存在' })
        continue
      }
      const version = order.version
      const result = processSingleOrder(order, action, requestRole, requestHandler, version, batchBody)
      results.push({
        order_id: orderId,
        order_no: order.order_no,
        success: result.ok,
        message: result.ok ? '' : (result.error || '操作失败')
      })
    }

    const successCount = results.filter(r => r.success).length
    const failedCount = results.filter(r => !r.success).length

    return c.json({
      total: results.length,
      success: successCount,
      failed: failedCount,
      results
    })
  })()
})

const port = 8004
serve({
  fetch: app.fetch,
  port,
}, (info) => {
  console.log(`服务器已启动，监听端口: ${info.port}`)
})

export default app
