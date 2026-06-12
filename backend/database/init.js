const db = require('./index');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');

const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

console.log('🗄️  开始初始化数据库...');

db.exec(`
  DROP TABLE IF EXISTS audit_notes;
  DROP TABLE IF EXISTS processing_records;
  DROP TABLE IF EXISTS attachments;
  DROP TABLE IF EXISTS visit_orders;
  DROP TABLE IF EXISTS users;

  CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT null,
    password TEXT NOT null,
    name TEXT NOT null,
    role TEXT NOT null CHECK(role IN ('nurse', 'doctor', 'director')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE visit_orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_no TEXT UNIQUE NOT null,
    pet_name TEXT NOT null,
    pet_type TEXT NOT null,
    pet_breed TEXT,
    pet_age INTEGER,
    pet_gender TEXT,
    owner_name TEXT NOT null,
    owner_phone TEXT NOT null,
    appointment_time DATETIME,
    visit_time DATETIME,
    follow_up_time DATETIME,
    chief_complaint TEXT,
    diagnosis TEXT,
    treatment TEXT,
    follow_up_result TEXT,
    priority TEXT NOT null DEFAULT 'normal' CHECK(priority IN ('urgent', 'high', 'normal', 'low')),
    status TEXT NOT null DEFAULT 'pending_assign' CHECK(status IN (
      'pending_assign',
      'assigned',
      'processing',
      'transferred',
      'returned_for_correction',
      'reprocessing',
      'follow_up_scheduled',
      'followed_up',
      'reviewing',
      'archived'
    )),
    assignee_id INTEGER REFERENCES users(id),
    handler_id INTEGER REFERENCES users(id),
    reviewer_id INTEGER REFERENCES users(id),
    deadline DATETIME NOT null,
    version INTEGER NOT null DEFAULT 1,
    material_status TEXT DEFAULT 'incomplete' CHECK(material_status IN ('complete', 'incomplete')),
    exception_type TEXT CHECK(exception_type IS NULL OR exception_type IN ('material', 'permission', 'timeline', 'status')),
    exception_reason TEXT,
    correction_action TEXT,
    is_overdue INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_by INTEGER REFERENCES users(id)
  );

  CREATE TABLE attachments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    visit_order_id INTEGER NOT null REFERENCES visit_orders(id) ON DELETE CASCADE,
    filename TEXT NOT null,
    original_name TEXT NOT null,
    file_type TEXT NOT null,
    file_size INTEGER,
    category TEXT NOT null CHECK(category IN ('pet_profile', 'appointment', 'diagnosis', 'treatment', 'follow_up', 'other')),
    uploaded_by INTEGER REFERENCES users(id),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE processing_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    visit_order_id INTEGER NOT null REFERENCES visit_orders(id) ON DELETE CASCADE,
    action TEXT NOT null,
    from_status TEXT,
    to_status TEXT,
    operator_id INTEGER NOT null REFERENCES users(id),
    operator_role TEXT NOT null,
    comment TEXT,
    exception_type TEXT CHECK(exception_type IS NULL OR exception_type IN ('material', 'permission', 'timeline', 'status')),
    exception_reason TEXT,
    evidence_required TEXT,
    evidence_provided TEXT,
    correction_action TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE audit_notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    visit_order_id INTEGER NOT null REFERENCES visit_orders(id) ON DELETE CASCADE,
    content TEXT NOT null,
    operator_id INTEGER NOT null REFERENCES users(id),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX idx_visit_status ON visit_orders(status);
  CREATE INDEX idx_visit_assignee ON visit_orders(assignee_id);
  CREATE INDEX idx_visit_handler ON visit_orders(handler_id);
  CREATE INDEX idx_visit_priority ON visit_orders(priority);
  CREATE INDEX idx_visit_deadline ON visit_orders(deadline);
  CREATE INDEX idx_visit_overdue ON visit_orders(is_overdue);
  CREATE INDEX idx_visit_exception ON visit_orders(exception_type);
`);

console.log('✅ 数据库表结构创建完成');

console.log('👤 正在创建演示账号...');
const hashPwd = (pwd) => bcrypt.hashSync(pwd, 10);

const insertUser = db.prepare(`
  INSERT INTO users (username, password, name, role)
  VALUES (?, ?, ?, ?)
`);

insertUser.run('nurse01', hashPwd('123456'), '李护士', 'nurse');
insertUser.run('doctor01', hashPwd('123456'), '王医师', 'doctor');
insertUser.run('director01', hashPwd('123456'), '张院长', 'director');

console.log('✅ 演示账号创建完成');
console.log('   前台护士: nurse01 / 123456');
console.log('   兽医师:   doctor01 / 123456');
console.log('   院长:     director01 / 123456');

console.log('📋 正在创建四类宠物就诊单样例...');

const now = new Date();
const daysLater = (d) => {
  const t = new Date(now);
  t.setDate(t.getDate() + d);
  return t.toISOString();
};
const daysAgo = (d) => {
  const t = new Date(now);
  t.setDate(t.getDate() - d);
  return t.toISOString();
};
const hoursLater = (h) => {
  const t = new Date(now);
  t.setHours(t.getHours() + h);
  return t.toISOString();
};

const insertOrder = db.prepare(`
  INSERT INTO visit_orders (
    order_no, pet_name, pet_type, pet_breed, pet_age, pet_gender,
    owner_name, owner_phone, appointment_time, visit_time, follow_up_time,
    chief_complaint, diagnosis, treatment, follow_up_result,
    priority, status, assignee_id, handler_id, reviewer_id,
    deadline, version, material_status, exception_type, exception_reason,
    correction_action, is_overdue, created_by
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

// ═══════════════════════════════════════════════════════════════
// 类型1: 正常流转 — 待分派，远期截止
// ═══════════════════════════════════════════════════════════════
insertOrder.run(
  'V202606001', '豆豆', '犬', '金毛寻回犬', 3, '公',
  '陈先生', '13800138001',
  daysLater(2), daysLater(3), daysLater(10),
  '食欲不振、呕吐两天',
  null, null, null,
  'high', 'pending_assign',
  null, null, null,
  daysLater(5), 1, 'incomplete', null, null,
  null, 0, 1
);

// ═══════════════════════════════════════════════════════════════
// 类型2: 缺材料异常 — 已转办，缺少影像材料
// ═══════════════════════════════════════════════════════════════
insertOrder.run(
  'V202606002', '旺财', '犬', '拉布拉多', 5, '公',
  '赵先生', '13800138002',
  daysAgo(3), daysAgo(2), daysLater(1),
  '后腿跛行',
  '疑似髋关节发育不良', 'X光检查+止痛消炎', null,
  'urgent', 'transferred',
  2, 2, null,
  daysLater(2), 3, 'incomplete', 'material', '缺少X光影像资料及检查报告，需补充后恢复处理',
  null, 0, 1
);

// ═══════════════════════════════════════════════════════════════
// 类型3: 逾期 — 已分派但已逾期，未接诊
// ═══════════════════════════════════════════════════════════════
insertOrder.run(
  'V202606003', '咪咪', '猫', '英国短毛猫', 2, '母',
  '刘女士', '13800138003',
  daysAgo(5), daysAgo(4), daysAgo(1),
  '频繁抓挠耳朵，有异味',
  '外耳道炎', '耳道清洗+外用药物', null,
  'normal', 'assigned',
  2, null, null,
  daysAgo(1), 2, 'complete', 'timeline', '就诊单已逾期，截止时间已过，当前责任人：分派兽医师',
  null, 1, 1
);

// ═══════════════════════════════════════════════════════════════
// 类型3: 逾期 — 处理中但已逾期
// ═══════════════════════════════════════════════════════════════
insertOrder.run(
  'V202606004', '花花', '猫', '布偶猫', 3, '母',
  '吴女士', '13800138004',
  daysAgo(5), daysAgo(4), daysLater(1),
  '体检疫苗接种',
  null, null, null,
  'normal', 'processing',
  2, 2, null,
  daysAgo(1), 2, 'incomplete', 'timeline', '就诊单已逾期，截止时间已过，当前责任人：分派兽医师',
  null, 1, 1
);

// ═══════════════════════════════════════════════════════════════
// 类型3: 逾期 — 审核中但已逾期
// ═══════════════════════════════════════════════════════════════
insertOrder.run(
  'V202606005', '胖胖', '犬', '柯基', 4, '母',
  '周先生', '13800138005',
  daysAgo(10), daysAgo(9), daysAgo(5),
  '体重超标，运动后喘息',
  '肥胖症+轻度脂肪肝', '处方粮+运动计划',
  '体重略有下降，主人依从性好',
  'low', 'reviewing',
  2, 2, 3,
  daysAgo(2), 5, 'complete', 'timeline', '就诊单已逾期，截止时间已过，当前责任人：分派兽医师',
  null, 1, 1
);

// ═══════════════════════════════════════════════════════════════
// 类型4: 退回补正 — 院长退回，需补正后重新提交
// ═══════════════════════════════════════════════════════════════
insertOrder.run(
  'V202606006', '黑妞', '犬', '德国牧羊犬', 6, '母',
  '郑先生', '13800138006',
  daysAgo(14), daysAgo(13), daysAgo(8),
  '皮肤瘙痒、脱毛',
  '过敏性皮炎', '药浴+口服抗过敏药',
  '症状缓解，仍需巩固治疗',
  'high', 'returned_for_correction',
  2, 2, null,
  daysAgo(4), 3, 'incomplete', 'material', '复诊记录缺失，药浴执行记录不完整',
  null, 1, 1
);

// ═══════════════════════════════════════════════════════════════
// 类型4: 退回补正 — 已开始补正中
// ═══════════════════════════════════════════════════════════════
insertOrder.run(
  'V202606007', '小白', '猫', '中华田园猫', 1, '公',
  '孙女士', '13800138007',
  daysAgo(7), daysAgo(6), daysAgo(3),
  '打喷嚏、流清涕',
  '上呼吸道感染', '抗病毒+支持治疗',
  '精神好转，食欲恢复',
  'normal', 'reprocessing',
  2, 2, null,
  daysLater(3), 4, 'incomplete', null, '补正中：补充诊后回访记录及处方执行确认',
  '补充诊后回访记录及处方执行确认', 0, 1
);

// ═══════════════════════════════════════════════════════════════
// 正常流转 — 已回访，待提交复核，临期
// ═══════════════════════════════════════════════════════════════
insertOrder.run(
  'V202606008', '大橘', '猫', '橘猫', 4, '公',
  '李先生', '13800138008',
  daysAgo(8), daysAgo(7), daysAgo(2),
  '尿频、血尿',
  '下泌尿道综合征', '导尿+消炎+处方粮',
  '排尿恢复正常，饮食良好',
  'high', 'followed_up',
  2, 2, null,
  hoursLater(18), 5, 'complete', null, null,
  null, 0, 1
);

// ═══════════════════════════════════════════════════════════════
// 正常流转 — 已归档
// ═══════════════════════════════════════════════════════════════
insertOrder.run(
  'V202606009', '团子', '犬', '泰迪', 2, '母',
  '王女士', '13800138009',
  daysAgo(20), daysAgo(19), daysAgo(12),
  '疫苗接种',
  '常规体检合格', '疫苗注射+驱虫',
  '一切正常，下次复诊时间已确认',
  'low', 'archived',
  2, 2, 3,
  daysAgo(10), 7, 'complete', null, null,
  null, 0, 1
);

console.log('✅ 宠物就诊单样例创建完成');
console.log('   V202606001 - 【正常流转】待分派（远期截止）');
console.log('   V202606002 - 【缺材料异常】已转办，缺少X光影像');
console.log('   V202606003 - 【逾期】已分派但逾期未接诊');
console.log('   V202606004 - 【逾期】处理中逾期');
console.log('   V202606005 - 【逾期】审核中逾期');
console.log('   V202606006 - 【退回补正】院长退回，复诊记录缺失');
console.log('   V202606007 - 【退回补正】补正中');
console.log('   V202606008 - 【正常流转】已回访，临期18h');
console.log('   V202606009 - 【正常流转】已归档');

console.log('📎 正在创建附件样例...');
const insertAttach = db.prepare(`
  INSERT INTO attachments (visit_order_id, filename, original_name, file_type, category, uploaded_by)
  VALUES (?, ?, ?, ?, ?, ?)
`);

insertAttach.run(2, 'prescription_wangcai.pdf', '处方单.pdf', 'application/pdf', 'treatment', 2);
insertAttach.run(3, 'profile_cat_mimi.pdf', '猫咪体检报告.pdf', 'application/pdf', 'pet_profile', 1);
insertAttach.run(3, 'diag_ear.jpg', '耳道检查照片.jpg', 'image/jpeg', 'diagnosis', 2);
insertAttach.run(5, 'followup_record.pdf', '回访记录.pdf', 'application/pdf', 'follow_up', 2);
insertAttach.run(6, 'treatment_heiniu.pdf', '药浴执行记录.pdf', 'application/pdf', 'treatment', 2);
insertAttach.run(7, 'reprocess_xiaobai.pdf', '补正材料-回访确认.pdf', 'application/pdf', 'follow_up', 2);
insertAttach.run(8, 'followup_daju.pdf', '回访记录-下泌尿道.pdf', 'application/pdf', 'follow_up', 2);

console.log('✅ 附件样例创建完成');

console.log('📝 正在创建处理记录样例...');
const insertRecord = db.prepare(`
  INSERT INTO processing_records (
    visit_order_id, action, from_status, to_status,
    operator_id, operator_role, comment, exception_type, exception_reason,
    evidence_required, evidence_provided, correction_action
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

// V202606001 正常流转 - 待分派
insertRecord.run(1, 'create', null, 'pending_assign', 1, 'nurse', '前台护士创建就诊单，待分派兽医师', null, null, '宠物建档、预约单', '宠物建档、预约单', null);

// V202606002 缺材料 - 已转办
insertRecord.run(2, 'create', null, 'pending_assign', 1, 'nurse', '前台护士创建就诊单', null, null, '宠物建档、预约单', '宠物建档、预约单', null);
insertRecord.run(2, 'assign', 'pending_assign', 'assigned', 1, 'nurse', '分派给王医师处理', null, null, null, null, null);
insertRecord.run(2, 'start_process', 'assigned', 'processing', 2, 'doctor', '开始接诊检查', null, null, null, null, null);
insertRecord.run(2, 'transfer', 'processing', 'transferred', 2, 'doctor', '初诊完成，等待影像检查后转办', 'material', '缺少X光影像资料及检查报告，需补充后恢复处理', 'X光检查报告', '处方单', null);

// V202606003 逾期 - 已分派
insertRecord.run(3, 'create', null, 'pending_assign', 1, 'nurse', '前台护士创建就诊单', null, null, '宠物建档、预约单', '宠物建档、预约单', null);
insertRecord.run(3, 'assign', 'pending_assign', 'assigned', 1, 'nurse', '分派给王医师', null, null, null, null, null);

// V202606004 逾期 - 处理中
insertRecord.run(4, 'create', null, 'pending_assign', 1, 'nurse', '前台护士创建就诊单', null, null, '宠物建档、预约单', '宠物建档、预约单', null);
insertRecord.run(4, 'assign', 'pending_assign', 'assigned', 1, 'nurse', '分派给王医师', null, null, null, null, null);
insertRecord.run(4, 'start_process', 'assigned', 'processing', 2, 'doctor', '开始接诊体检', null, null, null, null, null);

// V202606005 逾期 - 审核中
insertRecord.run(5, 'create', null, 'pending_assign', 1, 'nurse', '前台护士创建就诊单', null, null, '宠物建档、预约单', '宠物建档、预约单', null);
insertRecord.run(5, 'assign', 'pending_assign', 'assigned', 1, 'nurse', '分派给王医师', null, null, null, null, null);
insertRecord.run(5, 'start_process', 'assigned', 'processing', 2, 'doctor', '完成诊断和治疗方案', null, null, null, null, null);
insertRecord.run(5, 'schedule_follow_up', 'processing', 'follow_up_scheduled', 2, 'doctor', '安排回访', null, null, '诊断记录、治疗方案、处方单', '诊断记录、治疗方案、处方单', null);
insertRecord.run(5, 'do_follow_up', 'follow_up_scheduled', 'followed_up', 1, 'nurse', '完成回访', null, null, '回访记录', '回访记录', null);
insertRecord.run(5, 'submit_review', 'followed_up', 'reviewing', 2, 'doctor', '提交院长复核归档', null, null, null, null, null);

// V202606006 退回补正
insertRecord.run(6, 'create', null, 'pending_assign', 1, 'nurse', '前台护士创建就诊单', null, null, '宠物建档、预约单', '宠物建档、预约单', null);
insertRecord.run(6, 'assign', 'pending_assign', 'assigned', 1, 'nurse', '分派给王医师', null, null, null, null, null);
insertRecord.run(6, 'start_process', 'assigned', 'processing', 2, 'doctor', '接诊治疗', null, null, null, null, null);
insertRecord.run(6, 'schedule_follow_up', 'processing', 'follow_up_scheduled', 2, 'doctor', '安排回访', null, null, '诊断记录、治疗方案、处方单', '诊断记录、治疗方案、处方单', null);
insertRecord.run(6, 'do_follow_up', 'follow_up_scheduled', 'followed_up', 1, 'nurse', '回访完成', null, null, '回访记录', '回访记录', null);
insertRecord.run(6, 'submit_review', 'followed_up', 'reviewing', 2, 'doctor', '提交复核', null, null, null, null, null);
insertRecord.run(6, 'return_for_correction', 'reviewing', 'returned_for_correction', 3, 'director', '院长退回补正：复诊记录缺失，药浴执行记录不完整', 'material', '复诊记录缺失，药浴执行记录不完整', '退回原因说明', '复诊记录缺失，药浴执行记录不完整', null);

// V202606007 退回补正 - 补正中
insertRecord.run(7, 'create', null, 'pending_assign', 1, 'nurse', '前台护士创建就诊单', null, null, '宠物建档、预约单', '宠物建档、预约单', null);
insertRecord.run(7, 'assign', 'pending_assign', 'assigned', 1, 'nurse', '分派给王医师', null, null, null, null, null);
insertRecord.run(7, 'start_process', 'assigned', 'processing', 2, 'doctor', '接诊并确诊上呼吸道感染', null, null, null, null, null);
insertRecord.run(7, 'schedule_follow_up', 'processing', 'follow_up_scheduled', 2, 'doctor', '治疗完成安排回访', null, null, '诊断记录、治疗方案、处方单', '诊断记录、治疗方案、处方单', null);
insertRecord.run(7, 'do_follow_up', 'follow_up_scheduled', 'followed_up', 1, 'nurse', '回访完成', null, null, '回访记录', '回访记录', null);
insertRecord.run(7, 'submit_review', 'followed_up', 'reviewing', 2, 'doctor', '提交复核', null, null, null, null, null);
insertRecord.run(7, 'return_for_correction', 'reviewing', 'returned_for_correction', 3, 'director', '院长退回：回访记录缺少处方执行确认', 'material', '回访记录缺少处方执行确认', '退回原因说明', '回访记录缺少处方执行确认', null);
insertRecord.run(7, 'reprocess', 'returned_for_correction', 'reprocessing', 2, 'doctor', '开始补正：补充诊后回访记录及处方执行确认', null, '补正中：补充诊后回访记录及处方执行确认', null, null, '补充诊后回访记录及处方执行确认');

// V202606008 正常流转 - 已回访
insertRecord.run(8, 'create', null, 'pending_assign', 1, 'nurse', '前台护士创建就诊单', null, null, '宠物建档、预约单', '宠物建档、预约单', null);
insertRecord.run(8, 'assign', 'pending_assign', 'assigned', 1, 'nurse', '分派给王医师', null, null, null, null, null);
insertRecord.run(8, 'start_process', 'assigned', 'processing', 2, 'doctor', '导尿+消炎治疗', null, null, null, null, null);
insertRecord.run(8, 'schedule_follow_up', 'processing', 'follow_up_scheduled', 2, 'doctor', '治疗完成安排回访', null, null, '诊断记录、治疗方案、处方单', '诊断记录、治疗方案、处方单', null);
insertRecord.run(8, 'do_follow_up', 'follow_up_scheduled', 'followed_up', 1, 'nurse', '回访完成，排尿恢复正常', null, null, '回访记录', '回访记录', null);

// V202606009 正常流转 - 已归档
insertRecord.run(9, 'create', null, 'pending_assign', 1, 'nurse', '前台护士创建就诊单', null, null, '宠物建档、预约单', '宠物建档、预约单', null);
insertRecord.run(9, 'assign', 'pending_assign', 'assigned', 1, 'nurse', '分派给王医师', null, null, null, null, null);
insertRecord.run(9, 'start_process', 'assigned', 'processing', 2, 'doctor', '常规体检+疫苗', null, null, null, null, null);
insertRecord.run(9, 'schedule_follow_up', 'processing', 'follow_up_scheduled', 2, 'doctor', '安排回访', null, null, '诊断记录、治疗方案、处方单', '诊断记录、治疗方案、处方单', null);
insertRecord.run(9, 'do_follow_up', 'follow_up_scheduled', 'followed_up', 1, 'nurse', '回访正常', null, null, '回访记录', '回访记录', null);
insertRecord.run(9, 'submit_review', 'followed_up', 'reviewing', 2, 'doctor', '提交复核', null, null, null, null, null);
insertRecord.run(9, 'archive', 'reviewing', 'archived', 3, 'director', '复核通过，归档', null, null, null, null, null);

console.log('✅ 处理记录样例创建完成');

console.log('📓 正在创建审计备注样例...');
const insertAudit = db.prepare(`
  INSERT INTO audit_notes (visit_order_id, content, operator_id)
  VALUES (?, ?, ?)
`);

insertAudit.run(2, '需要催促主人尽快补充X光检查资料，否则影响后续诊断', 1);
insertAudit.run(3, '超时预警：已通知王医师优先处理此单据，截止时间已过', 1);
insertAudit.run(4, '逾期提醒：处理中的就诊单已超过截止时间，需加快进度', 1);
insertAudit.run(5, '逾期审核：该单据已逾期，请院长尽快复核', 1);
insertAudit.run(6, '重点关注：药浴执行情况需要兽医师电话确认并补录', 3);
insertAudit.run(6, '退回补正说明：复诊记录和药浴执行记录必须完整后才能重新提交', 3);
insertAudit.run(7, '补正进行中：兽医师正在补充回访记录和处方执行确认', 2);

console.log('✅ 审计备注样例创建完成');

console.log('\n🎉 数据库初始化全部完成！');
console.log(`   数据库文件: ${path.join(__dirname, '..', 'data', 'hospital.db')}`);
console.log('\n📊 四类单据覆盖情况：');
console.log('   ✅ 正常流转: V202606001(待分派), V202606008(已回访/临期), V202606009(已归档)');
console.log('   ✅ 缺材料异常: V202606002(已转办/缺X光影像)');
console.log('   ✅ 逾期: V202606003(已分派逾期), V202606004(处理中逾期), V202606005(审核中逾期)');
console.log('   ✅ 退回补正: V202606006(退回补正/复诊缺失), V202606007(补正中)');
