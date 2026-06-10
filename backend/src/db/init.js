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

function seedData() {
  const count = db.prepare('SELECT COUNT(*) as cnt FROM workorders').get().cnt;
  if (count > 0) {
    console.log('数据已存在，跳过初始化');
    return;
  }

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
      code: 'WO-2026-0601',
      title: '6月A型号齿轮生产工单',
      product_name: 'A型齿轮',
      quantity: 500,
      unit: '件',
      status: STATUS.PENDING_CORRECTION,
      current_handler_role: ROLES.PLANNER,
      current_handler: '张伟',
      deadline: '2026-06-20 18:00:00',
      planner: '张伟',
      workshop_director: '李明',
      factory_manager: '王强'
    },
    {
      id: 'wo_002',
      code: 'WO-2026-0602',
      title: '6月B型号轴承生产工单',
      product_name: 'B型轴承',
      quantity: 1200,
      unit: '套',
      status: STATUS.UNDER_REVIEW,
      current_handler_role: ROLES.WORKSHOP_DIRECTOR,
      current_handler: '李明',
      deadline: '2026-06-15 18:00:00',
      planner: '张伟',
      workshop_director: '李明',
      factory_manager: '王强'
    },
    {
      id: 'wo_003',
      code: 'WO-2026-0603',
      title: '6月C型号外壳生产工单',
      product_name: 'C型外壳',
      quantity: 300,
      unit: '件',
      status: STATUS.COMPLETED,
      current_handler_role: null,
      current_handler: null,
      deadline: '2026-06-10 18:00:00',
      planner: '张伟',
      workshop_director: '李明',
      factory_manager: '王强',
      completed_at: '2026-06-09 16:30:00'
    },
    {
      id: 'wo_004',
      code: 'WO-2026-0604',
      title: '6月D型号轴杆生产工单',
      product_name: 'D型轴杆',
      quantity: 800,
      unit: '根',
      status: STATUS.PENDING_CORRECTION,
      current_handler_role: ROLES.PLANNER,
      current_handler: '刘芳',
      deadline: '2026-06-09 18:00:00',
      planner: '刘芳',
      workshop_director: '陈刚',
      factory_manager: '王强'
    },
    {
      id: 'wo_005',
      code: 'WO-2026-0605',
      title: '6月E型号法兰盘生产工单',
      product_name: 'E型法兰盘',
      quantity: 600,
      unit: '件',
      status: STATUS.UNDER_REVIEW,
      current_handler_role: ROLES.WORKSHOP_DIRECTOR,
      current_handler: '陈刚',
      deadline: '2026-06-12 18:00:00',
      planner: '刘芳',
      workshop_director: '陈刚',
      factory_manager: '王强'
    },
    {
      id: 'wo_006',
      code: 'WO-2026-0606',
      title: '6月F型号密封圈生产工单',
      product_name: 'F型密封圈',
      quantity: 2000,
      unit: '个',
      status: STATUS.PENDING_CORRECTION,
      current_handler_role: ROLES.PLANNER,
      current_handler: '张伟',
      deadline: '2026-07-05 18:00:00',
      planner: '张伟',
      workshop_director: '李明',
      factory_manager: '王强'
    },
    {
      id: 'wo_007',
      code: 'WO-2026-0607',
      title: '6月G型号弹簧生产工单',
      product_name: 'G型弹簧',
      quantity: 1500,
      unit: '个',
      status: STATUS.UNDER_REVIEW,
      current_handler_role: ROLES.WORKSHOP_DIRECTOR,
      current_handler: '李明',
      deadline: '2026-06-25 18:00:00',
      planner: '刘芳',
      workshop_director: '李明',
      factory_manager: '王强'
    },
    {
      id: 'wo_008',
      code: 'WO-2026-0608',
      title: '6月H型号刹车片生产工单',
      product_name: 'H型刹车片',
      quantity: 400,
      unit: '副',
      status: STATUS.PENDING_CORRECTION,
      current_handler_role: ROLES.PLANNER,
      current_handler: '张伟',
      deadline: '2026-06-07 18:00:00',
      planner: '张伟',
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

  const updateWoScheduled = db.prepare(`
    UPDATE workorders SET
      production_schedule = ?,
      updated_at = datetime('now')
    WHERE id = ?
  `);

  const scheduleData = JSON.stringify({
    start_date: '2026-06-11',
    end_date: '2026-06-14',
    workshop: '第一车间',
    line: '2号线',
    shift: '白班',
    scheduled_by: '张伟',
    scheduled_at: '2026-06-10 09:30:00',
    remark: '按正常排产计划执行'
  });

  updateWoScheduled.run(scheduleData, 'wo_002');
  updateWoScheduled.run(scheduleData, 'wo_003');
  updateWoScheduled.run(scheduleData, 'wo_005');
  updateWoScheduled.run(scheduleData, 'wo_007');

  const updateWoMaterial = db.prepare(`
    UPDATE workorders SET
      material_issue = ?,
      updated_at = datetime('now')
    WHERE id = ?
  `);

  const materialData = JSON.stringify({
    issue_date: '2026-06-11',
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

  const updateWoCompletion = db.prepare(`
    UPDATE workorders SET
      completion_report = ?,
      updated_at = datetime('now')
    WHERE id = ?
  `);

  const completionData = JSON.stringify({
    completion_date: '2026-06-14',
    actual_quantity: 500,
    qualified_quantity: 495,
    defective_quantity: 5,
    inspector: '质检科-小赵',
    report_by: '李明',
    remark: '生产任务完成，合格率99%'
  });

  updateWoCompletion.run(completionData, 'wo_003');

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
    '工单即将到期，尚未安排生产',
    '生产排程',
    ROLES.PLANNER,
    '张伟'
  );

  console.log('示例数据初始化完成，共 ' + workorders.length + ' 条工单');
}

if (require.main === module) {
  initDatabase();
  seedData();
  console.log('数据库初始化完成');
}

module.exports = { initDatabase, seedData };
