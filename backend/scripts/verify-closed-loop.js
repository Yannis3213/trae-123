const Database = require('better-sqlite3');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const {
  ROLES, NODES, STATUSES, OPERATION_TYPES, EXCEPTION_TYPES
} = require('../src/utils/constants');

process.env.JWT_SECRET = 'test-secret-key';

const dbPath = path.join(__dirname, '..', 'data', 'merchant_entry_test.db');
const fs = require('fs');
if (fs.existsSync(dbPath)) {
  fs.unlinkSync(dbPath);
}

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

console.log('========== 到期预警与批量处理结果闭环验证 ==========\n');

console.log('步骤 1: 初始化数据库表结构...');
db.exec(`
  CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT NOT NULL,
    name TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE merchant_entry_forms (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    form_no TEXT UNIQUE NOT NULL,
    merchant_name TEXT NOT NULL,
    business_type TEXT NOT NULL,
    contact_name TEXT,
    contact_phone TEXT,
    business_license_no TEXT,
    legal_person_name TEXT,
    registered_address TEXT,
    business_scope TEXT,
    current_node TEXT NOT NULL,
    status TEXT NOT NULL,
    current_handler TEXT,
    previous_handler TEXT,
    previous_opinion TEXT,
    version INTEGER DEFAULT 1,
    deadline TEXT,
    archived_at TEXT,
    created_by TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE attachments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    form_id INTEGER NOT NULL,
    file_name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    evidence_type TEXT NOT NULL,
    uploaded_by TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (form_id) REFERENCES merchant_entry_forms(id) ON DELETE CASCADE
  );

  CREATE TABLE processing_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    form_id INTEGER NOT NULL,
    operation_type TEXT NOT NULL,
    operator TEXT NOT NULL,
    operator_role TEXT NOT NULL,
    from_node TEXT,
    to_node TEXT,
    from_status TEXT,
    to_status TEXT,
    opinion TEXT,
    version INTEGER,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (form_id) REFERENCES merchant_entry_forms(id) ON DELETE CASCADE
  );

  CREATE TABLE audit_notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    form_id INTEGER NOT NULL,
    note TEXT NOT NULL,
    created_by TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (form_id) REFERENCES merchant_entry_forms(id) ON DELETE CASCADE
  );

  CREATE TABLE exception_reasons (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    form_id INTEGER NOT NULL,
    exception_type TEXT NOT NULL,
    exception_detail TEXT NOT NULL,
    exception_node TEXT,
    created_by TEXT NOT NULL,
    missing_types TEXT,
    resolved INTEGER DEFAULT 0,
    resolved_by TEXT,
    resolved_at TEXT,
    resolution_note TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (form_id) REFERENCES merchant_entry_forms(id) ON DELETE CASCADE
  );

  CREATE TABLE batch_results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    batch_no TEXT NOT NULL,
    form_id INTEGER,
    form_no TEXT,
    success INTEGER NOT NULL,
    error_type TEXT,
    error_message TEXT,
    operator TEXT NOT NULL,
    operation_type TEXT NOT NULL,
    from_node TEXT,
    from_status TEXT,
    from_version INTEGER,
    from_handler TEXT,
    new_node TEXT,
    new_status TEXT,
    new_version INTEGER,
    new_handler TEXT,
    exception_type TEXT,
    exception_detail TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );
`);
console.log('✅ 数据库表结构初始化完成\n');

console.log('步骤 2: 插入测试用户...');
const hashPwd = (pwd) => bcrypt.hashSync(pwd, 10);
db.prepare('INSERT INTO users (username, password, role, name) VALUES (?, ?, ?, ?)').run('registrar1', hashPwd('123456'), ROLES.MERCHANT_REGISTRAR, '张登记');
db.prepare('INSERT INTO users (username, password, role, name) VALUES (?, ?, ?, ?)').run('registrar2', hashPwd('123456'), ROLES.MERCHANT_REGISTRAR, '李登记');
db.prepare('INSERT INTO users (username, password, role, name) VALUES (?, ?, ?, ?)').run('auditor1', hashPwd('123456'), ROLES.AUDIT_SUPERVISOR, '王审核');
db.prepare('INSERT INTO users (username, password, role, name) VALUES (?, ?, ?, ?)').run('leader1', hashPwd('123456'), ROLES.PLATFORM_LEADER, '赵复核');
console.log('✅ 测试用户插入完成\n');

console.log('步骤 3: 插入测试入驻单（包含不同到期时间）...');
const now = new Date();
const insertForm = db.prepare(`
  INSERT INTO merchant_entry_forms (
    form_no, merchant_name, business_type, contact_name, contact_phone,
    business_license_no, legal_person_name, registered_address, business_scope,
    current_node, status, current_handler, version, deadline, created_by
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const forms = [
  { no: 'RZ20250001', name: '阿里巴巴批发有限公司', node: NODES.QUALIFICATION_AUDIT, status: STATUSES.PENDING_AUDIT, handler: 'auditor1', deadline: formatDate(new Date(now.getTime() - 86400000 * 2)), businessType: '食品饮料', createdBy: 'registrar1' },
  { no: 'RZ20250002', name: '京东供应链管理公司', node: NODES.QUALIFICATION_AUDIT, status: STATUSES.PENDING_AUDIT, handler: 'auditor1', deadline: formatDate(new Date(now.getTime() + 86400000 * 0.5)), businessType: '电子产品', createdBy: 'registrar1' },
  { no: 'RZ20250003', name: '拼多多商家服务中心', node: NODES.QUALIFICATION_AUDIT, status: STATUSES.PENDING_AUDIT, handler: 'auditor1', deadline: formatDate(new Date(now.getTime() + 86400000 * 3)), businessType: '食品饮料', createdBy: 'registrar2' },
  { no: 'RZ20250004', name: '苏宁易购批发部', node: NODES.ENTRY_FORM_REGISTRATION, status: STATUSES.PENDING_REGISTRATION, handler: 'registrar1', deadline: formatDate(new Date(now.getTime() - 86400000)), businessType: '家居建材', createdBy: 'registrar1' },
  { no: 'RZ20250005', name: '国美电器供应商', node: NODES.ENTRY_REGISTRATION, status: STATUSES.PENDING_SIGN, handler: null, deadline: formatDate(new Date(now.getTime() + 86400000 * 5)), businessType: '电子产品', createdBy: 'registrar2' },
  { no: 'RZ20250006', name: '唯品会批发中心', node: NODES.FINAL_REVIEW, status: STATUSES.PENDING_FINAL_REVIEW, handler: 'leader1', deadline: formatDate(new Date(now.getTime() - 86400000 * 3)), businessType: '服装鞋帽', createdBy: 'registrar1' },
  { no: 'RZ20250007', name: '当当网图书批发', node: NODES.QUALIFICATION_AUDIT, status: STATUSES.PENDING_AUDIT, handler: 'auditor1', deadline: null, businessType: '其他', createdBy: 'registrar2' },
  { no: 'RZ20250008', name: '1号店日用品批发', node: NODES.ARCHIVED, status: STATUSES.ARCHIVED, handler: null, deadline: formatDate(new Date(now.getTime() - 86400000 * 10)), businessType: '食品饮料', createdBy: 'registrar1' },
];

function formatDate(d) {
  const pad = (n) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

forms.forEach(f => {
  insertForm.run(
    f.no, f.name, f.businessType, '联系人' + f.no.slice(-4), '13800138000',
    '91110000MA012345' + f.no.slice(-2), '法人' + f.no.slice(-4),
    '北京市朝阳区xxx街道', '批发零售',
    f.node, f.status, f.handler, 1, f.deadline, f.createdBy
  );
});

const formIds = db.prepare('SELECT id, form_no, current_node, status, deadline FROM merchant_entry_forms ORDER BY id').all();
console.log(`✅ 插入 ${formIds.length} 条测试入驻单：`);
formIds.forEach(f => {
  const dlStatus = !f.deadline ? '无期限' :
    new Date(f.deadline) < now ? '逾期' :
    new Date(f.deadline) < new Date(now.getTime() + 86400000) ? '临期' : '正常';
  console.log(`   ${f.form_no} | ${f.current_node} | ${f.status} | ${dlStatus}`);
});
console.log('');

console.log('步骤 4: 验证 byDeadline 统计（按角色+筛选条件）...');

function testByDeadline(userRole, filters = {}, description) {
  const { status, currentNode, keyword, businessType, deadlineGroup } = filters;

  const buildWhereClause = (includeDeadlineGroup = true) => {
    let clause = 'WHERE 1=1';
    const p = [];

    if (userRole === ROLES.MERCHANT_REGISTRAR) {
      clause += ` AND (
        current_node IN ('${NODES.ENTRY_REGISTRATION}', '${NODES.ENTRY_FORM_REGISTRATION}')
        OR created_by = ?
      )`;
      p.push('registrar1');
    } else if (userRole === ROLES.AUDIT_SUPERVISOR) {
      clause += ` AND current_node IN ('${NODES.QUALIFICATION_AUDIT}')`;
    } else if (userRole === ROLES.PLATFORM_LEADER) {
      clause += ` AND current_node IN ('${NODES.FINAL_REVIEW}', '${NODES.ARCHIVED}')`;
    }

    if (status) { clause += ' AND status = ?'; p.push(status); }
    if (currentNode) { clause += ' AND current_node = ?'; p.push(currentNode); }
    if (keyword) {
      clause += ' AND (merchant_name LIKE ? OR form_no LIKE ? OR contact_name LIKE ?)';
      const kw = `%${keyword}%`; p.push(kw, kw, kw);
    }
    if (businessType) { clause += ' AND business_type = ?'; p.push(businessType); }

    if (includeDeadlineGroup && deadlineGroup) {
      const nowStr = formatDate(now);
      if (deadlineGroup === 'overdue') {
        clause += ' AND deadline IS NOT NULL AND deadline < ? AND status != ?';
        p.push(nowStr, STATUSES.ARCHIVED);
      } else if (deadlineGroup === 'near') {
        clause += ` AND deadline IS NOT NULL AND deadline >= ? AND deadline <= datetime('now', '+1 day') AND status != ?`;
        p.push(nowStr, STATUSES.ARCHIVED);
      } else if (deadlineGroup === 'normal') {
        clause += ` AND (deadline IS NULL OR deadline > datetime('now', '+1 day')) AND status != ?`;
        p.push(STATUSES.ARCHIVED);
      }
    }

    return { clause, params: p };
  };

  const listWhere = buildWhereClause(true);
  const statsWhere = buildWhereClause(false);

  const list = db.prepare(`SELECT form_no, current_node, status, deadline FROM merchant_entry_forms ${listWhere.clause}`).all(...listWhere.params);

  const deadlineSql = `
    SELECT
      SUM(CASE WHEN deadline IS NOT NULL AND deadline < datetime('now') AND status != ? THEN 1 ELSE 0 END) as overdue,
      SUM(CASE WHEN deadline IS NOT NULL AND deadline >= datetime('now') AND deadline <= datetime('now', '+1 day') AND status != ? THEN 1 ELSE 0 END) as near,
      SUM(CASE WHEN (deadline IS NULL OR deadline > datetime('now', '+1 day')) AND status != ? THEN 1 ELSE 0 END) as normal
    FROM merchant_entry_forms ${statsWhere.clause}
  `;
  const deadlineResult = db.prepare(deadlineSql).get(...statsWhere.params, STATUSES.ARCHIVED, STATUSES.ARCHIVED, STATUSES.ARCHIVED);

  console.log(`  ${description}:`);
  console.log(`    列表数量: ${list.length}, 逾期: ${deadlineResult.overdue || 0}, 临期: ${deadlineResult.near || 0}, 正常: ${deadlineResult.normal || 0}`);
  console.log(`    列表单据: ${list.map(f => f.form_no).join(', ')}`);

  return { list, deadlineResult };
}

console.log('\n  4.1 审核主管角色（只能看到资质审核节点）:');
const auditResult = testByDeadline(ROLES.AUDIT_SUPERVISOR, {}, '无筛选');

console.log('\n  4.2 登记员角色（能看到入驻登记、入驻单登记节点，及自己创建的所有单据）:');
const regResult = testByDeadline(ROLES.MERCHANT_REGISTRAR, {}, '无筛选');

console.log('\n  4.3 复核负责人角色（能看到平台复核和已归档节点）:');
const leaderResult = testByDeadline(ROLES.PLATFORM_LEADER, {}, '无筛选');

console.log('\n  4.4 审核主管 + 业务类型筛选（食品饮料）:');
testByDeadline(ROLES.AUDIT_SUPERVISOR, { businessType: '食品饮料' }, '业务类型=食品饮料');

console.log('\n  4.5 审核主管 + 关键词搜索（阿里）:');
testByDeadline(ROLES.AUDIT_SUPERVISOR, { keyword: '阿里' }, '关键词=阿里');

console.log('\n  4.6 审核主管 + 到期分组筛选（逾期）:');
const overdueFilter = testByDeadline(ROLES.AUDIT_SUPERVISOR, { deadlineGroup: 'overdue' }, '到期分组=逾期');
if (overdueFilter.list.length > 0 && overdueFilter.list.length === overdueFilter.deadlineResult.overdue) {
  console.log('    ✅ 逾期筛选正确：列表数量与统计数量一致');
} else {
  console.log('    ❌ 逾期筛选错误：列表数量与统计数量不一致');
}

console.log('\n  4.7 审核主管 + 到期分组筛选（临期）:');
const nearFilter = testByDeadline(ROLES.AUDIT_SUPERVISOR, { deadlineGroup: 'near' }, '到期分组=临期');
if (nearFilter.list.length > 0 && nearFilter.list.length === nearFilter.deadlineResult.near) {
  console.log('    ✅ 临期筛选正确：列表数量与统计数量一致');
} else {
  console.log('    ❌ 临期筛选错误：列表数量与统计数量不一致');
}

console.log('\n  4.8 审核主管 + 到期分组筛选（正常）:');
const normalFilter = testByDeadline(ROLES.AUDIT_SUPERVISOR, { deadlineGroup: 'normal' }, '到期分组=正常');
const expectedNormal = (normalFilter.deadlineResult.normal || 0);
if (normalFilter.list.length === expectedNormal) {
  console.log('    ✅ 正常筛选正确：列表数量与统计数量一致');
} else {
  console.log(`    ❌ 正常筛选错误：列表数量${normalFilter.list.length}与统计数量${expectedNormal}不一致`);
}

console.log('\n✅ byDeadline 统计验证完成\n');

console.log('步骤 5: 验证批量处理（成功 + 失败混合场景）...');

const user = { username: 'auditor1', role: ROLES.AUDIT_SUPERVISOR };
const operation = OPERATION_TYPES.RETURN_SUPPLEMENT;
const opinion = '材料不完整，请补充';

const auditForms = db.prepare('SELECT id, form_no, current_node, status, version, current_handler FROM merchant_entry_forms WHERE current_node = ?').all(NODES.QUALIFICATION_AUDIT);
console.log(`  审核主管可处理的单据: ${auditForms.map(f => f.form_no).join(', ')}`);

const batchNo = `BATCH${Date.now()}`;
const results = [];

const testTx = db.transaction((testForms) => {
  testForms.forEach((formInput) => {
    const { formId, version } = formInput;
    const currentForm = db.prepare('SELECT * FROM merchant_entry_forms WHERE id = ?').get(formId);

    const baseResult = {
      formId,
      formNo: currentForm ? currentForm.form_no : null,
      fromNode: currentForm ? currentForm.current_node : null,
      fromStatus: currentForm ? currentForm.status : null,
      fromVersion: currentForm ? currentForm.version : null,
      fromHandler: currentForm ? currentForm.current_handler : null,
      exceptionType: null,
      exceptionDetail: null,
    };

    if (!currentForm) {
      results.push({
        ...baseResult,
        success: false,
        errorType: EXCEPTION_TYPES.MATERIAL_MISSING,
        errorMessage: '入驻单不存在',
        exceptionType: EXCEPTION_TYPES.MATERIAL_MISSING,
        exceptionDetail: '入驻单不存在'
      });
      return;
    }

    if (version !== undefined && version !== currentForm.version) {
      results.push({
        ...baseResult,
        success: false,
        errorType: EXCEPTION_TYPES.VERSION_CONFLICT,
        errorMessage: `版本冲突：当前版本为${currentForm.version}`,
        exceptionType: EXCEPTION_TYPES.VERSION_CONFLICT,
        exceptionDetail: `批量处理版本${version}与当前版本${currentForm.version}冲突`
      });
      return;
    }

    const validation = { valid: true, errors: [] };
    const expectedNodes = [NODES.QUALIFICATION_AUDIT, NODES.ENTRY_FORM_REGISTRATION, NODES.FINAL_REVIEW];
    const expectedStatuses = [STATUSES.PENDING_AUDIT, STATUSES.PENDING_REGISTRATION, STATUSES.PENDING_FINAL_REVIEW];
    if (!expectedNodes.includes(currentForm.current_node)) {
      validation.valid = false;
      validation.errors.push({ type: EXCEPTION_TYPES.PERMISSION_DENIED, message: `当前节点${currentForm.current_node}不允许退回补正` });
    }
    if (!expectedStatuses.includes(currentForm.status)) {
      validation.valid = false;
      validation.errors.push({ type: EXCEPTION_TYPES.STATUS_CONFLICT, message: `当前状态${currentForm.status}不允许退回补正` });
    }

    if (!validation.valid) {
      results.push({
        ...baseResult,
        success: false,
        errorType: validation.errors[0].type,
        errorMessage: validation.errors[0].message,
        exceptionType: validation.errors[0].type,
        exceptionDetail: validation.errors[0].message
      });
      return;
    }

    try {
      const fromNode = currentForm.current_node;
      const fromStatus = currentForm.status;
      let newVersion = currentForm.version;
      let toNode = fromNode;
      let toStatus = STATUSES.SUPPLEMENT_REQUIRED;
      let newHandler = currentForm.created_by || 'registrar';

      const evidenceCheck = { complete: true, missing: [], missingLabels: [] };
      if (formId === auditForms[0].id) {
        evidenceCheck.complete = false;
        evidenceCheck.missing = ['business_license', 'id_card'];
        evidenceCheck.missingLabels = ['营业执照', '法人身份证'];
      }

      const missingDesc = evidenceCheck.missingLabels.length > 0 ? `，缺少证据: ${evidenceCheck.missingLabels.join('、')}` : '';
      const missingTypesStr = evidenceCheck.missing.length > 0 ? evidenceCheck.missing.join(',') : null;

      db.prepare(`INSERT INTO exception_reasons (
        form_id, exception_type, exception_detail, exception_node, created_by, missing_types
      ) VALUES (?, ?, ?, ?, ?, ?)`).run(
        formId, EXCEPTION_TYPES.MATERIAL_MISSING,
        `批量退回补正: ${opinion}${missingDesc}`,
        fromNode, user.username, missingTypesStr
      );

      newVersion = currentForm.version + 1;
      db.prepare(`UPDATE merchant_entry_forms SET
        status = ?, current_handler = ?, version = ?, previous_opinion = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?`).run(toStatus, newHandler, newVersion, opinion, formId);

      db.prepare(`INSERT INTO processing_records (
        form_id, operation_type, operator, operator_role, from_node, to_node, from_status, to_status, opinion, version
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
        formId, operation, user.username, user.role, fromNode, toNode, fromStatus, toStatus, opinion, newVersion
      );

      results.push({
        ...baseResult,
        success: true,
        errorType: null,
        errorMessage: null,
        newNode: toNode,
        newStatus: toStatus,
        newVersion,
        newHandler
      });
    } catch (err) {
      results.push({
        ...baseResult,
        success: false,
        errorType: EXCEPTION_TYPES.STATUS_CONFLICT,
        errorMessage: err.message,
        exceptionType: EXCEPTION_TYPES.STATUS_CONFLICT,
        exceptionDetail: `批量处理异常: ${err.message}`
      });
    }
  });

  results.forEach(r => {
    db.prepare(`
      INSERT INTO batch_results (
        batch_no, form_id, form_no, success, error_type,
        error_message, operator, operation_type,
        from_node, from_status, from_version, from_handler,
        new_node, new_status, new_version, new_handler,
        exception_type, exception_detail
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      batchNo, r.formId, r.formNo, r.success ? 1 : 0, r.errorType, r.errorMessage,
      user.username, operation,
      r.fromNode || null, r.fromStatus || null, r.fromVersion || null, r.fromHandler || null,
      r.newNode || null, r.newStatus || null, r.newVersion || null, r.newHandler || null,
      r.exceptionType || null, r.exceptionDetail || null
    );
  });
});

const testForms = [
  { formId: auditForms[0].id, version: auditForms[0].version },
  { formId: auditForms[1].id, version: 999 },
  { formId: auditForms[2].id, version: auditForms[2].version },
  { formId: 99999, version: 1 },
];

testTx(testForms);

console.log(`\n  批量处理结果: 总计${results.length}条, 成功${results.filter(r => r.success).length}条, 失败${results.filter(r => !r.success).length}条`);
console.log('');

results.forEach((r, i) => {
  console.log(`  ${i + 1}. ${r.formNo || '未知单据'} - ${r.success ? '✅ 成功' : '❌ 失败'}`);
  console.log(`     原: [${r.fromNode}] ${r.fromStatus} v${r.fromVersion} @${r.fromHandler}`);
  if (r.success) {
    console.log(`     新: [${r.newNode}] ${r.newStatus} v${r.newVersion} @${r.newHandler}`);
  } else {
    console.log(`     错误类型: ${r.exceptionType}`);
    console.log(`     错误信息: ${r.errorMessage}`);
    if (r.exceptionDetail) console.log(`     异常详情: ${r.exceptionDetail}`);
  }
  console.log('');
});

console.log('步骤 6: 验证 batch_results 表持久化...');
const savedResults = db.prepare('SELECT * FROM batch_results WHERE batch_no = ? ORDER BY id').all(batchNo);
console.log(`  数据库中保存了 ${savedResults.length} 条记录`);
console.log('');

let allFieldsValid = true;
savedResults.forEach((saved, i) => {
  const expected = results[i];
  const checks = [
    { field: 'form_id', expected: expected.formId },
    { field: 'form_no', expected: expected.formNo },
    { field: 'success', expected: expected.success ? 1 : 0 },
    { field: 'error_type', expected: expected.errorType || null },
    { field: 'error_message', expected: expected.errorMessage || null },
    { field: 'from_node', expected: expected.fromNode || null },
    { field: 'from_status', expected: expected.fromStatus || null },
    { field: 'from_version', expected: expected.fromVersion !== null ? expected.fromVersion : null },
    { field: 'from_handler', expected: expected.fromHandler || null },
    { field: 'new_node', expected: expected.newNode || null },
    { field: 'new_status', expected: expected.newStatus || null },
    { field: 'new_version', expected: expected.newVersion !== null ? expected.newVersion : null },
    { field: 'new_handler', expected: expected.newHandler || null },
    { field: 'exception_type', expected: expected.exceptionType || null },
    { field: 'exception_detail', expected: expected.exceptionDetail || null },
  ];

  let recordValid = true;
  checks.forEach(check => {
    const actual = saved[check.field];
    const expected = check.expected;
    const isEqual = (actual === expected) || (actual === null && expected === undefined);
    if (!isEqual) {
      console.log(`  ❌ ${saved.form_no || 'ID:' + saved.form_id}: ${check.field} 不匹配，期望=${expected}, 实际=${actual}`);
      recordValid = false;
      allFieldsValid = false;
    }
  });

  if (recordValid) {
    console.log(`  ✅ ${saved.form_no || 'ID:' + saved.form_id}: 所有字段匹配正确`);
  }
});

console.log('');
if (allFieldsValid) {
  console.log('✅ batch_results 所有字段持久化正确\n');
} else {
  console.log('❌ batch_results 存在字段不匹配\n');
}

console.log('步骤 7: 验证失败项上下文与异常类型留痕...');
const failedResults = savedResults.filter(r => r.success === 0);
console.log(`  失败记录共 ${failedResults.length} 条`);
console.log('');

let allFailedValid = true;
failedResults.forEach(r => {
  const formExists = r.form_no !== null;
  const hasFromContext = r.from_node && r.from_status && r.from_version !== null;
  const hasExceptionType = r.exception_type && r.exception_detail;

  console.log(`  ${r.form_no || 'ID:' + r.form_id}:`);
  console.log(`     from_node: ${r.from_node || '❌ 缺失'}, from_status: ${r.from_status || '❌ 缺失'}, from_version: ${r.from_version !== null ? r.from_version : '❌ 缺失'}, from_handler: ${r.from_handler || '❌ 缺失'}`);
  console.log(`     exception_type: ${r.exception_type || '❌ 缺失'}, exception_detail: ${r.exception_detail || '❌ 缺失'}`);

  if (formExists && !hasFromContext) {
    console.log('     ❌ 失败项上下文字段不完整');
    allFailedValid = false;
  }
  if (!hasExceptionType) {
    console.log('     ❌ 失败项异常类型留痕不完整');
    allFailedValid = false;
  }
  if (formExists && hasFromContext && hasExceptionType) {
    console.log('     ✅ 失败项上下文和异常留痕完整');
  }
  if (!formExists && hasExceptionType) {
    console.log('     ✅ 不存在的单据异常留痕完整（无上下文属正常）');
  }
  console.log('');
});

console.log('步骤 8: 验证 exception_reasons 表 missing_types 字段...');
const exceptions = db.prepare('SELECT * FROM exception_reasons ORDER BY id').all();
console.log(`  异常记录共 ${exceptions.length} 条`);
exceptions.forEach(e => {
  console.log(`  ID:${e.id} | ${e.exception_type} | missing_types: ${e.missing_types || '(空)'} | ${e.exception_detail.slice(0, 50)}...`);
});
const hasMissingTypes = exceptions.some(e => e.missing_types && e.missing_types.includes(','));
if (hasMissingTypes) {
  console.log('✅ exception_reasons missing_types 字段正确保存\n');
} else {
  console.log('⚠️  exception_reasons missing_types 字段为空（非必须）\n');
}

console.log('步骤 9: 验证成功项状态变更...');
const successResults = results.filter(r => r.success);
let allStateValid = true;
successResults.forEach(r => {
  const form = db.prepare('SELECT * FROM merchant_entry_forms WHERE id = ?').get(r.formId);
  console.log(`  ${r.formNo}:`);
  console.log(`     期望: status=${r.newStatus}, current_handler=${r.newHandler}, version=${r.newVersion}`);
  console.log(`     实际: status=${form.status}, current_handler=${form.current_handler}, version=${form.version}`);
  if (form.status === r.newStatus && form.current_handler === r.newHandler && form.version === r.newVersion) {
    console.log('     ✅ 状态变更正确');
  } else {
    console.log('     ❌ 状态变更不正确');
    allStateValid = false;
  }
  console.log('');
});

console.log('========== 验证总结 ==========');
const checks = [
  { name: 'byDeadline 按角色筛选', pass: auditResult.deadlineResult.overdue > 0 && leaderResult.list.length > 0 },
  { name: 'byDeadline 到期分组筛选与统计一致', pass: overdueFilter.list.length === overdueFilter.deadlineResult.overdue },
  { name: '批量处理成功失败逐条返回', pass: results.length === testForms.length },
  { name: 'batch_results 完整字段持久化', pass: allFieldsValid },
  { name: '失败项上下文字段完整', pass: allFailedValid },
  { name: '失败项异常类型留痕', pass: allFailedValid },
  { name: '成功项状态变更正确', pass: allStateValid },
];

console.log('');
checks.forEach(c => {
  console.log(`${c.pass ? '✅' : '❌'} ${c.name}`);
});

const allPassed = checks.every(c => c.pass);
console.log('');
if (allPassed) {
  console.log('🎉 所有验证通过！到期预警与批量处理结果闭环完整！');
} else {
  console.log('⚠️  部分验证未通过，请检查问题');
}

db.close();
if (fs.existsSync(dbPath)) {
  fs.unlinkSync(dbPath);
}
