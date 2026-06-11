require('dotenv').config();

const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const dayjs = require('dayjs');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'data', 'merchant_entry.db');
const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

const {
  ROLES,
  NODES,
  STATUSES,
  EVIDENCE_TYPES
} = require('../src/utils/constants');

const users = [
  {
    username: 'registrar',
    password: bcrypt.hashSync('123456', 10),
    realName: '张登记',
    role: ROLES.MERCHANT_REGISTRAR,
    department: '招商部'
  },
  {
    username: 'auditor',
    password: bcrypt.hashSync('123456', 10),
    realName: '李审核',
    role: ROLES.AUDIT_SUPERVISOR,
    department: '审核部'
  },
  {
    username: 'leader',
    password: bcrypt.hashSync('123456', 10),
    realName: '王负责',
    role: ROLES.PLATFORM_LEADER,
    department: '平台管理部'
  }
];

const insertUser = db.prepare(`
  INSERT INTO users (username, password, real_name, role, department)
  VALUES (?, ?, ?, ?, ?)
`);

users.forEach(u => {
  insertUser.run(u.username, u.password, u.realName, u.role, u.department);
});

console.log('Users created: registrar, auditor, leader (password: 123456)');

const insertForm = db.prepare(`
  INSERT INTO merchant_entry_forms (
    form_no, merchant_name, credit_code, contact_name, contact_phone,
    contact_email, business_type, registered_capital, business_scope,
    business_license_no, tax_registration_no, organization_code,
    legal_person_name, legal_person_id_card, bank_account_name,
    bank_account_no, bank_name, warehouse_address, office_address,
    current_node, status, version, current_handler, previous_handler,
    previous_opinion, deadline, created_by
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const insertAttachment = db.prepare(`
  INSERT INTO attachments (
    form_id, file_name, file_type, file_size, file_path,
    upload_by, evidence_type, remark
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`);

const insertProcessingRecord = db.prepare(`
  INSERT INTO processing_records (
    form_id, operation_type, operator, operator_role,
    from_node, to_node, from_status, to_status, opinion, version
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const insertException = db.prepare(`
  INSERT INTO exception_reasons (
    form_id, exception_type, exception_detail, exception_node, created_by
  ) VALUES (?, ?, ?, ?, ?)
`);

const insertAuditNote = db.prepare(`
  INSERT INTO audit_notes (form_id, note_content, created_by)
  VALUES (?, ?, ?)
`);

function createNormalFlowForm() {
  const now = dayjs();
  const formNo = `ME${now.format('YYYYMMDD')}0001`;

  const result = insertForm.run(
    formNo,
    '杭州阳光食品有限公司',
    '91330100MA27WXYZ12',
    '陈经理',
    '13800138001',
    'chen@sunshinefood.com',
    '食品饮料',
    '500万人民币',
    '食品、饮料、保健品的批发与零售',
    '91330100MA27WXYZ12',
    '330100MA27WXYZ12',
    'MA27WXYZ1',
    '陈阳光',
    '330102198001011234',
    '杭州阳光食品有限公司',
    '1234567890123456789',
    '中国工商银行杭州分行',
    '杭州市余杭区良渚街道仓储路88号',
    '杭州市拱墅区万达广场A座1501室',
    NODES.ENTRY_REGISTRATION,
    STATUSES.PENDING_SIGN,
    1,
    'registrar',
    null,
    null,
    now.add(3, 'day').format('YYYY-MM-DD HH:mm:ss'),
    'registrar'
  );

  const formId = result.lastInsertRowid;

  insertAttachment.run(
    formId,
    '营业执照.jpg',
    'image/jpeg',
    1024000,
    '/attachments/001/license.jpg',
    'registrar',
    EVIDENCE_TYPES.BUSINESS_LICENSE,
    '营业执照正本扫描件'
  );

  insertProcessingRecord.run(
    formId,
    'create',
    'registrar',
    ROLES.MERCHANT_REGISTRAR,
    null,
    NODES.ENTRY_REGISTRATION,
    null,
    STATUSES.PENDING_SIGN,
    '创建商家入驻单-正常流转示例',
    1
  );

  insertAuditNote.run(
    formId,
    '这是一个正常流转的示例单据，用于演示完整的审核流程',
    'registrar'
  );

  console.log(`Created normal flow form: ${formNo} (id: ${formId})`);
  return formId;
}

function createAbnormalReturnForm() {
  const now = dayjs();
  const formNo = `ME${now.format('YYYYMMDD')}0002`;

  const result = insertForm.run(
    formNo,
    '宁波潮流服装有限公司',
    '91330200MA28ABCDEF',
    '刘主管',
    '13900139002',
    'liu@fashion.com',
    '服装鞋帽',
    '200万人民币',
    '服装、鞋帽、箱包的批发',
    '91330200MA28ABCDEF',
    null,
    null,
    '刘时尚',
    '330203198505055678',
    null,
    null,
    null,
    '宁波市鄞州区石碶街道服装工业园',
    '宁波市海曙区天一广场商务楼2001室',
    NODES.ENTRY_REGISTRATION,
    STATUSES.ABNORMAL_RETURN,
    3,
    'registrar',
    'auditor',
    '缺少税务登记证和组织机构代码证，请补充',
    now.add(3, 'day').format('YYYY-MM-DD HH:mm:ss'),
    'registrar'
  );

  const formId = result.lastInsertRowid;

  insertAttachment.run(
    formId,
    '营业执照.jpg',
    'image/jpeg',
    980000,
    '/attachments/002/license.jpg',
    'registrar',
    EVIDENCE_TYPES.BUSINESS_LICENSE,
    '营业执照'
  );

  insertAttachment.run(
    formId,
    '法人身份证.jpg',
    'image/jpeg',
    520000,
    '/attachments/002/idcard.jpg',
    'registrar',
    EVIDENCE_TYPES.ID_CARD,
    '法人身份证正反面'
  );

  insertProcessingRecord.run(
    formId,
    'create',
    'registrar',
    ROLES.MERCHANT_REGISTRAR,
    null,
    NODES.ENTRY_REGISTRATION,
    null,
    STATUSES.PENDING_SIGN,
    '创建商家入驻单',
    1
  );

  insertProcessingRecord.run(
    formId,
    'sign',
    'registrar',
    ROLES.MERCHANT_REGISTRAR,
    NODES.ENTRY_REGISTRATION,
    NODES.ENTRY_REGISTRATION,
    STATUSES.PENDING_SIGN,
    STATUSES.SIGN_COMPLETED,
    '签收完成',
    2
  );

  insertProcessingRecord.run(
    formId,
    'audit_reject',
    'auditor',
    ROLES.AUDIT_SUPERVISOR,
    NODES.ENTRY_REGISTRATION,
    NODES.ENTRY_REGISTRATION,
    STATUSES.SIGN_COMPLETED,
    STATUSES.ABNORMAL_RETURN,
    '缺少税务登记证和组织机构代码证，请补充',
    3
  );

  insertException.run(
    formId,
    'material_missing',
    '审核拒绝：缺少税务登记证和组织机构代码证，请补充',
    NODES.ENTRY_REGISTRATION,
    'auditor'
  );

  insertAuditNote.run(
    formId,
    '这是一个异常回传的示例单据，演示缺少材料被审核拒绝的场景',
    'auditor'
  );

  console.log(`Created abnormal return form: ${formNo} (id: ${formId})`);
  return formId;
}

function createSignCompletedForm() {
  const now = dayjs();
  const formNo = `ME${now.format('YYYYMMDD')}0003`;

  const result = insertForm.run(
    formNo,
    '温州电子科技有限公司',
    '91330300MA29GHIJKL',
    '王技术',
    '13700137003',
    'wang@wzelec.com',
    '电子产品',
    '1000万人民币',
    '电子产品、通讯设备、计算机软硬件的研发与销售',
    '91330300MA29GHIJKL',
    '330300MA29GHIJKL',
    'MA29GHIJK',
    '王科技',
    '330304197810109012',
    '温州电子科技有限公司',
    '9876543210987654321',
    '中国建设银行温州分行',
    '温州市龙湾区滨海工业园区电子路1号',
    '温州市鹿城区新城大道新城大厦25楼',
    NODES.QUALIFICATION_AUDIT,
    STATUSES.PENDING_AUDIT,
    4,
    'auditor',
    'registrar',
    '材料齐全，提交审核',
    now.add(2, 'day').format('YYYY-MM-DD HH:mm:ss'),
    'registrar'
  );

  const formId = result.lastInsertRowid;

  insertAttachment.run(
    formId,
    '营业执照.jpg',
    'image/jpeg',
    1150000,
    '/attachments/003/license.jpg',
    'registrar',
    EVIDENCE_TYPES.BUSINESS_LICENSE,
    '营业执照'
  );

  insertAttachment.run(
    formId,
    '税务登记证.jpg',
    'image/jpeg',
    890000,
    '/attachments/003/tax.jpg',
    'registrar',
    EVIDENCE_TYPES.TAX_CERTIFICATE,
    '税务登记证'
  );

  insertAttachment.run(
    formId,
    '法人身份证.jpg',
    'image/jpeg',
    610000,
    '/attachments/003/idcard.jpg',
    'registrar',
    EVIDENCE_TYPES.ID_CARD,
    '法人身份证'
  );

  insertAttachment.run(
    formId,
    '开户许可证.jpg',
    'image/jpeg',
    750000,
    '/attachments/003/bank.jpg',
    'registrar',
    EVIDENCE_TYPES.BANK_CERTIFICATE,
    '开户许可证'
  );

  insertProcessingRecord.run(
    formId,
    'create',
    'registrar',
    ROLES.MERCHANT_REGISTRAR,
    null,
    NODES.ENTRY_REGISTRATION,
    null,
    STATUSES.PENDING_SIGN,
    '创建商家入驻单',
    1
  );

  insertProcessingRecord.run(
    formId,
    'sign',
    'registrar',
    ROLES.MERCHANT_REGISTRAR,
    NODES.ENTRY_REGISTRATION,
    NODES.ENTRY_REGISTRATION,
    STATUSES.PENDING_SIGN,
    STATUSES.SIGN_COMPLETED,
    '签收完成',
    2
  );

  insertProcessingRecord.run(
    formId,
    'submit_audit',
    'registrar',
    ROLES.MERCHANT_REGISTRAR,
    NODES.ENTRY_REGISTRATION,
    NODES.QUALIFICATION_AUDIT,
    STATUSES.SIGN_COMPLETED,
    STATUSES.PENDING_AUDIT,
    '材料齐全，提交审核',
    3
  );

  insertAuditNote.run(
    formId,
    '这是一个签收完成待审核的示例单据，材料齐全，等待审核主管审核',
    'registrar'
  );

  console.log(`Created sign completed form: ${formNo} (id: ${formId})`);
  return formId;
}

function createOverdueForm() {
  const now = dayjs();
  const formNo = `ME${now.format('YYYYMMDD')}0004`;

  const result = insertForm.run(
    formNo,
    '嘉兴家居用品有限公司',
    '91330400MA2AMNOPQR',
    '赵家居',
    '13600136004',
    'zhao@jiaxinghome.com',
    '家居建材',
    '300万人民币',
    '家居用品、建材、装饰材料的批发',
    '91330400MA2AMNOPQR',
    '330400MA2AMNOPQR',
    'MA2AMNOPQ',
    '赵家居',
    '330402197503153456',
    null,
    null,
    null,
    '嘉兴市南湖区大桥镇家居产业园',
    '嘉兴市秀洲区江南摩尔商务楼12楼',
    NODES.ENTRY_REGISTRATION,
    STATUSES.PENDING_SIGN,
    1,
    'registrar',
    null,
    null,
    now.subtract(2, 'day').format('YYYY-MM-DD HH:mm:ss'),
    'registrar'
  );

  const formId = result.lastInsertRowid;

  insertAttachment.run(
    formId,
    '营业执照.jpg',
    'image/jpeg',
    870000,
    '/attachments/004/license.jpg',
    'registrar',
    EVIDENCE_TYPES.BUSINESS_LICENSE,
    '营业执照'
  );

  insertProcessingRecord.run(
    formId,
    'create',
    'registrar',
    ROLES.MERCHANT_REGISTRAR,
    null,
    NODES.ENTRY_REGISTRATION,
    null,
    STATUSES.PENDING_SIGN,
    '创建商家入驻单-逾期示例',
    1
  );

  insertException.run(
    formId,
    'timeout',
    '商家入驻登记节点已逾期2天，需要尽快处理',
    NODES.ENTRY_REGISTRATION,
    'system'
  );

  insertAuditNote.run(
    formId,
    '这是一个逾期的示例单据，用于演示到期预警和批量推进功能',
    'registrar'
  );

  console.log(`Created overdue form: ${formNo} (id: ${formId})`);
  return formId;
}

function createSupplementRequiredForm() {
  const now = dayjs();
  const formNo = `ME${now.format('YYYYMMDD')}0005`;

  const result = insertForm.run(
    formNo,
    '绍兴五金工具有限公司',
    '91330600MA2BSTUVWX',
    '孙五金',
    '13500135005',
    'sun@shaoxingtools.com',
    '五金交电',
    '150万人民币',
    '五金工具、交电产品、机械设备的批发',
    '91330600MA2BSTUVWX',
    '330600MA2BSTUVWX',
    'MA2BSTUVW',
    '孙工具',
    '330602198208087890',
    null,
    null,
    null,
    '绍兴市越城区斗门镇五金工业园',
    '绍兴市柯桥区万达广场SOHO 18楼',
    NODES.QUALIFICATION_AUDIT,
    STATUSES.SUPPLEMENT_REQUIRED,
    4,
    'registrar',
    'auditor',
    '请补充开户许可证和银行账户信息',
    now.add(2, 'day').format('YYYY-MM-DD HH:mm:ss'),
    'registrar'
  );

  const formId = result.lastInsertRowid;

  insertAttachment.run(
    formId,
    '营业执照.jpg',
    'image/jpeg',
    920000,
    '/attachments/005/license.jpg',
    'registrar',
    EVIDENCE_TYPES.BUSINESS_LICENSE,
    '营业执照'
  );

  insertAttachment.run(
    formId,
    '税务登记证.jpg',
    'image/jpeg',
    680000,
    '/attachments/005/tax.jpg',
    'registrar',
    EVIDENCE_TYPES.TAX_CERTIFICATE,
    '税务登记证'
  );

  insertAttachment.run(
    formId,
    '法人身份证.jpg',
    'image/jpeg',
    540000,
    '/attachments/005/idcard.jpg',
    'registrar',
    EVIDENCE_TYPES.ID_CARD,
    '法人身份证'
  );

  insertProcessingRecord.run(
    formId,
    'create',
    'registrar',
    ROLES.MERCHANT_REGISTRAR,
    null,
    NODES.ENTRY_REGISTRATION,
    null,
    STATUSES.PENDING_SIGN,
    '创建商家入驻单',
    1
  );

  insertProcessingRecord.run(
    formId,
    'sign',
    'registrar',
    ROLES.MERCHANT_REGISTRAR,
    NODES.ENTRY_REGISTRATION,
    NODES.ENTRY_REGISTRATION,
    STATUSES.PENDING_SIGN,
    STATUSES.SIGN_COMPLETED,
    '签收完成',
    2
  );

  insertProcessingRecord.run(
    formId,
    'submit_audit',
    'registrar',
    ROLES.MERCHANT_REGISTRAR,
    NODES.ENTRY_REGISTRATION,
    NODES.QUALIFICATION_AUDIT,
    STATUSES.SIGN_COMPLETED,
    STATUSES.PENDING_AUDIT,
    '提交审核',
    3
  );

  insertProcessingRecord.run(
    formId,
    'return_supplement',
    'auditor',
    ROLES.AUDIT_SUPERVISOR,
    NODES.QUALIFICATION_AUDIT,
    NODES.QUALIFICATION_AUDIT,
    STATUSES.PENDING_AUDIT,
    STATUSES.SUPPLEMENT_REQUIRED,
    '请补充开户许可证和银行账户信息',
    4
  );

  insertException.run(
    formId,
    'material_missing',
    '退回补正：请补充开户许可证和银行账户信息',
    NODES.QUALIFICATION_AUDIT,
    'auditor'
  );

  insertAuditNote.run(
    formId,
    '这是一个需补正的示例单据，演示从详情页进行补正操作的场景',
    'auditor'
  );

  console.log(`Created supplement required form: ${formNo} (id: ${formId})`);
  return formId;
}

function createArchivedForm() {
  const now = dayjs();
  const formNo = `ME${now.format('YYYYMMDD')}0006`;

  const result = insertForm.run(
    formNo,
    '湖州办公用品有限公司',
    '91330500MA2CYZABCD',
    '周办公',
    '13400134006',
    'zhou@huzhouoffice.com',
    '办公用品',
    '80万人民币',
    '办公用品、文具、办公设备的批发与零售',
    '91330500MA2CYZABCD',
    '330500MA2CYZABCD',
    'MA2CYZABC',
    '周办公',
    '330502198812122345',
    '湖州办公用品有限公司',
    '1122334455667788990',
    '中国银行湖州分行',
    '湖州市吴兴区八里店镇办公产业园',
    '湖州市德清县武康街道办公大厦8楼',
    NODES.ARCHIVED,
    STATUSES.ARCHIVED,
    7,
    null,
    'leader',
    '复核通过，同意归档',
    null,
    'registrar'
  );

  const formId = result.lastInsertRowid;

  insertAttachment.run(
    formId,
    '营业执照.jpg',
    'image/jpeg',
    760000,
    '/attachments/006/license.jpg',
    'registrar',
    EVIDENCE_TYPES.BUSINESS_LICENSE,
    '营业执照'
  );

  insertAttachment.run(
    formId,
    '税务登记证.jpg',
    'image/jpeg',
    590000,
    '/attachments/006/tax.jpg',
    'registrar',
    EVIDENCE_TYPES.TAX_CERTIFICATE,
    '税务登记证'
  );

  insertAttachment.run(
    formId,
    '法人身份证.jpg',
    'image/jpeg',
    480000,
    '/attachments/006/idcard.jpg',
    'registrar',
    EVIDENCE_TYPES.ID_CARD,
    '法人身份证'
  );

  insertAttachment.run(
    formId,
    '开户许可证.jpg',
    'image/jpeg',
    620000,
    '/attachments/006/bank.jpg',
    'registrar',
    EVIDENCE_TYPES.BANK_CERTIFICATE,
    '开户许可证'
  );

  insertProcessingRecord.run(
    formId,
    'create',
    'registrar',
    ROLES.MERCHANT_REGISTRAR,
    null,
    NODES.ENTRY_REGISTRATION,
    null,
    STATUSES.PENDING_SIGN,
    '创建商家入驻单',
    1
  );

  insertProcessingRecord.run(
    formId,
    'sign',
    'registrar',
    ROLES.MERCHANT_REGISTRAR,
    NODES.ENTRY_REGISTRATION,
    NODES.ENTRY_REGISTRATION,
    STATUSES.PENDING_SIGN,
    STATUSES.SIGN_COMPLETED,
    '签收完成',
    2
  );

  insertProcessingRecord.run(
    formId,
    'submit_audit',
    'registrar',
    ROLES.MERCHANT_REGISTRAR,
    NODES.ENTRY_REGISTRATION,
    NODES.QUALIFICATION_AUDIT,
    STATUSES.SIGN_COMPLETED,
    STATUSES.PENDING_AUDIT,
    '提交资质审核',
    3
  );

  insertProcessingRecord.run(
    formId,
    'audit_pass',
    'auditor',
    ROLES.AUDIT_SUPERVISOR,
    NODES.QUALIFICATION_AUDIT,
    NODES.ENTRY_FORM_REGISTRATION,
    STATUSES.PENDING_AUDIT,
    STATUSES.PENDING_REGISTRATION,
    '资质审核通过',
    4
  );

  insertProcessingRecord.run(
    formId,
    'register',
    'registrar',
    ROLES.MERCHANT_REGISTRAR,
    NODES.ENTRY_FORM_REGISTRATION,
    NODES.ENTRY_FORM_REGISTRATION,
    STATUSES.PENDING_REGISTRATION,
    STATUSES.REGISTRATION_COMPLETED,
    '入驻单登记完成',
    5
  );

  insertProcessingRecord.run(
    formId,
    'submit_final_review',
    'registrar',
    ROLES.MERCHANT_REGISTRAR,
    NODES.ENTRY_FORM_REGISTRATION,
    NODES.FINAL_REVIEW,
    STATUSES.REGISTRATION_COMPLETED,
    STATUSES.PENDING_FINAL_REVIEW,
    '提交平台复核',
    6
  );

  insertProcessingRecord.run(
    formId,
    'final_review_pass',
    'leader',
    ROLES.PLATFORM_LEADER,
    NODES.FINAL_REVIEW,
    NODES.ARCHIVED,
    STATUSES.PENDING_FINAL_REVIEW,
    STATUSES.ARCHIVED,
    '复核通过，同意归档',
    7
  );

  insertAuditNote.run(
    formId,
    '这是一个已完成归档的示例单据，用于演示完整的正常流转流程',
    'leader'
  );

  console.log(`Created archived form: ${formNo} (id: ${formId})`);
  return formId;
}

function createNearDeadlineForm() {
  const now = dayjs();
  const formNo = `ME${now.format('YYYYMMDD')}0007`;

  const result = insertForm.run(
    formNo,
    '金华日用百货有限公司',
    '91330700MA2D123456',
    '钱百货',
    '13300133007',
    'qian@jinhua百货.com',
    '日用百货',
    '100万人民币',
    '日用百货、化妆品、清洁用品的批发',
    '91330700MA2D123456',
    '330700MA2D123456',
    'MA2D12345',
    '钱百货',
    '330702199002024567',
    null,
    null,
    null,
    '金华市金东区孝顺镇百货产业园',
    '金华市婺城区人民广场商务楼10楼',
    NODES.QUALIFICATION_AUDIT,
    STATUSES.PENDING_AUDIT,
    3,
    'auditor',
    'registrar',
    '材料齐全，待审核',
    now.add(12, 'hour').format('YYYY-MM-DD HH:mm:ss'),
    'registrar'
  );

  const formId = result.lastInsertRowid;

  insertAttachment.run(
    formId,
    '营业执照.jpg',
    'image/jpeg',
    830000,
    '/attachments/007/license.jpg',
    'registrar',
    EVIDENCE_TYPES.BUSINESS_LICENSE,
    '营业执照'
  );

  insertAttachment.run(
    formId,
    '税务登记证.jpg',
    'image/jpeg',
    670000,
    '/attachments/007/tax.jpg',
    'registrar',
    EVIDENCE_TYPES.TAX_CERTIFICATE,
    '税务登记证'
  );

  insertAttachment.run(
    formId,
    '法人身份证.jpg',
    'image/jpeg',
    510000,
    '/attachments/007/idcard.jpg',
    'registrar',
    EVIDENCE_TYPES.ID_CARD,
    '法人身份证'
  );

  insertProcessingRecord.run(
    formId,
    'create',
    'registrar',
    ROLES.MERCHANT_REGISTRAR,
    null,
    NODES.ENTRY_REGISTRATION,
    null,
    STATUSES.PENDING_SIGN,
    '创建商家入驻单',
    1
  );

  insertProcessingRecord.run(
    formId,
    'sign',
    'registrar',
    ROLES.MERCHANT_REGISTRAR,
    NODES.ENTRY_REGISTRATION,
    NODES.ENTRY_REGISTRATION,
    STATUSES.PENDING_SIGN,
    STATUSES.SIGN_COMPLETED,
    '签收完成',
    2
  );

  insertProcessingRecord.run(
    formId,
    'submit_audit',
    'registrar',
    ROLES.MERCHANT_REGISTRAR,
    NODES.ENTRY_REGISTRATION,
    NODES.QUALIFICATION_AUDIT,
    STATUSES.SIGN_COMPLETED,
    STATUSES.PENDING_AUDIT,
    '材料齐全，待审核',
    3
  );

  insertAuditNote.run(
    formId,
    '这是一个临期的示例单据，将在12小时内到期，用于演示临期预警功能',
    'registrar'
  );

  console.log(`Created near deadline form: ${formNo} (id: ${formId})`);
  return formId;
}

const tx = db.transaction(() => {
  createNormalFlowForm();
  createAbnormalReturnForm();
  createSignCompletedForm();
  createOverdueForm();
  createSupplementRequiredForm();
  createArchivedForm();
  createNearDeadlineForm();
});

tx();

console.log('\n=== Demo Data Summary ===');
console.log('1. 正常流转待签收 - 杭州阳光食品有限公司');
console.log('2. 异常回传(缺材料) - 宁波潮流服装有限公司');
console.log('3. 签收完成待审核 - 温州电子科技有限公司');
console.log('4. 逾期未处理 - 嘉兴家居用品有限公司');
console.log('5. 需补正(退补) - 绍兴五金工具有限公司');
console.log('6. 已完成归档 - 湖州办公用品有限公司');
console.log('7. 临期(12小时内) - 金华日用百货有限公司');
console.log('\nAccounts:');
console.log('  商家入驻登记员: registrar / 123456');
console.log('  商家入驻审核主管: auditor / 123456');
console.log('  B2B批发平台复核负责人: leader / 123456');

db.close();
