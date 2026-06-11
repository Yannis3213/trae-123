const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const dayjs = require('dayjs');

const dbPath = path.join(__dirname, '../../data/reimbursement.db');
const schemaPath = path.join(__dirname, 'schema.sql');

const dataDir = path.dirname(dbPath);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

function initDatabase() {
  const schemaSQL = fs.readFileSync(schemaPath, 'utf-8');
  db.exec(schemaSQL);
  _seedDemoData();
}

function _seedDemoData() {
  const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
  if (userCount > 0) return;

  const insertUser = db.prepare(
    'INSERT INTO users (username, password, real_name, role) VALUES (?, ?, ?, ?)'
  );

  const clerkPwd = bcrypt.hashSync('123456', 10);
  const accountantPwd = bcrypt.hashSync('123456', 10);
  const managerPwd = bcrypt.hashSync('123456', 10);

  const clerkId = insertUser.run('clerk01', clerkPwd, '张三', 'reimbursement_clerk').lastInsertRowid;
  const accountantId = insertUser.run('accountant01', accountantPwd, '李四', 'expense_accountant').lastInsertRowid;
  const managerId = insertUser.run('manager01', managerPwd, '王五', 'finance_manager').lastInsertRowid;

  const users = { clerkId, accountantId, managerId };

  const insertApplication = db.prepare(`
    INSERT INTO reimbursement_applications 
    (application_no, applicant_id, applicant_name, title, amount, type, status, 
     current_handler, current_handler_role, due_date, version, created_at, updated_at, is_overdue, payment_evidence)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertAttachment = db.prepare(`
    INSERT INTO attachments 
    (application_id, file_name, file_type, file_url, uploader_id, evidence_type)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const insertProcessRecord = db.prepare(`
    INSERT INTO process_records 
    (application_id, operator_id, operator_name, operator_role, from_status, to_status, 
     action, comment, evidence_snapshot, version, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertAuditNote = db.prepare(`
    INSERT INTO audit_notes (application_id, note, operator_id) VALUES (?, ?, ?)
  `);

  const insertException = db.prepare(`
    INSERT INTO exception_reasons 
    (application_id, process_record_id, reason_code, reason_detail, handler_id, resolved, resolved_at, rectify_note)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const now = dayjs();
  const apps = [];

  const a1 = insertApplication.run(
    'BX' + now.format('YYYYMMDD') + '001',
    clerkId, '张三',
    '北京出差差旅费报销', 3500.00, 'travel',
    'pending_review',
    accountantId, 'expense_accountant',
    now.add(5, 'day').format('YYYY-MM-DD HH:mm:ss'),
    1,
    now.format('YYYY-MM-DD HH:mm:ss'),
    now.format('YYYY-MM-DD HH:mm:ss'),
    0, null
  ).lastInsertRowid;
  apps.push(a1);
  insertAttachment.run(a1, '高铁票.pdf', 'application/pdf', '/uploads/ticket_g101.pdf', clerkId, 'invoice');
  insertAttachment.run(a1, '酒店发票.pdf', 'application/pdf', '/uploads/hotel_0823.pdf', clerkId, 'invoice');
  const pr1 = insertProcessRecord.run(
    a1, clerkId, '张三', 'reimbursement_clerk',
    null, 'pending_review', 'submit',
    '提交北京出差报销申请，包含高铁和酒店费用',
    JSON.stringify({ attachment_count: 2 }),
    1, now.format('YYYY-MM-DD HH:mm:ss')
  ).lastInsertRowid;

  const a2 = insertApplication.run(
    'BX' + now.format('YYYYMMDD') + '002',
    clerkId, '张三',
    '客户招待餐费报销', 1800.00, 'entertainment',
    'verifying',
    managerId, 'finance_manager',
    now.add(3, 'day').format('YYYY-MM-DD HH:mm:ss'),
    1,
    now.format('YYYY-MM-DD HH:mm:ss'),
    now.format('YYYY-MM-DD HH:mm:ss'),
    0, null
  ).lastInsertRowid;
  apps.push(a2);
  insertAttachment.run(a2, '餐饮发票.jpg', 'image/jpeg', '/uploads/meal_0915.jpg', clerkId, 'invoice');
  const pr2a = insertProcessRecord.run(
    a2, clerkId, '张三', 'reimbursement_clerk',
    null, 'pending_review', 'submit',
    '客户招待餐费申请',
    JSON.stringify({ attachment_count: 1 }),
    1, now.subtract(2, 'day').format('YYYY-MM-DD HH:mm:ss')
  ).lastInsertRowid;
  const pr2b = insertProcessRecord.run(
    a2, accountantId, '李四', 'expense_accountant',
    'pending_review', 'verifying', 'review',
    '发票真实有效，金额合理，同意审核，提交财务经理复核',
    JSON.stringify({ attachment_count: 1 }),
    1, now.subtract(1, 'day').format('YYYY-MM-DD HH:mm:ss')
  ).lastInsertRowid;
  insertAuditNote.run(a2, '招待对象：XX公司王总一行3人，洽谈2024年合作框架', accountantId);

  const a3 = insertApplication.run(
    'BX' + now.format('YYYYMMDD') + '003',
    clerkId, '张三',
    '上海出差报销（缺材料）', 4200.00, 'travel',
    'exception',
    accountantId, 'expense_accountant',
    now.add(4, 'day').format('YYYY-MM-DD HH:mm:ss'),
    1,
    now.format('YYYY-MM-DD HH:mm:ss'),
    now.format('YYYY-MM-DD HH:mm:ss'),
    0, null
  ).lastInsertRowid;
  apps.push(a3);
  insertAttachment.run(a3, '高铁票.pdf', 'application/pdf', '/uploads/sh_ticket.pdf', clerkId, 'invoice');
  const pr3a = insertProcessRecord.run(
    a3, clerkId, '张三', 'reimbursement_clerk',
    null, 'pending_review', 'submit',
    '上海出差报销，附件后续补充',
    JSON.stringify({ attachment_count: 1 }),
    1, now.subtract(3, 'day').format('YYYY-MM-DD HH:mm:ss')
  ).lastInsertRowid;
  const pr3b = insertProcessRecord.run(
    a3, accountantId, '李四', 'expense_accountant',
    'pending_review', 'exception', 'exception',
    '缺少酒店发票，暂存异常，等待补充材料',
    JSON.stringify({ attachment_count: 1 }),
    1, now.subtract(1, 'day').format('YYYY-MM-DD HH:mm:ss')
  ).lastInsertRowid;
  insertException.run(
    a3, pr3b, 'missing_evidence',
    '上海出差报销缺少酒店发票（约1800元），需补充上传',
    clerkId, 0, null, null
  );
  insertAuditNote.run(a3, '提醒报销专员尽快上传酒店发票', accountantId);

  const a4 = insertApplication.run(
    'BX' + now.format('YYYYMMDD') + '004',
    clerkId, '张三',
    '办公用品采购报销（缺材料）', 560.00, 'office',
    'returned',
    clerkId, 'reimbursement_clerk',
    now.add(2, 'day').format('YYYY-MM-DD HH:mm:ss'),
    1,
    now.format('YYYY-MM-DD HH:mm:ss'),
    now.format('YYYY-MM-DD HH:mm:ss'),
    0, null
  ).lastInsertRowid;
  apps.push(a4);
  const pr4a = insertProcessRecord.run(
    a4, clerkId, '张三', 'reimbursement_clerk',
    null, 'pending_review', 'submit',
    '办公用品采购，暂无发票',
    JSON.stringify({ attachment_count: 0 }),
    1, now.subtract(2, 'day').format('YYYY-MM-DD HH:mm:ss')
  ).lastInsertRowid;
  const pr4b = insertProcessRecord.run(
    a4, accountantId, '李四', 'expense_accountant',
    'pending_review', 'returned', 'return',
    '无任何附件凭证，退回补正，请上传采购发票或收据',
    JSON.stringify({ attachment_count: 0 }),
    1, now.subtract(1, 'day').format('YYYY-MM-DD HH:mm:ss')
  ).lastInsertRowid;
  insertException.run(
    a4, pr4b, 'missing_evidence',
    '办公用品采购报销未上传任何附件（发票/收据）',
    clerkId, 0, null, null
  );

  const overdueDue = now.subtract(7, 'day');
  const a5 = insertApplication.run(
    'BX' + now.format('YYYYMMDD') + '005',
    clerkId, '张三',
    '广州出差报销（逾期）', 5800.00, 'travel',
    'pending_review',
    accountantId, 'expense_accountant',
    overdueDue.format('YYYY-MM-DD HH:mm:ss'),
    1,
    now.subtract(12, 'day').format('YYYY-MM-DD HH:mm:ss'),
    now.subtract(12, 'day').format('YYYY-MM-DD HH:mm:ss'),
    1, null
  ).lastInsertRowid;
  apps.push(a5);
  insertAttachment.run(a5, '机票行程单.pdf', 'application/pdf', '/uploads/gz_plane.pdf', clerkId, 'invoice');
  insertAttachment.run(a5, '酒店发票.pdf', 'application/pdf', '/uploads/gz_hotel.pdf', clerkId, 'invoice');
  const pr5 = insertProcessRecord.run(
    a5, clerkId, '张三', 'reimbursement_clerk',
    null, 'pending_review', 'submit',
    '广州出差报销申请',
    JSON.stringify({ attachment_count: 2 }),
    1, now.subtract(12, 'day').format('YYYY-MM-DD HH:mm:ss')
  ).lastInsertRowid;
  insertException.run(
    a5, null, 'timeout',
    '报销单处理超时，已逾期7天，请费用会计尽快处理',
    accountantId, 0, null, null
  );

  const a6 = insertApplication.run(
    'BX' + now.format('YYYYMMDD') + '006',
    clerkId, '张三',
    '团建活动报销（逾期）', 2200.00, 'other',
    'verifying',
    managerId, 'finance_manager',
    overdueDue.format('YYYY-MM-DD HH:mm:ss'),
    1,
    now.subtract(10, 'day').format('YYYY-MM-DD HH:mm:ss'),
    now.subtract(9, 'day').format('YYYY-MM-DD HH:mm:ss'),
    1, null
  ).lastInsertRowid;
  apps.push(a6);
  insertAttachment.run(a6, '餐饮发票.jpg', 'image/jpeg', '/uploads/team_meal.jpg', clerkId, 'receipt');
  const pr6a = insertProcessRecord.run(
    a6, clerkId, '张三', 'reimbursement_clerk',
    null, 'pending_review', 'submit',
    '团建活动费用报销',
    JSON.stringify({ attachment_count: 1 }),
    1, now.subtract(10, 'day').format('YYYY-MM-DD HH:mm:ss')
  ).lastInsertRowid;
  const pr6b = insertProcessRecord.run(
    a6, accountantId, '李四', 'expense_accountant',
    'pending_review', 'verifying', 'review',
    '审核通过，提交财务经理',
    JSON.stringify({ attachment_count: 1 }),
    1, now.subtract(9, 'day').format('YYYY-MM-DD HH:mm:ss')
  ).lastInsertRowid;
  insertException.run(
    a6, null, 'timeout',
    '财务经理复核超时，已逾期7天，请尽快处理',
    managerId, 0, null, null
  );

  const a7 = insertApplication.run(
    'BX' + now.format('YYYYMMDD') + '007',
    clerkId, '张三',
    '深圳出差报销（退回补正后重提）', 3200.00, 'travel',
    'pending_review',
    accountantId, 'expense_accountant',
    now.add(6, 'day').format('YYYY-MM-DD HH:mm:ss'),
    2,
    now.subtract(8, 'day').format('YYYY-MM-DD HH:mm:ss'),
    now.subtract(3, 'day').format('YYYY-MM-DD HH:mm:ss'),
    0, null
  ).lastInsertRowid;
  apps.push(a7);
  insertAttachment.run(a7, '高铁票.pdf', 'application/pdf', '/uploads/sz_ticket_v2.pdf', clerkId, 'invoice');
  insertAttachment.run(a7, '滴滴行程.pdf', 'application/pdf', '/uploads/sz_didi.pdf', clerkId, 'receipt');
  insertAttachment.run(a7, '酒店发票.pdf', 'application/pdf', '/uploads/sz_hotel_v2.pdf', clerkId, 'invoice');
  const pr7a = insertProcessRecord.run(
    a7, clerkId, '张三', 'reimbursement_clerk',
    null, 'pending_review', 'submit',
    '深圳出差报销（初次提交）',
    JSON.stringify({ attachment_count: 1 }),
    1, now.subtract(8, 'day').format('YYYY-MM-DD HH:mm:ss')
  ).lastInsertRowid;
  const pr7b = insertProcessRecord.run(
    a7, accountantId, '李四', 'expense_accountant',
    'pending_review', 'returned', 'return',
    '缺少市内交通凭证和酒店发票，退回补正',
    JSON.stringify({ attachment_count: 1 }),
    1, now.subtract(7, 'day').format('YYYY-MM-DD HH:mm:ss')
  ).lastInsertRowid;
  insertException.run(
    a7, pr7b, 'returned_rectify',
    '退回补正：缺少市内交通凭证、酒店发票',
    clerkId, 1,
    now.subtract(3, 'day').format('YYYY-MM-DD HH:mm:ss'),
    '已补充滴滴行程单和酒店发票，请重新审核'
  );
  const pr7c = insertProcessRecord.run(
    a7, clerkId, '张三', 'reimbursement_clerk',
    'returned', 'pending_review', 'rectify',
    '已补充附件（滴滴+酒店发票），重新提交审核',
    JSON.stringify({ attachment_count: 3 }),
    2, now.subtract(3, 'day').format('YYYY-MM-DD HH:mm:ss')
  ).lastInsertRowid;

  const a8 = insertApplication.run(
    'BX' + now.format('YYYYMMDD') + '008',
    clerkId, '张三',
    '大额招待费（退回补正/状态冲突）', 15800.00, 'entertainment',
    'returned',
    clerkId, 'reimbursement_clerk',
    now.add(10, 'day').format('YYYY-MM-DD HH:mm:ss'),
    2,
    now.subtract(6, 'day').format('YYYY-MM-DD HH:mm:ss'),
    now.subtract(1, 'day').format('YYYY-MM-DD HH:mm:ss'),
    0, null
  ).lastInsertRowid;
  apps.push(a8);
  insertAttachment.run(a8, '餐饮发票1.jpg', 'image/jpeg', '/uploads/big_meal_1.jpg', clerkId, 'invoice');
  insertAttachment.run(a8, '餐饮发票2.jpg', 'image/jpeg', '/uploads/big_meal_2.jpg', clerkId, 'invoice');
  const pr8a = insertProcessRecord.run(
    a8, clerkId, '张三', 'reimbursement_clerk',
    null, 'pending_review', 'submit',
    '重要客户招待费报销',
    JSON.stringify({ attachment_count: 2 }),
    1, now.subtract(6, 'day').format('YYYY-MM-DD HH:mm:ss')
  ).lastInsertRowid;
  const pr8b = insertProcessRecord.run(
    a8, accountantId, '李四', 'expense_accountant',
    'pending_review', 'verifying', 'review',
    '金额较大，附件完整，提交经理风险复核',
    JSON.stringify({ attachment_count: 2 }),
    1, now.subtract(5, 'day').format('YYYY-MM-DD HH:mm:ss')
  ).lastInsertRowid;
  const pr8c = insertProcessRecord.run(
    a8, managerId, '王五', 'finance_manager',
    'verifying', 'returned', 'return',
    '单笔招待费超过1万，需补充：1) 招待事由详细说明 2) 参与人员名单 3) 事前审批单。状态冲突需关注版本一致性',
    JSON.stringify({ attachment_count: 2 }),
    1, now.subtract(2, 'day').format('YYYY-MM-DD HH:mm:ss')
  ).lastInsertRowid;
  insertException.run(
    a8, pr8c, 'state_conflict',
    '高风险金额报销被退回，需确认版本号是否正确同步；同时需按退回意见补充材料',
    clerkId, 0, null, null
  );
  insertException.run(
    a8, pr8c, 'returned_rectify',
    '退回补正：补充招待事由、参与人员名单、事前审批单',
    clerkId, 0, null, null
  );
  insertAuditNote.run(a8, '大额招待费退回补正，务必补充事前审批流程记录', managerId);
  const pr8d = insertProcessRecord.run(
    a8, clerkId, '张三', 'reimbursement_clerk',
    'returned', 'returned', 'rectify',
    '已补充说明文档，审批单扫描件正在走流程，先提交版本2',
    JSON.stringify({ attachment_count: 2 }),
    2, now.subtract(1, 'day').format('YYYY-MM-DD HH:mm:ss')
  ).lastInsertRowid;

  console.log('[DB] 演示数据初始化完成：');
  console.log(`  - 用户: 3 (clerk01/accountant01/manager01, 密码均为 123456)`);
  console.log(`  - 报销申请: ${apps.length} 条`);
  console.log(`    - 正常流转: 2条 (BX..001待审核, BX..002待复核)`);
  console.log(`    - 缺材料:   2条 (BX..003异常, BX..004退回)`);
  console.log(`    - 逾期:     2条 (BX..005/006, 已过期7天)`);
  console.log(`    - 退回/冲突:2条 (BX..007版本2重提, BX..008金额风险)`);
}

module.exports = {
  db,
  initDatabase
};
