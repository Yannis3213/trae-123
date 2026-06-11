import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import dayjs from 'dayjs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(path.join(dataDir, 'launch-plans.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS launch_plans (
      id TEXT PRIMARY KEY,
      plan_no TEXT UNIQUE NOT NULL,
      customer_name TEXT NOT NULL,
      project_name TEXT NOT NULL,
      priority TEXT NOT NULL DEFAULT 'medium',
      deadline TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'draft',
      owner TEXT NOT NULL,
      current_handler TEXT NOT NULL,
      assignee TEXT DEFAULT '',
      accept_status TEXT DEFAULT 'unassigned',
      launch_target TEXT DEFAULT '',
      config_checklist TEXT DEFAULT '',
      acceptance_notes TEXT DEFAULT '',
      result TEXT DEFAULT '',
      reject_reason TEXT DEFAULT '',
      last_submitter TEXT DEFAULT '',
      version INTEGER NOT NULL DEFAULT 1,
      created_by TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS attachments (
      id TEXT PRIMARY KEY,
      launch_plan_id TEXT NOT NULL,
      file_name TEXT NOT NULL,
      file_path TEXT NOT NULL,
      file_size INTEGER NOT NULL DEFAULT 0,
      uploaded_by TEXT NOT NULL,
      uploaded_at TEXT NOT NULL,
      FOREIGN KEY (launch_plan_id) REFERENCES launch_plans(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS process_records (
      id TEXT PRIMARY KEY,
      launch_plan_id TEXT NOT NULL,
      action TEXT NOT NULL,
      from_status TEXT NOT NULL,
      to_status TEXT NOT NULL,
      operator TEXT NOT NULL,
      operator_role TEXT NOT NULL,
      comment TEXT DEFAULT '',
      evidence TEXT DEFAULT '',
      created_at TEXT NOT NULL,
      FOREIGN KEY (launch_plan_id) REFERENCES launch_plans(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS audit_notes (
      id TEXT PRIMARY KEY,
      launch_plan_id TEXT NOT NULL,
      note TEXT NOT NULL,
      author TEXT NOT NULL,
      author_role TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (launch_plan_id) REFERENCES launch_plans(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS exception_logs (
      id TEXT PRIMARY KEY,
      launch_plan_id TEXT,
      type TEXT NOT NULL,
      detail TEXT NOT NULL,
      operator TEXT DEFAULT '',
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_launch_plans_status ON launch_plans(status);
    CREATE INDEX IF NOT EXISTS idx_launch_plans_owner ON launch_plans(owner);
    CREATE INDEX IF NOT EXISTS idx_launch_plans_handler ON launch_plans(current_handler);
    CREATE INDEX IF NOT EXISTS idx_launch_plans_deadline ON launch_plans(deadline);
    CREATE INDEX IF NOT EXISTS idx_process_records_plan ON process_records(launch_plan_id);
    CREATE INDEX IF NOT EXISTS idx_audit_notes_plan ON audit_notes(launch_plan_id);
    CREATE INDEX IF NOT EXISTS idx_attachments_plan ON attachments(launch_plan_id);
  `);

  try {
    db.exec(`ALTER TABLE launch_plans ADD COLUMN assignee TEXT DEFAULT ''`);
  } catch {}
  try {
    db.exec(`ALTER TABLE launch_plans ADD COLUMN last_submitter TEXT DEFAULT ''`);
  } catch {}
  try {
    db.exec(`ALTER TABLE launch_plans ADD COLUMN accept_status TEXT DEFAULT 'unassigned'`);
  } catch {}

  seedInitialData();
}

function seedInitialData() {
  const count = db.prepare('SELECT COUNT(*) as cnt FROM launch_plans').get().cnt;
  if (count > 0) return;

  const now = dayjs().format('YYYY-MM-DD HH:mm:ss');
  const plans = [
    {
      id: 'plan-001',
      plan_no: 'LP-2026-0601',
      customer_name: '北京云端科技有限公司',
      project_name: 'SaaS CRM系统上线',
      priority: 'high',
      deadline: dayjs().add(5, 'day').format('YYYY-MM-DD'),
      status: 'draft',
      owner: '张三',
      current_handler: '张三',
      assignee: '',
      accept_status: 'unassigned',
      launch_target: '完成CRM系统部署，用户数据迁移完成',
      config_checklist: '1. 数据库配置\n2. 用户权限配置\n3. 集成配置',
      acceptance_notes: '',
      last_submitter: '',
      created_by: '张三',
    },
    {
      id: 'plan-002',
      plan_no: 'LP-2026-0602',
      customer_name: '上海智联网络股份有限公司',
      project_name: 'ERP财务模块上线',
      priority: 'urgent',
      deadline: dayjs().add(1, 'day').format('YYYY-MM-DD'),
      status: 'pending_review',
      owner: '张三',
      current_handler: '王总',
      assignee: '李四',
      accept_status: 'accepted',
      launch_target: '财务模块上线，发票、凭证流程打通',
      config_checklist: '1. 财务科目配置\n2. 审批流配置\n3. 报表配置',
      acceptance_notes: '客户已完成UAT测试，签字确认',
      last_submitter: '李四',
      created_by: '张三',
    },
    {
      id: 'plan-003',
      plan_no: 'LP-2026-0603',
      customer_name: '深圳创新智造科技',
      project_name: 'MES生产管理系统上线',
      priority: 'medium',
      deadline: dayjs().subtract(2, 'day').format('YYYY-MM-DD'),
      status: 'draft',
      owner: '王五',
      current_handler: '王五',
      assignee: '',
      accept_status: 'unassigned',
      launch_target: '生产管理模块上线，工单流程跑通',
      config_checklist: '',
      acceptance_notes: '',
      last_submitter: '',
      created_by: '王五',
    },
    {
      id: 'plan-004',
      plan_no: 'LP-2026-0604',
      customer_name: '广州优享电商平台',
      project_name: '会员营销系统上线',
      priority: 'low',
      deadline: dayjs().add(10, 'day').format('YYYY-MM-DD'),
      status: 'archived',
      owner: '赵六',
      current_handler: '赵六',
      assignee: '',
      accept_status: 'accepted',
      launch_target: '会员营销系统上线，积分、优惠券功能可用',
      config_checklist: '1. 会员等级配置\n2. 积分规则配置\n3. 优惠券模板',
      acceptance_notes: '客户方负责人签字确认上线完成',
      result: '上线成功，系统运行稳定，客户满意度高',
      last_submitter: '赵六',
      created_by: '赵六',
    },
    {
      id: 'plan-005',
      plan_no: 'LP-2026-0605',
      customer_name: '杭州数智科技有限公司',
      project_name: 'BI数据分析平台上线',
      priority: 'high',
      deadline: dayjs().add(3, 'day').format('YYYY-MM-DD'),
      status: 'draft',
      owner: '张三',
      current_handler: '李四',
      assignee: '李四',
      accept_status: 'assigned',
      launch_target: 'BI平台上线，报表和仪表盘功能交付',
      config_checklist: '1. 数据源配置\n2. 报表模板配置\n3. 权限配置',
      acceptance_notes: '',
      last_submitter: '',
      created_by: '张三',
    },
    {
      id: 'plan-006',
      plan_no: 'LP-2026-0606',
      customer_name: '成都智能科技有限公司',
      project_name: '智能制造IoT平台上线',
      priority: 'high',
      deadline: dayjs().add(2, 'day').format('YYYY-MM-DD'),
      status: 'draft',
      owner: '张三',
      current_handler: '王五',
      assignee: '李四',
      accept_status: 'accepted',
      launch_target: 'IoT平台上线，设备接入与数据采集完成',
      config_checklist: '1. MQTT服务配置\n2. 设备接入配置\n3. 告警规则配置',
      acceptance_notes: '',
      last_submitter: '',
      created_by: '张三',
    },
  ];

  const insertPlan = db.prepare(`
    INSERT INTO launch_plans (
      id, plan_no, customer_name, project_name, priority, deadline, status,
      owner, current_handler, assignee, accept_status, launch_target, config_checklist, acceptance_notes,
      result, last_submitter, version, created_by, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const p of plans) {
    insertPlan.run(
      p.id, p.plan_no, p.customer_name, p.project_name, p.priority,
      p.deadline, p.status, p.owner, p.current_handler, p.assignee || '',
      p.accept_status || 'unassigned',
      p.launch_target, p.config_checklist, p.acceptance_notes,
      p.result || '', p.last_submitter || '', 1, p.created_by, now, now
    );
  }

  const insertRecord = db.prepare(`
    INSERT INTO process_records (
      id, launch_plan_id, action, from_status, to_status, operator,
      operator_role, comment, evidence, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertRecord.run(
    'rec-001', 'plan-001', 'create', '', 'draft',
    '张三', 'cs_manager', '客户成功经理创建上线计划单', '', now
  );
  insertRecord.run(
    'rec-002', 'plan-002', 'create', '', 'draft',
    '张三', 'cs_manager', '客户成功经理创建上线计划单', '', now
  );
  insertRecord.run(
    'rec-003', 'plan-002', 'assign', 'draft', 'draft',
    '张三', 'cs_manager', '指派交付顾问李四办理', '李四', now
  );
  insertRecord.run(
    'rec-004', 'plan-002', 'accept', 'draft', 'draft',
    '李四', 'delivery_consultant', '交付顾问接办', '', now
  );
  insertRecord.run(
    'rec-005', 'plan-002', 'submit', 'draft', 'pending_review',
    '李四', 'delivery_consultant', '配置完成，提交审核', '配置截图3张', now
  );
  insertRecord.run(
    'rec-006', 'plan-005', 'create', '', 'draft',
    '张三', 'cs_manager', '客户成功经理创建上线计划单', '', now
  );
  insertRecord.run(
    'rec-007', 'plan-005', 'assign', 'draft', 'draft',
    '张三', 'cs_manager', '指派交付顾问李四办理', '李四', now
  );
  insertRecord.run(
    'rec-008', 'plan-006', 'create', '', 'draft',
    '张三', 'cs_manager', '客户成功经理创建上线计划单', '', now
  );
  insertRecord.run(
    'rec-009', 'plan-006', 'assign', 'draft', 'draft',
    '张三', 'cs_manager', '指派交付顾问李四办理', '李四', now
  );
  insertRecord.run(
    'rec-010', 'plan-006', 'accept', 'draft', 'draft',
    '李四', 'delivery_consultant', '交付顾问李四接办', '', now
  );
  insertRecord.run(
    'rec-011', 'plan-006', 'update', 'draft', 'draft',
    '王五', 'delivery_consultant', '处理人被错误变更为王五', '处理人错位：应为李四', now
  );

  insertRecord.run(
    'rec-101', 'plan-004', 'create', '', 'draft',
    '赵六', 'delivery_consultant', '交付顾问创建上线计划单', '', now
  );
  insertRecord.run(
    'rec-102', 'plan-004', 'submit', 'draft', 'pending_review',
    '赵六', 'delivery_consultant', '上线完成，提交复核', '验收单扫描件', now
  );
  insertRecord.run(
    'rec-103', 'plan-004', 'archive', 'pending_review', 'archived',
    '王总', 'cs_lead', '复核通过，归档', '验收确认书', now
  );

  const insertAudit = db.prepare(`
    INSERT INTO audit_notes (id, launch_plan_id, note, author, author_role, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  insertAudit.run(
    'audit-001', 'plan-004', '已确认客户方验收报告签字完整，财务对账无异常',
    '王总', 'cs_lead', now
  );
  insertAudit.run(
    'audit-002', 'plan-006', '【冲突样例】李四已接办该单据，但处理人被错误变更为王五，演示「处理人错位」校验场景',
    '系统', 'admin', now
  );
}

export default db;
