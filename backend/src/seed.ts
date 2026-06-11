import * as crypto from 'crypto';
import * as path from 'path';
import * as fs from 'fs';

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

  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  const userCount = db.prepare('SELECT COUNT(*) as cnt FROM users').get() as any;
  if (userCount.cnt > 0) {
    console.log('演示数据已存在，跳过初始化');
    db.close();
    return;
  }

  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const threeDaysLater = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const fiveDaysLater = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const users = [
    { id: 'u-director-001', username: 'director', password: hashPassword('123456'), displayName: '王主任', role: 'cooperative_director' },
    { id: 'u-tech-001', username: 'technician', password: hashPassword('123456'), displayName: '李农技', role: 'agricultural_technician' },
    { id: 'u-field-001', username: 'fieldmanager', password: hashPassword('123456'), displayName: '张田间', role: 'field_manager' },
  ];

  const insertUser = db.prepare(
    'INSERT INTO users (id, username, password, display_name, role) VALUES (?, ?, ?, ?, ?)',
  );
  for (const u of users) {
    insertUser.run(u.id, u.username, u.password, u.displayName, u.role);
  }

  const tasks = [
    {
      id: 't-normal-001', taskNo: 'ZZ-202606-0001', title: '小麦种植-东区3号田',
      description: '东区3号田小麦种植任务，需完成播种、施肥和田间管理',
      status: 'pending_assign', assigneeId: null, assigneeRole: null,
      creatorId: 'u-director-001', creatorRole: 'cooperative_director',
      planName: '2026年夏播小麦计划', planYear: 2026, planMonth: 6,
      deadline: fiveDaysLater, version: 1, exceptionReason: null,
    },
    {
      id: 't-normal-002', taskNo: 'ZZ-202606-0002', title: '水稻育秧-南区试验田',
      description: '南区试验田水稻育秧，需做好种子处理和育秧管理',
      status: 'assigned', assigneeId: 'u-tech-001', assigneeRole: 'agricultural_technician',
      creatorId: 'u-director-001', creatorRole: 'cooperative_director',
      planName: '2026年水稻育秧计划', planYear: 2026, planMonth: 6,
      deadline: threeDaysLater, version: 1, exceptionReason: null,
    },
    {
      id: 't-normal-003', taskNo: 'ZZ-202606-0003', title: '玉米播种-西区5号田',
      description: '西区5号田玉米播种，注意行距和株距标准',
      status: 'processing', assigneeId: 'u-tech-001', assigneeRole: 'agricultural_technician',
      creatorId: 'u-director-001', creatorRole: 'cooperative_director',
      planName: '2026年玉米播种计划', planYear: 2026, planMonth: 6,
      deadline: fiveDaysLater, version: 2, exceptionReason: null,
    },
    {
      id: 't-transfer-001', taskNo: 'ZZ-202606-0004', title: '大豆种植-北区2号田',
      description: '北区2号田大豆种植，已转办至田间管理员处理',
      status: 'transferred', assigneeId: 'u-field-001', assigneeRole: 'field_manager',
      creatorId: 'u-tech-001', creatorRole: 'agricultural_technician',
      planName: '2026年大豆种植计划', planYear: 2026, planMonth: 6,
      deadline: threeDaysLater, version: 3, exceptionReason: null,
    },
    {
      id: 't-followup-001', taskNo: 'ZZ-202606-0005', title: '花生收获-东区1号田',
      description: '东区1号田花生收获，已回访确认产量',
      status: 'followed_up', assigneeId: 'u-tech-001', assigneeRole: 'agricultural_technician',
      creatorId: 'u-director-001', creatorRole: 'cooperative_director',
      planName: '2026年花生种植计划', planYear: 2026, planMonth: 5,
      deadline: fiveDaysLater, version: 5, exceptionReason: null,
    },
    {
      id: 't-missing-001', taskNo: 'ZZ-202606-0006', title: '棉花种植-南区4号田',
      description: '南区4号田棉花种植，缺少农资审批材料',
      status: 'returned_for_correction', assigneeId: 'u-tech-001', assigneeRole: 'agricultural_technician',
      creatorId: 'u-director-001', creatorRole: 'cooperative_director',
      planName: '2026年棉花种植计划', planYear: 2026, planMonth: 6,
      deadline: yesterday, version: 4, exceptionReason: '农资领用未审批，缺少化肥和农药审批单',
    },
    {
      id: 't-overdue-001', taskNo: 'ZZ-202606-0007', title: '油菜种植-西区6号田',
      description: '西区6号田油菜种植，已逾期未处理',
      status: 'assigned', assigneeId: 'u-tech-001', assigneeRole: 'agricultural_technician',
      creatorId: 'u-director-001', creatorRole: 'cooperative_director',
      planName: '2026年油菜种植计划', planYear: 2026, planMonth: 5,
      deadline: twoDaysAgo, version: 2, exceptionReason: null,
    },
    {
      id: 't-conflict-001', taskNo: 'ZZ-202606-0008', title: '红薯种植-北区7号田',
      description: '北区7号田红薯种植，状态冲突测试任务',
      status: 'processing', assigneeId: 'u-field-001', assigneeRole: 'field_manager',
      creatorId: 'u-tech-001', creatorRole: 'agricultural_technician',
      planName: '2026年红薯种植计划', planYear: 2026, planMonth: 6,
      deadline: threeDaysLater, version: 2, exceptionReason: null,
    },
    {
      id: 't-archived-001', taskNo: 'ZZ-202605-0001', title: '春小麦收获-东区2号田',
      description: '东区2号田春小麦收获，已完成归档',
      status: 'archived', assigneeId: 'u-tech-001', assigneeRole: 'agricultural_technician',
      creatorId: 'u-director-001', creatorRole: 'cooperative_director',
      planName: '2026年春小麦种植计划', planYear: 2026, planMonth: 5,
      deadline: null, version: 7, exceptionReason: null,
    },
  ];

  const insertTask = db.prepare(
    `INSERT INTO planting_tasks (id, task_no, title, description, status, assignee_id, assignee_role, creator_id, creator_role, plan_name, plan_year, plan_month, deadline, version, exception_reason)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  for (const t of tasks) {
    insertTask.run(
      t.id, t.taskNo, t.title, t.description, t.status,
      t.assigneeId, t.assigneeRole, t.creatorId, t.creatorRole,
      t.planName, t.planYear, t.planMonth, t.deadline, t.version, t.exceptionReason,
    );
  }

  const materials = [
    { id: 'm-001', taskId: 't-normal-003', materialName: '复合肥', quantity: 200, unit: '公斤', status: 'approved', applicantId: 'u-tech-001', applicantRole: 'agricultural_technician' },
    { id: 'm-002', taskId: 't-normal-003', materialName: '玉米种子', quantity: 50, unit: '公斤', status: 'approved', applicantId: 'u-tech-001', applicantRole: 'agricultural_technician' },
    { id: 'm-003', taskId: 't-missing-001', materialName: '尿素', quantity: 100, unit: '公斤', status: 'pending', applicantId: 'u-tech-001', applicantRole: 'agricultural_technician' },
    { id: 'm-004', taskId: 't-missing-001', materialName: '杀虫剂', quantity: 20, unit: '瓶', status: 'pending', applicantId: 'u-tech-001', applicantRole: 'agricultural_technician' },
    { id: 'm-005', taskId: 't-conflict-001', materialName: '红薯苗', quantity: 5000, unit: '株', status: 'approved', applicantId: 'u-field-001', applicantRole: 'field_manager' },
  ];

  const insertMaterial = db.prepare(
    `INSERT INTO material_requisitions (id, task_id, material_name, quantity, unit, requisition_status, applicant_id, applicant_role)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  for (const m of materials) {
    insertMaterial.run(m.id, m.taskId, m.materialName, m.quantity, m.unit, m.status, m.applicantId, m.applicantRole);
  }

  const fieldRecords = [
    { id: 'fr-001', taskId: 't-normal-003', recordDate: today, recordType: 'sowing', content: '西区5号田玉米播种完成，行距60cm，株距30cm', recorderId: 'u-tech-001', recorderRole: 'agricultural_technician', weather: '晴' },
    { id: 'fr-002', taskId: 't-normal-003', recordDate: today, recordType: 'fertilizing', content: '施底肥复合肥200公斤，均匀撒施', recorderId: 'u-tech-001', recorderRole: 'agricultural_technician', weather: '晴' },
    { id: 'fr-003', taskId: 't-transfer-001', recordDate: twoDaysAgo, recordType: 'inspection', content: '北区2号田大豆出苗情况良好', recorderId: 'u-field-001', recorderRole: 'field_manager', weather: '多云' },
    { id: 'fr-004', taskId: 't-conflict-001', recordDate: today, recordType: 'sowing', content: '北区7号田红薯栽插完成', recorderId: 'u-field-001', recorderRole: 'field_manager', weather: '晴' },
  ];

  const insertFieldRecord = db.prepare(
    `INSERT INTO field_records (id, task_id, record_date, record_type, content, recorder_id, recorder_role, weather)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  for (const fr of fieldRecords) {
    insertFieldRecord.run(fr.id, fr.taskId, fr.recordDate, fr.recordType, fr.content, fr.recorderId, fr.recorderRole, fr.weather);
  }

  const auditLogs = [
    { id: 'al-001', taskId: 't-normal-001', operatorId: 'u-director-001', operatorRole: 'cooperative_director', action: 'create', beforeStatus: null, afterStatus: 'pending_assign', failReason: null },
    { id: 'al-002', taskId: 't-normal-002', operatorId: 'u-director-001', operatorRole: 'cooperative_director', action: 'create', beforeStatus: null, afterStatus: 'pending_assign', failReason: null },
    { id: 'al-003', taskId: 't-normal-002', operatorId: 'u-director-001', operatorRole: 'cooperative_director', action: 'assign', beforeStatus: 'pending_assign', afterStatus: 'assigned', failReason: null },
    { id: 'al-004', taskId: 't-normal-003', operatorId: 'u-director-001', operatorRole: 'cooperative_director', action: 'assign', beforeStatus: 'pending_assign', afterStatus: 'assigned', failReason: null },
    { id: 'al-005', taskId: 't-normal-003', operatorId: 'u-tech-001', operatorRole: 'agricultural_technician', action: 'process', beforeStatus: 'assigned', afterStatus: 'processing', failReason: null },
    { id: 'al-006', taskId: 't-missing-001', operatorId: 'u-director-001', operatorRole: 'cooperative_director', action: 'return_for_correction', beforeStatus: 'processing', afterStatus: 'returned_for_correction', failReason: '农资领用未审批' },
    { id: 'al-007', taskId: 't-overdue-001', operatorId: 'u-director-001', operatorRole: 'cooperative_director', action: 'assign', beforeStatus: 'pending_assign', afterStatus: 'assigned', failReason: null },
    { id: 'al-008', taskId: 't-conflict-001', operatorId: 'u-tech-001', operatorRole: 'agricultural_technician', action: 'assign', beforeStatus: 'pending_assign', afterStatus: 'assigned', failReason: null },
    { id: 'al-009', taskId: 't-conflict-001', operatorId: 'u-field-001', operatorRole: 'field_manager', action: 'process', beforeStatus: 'assigned', afterStatus: 'processing', failReason: null },
  ];

  const insertAuditLog = db.prepare(
    `INSERT INTO audit_logs (id, task_id, operator_id, operator_role, action, before_status, after_status, fail_reason)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  for (const al of auditLogs) {
    insertAuditLog.run(al.id, al.taskId, al.operatorId, al.operatorRole, al.action, al.beforeStatus, al.afterStatus, al.failReason);
  }

  console.log('演示数据初始化完成');
  console.log('演示账号:');
  console.log('  合作社主任: director / 123456');
  console.log('  农技员: technician / 123456');
  console.log('  田间管理员: fieldmanager / 123456');
  console.log('');
  console.log('演示单据:');
  console.log('  正常流转: ZZ-202606-0001 (待分派) -> ZZ-202606-0002 (已分派) -> ZZ-202606-0003 (处理中)');
  console.log('  已转办: ZZ-202606-0004');
  console.log('  已回访: ZZ-202606-0005');
  console.log('  缺材料退回: ZZ-202606-0006');
  console.log('  逾期未处理: ZZ-202606-0007');
  console.log('  状态冲突: ZZ-202606-0008');
  console.log('  已归档: ZZ-202605-0001');
  console.log('');
  console.log('异常入口:');
  console.log('  越权归档: 用农技员账号尝试归档 ZZ-202606-0005');
  console.log('  重复提交: 用相同version提交 ZZ-202606-0003');
  console.log('  状态冲突: 对已归档的 ZZ-202605-0001 执行操作');
  console.log('  缺证据: 不提供evidence处理 ZZ-202606-0002');
  console.log('  越权推进: 田间管理员尝试归档');

  db.close();
}

seed();
