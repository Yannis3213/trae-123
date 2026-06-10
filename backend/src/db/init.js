const db = require('./database');
const { STATUS, ROLES } = require('../config');

function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS workorders (
      id TEXT PRIMARY KEY,
      code TEXT UNIQUE NOT NULL,
      title TEXT NOT NULL,
      product_name TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      unit TEXT DEFAULT '件',
      status TEXT NOT NULL DEFAULT '${STATUS.PENDING_CORRECTION}',
      current_handler_role TEXT,
      current_handler TEXT,
      version INTEGER NOT NULL DEFAULT 1,
      deadline TEXT,
      planner TEXT,
      workshop_director TEXT,
      factory_manager TEXT,
      production_schedule json,
      material_issue json,
      completion_report json,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      completed_at TEXT
    );

    CREATE TABLE IF NOT EXISTS attachments (
      id TEXT PRIMARY KEY,
      workorder_id TEXT NOT NULL,
      type TEXT NOT NULL,
      name TEXT NOT NULL,
      url TEXT,
      uploaded_by TEXT NOT NULL,
      uploaded_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (workorder_id) REFERENCES workorders(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS processing_records (
      id TEXT PRIMARY KEY,
      workorder_id TEXT NOT NULL,
      action TEXT NOT NULL,
      from_status TEXT,
      to_status TEXT,
      operator_role TEXT NOT NULL,
      operator TEXT NOT NULL,
      remark TEXT,
      evidence json,
      version_before INTEGER,
      version_after INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (workorder_id) REFERENCES workorders(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS audit_notes (
      id TEXT PRIMARY KEY,
      workorder_id TEXT NOT NULL,
      content TEXT NOT NULL,
      author_role TEXT NOT NULL,
      author TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (workorder_id) REFERENCES workorders(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS exceptions (
      id TEXT PRIMARY KEY,
      workorder_id TEXT NOT NULL,
      type TEXT NOT NULL,
      reason TEXT NOT NULL,
      node TEXT,
      responsible_role TEXT,
      responsible_person TEXT,
      resolved INTEGER DEFAULT 0,
      resolved_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (workorder_id) REFERENCES workorders(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_workorders_status ON workorders(status);
    CREATE INDEX IF NOT EXISTS idx_workorders_planner ON workorders(planner);
    CREATE INDEX IF NOT EXISTS idx_workorders_deadline ON workorders(deadline);
    CREATE INDEX IF NOT EXISTS idx_attachments_workorder ON attachments(workorder_id);
    CREATE INDEX IF NOT EXISTS idx_records_workorder ON processing_records(workorder_id);
    CREATE INDEX IF NOT EXISTS idx_audit_workorder ON audit_notes(workorder_id);
    CREATE INDEX IF NOT EXISTS idx_exceptions_workorder ON exceptions(workorder_id);
  `);

  console.log('数据库表结构初始化完成');
}

function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day} 18:00:00`;
}

function addDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function seedData() {
  const count = db.prepare('SELECT COUNT(*) as cnt FROM workorders').get().cnt;
  if (count > 0) {
    console.log('数据已存在，跳过初始化');
    return;
  }

  const now = new Date();
  const dateOverdue = formatDate(addDays(now, -2));
  const dateOverdue2 = formatDate(addDays(now, -5));
  const dateWarning = formatDate(addDays(now, 2));
  const dateWarning2 = formatDate(addDays(now, 1));
  const dateNormal = formatDate(addDays(now, 10));
  const dateNormal2 = formatDate(addDays(now, 15));
  const dateCompleted = formatDate(addDays(now, -3));

  const insertWorkorder = db.prepare(`
    INSERT INTO workorders (
      id, code, title, product_name, quantity, unit, status,
      current_handler_role, current_handler, version, deadline,
      planner, workshop_director, factory_manager
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertRecord = db.prepare(`
    INSERT INTO processing_records (
      id, workorder_id, action, from_status, to_status,
      operator_role, operator, remark, evidence, version_before, version_after
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const workorders = [
    {
      id: 'wo_001',
      code: 'WO-DEMO-001',
      title: 'A型号齿轮生产工单（待补正-正常）',
      product_name: 'A型齿轮',
      quantity: 500,
      unit: '件',
      status: STATUS.PENDING_CORRECTION,
      current_handler_role: ROLES.PLANNER,
      current_handler: '张伟',
      deadline: dateNormal,
      planner: '张伟',
      workshop_director: '李明',
      factory_manager: '王强'
    },
    {
      id: 'wo_002',
      code: 'WO-DEMO-002',
      title: 'B型号轴承生产工单（复核中-临期）',
      product_name: 'B型轴承',
      quantity: 1200,
      unit: '套',
      status: STATUS.UNDER_REVIEW,
      current_handler_role: ROLES.WORKSHOP_DIRECTOR,
      current_handler: '李明',
      deadline: dateWarning,
      planner: '张伟',
      workshop_director: '李明',
      factory_manager: '王强'
    },
    {
      id: 'wo_003',
      code: 'WO-DEMO-003',
      title: 'C型号外壳生产工单（已办结）',
      product_name: 'C型外壳',
      quantity: 300,
      unit: '件',
      status: STATUS.COMPLETED,
      current_handler_role: null,
      current_handler: null,
      deadline: dateCompleted,
      planner: '张伟',
      workshop_director: '李明',
      factory_manager: '王强',
      completed_at: formatDate(addDays(now, -4)).replace('18:00:00', '16:30:00')
    },
    {
      id: 'wo_004',
      code: 'WO-DEMO-004',
      title: 'D型号轴杆生产工单（待补正-逾期）',
      product_name: 'D型轴杆',
      quantity: 800,
      unit: '根',
      status: STATUS.PENDING_CORRECTION,
      current_handler_role: ROLES.PLANNER,
      current_handler: '刘芳',
      deadline: dateOverdue,
      planner: '刘芳',
      workshop_director: '陈刚',
      factory_manager: '王强'
    },
    {
      id: 'wo_005',
      code: 'WO-DEMO-005',
      title: 'E型号法兰盘生产工单（复核中-正常）',
      product_name: 'E型法兰盘',
      quantity: 600,
      unit: '件',
      status: STATUS.UNDER_REVIEW,
      current_handler_role: ROLES.WORKSHOP_DIRECTOR,
      current_handler: '陈刚',
      deadline: dateNormal2,
      planner: '刘芳',
      workshop_director: '陈刚',
      factory_manager: '王强'
    },
    {
      id: 'wo_006',
      code: 'WO-DEMO-006',
      title: 'F型号密封圈生产工单（待补正-临期）',
      product_name: 'F型密封圈',
      quantity: 2000,
      unit: '个',
      status: STATUS.PENDING_CORRECTION,
      current_handler_role: ROLES.PLANNER,
      current_handler: '张伟',
      deadline: dateWarning2,
      planner: '张伟',
      workshop_director: '李明',
      factory_manager: '王强'
    },
    {
      id: 'wo_007',
      code: 'WO-DEMO-007',
      title: 'G型号弹簧生产工单（复核中-待厂务确认）',
      product_name: 'G型弹簧',
      quantity: 1500,
      unit: '个',
      status: STATUS.UNDER_REVIEW,
      current_handler_role: ROLES.FACTORY_MANAGER,
      current_handler: '王强',
      deadline: dateNormal,
      planner: '刘芳',
      workshop_director: '李明',
      factory_manager: '王强'
    },
    {
      id: 'wo_008',
      code: 'WO-DEMO-008',
      title: 'H型号刹车片生产工单（待补正-逾期严重）',
      product_name: 'H型刹车片',
      quantity: 400,
      unit: '副',
      status: STATUS.PENDING_CORRECTION,
      current_handler_role: ROLES.PLANNER,
      current_handler: '张伟',
      deadline: dateOverdue2,
      planner: '张伟',
      workshop_director: '陈刚',
      factory_manager: '王强'
    },
    {
      id: 'wo_009',
      code: 'WO-DEMO-009',
      title: 'I型号螺丝生产工单（复核中-逾期）',
      product_name: 'I型螺丝',
      quantity: 5000,
      unit: '个',
      status: STATUS.UNDER_REVIEW,
      current_handler_role: ROLES.WORKSHOP_DIRECTOR,
      current_handler: '陈刚',
      deadline: dateOverdue,
      planner: '刘芳',
      workshop_director: '陈刚',
      factory_manager: '王强'
    }
  ];

  for (const wo of workorders) {
    insertWorkorder.run(
      wo.id, wo.code, wo.title, wo.product_name, wo.quantity, wo.unit,
      wo.status, wo.current_handler_role, wo.current_handler, 1, wo.deadline,
      wo.planner, wo.workshop_director, wo.factory_manager
    );

    insertRecord.run(
      'rec_' + wo.id + '_01',
      wo.id,
      '创建工单',
      null,
      wo.status,
      ROLES.PLANNER,
      wo.planner,
      '系统创建生产工单',
      null,
      null,
      1
    );
  }

  const dateStr = (d) => d.toISOString().split('T')[0];
  const today = dateStr(now);
  const yesterday = dateStr(addDays(now, -1));
  const twoDaysAgo = dateStr(addDays(now, -2));

  const updateWoScheduled = db.prepare(`
    UPDATE workorders SET
      production_schedule = ?,
      updated_at = datetime('now')
    WHERE id = ?
  `);

  const scheduleData = JSON.stringify({
    start_date: yesterday,
    end_date: today,
    workshop: '第一车间',
    line: '2号线',
    shift: '白班',
    scheduled_by: '张伟',
    scheduled_at: twoDaysAgo + ' 09:30:00',
    remark: '按正常排产计划执行'
  });

  updateWoScheduled.run(scheduleData, 'wo_002');
  updateWoScheduled.run(scheduleData, 'wo_003');
  updateWoScheduled.run(scheduleData, 'wo_005');
  updateWoScheduled.run(scheduleData, 'wo_007');
  updateWoScheduled.run(scheduleData, 'wo_009');

  const updateWoMaterial = db.prepare(`
    UPDATE workorders SET
      material_issue = ?,
      updated_at = datetime('now')
    WHERE id = ?
  `);

  const materialData = JSON.stringify({
    issue_date: yesterday,
    warehouse: '原材料库A区',
    materials: [
      { name: '合金钢', quantity: 200, unit: 'kg' },
      { name: '润滑油', quantity: 10, unit: 'L' }
    ],
    issued_by: '王库管',
    received_by: '李明',
    remark: '材料齐全，已办理出库'
  });

  updateWoMaterial.run(materialData, 'wo_002');
  updateWoMaterial.run(materialData, 'wo_003');
  updateWoMaterial.run(materialData, 'wo_005');
  updateWoMaterial.run(materialData, 'wo_007');
  updateWoMaterial.run(materialData, 'wo_009');

  const updateWoCompletion = db.prepare(`
    UPDATE workorders SET
      completion_report = ?,
      updated_at = datetime('now')
    WHERE id = ?
  `);

  const completionData = JSON.stringify({
    completion_date: today,
    actual_quantity: 500,
    qualified_quantity: 495,
    defective_quantity: 5,
    inspector: '质检科-小赵',
    report_by: '李明',
    remark: '生产任务完成，合格率99%'
  });

  updateWoCompletion.run(completionData, 'wo_003');
  updateWoCompletion.run(completionData, 'wo_007');

  const insertException = db.prepare(`
    INSERT INTO exceptions (
      id, workorder_id, type, reason, node,
      responsible_role, responsible_person
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  insertException.run(
    'exc_001',
    'wo_004',
    'overdue',
    '工单已超过截止日期，未完成生产排程',
    '生产排程',
    ROLES.PLANNER,
    '刘芳'
  );

  insertException.run(
    'exc_002',
    'wo_008',
    'overdue',
    '工单已严重逾期，尚未安排生产',
    '生产排程',
    ROLES.PLANNER,
    '张伟'
  );

  insertException.run(
    'exc_003',
    'wo_009',
    'overdue',
    '工单已逾期，车间主任尚未复核',
    '车间复核',
    ROLES.WORKSHOP_DIRECTOR,
    '陈刚'
  );

  const insertAuditNote = db.prepare(`
    INSERT INTO audit_notes (
      id, workorder_id, content, author_role, author
    ) VALUES (?, ?, ?, ?, ?)
  `);

  insertAuditNote.run(
    'note_001',
    'wo_003',
    '该工单生产过程顺利，质量合格，已按期完成',
    ROLES.FACTORY_MANAGER,
    '王强'
  );

  insertAuditNote.run(
    'note_002',
    'wo_004',
    '请刘芳尽快处理该逾期工单，如有困难请及时反馈',
    ROLES.FACTORY_MANAGER,
    '王强'
  );

  console.log('示例数据初始化完成，共 ' + workorders.length + ' 条工单');
}

if (require.main === module) {
  initDatabase();
  seedData();
  console.log('数据库初始化完成');
}

module.exports = { initDatabase, seedData };
