import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, '..', '..', 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_PATH = path.join(DATA_DIR, 'hotel_orders.db');

export function getDb() {
  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  return db;
}

export function initDb() {
  const db = getDb();

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('registrar','supervisor','reviewer')),
      display_name TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      order_no TEXT UNIQUE NOT NULL,
      guest_name TEXT NOT NULL,
      room_no TEXT,
      check_in_date TEXT NOT NULL,
      check_out_date TEXT,
      amount REAL NOT NULL DEFAULT 0,
      order_type TEXT NOT NULL DEFAULT 'normal',
      status TEXT NOT NULL CHECK(status IN ('pending','transferred','reviewed','archived')),
      current_handler TEXT,
      current_role TEXT CHECK(current_role IN ('registrar','supervisor','reviewer')),
      deadline TEXT,
      version INTEGER NOT NULL DEFAULT 1,
      created_by TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      archived_at TEXT,
      FOREIGN KEY (created_by) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS attachments (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL,
      file_name TEXT NOT NULL,
      file_type TEXT NOT NULL,
      evidence_type TEXT NOT NULL CHECK(evidence_type IN ('id_card','registration_form','deposit_slip','review_note','other')),
      uploaded_by TEXT NOT NULL,
      uploaded_at TEXT NOT NULL,
      FOREIGN KEY (order_id) REFERENCES orders(id),
      FOREIGN KEY (uploaded_by) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS processing_records (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL,
      action TEXT NOT NULL,
      action_label TEXT NOT NULL,
      from_status TEXT,
      to_status TEXT,
      operator_id TEXT NOT NULL,
      operator_name TEXT NOT NULL,
      operator_role TEXT NOT NULL,
      handler_before TEXT,
      handler_after TEXT,
      deadline_before TEXT,
      deadline_after TEXT,
      evidence_required TEXT,
      evidence_provided TEXT,
      remark TEXT,
      version_before INTEGER,
      version_after INTEGER,
      created_at TEXT NOT NULL,
      FOREIGN KEY (order_id) REFERENCES orders(id),
      FOREIGN KEY (operator_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS audit_notes (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL,
      note_type TEXT NOT NULL CHECK(note_type IN ('normal','correction','exception')),
      content TEXT NOT NULL,
      created_by TEXT NOT NULL,
      created_by_name TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (order_id) REFERENCES orders(id),
      FOREIGN KEY (created_by) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS exception_reasons (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL,
      reason_code TEXT NOT NULL,
      reason_label TEXT NOT NULL,
      description TEXT NOT NULL,
      severity TEXT NOT NULL CHECK(severity IN ('low','medium','high')),
      reported_by TEXT NOT NULL,
      reported_by_name TEXT NOT NULL,
      resolved INTEGER NOT NULL DEFAULT 0,
      resolved_by TEXT,
      resolved_at TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (order_id) REFERENCES orders(id),
      FOREIGN KEY (reported_by) REFERENCES users(id)
    );

    CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
    CREATE INDEX IF NOT EXISTS idx_orders_role ON orders(current_role);
    CREATE INDEX IF NOT EXISTS idx_orders_handler ON orders(current_handler);
    CREATE INDEX IF NOT EXISTS idx_orders_deadline ON orders(deadline);
    CREATE INDEX IF NOT EXISTS idx_records_order ON processing_records(order_id);
    CREATE INDEX IF NOT EXISTS idx_attachments_order ON attachments(order_id);
    CREATE INDEX IF NOT EXISTS idx_notes_order ON audit_notes(order_id);
    CREATE INDEX IF NOT EXISTS idx_exceptions_order ON exception_reasons(order_id);
  `);

  const userCount = db.prepare('SELECT COUNT(*) as cnt FROM users').get().cnt;
  if (userCount === 0) {
    const now = new Date().toISOString();
    const insertUser = db.prepare(`
      INSERT INTO users (id, username, password, role, display_name, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    insertUser.run('u_registrar', 'registrar', '123456', 'registrar', '王登记（住客登记员）', now);
    insertUser.run('u_supervisor', 'supervisor', '123456', 'supervisor', '李审核（住客审核主管）', now);
    insertUser.run('u_reviewer', 'reviewer', '123456', 'reviewer', '张复核（酒店集团复核负责人）', now);
  }

  const orderCount = db.prepare('SELECT COUNT(*) as cnt FROM orders').get().cnt;
  if (orderCount === 0) {
    seedDemoOrders(db);
  }

  console.log('SQLite 初始化完成，数据库路径:', DB_PATH);
  db.close();
}

function seedDemoOrders(db) {
  const now = new Date();
  const fmt = (d) => d.toISOString();
  const addDays = (d, n) => { const nd = new Date(d); nd.setDate(nd.getDate() + n); return nd; };

  const orders = [
    {
      id: 'o_001', order_no: 'G20250601001', guest_name: '陈正常', room_no: '8601',
      check_in_date: fmt(addDays(now, -3)).slice(0,10),
      check_out_date: fmt(addDays(now, 2)).slice(0,10),
      amount: 2580, order_type: 'normal',
      status: 'pending', current_handler: 'u_registrar', current_role: 'registrar',
      deadline: fmt(addDays(now, 1)), version: 1, created_by: 'u_registrar'
    },
    {
      id: 'o_002', order_no: 'G20250601002', guest_name: '赵缺材', room_no: '7205',
      check_in_date: fmt(addDays(now, -5)).slice(0,10),
      check_out_date: fmt(addDays(now, -1)).slice(0,10),
      amount: 4800, order_type: 'normal',
      status: 'transferred', current_handler: 'u_supervisor', current_role: 'supervisor',
      deadline: fmt(addDays(now, -1)), version: 2, created_by: 'u_registrar'
    },
    {
      id: 'o_003', order_no: 'G20250601003', guest_name: '孙临期', room_no: '6312',
      check_in_date: fmt(addDays(now, -2)).slice(0,10),
      check_out_date: fmt(addDays(now, 3)).slice(0,10),
      amount: 12600, order_type: 'vip',
      status: 'transferred', current_handler: 'u_supervisor', current_role: 'supervisor',
      deadline: fmt(addDays(now, 0.2)), version: 2, created_by: 'u_registrar'
    },
    {
      id: 'o_004', order_no: 'G20250601004', guest_name: '周逾期', room_no: '5108',
      check_in_date: fmt(addDays(now, -10)).slice(0,10),
      check_out_date: fmt(addDays(now, -5)).slice(0,10),
      amount: 7200, order_type: 'normal',
      status: 'transferred', current_handler: 'u_reviewer', current_role: 'reviewer',
      deadline: fmt(addDays(now, -3)), version: 3, created_by: 'u_registrar'
    },
    {
      id: 'o_005', order_no: 'G20250601005', guest_name: '吴回访', room_no: '9502',
      check_in_date: fmt(addDays(now, -8)).slice(0,10),
      check_out_date: fmt(addDays(now, -4)).slice(0,10),
      amount: 9600, order_type: 'vip',
      status: 'reviewed', current_handler: 'u_reviewer', current_role: 'reviewer',
      deadline: fmt(addDays(now, 1)), version: 4, created_by: 'u_registrar'
    },
    {
      id: 'o_006', order_no: 'G20250601006', guest_name: '郑补正', room_no: '4306',
      check_in_date: fmt(addDays(now, -4)).slice(0,10),
      check_out_date: fmt(addDays(now, 1)).slice(0,10),
      amount: 3600, order_type: 'normal',
      status: 'transferred', current_handler: 'u_registrar', current_role: 'registrar',
      deadline: fmt(addDays(now, 2)), version: 3, created_by: 'u_registrar'
    },
    {
      id: 'o_007', order_no: 'G20250601007', guest_name: '冯冲突', room_no: '3201',
      check_in_date: fmt(addDays(now, -2)).slice(0,10),
      check_out_date: fmt(addDays(now, 3)).slice(0,10),
      amount: 5200, order_type: 'normal',
      status: 'transferred', current_handler: 'u_supervisor', current_role: 'supervisor',
      deadline: fmt(addDays(now, 0.5)), version: 2, created_by: 'u_registrar'
    },
  ];

  const insertOrder = db.prepare(`
    INSERT INTO orders (id, order_no, guest_name, room_no, check_in_date, check_out_date,
      amount, order_type, status, current_handler, current_role, deadline, version,
      created_by, created_at, updated_at)
    VALUES (@id, @order_no, @guest_name, @room_no, @check_in_date, @check_out_date,
      @amount, @order_type, @status, @current_handler, @current_role, @deadline, @version,
      @created_by, @created_at, @updated_at)
  `);

  const ts = fmt(now);
  for (const o of orders) {
    insertOrder.run({ ...o, created_at: ts, updated_at: ts });
  }

  const insertRecord = db.prepare(`
    INSERT INTO processing_records (id, order_id, action, action_label, from_status, to_status,
      operator_id, operator_name, operator_role, handler_before, handler_after,
      deadline_before, deadline_after, evidence_required, evidence_provided, remark,
      version_before, version_after, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertRecord.run('r_002_1', 'o_002', 'create', '住客登记员登记', null, 'pending',
    'u_registrar', '王登记', 'registrar', null, 'u_registrar', null, fmt(addDays(now,-1)),
    'id_card,registration_form', 'id_card', '创建订单，缺入住登记单', 0, 1, fmt(addDays(now,-5)));
  insertRecord.run('r_002_2', 'o_002', 'transfer', '转办至审核主管', 'pending', 'transferred',
    'u_registrar', '王登记', 'registrar', 'u_registrar', 'u_supervisor',
    fmt(addDays(now,-1)), fmt(addDays(now,-1)),
    'id_card,registration_form,deposit_slip', 'id_card', '先转办，材料稍后补', 1, 2, fmt(addDays(now,-4)));

  insertRecord.run('r_003_1', 'o_003', 'create', '住客登记员登记', null, 'pending',
    'u_registrar', '王登记', 'registrar', null, 'u_registrar', null, fmt(addDays(now,0.2)),
    'id_card,registration_form', 'id_card,registration_form', 'VIP客户登记', 0, 1, fmt(addDays(now,-2)));
  insertRecord.run('r_003_2', 'o_003', 'transfer', '转办至审核主管', 'pending', 'transferred',
    'u_registrar', '王登记', 'registrar', 'u_registrar', 'u_supervisor',
    fmt(addDays(now,0.2)), fmt(addDays(now,0.2)),
    'deposit_slip', 'deposit_slip', 'VIP客户材料齐全', 1, 2, fmt(addDays(now,-1)));

  insertRecord.run('r_004_1', 'o_004', 'create', '住客登记员登记', null, 'pending',
    'u_registrar', '王登记', 'registrar', null, 'u_registrar', null, fmt(addDays(now,-3)),
    'id_card,registration_form', 'id_card,registration_form', '', 0, 1, fmt(addDays(now,-10)));
  insertRecord.run('r_004_2', 'o_004', 'transfer', '转办至审核主管', 'pending', 'transferred',
    'u_registrar', '王登记', 'registrar', 'u_registrar', 'u_supervisor',
    fmt(addDays(now,-3)), fmt(addDays(now,-3)),
    'deposit_slip,review_note', 'deposit_slip,review_note', '', 1, 2, fmt(addDays(now,-9)));
  insertRecord.run('r_004_3', 'o_004', 'transfer', '转办至集团复核', 'transferred', 'transferred',
    'u_supervisor', '李审核', 'supervisor', 'u_supervisor', 'u_reviewer',
    fmt(addDays(now,-3)), fmt(addDays(now,-3)),
    'review_note', 'review_note', '前厅接待和客房主管核查无异常', 2, 3, fmt(addDays(now,-6)));

  insertRecord.run('r_005_1', 'o_005', 'create', '住客登记员登记', null, 'pending',
    'u_registrar', '王登记', 'registrar', null, 'u_registrar', null, fmt(addDays(now,1)),
    'id_card,registration_form', 'id_card,registration_form', 'VIP已回访', 0, 1, fmt(addDays(now,-8)));
  insertRecord.run('r_005_2', 'o_005', 'transfer', '转办至审核主管', 'pending', 'transferred',
    'u_registrar', '王登记', 'registrar', 'u_registrar', 'u_supervisor',
    fmt(addDays(now,1)), fmt(addDays(now,1)),
    'deposit_slip,review_note', 'deposit_slip,review_note', '完整材料', 1, 2, fmt(addDays(now,-7)));
  insertRecord.run('r_005_3', 'o_005', 'transfer', '转办至集团复核', 'transferred', 'transferred',
    'u_supervisor', '李审核', 'supervisor', 'u_supervisor', 'u_reviewer',
    fmt(addDays(now,1)), fmt(addDays(now,1)),
    'review_note', 'review_note', '前厅、客房均完成回访记录', 2, 3, fmt(addDays(now,-5)));
  insertRecord.run('r_005_4', 'o_005', 'review', '集团复核完成', 'transferred', 'reviewed',
    'u_reviewer', '张复核', 'reviewer', 'u_reviewer', 'u_reviewer',
    fmt(addDays(now,1)), fmt(addDays(now,1)),
    '', '', '复核归档前审核通过，已回访', 3, 4, fmt(addDays(now,-2)));

  insertRecord.run('r_006_1', 'o_006', 'create', '住客登记员登记', null, 'pending',
    'u_registrar', '王登记', 'registrar', null, 'u_registrar', null, fmt(addDays(now,2)),
    'id_card,registration_form', 'id_card,registration_form', '', 0, 1, fmt(addDays(now,-4)));
  insertRecord.run('r_006_2', 'o_006', 'transfer', '转办至审核主管', 'pending', 'transferred',
    'u_registrar', '王登记', 'registrar', 'u_registrar', 'u_supervisor',
    fmt(addDays(now,2)), fmt(addDays(now,2)),
    'deposit_slip', 'deposit_slip', '', 1, 2, fmt(addDays(now,-3)));
  insertRecord.run('r_006_3', 'o_006', 'return', '退回补正', 'transferred', 'transferred',
    'u_supervisor', '李审核', 'supervisor', 'u_supervisor', 'u_registrar',
    fmt(addDays(now,2)), fmt(addDays(now,2)),
    'registration_form', '', '入住登记单客户签名缺失，需补正', 2, 3, fmt(addDays(now,-1)));

  insertRecord.run('r_007_1', 'o_007', 'create', '住客登记员登记', null, 'pending',
    'u_registrar', '王登记', 'registrar', null, 'u_registrar', null, fmt(addDays(now, 0.5)),
    'id_card,registration_form', 'id_card,registration_form', '客户冲突样例登记', 0, 1, fmt(addDays(now,-2)));
  insertRecord.run('r_007_2', 'o_007', 'transfer', '转办至审核主管', 'pending', 'transferred',
    'u_registrar', '王登记', 'registrar', 'u_registrar', 'u_supervisor',
    fmt(addDays(now, 0.5)), fmt(addDays(now, 0.5)),
    'id_card,registration_form', 'id_card,registration_form,deposit_slip', '押金单已上传，核验记录待补齐（临期+可能触发状态冲突）', 1, 2, fmt(addDays(now,-1.5)));

  const insertAttachment = db.prepare(`
    INSERT INTO attachments (id, order_id, file_name, file_type, evidence_type, uploaded_by, uploaded_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  insertAttachment.run('a_001_1', 'o_001', '身份证正面.jpg', 'image/jpeg', 'id_card', 'u_registrar', fmt(addDays(now,-3)));
  insertAttachment.run('a_001_2', 'o_001', '入住登记单.pdf', 'application/pdf', 'registration_form', 'u_registrar', fmt(addDays(now,-3)));
  insertAttachment.run('a_001_3', 'o_001', '押金收据.jpg', 'image/jpeg', 'deposit_slip', 'u_registrar', fmt(addDays(now,-3)));
  insertAttachment.run('a_002_1', 'o_002', '身份证.jpg', 'image/jpeg', 'id_card', 'u_registrar', fmt(addDays(now,-5)));
  insertAttachment.run('a_003_1', 'o_003', '身份证.jpg', 'image/jpeg', 'id_card', 'u_registrar', fmt(addDays(now,-2)));
  insertAttachment.run('a_003_2', 'o_003', '登记单.pdf', 'application/pdf', 'registration_form', 'u_registrar', fmt(addDays(now,-2)));
  insertAttachment.run('a_003_3', 'o_003', 'VIP押金单.jpg', 'image/jpeg', 'deposit_slip', 'u_registrar', fmt(addDays(now,-2)));
  insertAttachment.run('a_004_1', 'o_004', '身份证.jpg', 'image/jpeg', 'id_card', 'u_registrar', fmt(addDays(now,-10)));
  insertAttachment.run('a_004_2', 'o_004', '登记单.pdf', 'application/pdf', 'registration_form', 'u_registrar', fmt(addDays(now,-10)));
  insertAttachment.run('a_004_3', 'o_004', '押金收据.jpg', 'image/jpeg', 'deposit_slip', 'u_supervisor', fmt(addDays(now,-8)));
  insertAttachment.run('a_004_4', 'o_004', '客房核查记录.pdf', 'application/pdf', 'review_note', 'u_supervisor', fmt(addDays(now,-6)));
  insertAttachment.run('a_005_1', 'o_005', '全套证件包.zip', 'application/zip', 'id_card', 'u_registrar', fmt(addDays(now,-8)));
  insertAttachment.run('a_005_2', 'o_005', '回访记录.pdf', 'application/pdf', 'review_note', 'u_reviewer', fmt(addDays(now,-2)));
  insertAttachment.run('a_006_1', 'o_006', '身份证.jpg', 'image/jpeg', 'id_card', 'u_registrar', fmt(addDays(now,-4)));
  insertAttachment.run('a_006_2', 'o_006', '登记单(无签名).pdf', 'application/pdf', 'registration_form', 'u_registrar', fmt(addDays(now,-4)));
  insertAttachment.run('a_006_3', 'o_006', '押金单.jpg', 'image/jpeg', 'deposit_slip', 'u_registrar', fmt(addDays(now,-3)));
  insertAttachment.run('a_007_1', 'o_007', '身份证_冯冲突.jpg', 'image/jpeg', 'id_card', 'u_registrar', fmt(addDays(now,-2)));
  insertAttachment.run('a_007_2', 'o_007', '入住登记单_冯冲突.pdf', 'application/pdf', 'registration_form', 'u_registrar', fmt(addDays(now,-2)));
  insertAttachment.run('a_007_3', 'o_007', '押金单_3201.jpg', 'image/jpeg', 'deposit_slip', 'u_registrar', fmt(addDays(now,-1.5)));

  const insertException = db.prepare(`
    INSERT INTO exception_reasons (id, order_id, reason_code, reason_label, description, severity,
      reported_by, reported_by_name, resolved, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  insertException.run('e_002_1', 'o_002', 'MISSING_EVIDENCE', '材料缺失', '缺少入住登记单和押金收据凭证', 'high',
    'u_supervisor', '李审核', 0, fmt(addDays(now,-3)));
  insertException.run('e_003_1', 'o_003', 'DEADLINE_WARN', '临期预警', '距办理截止不足1小时，VIP客户优先处理', 'medium',
    'u_supervisor', '李审核', 0, fmt(addDays(now,-0.3)));
  insertException.run('e_004_1', 'o_004', 'OVERDUE', '办理逾期', '该订单已逾期3天未完成归档', 'high',
    'u_reviewer', '张复核', 0, fmt(addDays(now,-2)));
  insertException.run('e_006_1', 'o_006', 'SIGNATURE_MISSING', '签名缺失退回补正', '入住登记单客人签名栏为空', 'medium',
    'u_supervisor', '李审核', 0, fmt(addDays(now,-1)));
  insertException.run('e_007_1', 'o_007', 'STATUS_CONFLICT_WARN', '状态冲突样例订单', '用于演示 STATUS_SYNC_CONFLICT / VERSION_CONFLICT 拦截：请用 curl 传入错误 page_status、或双浏览器并发提交', 'high',
    'u_supervisor', '李审核', 0, fmt(addDays(now,-1)));
  insertException.run('e_007_2', 'o_007', 'DEADLINE_WARN', '临期预警（不足半天）', '距办理截止不足12小时，优先补齐核验记录后转办集团复核', 'medium',
    'u_supervisor', '李审核', 0, fmt(addDays(now,-0.3)));

  const insertNote = db.prepare(`
    INSERT INTO audit_notes (id, order_id, note_type, content, created_by, created_by_name, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  insertNote.run('n_002_1', 'o_002', 'exception', '客户要求尽快结算，材料不齐先转办审核主管协调',
    'u_registrar', '王登记', fmt(addDays(now,-4)));
  insertNote.run('n_003_1', 'o_003', 'normal', 'VIP客户，前厅接待已确认身份信息，客房主管已查房，待值班经理复核',
    'u_supervisor', '李审核', fmt(addDays(now,-0.5)));
  insertNote.run('n_004_1', 'o_004', 'exception', '逾期订单，前厅接待已联系客人，客人出差未归，等待回传授权书',
    'u_supervisor', '李审核', fmt(addDays(now,-5)));
  insertNote.run('n_004_2', 'o_004', 'normal', '客房主管已退房核查，无物品损坏，前厅接待已核实消费记录',
    'u_supervisor', '李审核', fmt(addDays(now,-5)));
  insertNote.run('n_005_1', 'o_005', 'normal', 'VIP回访已完成，客人满意度9.5分，前厅接待和客房主管记录齐全，建议归档',
    'u_reviewer', '张复核', fmt(addDays(now,-2)));
  insertNote.run('n_006_1', 'o_006', 'correction', '入住登记单客人签名缺失，已通知前台联系客人补签后重新提交',
    'u_supervisor', '李审核', fmt(addDays(now,-1)));
  insertNote.run('n_007_1', 'o_007', 'normal',
    '【状态冲突触发方法】方法A：curl 传错误 page_status → STATUS_SYNC_CONFLICT；方法B：双浏览器同页不刷新并发 submit → VERSION_CONFLICT；方法C：非 u_supervisor 角色操作 → ROLE_MISMATCH / NOT_YOUR_HANDLER；方法D：未补齐 review_note 就转办 → MISSING_EVIDENCE',
    'u_supervisor', '李审核', fmt(addDays(now,-1)));
  insertNote.run('n_007_2', 'o_007', 'correction',
    '缺核验记录 review_note：先点「上传证据」选择类型=核验/回访记录，填写文件名后提交，再执行「转办至酒店集团复核负责人」即可通过 MISSING_EVIDENCE 校验',
    'u_supervisor', '李审核', fmt(addDays(now,-0.8)));

  console.log('示例数据导入完成：7条订单 + 对应附件、异常、备注、处理记录');
}

if (process.argv[1] && process.argv[1].includes('init.js')) {
  initDb();
}
