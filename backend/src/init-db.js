import db from './db.js';
import bcrypt from 'bcryptjs';
import dayjs from 'dayjs';

function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL,
      department TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS clues (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      clue_no TEXT UNIQUE NOT NULL,
      title TEXT NOT NULL,
      clue_type TEXT NOT NULL,
      priority TEXT NOT NULL,
      status TEXT NOT NULL,
      enterprise_name TEXT,
      contact_person TEXT,
      contact_phone TEXT,
      amount REAL,
      description TEXT,
      deadline DATETIME,
      responsible_person_id INTEGER,
      current_handler_id INTEGER,
      created_by INTEGER,
      version INTEGER DEFAULT 1,
      abnormal_tags TEXT DEFAULT '[]',
      return_reason TEXT,
      audit_remark TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (responsible_person_id) REFERENCES users(id),
      FOREIGN KEY (current_handler_id) REFERENCES users(id),
      FOREIGN KEY (created_by) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS attachments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      clue_id INTEGER NOT NULL,
      file_name TEXT NOT NULL,
      file_type TEXT NOT NULL,
      file_path TEXT NOT NULL,
      file_size INTEGER,
      attachment_type TEXT,
      uploaded_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (clue_id) REFERENCES clues(id),
      FOREIGN KEY (uploaded_by) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS processing_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      clue_id INTEGER NOT NULL,
      from_status TEXT,
      to_status TEXT NOT NULL,
      action TEXT NOT NULL,
      result TEXT,
      remark TEXT,
      operator_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (clue_id) REFERENCES clues(id),
      FOREIGN KEY (operator_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS audit_notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      clue_id INTEGER NOT NULL,
      note TEXT NOT NULL,
      auditor_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (clue_id) REFERENCES clues(id),
      FOREIGN KEY (auditor_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS abnormal_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      clue_id INTEGER,
      abnormal_type TEXT NOT NULL,
      description TEXT NOT NULL,
      operator_id INTEGER,
      request_data TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (clue_id) REFERENCES clues(id),
      FOREIGN KEY (operator_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS batch_results (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      batch_no TEXT NOT NULL,
      clue_id INTEGER,
      clue_no TEXT,
      success INTEGER NOT NULL DEFAULT 0,
      error_code TEXT,
      error_message TEXT,
      from_status TEXT,
      to_status TEXT,
      old_version INTEGER,
      new_version INTEGER,
      abnormal_type TEXT,
      processing_record_id INTEGER,
      operator_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (clue_id) REFERENCES clues(id),
      FOREIGN KEY (operator_id) REFERENCES users(id),
      FOREIGN KEY (processing_record_id) REFERENCES processing_records(id)
    );

    CREATE INDEX IF NOT EXISTS idx_clues_status ON clues(status);
    CREATE INDEX IF NOT EXISTS idx_clues_priority ON clues(priority);
    CREATE INDEX IF NOT EXISTS idx_clues_type ON clues(clue_type);
    CREATE INDEX IF NOT EXISTS idx_clues_deadline ON clues(deadline);
    CREATE INDEX IF NOT EXISTS idx_clues_handler ON clues(current_handler_id);
    CREATE INDEX IF NOT EXISTS idx_clues_responsible ON clues(responsible_person_id);
    CREATE INDEX IF NOT EXISTS idx_attachments_clue ON attachments(clue_id);
    CREATE INDEX IF NOT EXISTS idx_records_clue ON processing_records(clue_id);
    CREATE INDEX IF NOT EXISTS idx_audit_clue ON audit_notes(clue_id);
    CREATE INDEX IF NOT EXISTS idx_abnormal_clue ON abnormal_logs(clue_id);
    CREATE INDEX IF NOT EXISTS idx_batch_no ON batch_results(batch_no);
  `);

  console.log('✅ 数据库表结构创建完成');
}

function initUsers() {
  const salt = bcrypt.genSaltSync(10);
  
  const users = [
    {
      username: 'registrar1',
      password: bcrypt.hashSync('123456', salt),
      name: '张登记',
      role: 'registrar',
      department: '招商部'
    },
    {
      username: 'auditor1',
      password: bcrypt.hashSync('123456', salt),
      name: '李审核',
      role: 'auditor',
      department: '招商部'
    },
    {
      username: 'reviewer1',
      password: bcrypt.hashSync('123456', salt),
      name: '王复核',
      role: 'reviewer',
      department: '园区管委会'
    },
    {
      username: 'registrar2',
      password: bcrypt.hashSync('123456', salt),
      name: '赵专员',
      role: 'registrar',
      department: '招商部'
    },
    {
      username: 'auditor2',
      password: bcrypt.hashSync('123456', salt),
      name: '刘主管',
      role: 'auditor',
      department: '招商部'
    }
  ];

  const stmt = db.prepare(`
    INSERT OR IGNORE INTO users (username, password, name, role, department)
    VALUES (?, ?, ?, ?, ?)
  `);

  users.forEach(user => {
    stmt.run(user.username, user.password, user.name, user.role, user.department);
  });

  console.log('✅ 用户数据初始化完成');
}

function initClues() {
  const now = dayjs();
  
  const clues = [
    {
      clue_no: 'ZS20240601001',
      title: '科技创新有限公司入驻园区',
      clue_type: 'enterprise',
      priority: 'high',
      status: 'pending_submit',
      enterprise_name: '科技创新有限公司',
      contact_person: '陈总',
      contact_phone: '13800138001',
      amount: 5000000,
      description: '高新技术企业，计划入驻园区3000平米办公空间',
      deadline: now.add(3, 'day').format('YYYY-MM-DD HH:mm:ss'),
      responsible_person_id: 1,
      current_handler_id: 1,
      created_by: 1,
      version: 1,
      abnormal_tags: JSON.stringify([])
    },
    {
      clue_no: 'ZS20240601002',
      title: '智慧物流集团区域总部签约',
      clue_type: 'signing',
      priority: 'high',
      status: 'pending_audit',
      enterprise_name: '智慧物流集团',
      contact_person: '马总',
      contact_phone: '13800138002',
      amount: 20000000,
      description: '物流企业区域总部，需整栋办公楼',
      deadline: now.add(5, 'day').format('YYYY-MM-DD HH:mm:ss'),
      responsible_person_id: 4,
      current_handler_id: 2,
      created_by: 4,
      version: 2,
      abnormal_tags: JSON.stringify([])
    },
    {
      clue_no: 'ZS20240601003',
      title: '新能源汽车配件公司拜访跟进',
      clue_type: 'follow_up',
      priority: 'medium',
      status: 'returned',
      enterprise_name: '新能源汽车配件有限公司',
      contact_person: '周经理',
      contact_phone: '13800138003',
      amount: 8000000,
      description: '汽车配件生产企业，需1000平米厂房',
      deadline: now.subtract(1, 'day').format('YYYY-MM-DD HH:mm:ss'),
      responsible_person_id: 1,
      current_handler_id: 1,
      created_by: 1,
      version: 2,
      return_reason: '缺少企业营业执照附件和场地使用证明',
      abnormal_tags: JSON.stringify(['missing_material', 'overdue'])
    },
    {
      clue_no: 'ZS20240601004',
      title: '生物医药研发中心项目',
      clue_type: 'enterprise',
      priority: 'high',
      status: 'resubmitted',
      enterprise_name: '生物医药科技有限公司',
      contact_person: '吴博士',
      contact_phone: '13800138004',
      amount: 15000000,
      description: '生物医药研发企业，需GMP标准车间',
      deadline: now.add(7, 'day').format('YYYY-MM-DD HH:mm:ss'),
      responsible_person_id: 4,
      current_handler_id: 5,
      created_by: 4,
      version: 3,
      abnormal_tags: JSON.stringify([])
    },
    {
      clue_no: 'ZS20240601005',
      title: '跨境电商平台总部落地',
      clue_type: 'signing',
      priority: 'high',
      status: 'pending_review',
      enterprise_name: '全球购跨境电商有限公司',
      contact_person: '郑总',
      contact_phone: '13800138005',
      amount: 30000000,
      description: '跨境电商总部，需办公+仓储一体化空间',
      deadline: now.add(2, 'day').format('YYYY-MM-DD HH:mm:ss'),
      responsible_person_id: 4,
      current_handler_id: 3,
      created_by: 4,
      version: 3,
      abnormal_tags: JSON.stringify([])
    },
    {
      clue_no: 'ZS20240601006',
      title: '人工智能企业入驻洽谈',
      clue_type: 'follow_up',
      priority: 'medium',
      status: 'pending_submit',
      enterprise_name: '智联人工智能有限公司',
      contact_person: '孙总监',
      contact_phone: '13800138006',
      amount: 12000000,
      description: 'AI算法公司，需研发中心办公空间',
      deadline: now.subtract(3, 'day').format('YYYY-MM-DD HH:mm:ss'),
      responsible_person_id: 1,
      current_handler_id: 1,
      created_by: 1,
      version: 1,
      abnormal_tags: JSON.stringify(['overdue'])
    },
    {
      clue_no: 'ZS20240601007',
      title: '金融科技公司区域中心',
      clue_type: 'enterprise',
      priority: 'low',
      status: 'pending_audit',
      enterprise_name: '融科金融科技有限公司',
      contact_person: '钱总',
      contact_phone: '13800138007',
      amount: 6000000,
      description: '金融科技公司，需500平米精装办公区',
      deadline: now.add(14, 'day').format('YYYY-MM-DD HH:mm:ss'),
      responsible_person_id: 4,
      current_handler_id: 5,
      created_by: 4,
      version: 1,
      abnormal_tags: JSON.stringify([])
    },
    {
      clue_no: 'ZS20240601008',
      title: '智能制造企业扩产项目',
      clue_type: 'enterprise',
      priority: 'high',
      status: 'approved',
      enterprise_name: '精工智能制造有限公司',
      contact_person: '冯厂长',
      contact_phone: '13800138008',
      amount: 25000000,
      description: '智能制造企业，需5000平米生产车间',
      deadline: now.add(1, 'day').format('YYYY-MM-DD HH:mm:ss'),
      responsible_person_id: 4,
      current_handler_id: 3,
      created_by: 4,
      version: 4,
      abnormal_tags: JSON.stringify([])
    },
    {
      clue_no: 'ZS20240601009',
      title: '文化创意产业园入驻',
      clue_type: 'follow_up',
      priority: 'medium',
      status: 'pending_review',
      enterprise_name: '创想文化传播有限公司',
      contact_person: '韩总',
      contact_phone: '13800138009',
      amount: 3000000,
      description: '文创企业，需loft办公空间',
      deadline: now.subtract(5, 'day').format('YYYY-MM-DD HH:mm:ss'),
      responsible_person_id: 1,
      current_handler_id: 3,
      created_by: 1,
      version: 3,
      abnormal_tags: JSON.stringify(['overdue'])
    },
    {
      clue_no: 'ZS20240601010',
      title: '新材料科技公司签约',
      clue_type: 'signing',
      priority: 'high',
      status: 'archived',
      enterprise_name: '先进材料科技有限公司',
      contact_person: '董总',
      contact_phone: '13800138010',
      amount: 18000000,
      description: '新材料研发生产企业，已完成签约入驻',
      deadline: now.subtract(10, 'day').format('YYYY-MM-DD HH:mm:ss'),
      responsible_person_id: 4,
      current_handler_id: null,
      created_by: 4,
      version: 5,
      abnormal_tags: JSON.stringify([])
    },
    {
      clue_no: 'ZS20240601011',
      title: '云计算数据中心项目',
      clue_type: 'enterprise',
      priority: 'high',
      status: 'pending_submit',
      enterprise_name: '云端数据科技有限公司',
      contact_person: '许总',
      contact_phone: '13800138011',
      amount: 50000000,
      description: 'IDC数据中心，需独立建筑和电力保障',
      deadline: now.add(1, 'day').format('YYYY-MM-DD HH:mm:ss'),
      responsible_person_id: 1,
      current_handler_id: 1,
      created_by: 1,
      version: 1,
      abnormal_tags: JSON.stringify(['overdue'])
    },
    {
      clue_no: 'ZS20240601012',
      title: '教育培训机构入驻',
      clue_type: 'follow_up',
      priority: 'low',
      status: 'draft',
      enterprise_name: '博学教育科技有限公司',
      contact_person: '何校长',
      contact_phone: '13800138012',
      amount: 2000000,
      description: '职业培训机构，需教学场地',
      deadline: now.add(30, 'day').format('YYYY-MM-DD HH:mm:ss'),
      responsible_person_id: 4,
      current_handler_id: 4,
      created_by: 4,
      version: 1,
      abnormal_tags: JSON.stringify([])
    }
  ];

  const stmt = db.prepare(`
    INSERT OR IGNORE INTO clues (
      clue_no, title, clue_type, priority, status, enterprise_name,
      contact_person, contact_phone, amount, description, deadline,
      responsible_person_id, current_handler_id, created_by, version,
      abnormal_tags, return_reason
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  clues.forEach(clue => {
    stmt.run(
      clue.clue_no, clue.title, clue.clue_type, clue.priority, clue.status,
      clue.enterprise_name, clue.contact_person, clue.contact_phone, clue.amount,
      clue.description, clue.deadline, clue.responsible_person_id,
      clue.current_handler_id, clue.created_by, clue.version,
      clue.abnormal_tags, clue.return_reason
    );
  });

  console.log('✅ 招商线索单数据初始化完成');
}

function initAttachments() {
  const attachments = [
    { clue_id: 1, file_name: '企业营业执照.pdf', file_type: 'application/pdf', file_path: '/attachments/clue1_license.pdf', file_size: 1024000, attachment_type: 'enterprise_info', uploaded_by: 1 },
    { clue_id: 2, file_name: '企业简介.pdf', file_type: 'application/pdf', file_path: '/attachments/clue2_intro.pdf', file_size: 2048000, attachment_type: 'enterprise_info', uploaded_by: 4 },
    { clue_id: 2, file_name: '拜访记录.docx', file_type: 'application/docx', file_path: '/attachments/clue2_visit.docx', file_size: 512000, attachment_type: 'visit_record', uploaded_by: 4 },
    { clue_id: 4, file_name: '企业营业执照.pdf', file_type: 'application/pdf', file_path: '/attachments/clue4_license.pdf', file_size: 1024000, attachment_type: 'enterprise_info', uploaded_by: 4 },
    { clue_id: 4, file_name: '资质证明.pdf', file_type: 'application/pdf', file_path: '/attachments/clue4_cert.pdf', file_size: 768000, attachment_type: 'enterprise_info', uploaded_by: 4 },
    { clue_id: 5, file_name: '企业营业执照.pdf', file_type: 'application/pdf', file_path: '/attachments/clue5_license.pdf', file_size: 1024000, attachment_type: 'enterprise_info', uploaded_by: 4 },
    { clue_id: 5, file_name: '拜访纪要.pdf', file_type: 'application/pdf', file_path: '/attachments/clue5_visit.pdf', file_size: 512000, attachment_type: 'visit_record', uploaded_by: 4 },
    { clue_id: 5, file_name: '合作意向书.pdf', file_type: 'application/pdf', file_path: '/attachments/clue5_intent.pdf', file_size: 1024000, attachment_type: 'visit_record', uploaded_by: 2 },
    { clue_id: 7, file_name: '企业信息.pdf', file_type: 'application/pdf', file_path: '/attachments/clue7_info.pdf', file_size: 768000, attachment_type: 'enterprise_info', uploaded_by: 4 },
    { clue_id: 8, file_name: '企业营业执照.pdf', file_type: 'application/pdf', file_path: '/attachments/clue8_license.pdf', file_size: 1024000, attachment_type: 'enterprise_info', uploaded_by: 4 },
    { clue_id: 8, file_name: '多次拜访记录.pdf', file_type: 'application/pdf', file_path: '/attachments/clue8_visits.pdf', file_size: 2048000, attachment_type: 'visit_record', uploaded_by: 5 },
    { clue_id: 8, file_name: '投资协议草案.pdf', file_type: 'application/pdf', file_path: '/attachments/clue8_contract.pdf', file_size: 3072000, attachment_type: 'signing_contract', uploaded_by: 2 },
    { clue_id: 9, file_name: '企业资料.pdf', file_type: 'application/pdf', file_path: '/attachments/clue9_info.pdf', file_size: 1024000, attachment_type: 'enterprise_info', uploaded_by: 1 },
    { clue_id: 9, file_name: '现场考察记录.pdf', file_type: 'application/pdf', file_path: '/attachments/clue9_visit.pdf', file_size: 768000, attachment_type: 'visit_record', uploaded_by: 1 },
    { clue_id: 10, file_name: '全套入驻资料.pdf', file_type: 'application/pdf', file_path: '/attachments/clue10_all.pdf', file_size: 5120000, attachment_type: 'enterprise_info', uploaded_by: 4 },
    { clue_id: 10, file_name: '签约合同.pdf', file_type: 'application/pdf', file_path: '/attachments/clue10_contract.pdf', file_size: 4096000, attachment_type: 'signing_contract', uploaded_by: 5 },
    { clue_id: 11, file_name: '项目建议书.pdf', file_type: 'application/pdf', file_path: '/attachments/clue11_proposal.pdf', file_size: 2048000, attachment_type: 'enterprise_info', uploaded_by: 1 }
  ];

  const stmt = db.prepare(`
    INSERT OR IGNORE INTO attachments (
      clue_id, file_name, file_type, file_path, file_size,
      attachment_type, uploaded_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  attachments.forEach(att => {
    stmt.run(att.clue_id, att.file_name, att.file_type, att.file_path, att.file_size, att.attachment_type, att.uploaded_by);
  });

  console.log('✅ 附件数据初始化完成');
}

function initProcessingRecords() {
  const now = dayjs();
  
  const records = [
    { clue_id: 2, from_status: 'pending_submit', to_status: 'pending_audit', action: '提交审核', result: 'success', remark: '材料齐全，进入审核环节', operator_id: 4, created_at: now.subtract(5, 'day').format('YYYY-MM-DD HH:mm:ss') },
    { clue_id: 2, from_status: 'pending_audit', to_status: 'pending_audit', action: '审核中', result: 'success', remark: '正在核实企业资质', operator_id: 2, created_at: now.subtract(3, 'day').format('YYYY-MM-DD HH:mm:ss') },
    { clue_id: 3, from_status: 'pending_submit', to_status: 'pending_audit', action: '提交审核', result: 'success', remark: '初次提交', operator_id: 1, created_at: now.subtract(7, 'day').format('YYYY-MM-DD HH:mm:ss') },
    { clue_id: 3, from_status: 'pending_audit', to_status: 'returned', action: '退回补正', result: 'success', remark: '缺少企业营业执照附件和场地使用证明，请补充后重新提交', operator_id: 2, created_at: now.subtract(4, 'day').format('YYYY-MM-DD HH:mm:ss') },
    { clue_id: 4, from_status: 'pending_submit', to_status: 'pending_audit', action: '提交审核', result: 'success', remark: '初次提交', operator_id: 4, created_at: now.subtract(10, 'day').format('YYYY-MM-DD HH:mm:ss') },
    { clue_id: 4, from_status: 'pending_audit', to_status: 'returned', action: '退回补正', result: 'success', remark: '请补充企业资质证明文件', operator_id: 5, created_at: now.subtract(7, 'day').format('YYYY-MM-DD HH:mm:ss') },
    { clue_id: 4, from_status: 'returned', to_status: 'resubmitted', action: '重新提交', result: 'success', remark: '已补充资质证明', operator_id: 4, created_at: now.subtract(3, 'day').format('YYYY-MM-DD HH:mm:ss') },
    { clue_id: 5, from_status: 'pending_submit', to_status: 'pending_audit', action: '提交审核', result: 'success', remark: '材料齐全', operator_id: 4, created_at: now.subtract(14, 'day').format('YYYY-MM-DD HH:mm:ss') },
    { clue_id: 5, from_status: 'pending_audit', to_status: 'pending_review', action: '审核通过', result: 'success', remark: '企业资质良好，建议入驻', operator_id: 2, created_at: now.subtract(10, 'day').format('YYYY-MM-DD HH:mm:ss') },
    { clue_id: 5, from_status: 'pending_review', to_status: 'pending_review', action: '复核中', result: 'success', remark: '正在复核合同条款', operator_id: 3, created_at: now.subtract(5, 'day').format('YYYY-MM-DD HH:mm:ss') },
    { clue_id: 7, from_status: 'pending_submit', to_status: 'pending_audit', action: '提交审核', result: 'success', remark: '', operator_id: 4, created_at: now.subtract(2, 'day').format('YYYY-MM-DD HH:mm:ss') },
    { clue_id: 8, from_status: 'pending_submit', to_status: 'pending_audit', action: '提交审核', result: 'success', remark: '', operator_id: 4, created_at: now.subtract(20, 'day').format('YYYY-MM-DD HH:mm:ss') },
    { clue_id: 8, from_status: 'pending_audit', to_status: 'pending_review', action: '审核通过', result: 'success', remark: '优质企业，重点跟进', operator_id: 5, created_at: now.subtract(15, 'day').format('YYYY-MM-DD HH:mm:ss') },
    { clue_id: 8, from_status: 'pending_review', to_status: 'approved', action: '复核通过', result: 'success', remark: '同意入驻，尽快签约', operator_id: 3, created_at: now.subtract(7, 'day').format('YYYY-MM-DD HH:mm:ss') },
    { clue_id: 9, from_status: 'pending_submit', to_status: 'pending_audit', action: '提交审核', result: 'success', remark: '', operator_id: 1, created_at: now.subtract(14, 'day').format('YYYY-MM-DD HH:mm:ss') },
    { clue_id: 9, from_status: 'pending_audit', to_status: 'pending_review', action: '审核通过', result: 'success', remark: '文创产业符合园区定位', operator_id: 2, created_at: now.subtract(10, 'day').format('YYYY-MM-DD HH:mm:ss') },
    { clue_id: 10, from_status: 'pending_submit', to_status: 'pending_audit', action: '提交审核', result: 'success', remark: '', operator_id: 4, created_at: now.subtract(30, 'day').format('YYYY-MM-DD HH:mm:ss') },
    { clue_id: 10, from_status: 'pending_audit', to_status: 'pending_review', action: '审核通过', result: 'success', remark: '新材料企业，政策扶持', operator_id: 5, created_at: now.subtract(25, 'day').format('YYYY-MM-DD HH:mm:ss') },
    { clue_id: 10, from_status: 'pending_review', to_status: 'approved', action: '复核通过', result: 'success', remark: '同意入驻', operator_id: 3, created_at: now.subtract(20, 'day').format('YYYY-MM-DD HH:mm:ss') },
    { clue_id: 10, from_status: 'approved', to_status: 'archived', action: '归档', result: 'success', remark: '已完成签约入驻', operator_id: 3, created_at: now.subtract(10, 'day').format('YYYY-MM-DD HH:mm:ss') }
  ];

  const stmt = db.prepare(`
    INSERT OR IGNORE INTO processing_records (
      clue_id, from_status, to_status, action, result, remark, operator_id, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  records.forEach(record => {
    stmt.run(record.clue_id, record.from_status, record.to_status, record.action, record.result, record.remark, record.operator_id, record.created_at);
  });

  console.log('✅ 处理记录数据初始化完成');
}

function initAuditNotes() {
  const now = dayjs();
  
  const notes = [
    { clue_id: 2, note: '该企业为物流行业龙头，区域总部项目含金量高，建议加快审批进度', auditor_id: 2, created_at: now.subtract(3, 'day').format('YYYY-MM-DD HH:mm:ss') },
    { clue_id: 3, note: '第一次退回原因：缺少企业营业执照。第二次检查：仍缺少场地使用证明，需重点提醒登记员', auditor_id: 2, created_at: now.subtract(4, 'day').format('YYYY-MM-DD HH:mm:ss') },
    { clue_id: 5, note: '跨境电商企业，年交易额预计超10亿，税收贡献大。建议给予租金优惠政策', auditor_id: 3, created_at: now.subtract(5, 'day').format('YYYY-MM-DD HH:mm:ss') },
    { clue_id: 8, note: '智能制造企业，属于国家重点扶持产业。已与招商团队进行3轮洽谈，企业入驻意愿强烈', auditor_id: 3, created_at: now.subtract(7, 'day').format('YYYY-MM-DD HH:mm:ss') },
    { clue_id: 9, note: '文创企业虽然金额不大，但能丰富园区产业生态，建议通过。注意逾期问题，需提醒责任人加快处理', auditor_id: 2, created_at: now.subtract(8, 'day').format('YYYY-MM-DD HH:mm:ss') },
    { clue_id: 10, note: '新材料企业已顺利入驻，成为园区标杆企业。后续可作为招商案例', auditor_id: 3, created_at: now.subtract(10, 'day').format('YYYY-MM-DD HH:mm:ss') },
    { clue_id: 11, note: 'IDC数据中心项目投资巨大，但对电力和网络要求高。需协调园区基础设施部门评估可行性', auditor_id: 1, created_at: now.subtract(1, 'day').format('YYYY-MM-DD HH:mm:ss') }
  ];

  const stmt = db.prepare(`
    INSERT OR IGNORE INTO audit_notes (clue_id, note, auditor_id, created_at)
    VALUES (?, ?, ?, ?)
  `);

  notes.forEach(note => {
    stmt.run(note.clue_id, note.note, note.auditor_id, note.created_at);
  });

  console.log('✅ 审计备注数据初始化完成');
}

function initAbnormalLogs() {
  const now = dayjs();
  
  const logs = [
    { clue_id: 3, abnormal_type: 'missing_material', description: '提交审核时缺少必填附件：企业营业执照、场地使用证明', operator_id: 1, request_data: JSON.stringify({ action: 'submit', clue_id: 3 }), created_at: now.subtract(6, 'day').format('YYYY-MM-DD HH:mm:ss') },
    { clue_id: 3, abnormal_type: 'overdue', description: '线索单已超过截止时间1天，状态仍为已退回未处理', operator_id: null, request_data: null, created_at: now.subtract(1, 'day').format('YYYY-MM-DD HH:mm:ss') },
    { clue_id: 6, abnormal_type: 'overdue', description: '线索单已超过截止时间3天，状态仍为待提交', operator_id: null, request_data: null, created_at: now.format('YYYY-MM-DD HH:mm:ss') },
    { clue_id: 9, abnormal_type: 'overdue', description: '线索单已超过截止时间5天，状态仍为待复核', operator_id: null, request_data: null, created_at: now.format('YYYY-MM-DD HH:mm:ss') },
    { clue_id: 11, abnormal_type: 'overdue', description: '高优先级线索单即将过期（剩余1天），状态仍为待提交', operator_id: null, request_data: null, created_at: now.format('YYYY-MM-DD HH:mm:ss') },
    { clue_id: 4, abnormal_type: 'status_conflict', description: '登记员尝试直接从退回状态跳转到待复核，违反状态流转规则', operator_id: 4, request_data: JSON.stringify({ action: 'approve', clue_id: 4, target_status: 'pending_review' }), created_at: now.subtract(6, 'day').format('YYYY-MM-DD HH:mm:ss') },
    { clue_id: 2, abnormal_type: 'version_conflict', description: '提交的版本号(1)与当前版本号(2)不匹配，可能存在并发修改', operator_id: 2, request_data: JSON.stringify({ action: 'audit', clue_id: 2, version: 1 }), created_at: now.subtract(4, 'day').format('YYYY-MM-DD HH:mm:ss') },
    { clue_id: 5, abnormal_type: 'missing_material', description: '复核前检查：建议补充签约意向书作为支撑材料（非强制但建议）', operator_id: 3, request_data: null, created_at: now.subtract(5, 'day').format('YYYY-MM-DD HH:mm:ss') }
  ];

  const stmt = db.prepare(`
    INSERT OR IGNORE INTO abnormal_logs (
      clue_id, abnormal_type, description, operator_id, request_data, created_at
    ) VALUES (?, ?, ?, ?, ?, ?)
  `);

  logs.forEach(log => {
    stmt.run(log.clue_id, log.abnormal_type, log.description, log.operator_id, log.request_data, log.created_at);
  });

  console.log('✅ 异常日志数据初始化完成');
}

console.log('🚀 开始初始化数据库...\n');

initDatabase();
initUsers();
initClues();
initAttachments();
initProcessingRecords();
initAuditNotes();
initAbnormalLogs();

console.log('\n🎉 数据库初始化完成！');
console.log('\n📋 演示账号：');
console.log('  招商线索登记员: registrar1 / 123456 (张登记)');
console.log('  招商线索登记员: registrar2 / 123456 (赵专员)');
console.log('  招商线索审核主管: auditor1 / 123456 (李审核)');
console.log('  招商线索审核主管: auditor2 / 123456 (刘主管)');
console.log('  园区招商中心复核负责人: reviewer1 / 123456 (王复核)');
