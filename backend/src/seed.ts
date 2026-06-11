import * as crypto from 'crypto';
import * as path from 'path';
import * as fs from 'fs';
import { v4 as uuidv4 } from 'uuid';

function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password).digest('hex');
}

function seed() {
  const Database = require('better-sqlite3');
  const dbPath = path.join(process.cwd(), 'data', 'agri_coop.db');
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // 删除旧库，确保每次 seed 干净
  if (fs.existsSync(dbPath)) {
    fs.unlinkSync(dbPath);
  }

  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  // 建表
  db.exec(`
    CREATE TABLE users (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      display_name TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('agricultural_technician', 'cooperative_director', 'field_manager')),
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE planting_tasks (
      id TEXT PRIMARY KEY,
      task_no TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      description TEXT,
      status TEXT NOT NULL DEFAULT 'pending_assign' CHECK(status IN (
        'pending_assign', 'assigned', 'processing', 'transferred',
        'followed_up', 'archived', 'returned_for_correction'
      )),
      assignee_id TEXT,
      assignee_role TEXT,
      creator_id TEXT NOT NULL,
      creator_role TEXT NOT NULL,
      plan_name TEXT,
      plan_year INTEGER,
      plan_month INTEGER,
      deadline TEXT,
      version INTEGER NOT NULL DEFAULT 1,
      exception_reason TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE material_requisitions (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL,
      material_name TEXT NOT NULL,
      quantity REAL NOT NULL,
      unit TEXT NOT NULL,
      requisition_status TEXT NOT NULL DEFAULT 'pending' CHECK(requisition_status IN ('pending', 'approved', 'rejected', 'returned')),
      applicant_id TEXT NOT NULL,
      applicant_role TEXT NOT NULL,
      applied_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      approved_at TEXT,
      remarks TEXT
    );

    CREATE TABLE field_records (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL,
      record_date TEXT NOT NULL,
      record_type TEXT NOT NULL,
      content TEXT NOT NULL,
      recorder_id TEXT NOT NULL,
      recorder_role TEXT NOT NULL,
      weather TEXT,
      remarks TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE processing_records (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL,
      processor_id TEXT NOT NULL,
      processor_role TEXT NOT NULL,
      action TEXT NOT NULL,
      result TEXT NOT NULL CHECK(result IN ('success', 'failure')),
      fail_reason TEXT,
      evidence TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE audit_logs (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL,
      operator_id TEXT NOT NULL,
      operator_role TEXT NOT NULL,
      action TEXT NOT NULL,
      before_status TEXT,
      after_status TEXT,
      fail_reason TEXT,
      remarks TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE attachments (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL,
      file_name TEXT NOT NULL,
      file_size INTEGER NOT NULL,
      file_type TEXT NOT NULL,
      uploaded_by TEXT NOT NULL,
      uploaded_by_role TEXT NOT NULL,
      uploaded_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );
  `);

  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const in2Days = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const in5Days = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const day3Ago = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const day5Ago = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  // 三类账号
  const users = [
    { id: 'u-director', username: 'director', password: hashPassword('123456'), displayName: '王主任', role: 'cooperative_director' },
    { id: 'u-technician', username: 'technician', password: hashPassword('123456'), displayName: '李农技', role: 'agricultural_technician' },
    { id: 'u-field', username: 'fieldmanager', password: hashPassword('123456'), displayName: '张田间', role: 'field_manager' },
  ];
  const insertUser = db.prepare('INSERT INTO users (id, username, password, display_name, role) VALUES (?, ?, ?, ?, ?)');
  for (const u of users) insertUser.run(u.id, u.username, u.password, u.displayName, u.role);

  // 任务插入
  const insertTask = db.prepare(`
    INSERT INTO planting_tasks (id, task_no, title, description, status, assignee_id, assignee_role, creator_id, creator_role, plan_name, plan_year, plan_month, deadline, version, exception_reason)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertAudit = db.prepare(`
    INSERT INTO audit_logs (id, task_id, operator_id, operator_role, action, before_status, after_status, fail_reason, remarks)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertProc = db.prepare(`
    INSERT INTO processing_records (id, task_id, processor_id, processor_role, action, result, fail_reason, evidence)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertMaterial = db.prepare(`
    INSERT INTO material_requisitions (id, task_id, material_name, quantity, unit, requisition_status, applicant_id, applicant_role, applied_at, approved_at, remarks)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertField = db.prepare(`
    INSERT INTO field_records (id, task_id, record_date, record_type, content, recorder_id, recorder_role, weather, remarks)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertAttach = db.prepare(`
    INSERT INTO attachments (id, task_id, file_name, file_size, file_type, uploaded_by, uploaded_by_role, uploaded_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now', 'localtime'))
  `);

  // ================= 第一类：正常流转 =================
  // 1. 待分派
  const t1Id = 't-pending';
  insertTask.run(t1Id, 'ZZ-202606-0001',
    '小麦种植-东区3号田',
    '东区3号田50亩小麦种植任务，需完成播种、施肥和全生育期田间管理',
    'pending_assign', null, null,
    'u-director', 'cooperative_director',
    '2026年夏播小麦计划', 2026, 6, in5Days, 1, null,
  );
  insertAudit.run(uuidv4(), t1Id, 'u-director', 'cooperative_director', 'create',
    null, 'pending_assign', null, '创建任务：小麦种植-东区3号田，计划50亩连片种植');
  insertAttach.run(uuidv4(), t1Id, '小麦种植方案.pdf', 245000, 'application/pdf', 'u-director', 'cooperative_director');
  insertAttach.run(uuidv4(), t1Id, '东区3号田地形图.jpg', 890000, 'image/jpeg', 'u-director', 'cooperative_director');

  // 2. 已分派(李农技)
  const t2Id = 't-assigned';
  insertTask.run(t2Id, 'ZZ-202606-0002',
    '水稻育秧-南区试验田',
    '南区试验田10亩水稻育秧，需做好种子消毒、育秧大棚温度管理和肥水管理',
    'assigned', 'u-technician', 'agricultural_technician',
    'u-director', 'cooperative_director',
    '2026年水稻育秧计划', 2026, 6, in2Days, 2, null,
  );
  insertAudit.run(uuidv4(), t2Id, 'u-director', 'cooperative_director', 'create',
    null, 'pending_assign', null, '创建任务：水稻育秧-南区试验田');
  insertAudit.run(uuidv4(), t2Id, 'u-director', 'cooperative_director', 'assign',
    'pending_assign', 'assigned', null, '分派给 李农技(农技员)');
  insertMaterial.run(uuidv4(), t2Id, '水稻种子-甬优15号', 30, '公斤', 'approved', 'u-technician', 'agricultural_technician', day3Ago, yesterday, '种子采购已确认');
  insertAttach.run(uuidv4(), t2Id, '育秧大棚作业规范.docx', 120000, 'application/msword', 'u-technician', 'agricultural_technician');

  // 3. 处理中 (李农技正在处理，有田间记录和已审批农资)
  const t3Id = 't-processing';
  insertTask.run(t3Id, 'ZZ-202606-0003',
    '玉米播种-西区5号田',
    '西区5号田80亩夏玉米播种，注意行距60cm、株距30cm，每亩留苗3500株',
    'processing', 'u-technician', 'agricultural_technician',
    'u-director', 'cooperative_director',
    '2026年玉米播种计划', 2026, 6, in5Days, 3, null,
  );
  insertAudit.run(uuidv4(), t3Id, 'u-director', 'cooperative_director', 'create', null, 'pending_assign', null, '创建任务：玉米播种-西区5号田');
  insertAudit.run(uuidv4(), t3Id, 'u-director', 'cooperative_director', 'assign', 'pending_assign', 'assigned', null, '分派给 李农技(农技员)');
  insertAudit.run(uuidv4(), t3Id, 'u-technician', 'agricultural_technician', 'process', 'assigned', 'processing', null, '播种准备完成，农资领用清单+播种作业计划表已提交');
  insertProc.run(uuidv4(), t3Id, 'u-technician', 'agricultural_technician', 'start_processing', 'success', null, '农资清单已上传，播种机械已到位');
  insertMaterial.run(uuidv4(), t3Id, '复合肥(NPK28-6-6)', 200, '公斤', 'approved', 'u-technician', 'agricultural_technician', day5Ago, day3Ago, '按每亩2.5公斤标准审批');
  insertMaterial.run(uuidv4(), t3Id, '玉米种子-登海605', 50, '公斤', 'approved', 'u-technician', 'agricultural_technician', day5Ago, day3Ago, '每公斤110元，合计5500元');
  insertField.run(uuidv4(), t3Id, today, 'sowing', '5号田播种完成，东区块已完成30亩，行距62cm株距28cm符合标准', 'u-technician', 'agricultural_technician', '晴', '西区块预计明日完成');
  insertField.run(uuidv4(), t3Id, today, 'fertilizing', '基肥撒施完成，使用复合肥每亩2.5kg，均匀撒施后翻入20cm土层', 'u-technician', 'agricultural_technician', '晴', null);
  insertAttach.run(uuidv4(), t3Id, '5号田播种完成照片.zip', 3200000, 'application/zip', 'u-technician', 'agricultural_technician');

  // ================= 第二类：已转办 =================
  const t4Id = 't-transferred';
  insertTask.run(t4Id, 'ZZ-202606-0004',
    '大豆种植-北区2号田',
    '北区2号田30亩大豆种植，李农技处理后转办给田间管理员进行日常管理',
    'transferred', 'u-field', 'field_manager',
    'u-technician', 'agricultural_technician',
    '2026年大豆种植计划', 2026, 6, in2Days, 4, null,
  );
  insertAudit.run(uuidv4(), t4Id, 'u-technician', 'agricultural_technician', 'create', null, 'pending_assign', null, '创建任务：大豆种植-北区2号田');
  insertAudit.run(uuidv4(), t4Id, 'u-director', 'cooperative_director', 'assign', 'pending_assign', 'assigned', null, '分派给 李农技(农技员)进行技术方案制定');
  insertAudit.run(uuidv4(), t4Id, 'u-technician', 'agricultural_technician', 'process', 'assigned', 'processing', null, '技术方案已确定：品种选用齐黄34，亩播量5kg');
  insertAudit.run(uuidv4(), t4Id, 'u-technician', 'agricultural_technician', 'transfer', 'processing', 'transferred', null, '转办给 张田间(田间管理员) 负责田间日常管理');
  insertProc.run(uuidv4(), t4Id, 'u-technician', 'agricultural_technician', 'start_processing', 'success', null, '已制定技术方案');
  insertProc.run(uuidv4(), t4Id, 'u-technician', 'agricultural_technician', 'transfer', 'success', null, '转办给田间管理员执行日常管理');
  insertMaterial.run(uuidv4(), t4Id, '大豆种子-齐黄34', 150, '公斤', 'approved', 'u-technician', 'agricultural_technician', day5Ago, day3Ago, null);
  insertField.run(uuidv4(), t4Id, yesterday, 'sowing', '北区2号田大豆播种完成，深度4cm，覆土镇压到位', 'u-field', 'field_manager', '多云转小雨', null);
  insertField.run(uuidv4(), t4Id, today, 'inspection', '出苗检查：整体出苗率95%，有个别缺苗已补播', 'u-field', 'field_manager', '阴', null);
  insertAttach.run(uuidv4(), t4Id, '大豆品种说明.pdf', 420000, 'application/pdf', 'u-technician', 'agricultural_technician');
  insertAttach.run(uuidv4(), t4Id, '北区田间巡检记录.jpg', 780000, 'image/jpeg', 'u-field', 'field_manager');

  // ================= 第三类：已回访 =================
  const t5Id = 't-followed';
  insertTask.run(t5Id, 'ZZ-202606-0005',
    '花生收获-东区1号田',
    '东区1号田20亩花生种植任务，已完成全部流程并回访确认产量',
    'followed_up', 'u-technician', 'agricultural_technician',
    'u-director', 'cooperative_director',
    '2026年花生种植计划', 2026, 5, in5Days, 6, null,
  );
  insertAudit.run(uuidv4(), t5Id, 'u-director', 'cooperative_director', 'create', null, 'pending_assign', null, '创建任务：花生收获-东区1号田');
  insertAudit.run(uuidv4(), t5Id, 'u-director', 'cooperative_director', 'assign', 'pending_assign', 'assigned', null, '分派给 李农技(农技员)');
  insertAudit.run(uuidv4(), t5Id, 'u-technician', 'agricultural_technician', 'process', 'assigned', 'processing', null, '开始种植，已制定播种计划和农资需求');
  insertAudit.run(uuidv4(), t5Id, 'u-technician', 'agricultural_technician', 'complete_processing', 'processing', 'transferred', null, '田间管理全部完成，等待收获');
  insertAudit.run(uuidv4(), t5Id, 'u-director', 'cooperative_director', 'follow_up', 'transferred', 'followed_up', null, '回访：合作社社员确认亩产320kg，超预期达成，对技术服务满意');
  insertProc.run(uuidv4(), t5Id, 'u-technician', 'agricultural_technician', 'start_processing', 'success', null, '农资领用清单已确认');
  insertProc.run(uuidv4(), t5Id, 'u-technician', 'agricultural_technician', 'complete_processing', 'success', null, '田间管理完成，待收获');
  insertProc.run(uuidv4(), t5Id, 'u-director', 'cooperative_director', 'follow_up', 'success', null, '社员回访确认');
  insertField.run(uuidv4(), t5Id, day5Ago, 'harvesting', '1号田花生收获完成，总产量6400kg，平均亩产320kg', 'u-technician', 'agricultural_technician', '晴', '晾晒后预计增加3%容重');
  insertField.run(uuidv4(), t5Id, day3Ago, 'inspection', '收获后田间检查，无花生果遗漏，秸秆已粉碎还田', 'u-field', 'field_manager', '晴', null);
  insertMaterial.run(uuidv4(), t5Id, '花生种-鲁花11号', 80, '公斤', 'approved', 'u-technician', 'agricultural_technician', day5Ago, day5Ago, null);
  insertAttach.run(uuidv4(), t5Id, '花生测产报告.pdf', 350000, 'application/pdf', 'u-director', 'cooperative_director');
  insertAttach.run(uuidv4(), t5Id, '社员满意度签字确认.jpg', 1200000, 'image/jpeg', 'u-director', 'cooperative_director');

  // ================= 第四类：退回补正(缺材料) =================
  const t6Id = 't-returned';
  insertTask.run(t6Id, 'ZZ-202606-0006',
    '棉花种植-南区4号田',
    '南区4号田25亩棉花种植，因农资领用未审批被退回补正',
    'returned_for_correction', 'u-technician', 'agricultural_technician',
    'u-director', 'cooperative_director',
    '2026年棉花种植计划', 2026, 6, yesterday, 5,
    '农资领用未审批：缺少化肥(尿素100公斤)和农药(杀虫剂20瓶)的审批单据，同时田间记录仅有播种记录，缺少施肥和病虫害防治记录',
  );
  insertAudit.run(uuidv4(), t6Id, 'u-director', 'cooperative_director', 'create', null, 'pending_assign', null, '创建任务：棉花种植-南区4号田');
  insertAudit.run(uuidv4(), t6Id, 'u-director', 'cooperative_director', 'assign', 'pending_assign', 'assigned', null, '分派给 李农技(农技员)');
  insertAudit.run(uuidv4(), t6Id, 'u-technician', 'agricultural_technician', 'process', 'assigned', 'processing', null, '开始种植');
  insertAudit.run(uuidv4(), t6Id, 'u-director', 'cooperative_director', 'return_for_correction', 'processing', 'returned_for_correction',
    '农资领用未审批，缺少田间记录',
    '退回原因：1) 尿素100kg和杀虫剂20瓶未审批 2) 田间记录缺施肥和病虫害防治环节');
  insertProc.run(uuidv4(), t6Id, 'u-technician', 'agricultural_technician', 'start_processing', 'success', null, '棉花播种完成');
  insertProc.run(uuidv4(), t6Id, 'u-director', 'cooperative_director', 'return_for_correction', 'failure',
    '农资缺失+记录不全',
    '缺尿素100kg杀虫剂20瓶审批，施肥和防病虫记录缺失');
  insertMaterial.run(uuidv4(), t6Id, '尿素', 100, '公斤', 'pending', 'u-technician', 'agricultural_technician', today, null, null);
  insertMaterial.run(uuidv4(), t6Id, '杀虫剂-吡虫啉', 20, '瓶', 'pending', 'u-technician', 'agricultural_technician', today, null, null);
  insertMaterial.run(uuidv4(), t6Id, '棉花种', 15, '公斤', 'approved', 'u-technician', 'agricultural_technician', day3Ago, day3Ago, null);
  insertField.run(uuidv4(), t6Id, yesterday, 'sowing', '4号田棉花播种完成，地膜覆盖', 'u-technician', 'agricultural_technician', '晴', null);
  insertAttach.run(uuidv4(), t6Id, '缺材料整改通知.png', 230000, 'image/png', 'u-director', 'cooperative_director');

  // ================= 第五类：逾期未处理 =================
  const t7Id = 't-overdue';
  insertTask.run(t7Id, 'ZZ-202606-0007',
    '油菜种植-西区6号田',
    '西区6号田40亩油菜种植，已逾期2天未开始处理',
    'assigned', 'u-technician', 'agricultural_technician',
    'u-director', 'cooperative_director',
    '2026年油菜种植计划', 2026, 5, day3Ago, 2, null,
  );
  insertAudit.run(uuidv4(), t7Id, 'u-director', 'cooperative_director', 'create', null, 'pending_assign', null, '创建任务：油菜种植-西区6号田');
  insertAudit.run(uuidv4(), t7Id, 'u-director', 'cooperative_director', 'assign', 'pending_assign', 'assigned', null, '分派给 李农技(农技员) - 已逾期2天');
  insertMaterial.run(uuidv4(), t7Id, '油菜籽', 120, '公斤', 'approved', 'u-technician', 'agricultural_technician', day5Ago, day5Ago, null);

  // ================= 第六类：状态冲突测试 =================
  const t8Id = 't-conflict';
  insertTask.run(t8Id, 'ZZ-202606-0008',
    '红薯种植-北区7号田',
    '北区7号田红薯种植任务，测试田间管理员的处理环节',
    'processing', 'u-field', 'field_manager',
    'u-technician', 'agricultural_technician',
    '2026年红薯种植计划', 2026, 6, in2Days, 3, null,
  );
  insertAudit.run(uuidv4(), t8Id, 'u-technician', 'agricultural_technician', 'create', null, 'pending_assign', null, '创建任务：红薯种植-北区7号田');
  insertAudit.run(uuidv4(), t8Id, 'u-director', 'cooperative_director', 'assign', 'pending_assign', 'assigned', null, '分派给 张田间(田间管理员)');
  insertAudit.run(uuidv4(), t8Id, 'u-field', 'field_manager', 'process', 'assigned', 'processing', null, '田间管理员开始红薯栽插');
  insertProc.run(uuidv4(), t8Id, 'u-field', 'field_manager', 'start_processing', 'success', null, '红薯栽插作业开始');
  insertField.run(uuidv4(), t8Id, today, 'sowing', '北区7号田红薯栽插完成，起垄+滴灌带铺设到位', 'u-field', 'field_manager', '晴', null);
  insertMaterial.run(uuidv4(), t8Id, '红薯苗-商薯19号', 5000, '株', 'approved', 'u-field', 'field_manager', yesterday, yesterday, null);

  // ================= 已归档 =================
  const t9Id = 't-archived';
  insertTask.run(t9Id, 'ZZ-202605-0001',
    '春小麦收获-东区2号田',
    '东区2号田春小麦种植全流程完成并归档',
    'archived', 'u-technician', 'agricultural_technician',
    'u-director', 'cooperative_director',
    '2026年春小麦种植计划', 2026, 5, day5Ago, 8, null,
  );
  insertAudit.run(uuidv4(), t9Id, 'u-director', 'cooperative_director', 'create', null, 'pending_assign', null, '创建任务：春小麦收获-东区2号田');
  insertAudit.run(uuidv4(), t9Id, 'u-director', 'cooperative_director', 'assign', 'pending_assign', 'assigned', null, '分派给 李农技');
  insertAudit.run(uuidv4(), t9Id, 'u-technician', 'agricultural_technician', 'process', 'assigned', 'processing', null, '开始春小麦田间管理');
  insertAudit.run(uuidv4(), t9Id, 'u-technician', 'agricultural_technician', 'complete_processing', 'processing', 'transferred', null, '春小麦收获完成');
  insertAudit.run(uuidv4(), t9Id, 'u-director', 'cooperative_director', 'follow_up', 'transferred', 'followed_up', null, '回访确认亩产420kg超预期');
  insertAudit.run(uuidv4(), t9Id, 'u-director', 'cooperative_director', 'archive', 'followed_up', 'archived', null, '任务归档完成，全部材料齐全');
  insertProc.run(uuidv4(), t9Id, 'u-technician', 'agricultural_technician', 'start_processing', 'success', null, '田间管理开始');
  insertProc.run(uuidv4(), t9Id, 'u-technician', 'agricultural_technician', 'complete_processing', 'success', null, '收获完成');
  insertProc.run(uuidv4(), t9Id, 'u-director', 'cooperative_director', 'follow_up', 'success', null, '回访完成');
  insertProc.run(uuidv4(), t9Id, 'u-director', 'cooperative_director', 'archive', 'success', null, '归档完成');
  insertField.run(uuidv4(), t9Id, day5Ago, 'harvesting', '东区2号田春小麦收获，亩产420kg，总产21吨', 'u-technician', 'agricultural_technician', '晴', null);
  insertField.run(uuidv4(), t9Id, day3Ago, 'inspection', '收获后清田检查，秸秆全量还田', 'u-field', 'field_manager', '晴', null);
  insertMaterial.run(uuidv4(), t9Id, '春小麦种', 500, '公斤', 'approved', 'u-technician', 'agricultural_technician', day5Ago, day5Ago, null);
  insertMaterial.run(uuidv4(), t9Id, '复合肥', 1000, '公斤', 'approved', 'u-technician', 'agricultural_technician', day5Ago, day5Ago, null);
  insertAttach.run(uuidv4(), t9Id, '春小麦测产报告.pdf', 520000, 'application/pdf', 'u-technician', 'agricultural_technician');
  insertAttach.run(uuidv4(), t9Id, '收获现场照片1.jpg', 1450000, 'image/jpeg', 'u-field', 'field_manager');
  insertAttach.run(uuidv4(), t9Id, '收获现场照片2.jpg', 1380000, 'image/jpeg', 'u-field', 'field_manager');
  insertAttach.run(uuidv4(), t9Id, '合作社签字确认单.pdf', 290000, 'application/pdf', 'u-director', 'cooperative_director');

  // ================= 已回访但缺材料 - 测试归档失败 =================
  const t10Id = 't-followed-missing';
  insertTask.run(t10Id, 'ZZ-202606-0009',
    '西瓜种植-西区8号田',
    '西瓜种植已回访完成，但仍有未审批农资，用于测试归档时拦截',
    'followed_up', 'u-technician', 'agricultural_technician',
    'u-director', 'cooperative_director',
    '2026年西瓜种植计划', 2026, 6, in5Days, 5, null,
  );
  insertAudit.run(uuidv4(), t10Id, 'u-director', 'cooperative_director', 'create', null, 'pending_assign', null, '创建任务：西瓜种植-西区8号田');
  insertAudit.run(uuidv4(), t10Id, 'u-director', 'cooperative_director', 'assign', 'pending_assign', 'assigned', null, '分派给 李农技');
  insertAudit.run(uuidv4(), t10Id, 'u-technician', 'agricultural_technician', 'process', 'assigned', 'processing', null, '开始西瓜种植');
  insertAudit.run(uuidv4(), t10Id, 'u-technician', 'agricultural_technician', 'complete_processing', 'processing', 'transferred', null, '田间管理完成');
  insertAudit.run(uuidv4(), t10Id, 'u-director', 'cooperative_director', 'follow_up', 'transferred', 'followed_up', null, '回访完成');
  insertMaterial.run(uuidv4(), t10Id, '西瓜苗', 6000, '株', 'approved', 'u-technician', 'agricultural_technician', day3Ago, day3Ago, null);
  insertMaterial.run(uuidv4(), t10Id, '钾肥', 80, '公斤', 'pending', 'u-technician', 'agricultural_technician', yesterday, null, '膨瓜期追肥未审批');
  insertField.run(uuidv4(), t10Id, yesterday, 'inspection', '西瓜膨瓜期检查，果实生长均匀', 'u-technician', 'agricultural_technician', '晴', null);

  // ================= 新增样例1: 已回访但缺田间记录 - 测试归档拦截 =================
  const t11Id = 't-followed-no-field';
  insertTask.run(t11Id, 'ZZ-202606-0010',
    '甜瓜种植-南区9号田',
    '甜瓜种植已完成回访但无田间记录，用于测试归档时"缺田间记录"拦截',
    'followed_up', 'u-technician', 'agricultural_technician',
    'u-director', 'cooperative_director',
    '2026年甜瓜种植计划', 2026, 6, in5Days, 5, null,
  );
  insertAudit.run(uuidv4(), t11Id, 'u-director', 'cooperative_director', 'create', null, 'pending_assign', null, '创建任务：甜瓜种植-南区9号田');
  insertAudit.run(uuidv4(), t11Id, 'u-director', 'cooperative_director', 'assign', 'pending_assign', 'assigned', null, '分派给 李农技(农技员)');
  insertAudit.run(uuidv4(), t11Id, 'u-technician', 'agricultural_technician', 'process', 'assigned', 'processing', null, '开始甜瓜种植，已定植');
  insertAudit.run(uuidv4(), t11Id, 'u-technician', 'agricultural_technician', 'complete_processing', 'processing', 'transferred', null, '田间管理完成，但未录入田间记录');
  insertAudit.run(uuidv4(), t11Id, 'u-director', 'cooperative_director', 'follow_up', 'transferred', 'followed_up', null, '回访完成，社员确认坐果良好');
  insertProc.run(uuidv4(), t11Id, 'u-technician', 'agricultural_technician', 'start_processing', 'success', null, '定植完成');
  insertProc.run(uuidv4(), t11Id, 'u-technician', 'agricultural_technician', 'complete_processing', 'success', null, '管理完成，但田间记录未录入');
  insertProc.run(uuidv4(), t11Id, 'u-director', 'cooperative_director', 'follow_up', 'success', null, '回访确认');
  insertMaterial.run(uuidv4(), t11Id, '甜瓜苗', 4000, '株', 'approved', 'u-technician', 'agricultural_technician', day5Ago, day5Ago, null);
  // 注意：这里故意不插入field_records，用于测试归档拦截
  insertAttach.run(uuidv4(), t11Id, '甜瓜定植照片.jpg', 890000, 'image/jpeg', 'u-technician', 'agricultural_technician');

  // ================= 新增样例2: 旧版本冲突测试 =================
  const t12Id = 't-version-conflict';
  insertTask.run(t12Id, 'ZZ-202606-0011',
    '蔬菜种植-东区10号田',
    '蔬菜种植任务，用于测试版本冲突（当前version=5）',
    'processing', 'u-technician', 'agricultural_technician',
    'u-director', 'cooperative_director',
    '2026年蔬菜种植计划', 2026, 6, in5Days, 5, null,
  );
  insertAudit.run(uuidv4(), t12Id, 'u-director', 'cooperative_director', 'create', null, 'pending_assign', null, '创建任务：蔬菜种植-东区10号田');
  insertAudit.run(uuidv4(), t12Id, 'u-director', 'cooperative_director', 'assign', 'pending_assign', 'assigned', null, '分派给 李农技 v2');
  insertAudit.run(uuidv4(), t12Id, 'u-technician', 'agricultural_technician', 'process', 'assigned', 'processing', null, '开始处理 v3');
  insertAudit.run(uuidv4(), t12Id, 'u-technician', 'agricultural_technician', 'process', 'processing', 'processing', null, '更新处理内容 v4');
  insertAudit.run(uuidv4(), t12Id, 'u-technician', 'agricultural_technician', 'process', 'processing', 'processing', null, '再次更新 v5');
  insertProc.run(uuidv4(), t12Id, 'u-technician', 'agricultural_technician', 'start_processing', 'success', null, '版本3开始处理');
  insertField.run(uuidv4(), t12Id, yesterday, 'sowing', '蔬菜定植完成', 'u-technician', 'agricultural_technician', '晴', null);
  insertMaterial.run(uuidv4(), t12Id, '番茄苗', 2000, '株', 'approved', 'u-technician', 'agricultural_technician', day5Ago, day3Ago, null);
  insertAttach.run(uuidv4(), t12Id, '蔬菜种植现场.jpg', 760000, 'image/jpeg', 'u-technician', 'agricultural_technician');

  // ================= 新增样例3: 越权测试 - 田间管理员被分派给非田间管理员角色的任务 =================
  const t13Id = 't-unauthorized-field';
  insertTask.run(t13Id, 'ZZ-202606-0012',
    '小麦病虫害防治-西区11号田',
    '测试田间管理员越权操作：assignee_role是农技员，但assignee_id是田间管理员（数据异常场景）',
    'assigned', 'u-field', 'agricultural_technician',
    'u-director', 'cooperative_director',
    '2026年小麦病虫害防治计划', 2026, 6, in2Days, 2, null,
  );
  insertAudit.run(uuidv4(), t13Id, 'u-director', 'cooperative_director', 'create', null, 'pending_assign', null, '创建任务：小麦病虫害防治-西区11号田');
  insertAudit.run(uuidv4(), t13Id, 'u-director', 'cooperative_director', 'assign', 'pending_assign', 'assigned', null, '分派时误将assignee_role设为农技员，但实际分给了田间管理员张田间');
  insertProc.run(uuidv4(), t13Id, 'u-director', 'cooperative_director', 'assign', 'success', null, '分派完成（数据异常测试用）');
  insertMaterial.run(uuidv4(), t13Id, '杀虫剂-吡虫啉', 30, '瓶', 'approved', 'u-director', 'cooperative_director', day3Ago, yesterday, null);
  // 注意：assignee_role故意设为agricultural_technician，但assignee_id是u-field，用于测试田间管理员跳过处理环节的拦截

  // ================= 新增样例4: 多项缺材料样例 =================
  const t14Id = 't-multiple-missing';
  insertTask.run(t14Id, 'ZZ-202606-0013',
    '葡萄园管理-北区12号田',
    '葡萄园管理任务，有多项未审批农资，测试完成处理时拦截',
    'processing', 'u-technician', 'agricultural_technician',
    'u-director', 'cooperative_director',
    '2026年葡萄园管理计划', 2026, 6, in5Days, 3, null,
  );
  insertAudit.run(uuidv4(), t14Id, 'u-director', 'cooperative_director', 'create', null, 'pending_assign', null, '创建任务：葡萄园管理-北区12号田');
  insertAudit.run(uuidv4(), t14Id, 'u-director', 'cooperative_director', 'assign', 'pending_assign', 'assigned', null, '分派给 李农技');
  insertAudit.run(uuidv4(), t14Id, 'u-technician', 'agricultural_technician', 'process', 'assigned', 'processing', null, '开始葡萄园夏季修剪');
  insertProc.run(uuidv4(), t14Id, 'u-technician', 'agricultural_technician', 'start_processing', 'success', null, '夏季修剪开始');
  // 3项pending农资
  insertMaterial.run(uuidv4(), t14Id, '复合肥', 150, '公斤', 'pending', 'u-technician', 'agricultural_technician', today, null, '膨果肥未审批');
  insertMaterial.run(uuidv4(), t14Id, '杀菌剂-波尔多液', 50, '瓶', 'pending', 'u-technician', 'agricultural_technician', yesterday, null, '霜霉病防治未审批');
  insertMaterial.run(uuidv4(), t14Id, '叶面肥', 40, '升', 'pending', 'u-technician', 'agricultural_technician', yesterday, null, '叶面喷施未审批');
  insertMaterial.run(uuidv4(), t14Id, '修枝剪', 10, '把', 'approved', 'u-technician', 'agricultural_technician', day5Ago, day3Ago, null);
  insertField.run(uuidv4(), t14Id, yesterday, 'pruning', '夏季修剪完成，剪除徒长枝和过密枝', 'u-technician', 'agricultural_technician', '多云', null);
  insertAttach.run(uuidv4(), t14Id, '葡萄园修剪后照片.jpg', 1100000, 'image/jpeg', 'u-technician', 'agricultural_technician');

  // ================= 新增样例5: 田间管理员分派给自己的任务 - 正常场景 =================
  const t15Id = 't-field-normal';
  insertTask.run(t15Id, 'ZZ-202606-0014',
    '果园除草-南区13号田',
    '正常分派给田间管理员的任务，用于测试田间管理员正常处理流程',
    'assigned', 'u-field', 'field_manager',
    'u-director', 'cooperative_director',
    '2026年果园管理计划', 2026, 6, in2Days, 2, null,
  );
  insertAudit.run(uuidv4(), t15Id, 'u-director', 'cooperative_director', 'create', null, 'pending_assign', null, '创建任务：果园除草-南区13号田');
  insertAudit.run(uuidv4(), t15Id, 'u-director', 'cooperative_director', 'assign', 'pending_assign', 'assigned', null, '分派给 张田间(田间管理员) - 正常场景');
  insertProc.run(uuidv4(), t15Id, 'u-director', 'cooperative_director', 'assign', 'success', null, '分派给田间管理员');
  insertMaterial.run(uuidv4(), t15Id, '除草剂-草甘膦', 20, '升', 'approved', 'u-field', 'field_manager', yesterday, yesterday, null);
  insertAttach.run(uuidv4(), t15Id, '果园杂草情况.jpg', 650000, 'image/jpeg', 'u-field', 'field_manager');

  console.log('');
  console.log('========================================');
  console.log('  农业合作社 SQLite 演示数据初始化完成');
  console.log('========================================');
  console.log('');
  console.log('▶ 演示账号 (密码均为 123456)：');
  console.log('  - 合作社主任: director / 123456  (分派+归档+退回)');
  console.log('  - 农技员:     technician / 123456  (处理+转办)');
  console.log('  - 田间管理员: fieldmanager / 123456 (处理+录入记录)');
  console.log('');
  console.log('▶ 四类演示单据（共15个任务）：');
  console.log('  【正常流转】');
  console.log('    ZZ-202606-0001 待分派   - 小麦种植，带附件(方案+地形图)');
  console.log('    ZZ-202606-0002 已分派   - 水稻育秧，带农资审批+附件');
  console.log('    ZZ-202606-0003 处理中   - 玉米播种，带田间记录×2+农资×2+附件');
  console.log('    ZZ-202606-0014 已分派   - 果园除草，田间管理员正常处理任务');
  console.log('  【已转办】');
  console.log('    ZZ-202606-0004 已转办   - 大豆种植，农技员转田间管理员，带田间巡检');
  console.log('  【已回访】');
  console.log('    ZZ-202606-0005 已回访   - 花生收获，回访确认亩产320kg');
  console.log('    ZZ-202606-0009 已回访   - 西瓜种植 (有1项未审批农资，归档被拦截用)');
  console.log('    ZZ-202606-0010 已回访   - 甜瓜种植 (故意缺田间记录，归档拦截测试核心样例)');
  console.log('  【退回补正 / 异常】');
  console.log('    ZZ-202606-0006 退回补正 - 棉花种植，缺化肥和农药审批');
  console.log('    ZZ-202606-0007 已分派   - 油菜种植，已逾期2天未处理');
  console.log('    ZZ-202606-0008 处理中   - 红薯种植，田间管理员处理 (正常处理场景)');
  console.log('    ZZ-202606-0011 处理中   - 蔬菜种植 (version=5，版本冲突测试)');
  console.log('    ZZ-202606-0012 已分派   - 小麦病虫害防治 (assignee_role异常，田间管理员越权拦截)');
  console.log('    ZZ-202606-0013 处理中   - 葡萄园管理 (3项pending农资，完成处理拦截)');
  console.log('  【已归档】');
  console.log('    ZZ-202605-0001 已归档   - 春小麦收获，4附件+完整审批');
  console.log('');
  console.log('▶ 异常入口 (用于接口穿透测试)：');
  console.log('  ✅ 越权归档:     用农技员账号归档 0005');
  console.log('  ✅ 版本冲突:     用 version=1 提交 0011 (当前 v5)');
  console.log('  ✅ 状态冲突:     对已归档 202605-0001 再次分派');
  console.log('  ✅ 缺证据:       处理 0002 (水稻育秧) 不提供 evidence');
  console.log('  ✅ 越权推进:     田间管理员尝试分派/回访/归档');
  console.log('  ✅ 缺材料归档:   主任归档 0009 (有未审批钾肥)');
  console.log('  ✅ 缺田间记录:   主任归档 0010 (已回访但无field_record)');
  console.log('  ✅ 多项缺材料:   农技员完成处理 0013 (3项pending农资)');
  console.log('  ✅ 田间管理员越权: 田间管理员处理 0012 (assignee_role不是field_manager)');
  console.log('  ✅ 非处理人越权: 田间管理员处理 0002 (处理人是李农技)');
  console.log('');

  db.close();
}

seed();
