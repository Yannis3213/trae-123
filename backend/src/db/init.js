const db = require('./index');
const { v4: uuidv4 } = require('uuid');
const { ROLES, ORDER_STATUS } = require('../utils/constants');

function hoursAgo(n) {
  const d = new Date();
  d.setHours(d.getHours() - n);
  return d.toISOString();
}

function hoursLater(n) {
  const d = new Date();
  d.setHours(d.getHours() + n);
  return d.toISOString();
}

function seed() {
  const existingUsers = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
  if (existingUsers > 0) {
    console.log('数据库已存在用户数据，跳过初始化。如需重新初始化，请删除 data/pharmacy.db 文件后再运行。');
    return;
  }

  const insertUser = db.prepare(`
    INSERT INTO users (id, username, name, role, store_id, area_id)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const users = [
    ['u_clerk_wang', 'clerk_wang', '王店员', ROLES.STORE_CLERK, 'store_001', 'area_east'],
    ['u_clerk_li', 'clerk_li', '李店员', ROLES.STORE_CLERK, 'store_002', 'area_east'],
    ['u_pharmacist_zhang', 'pharmacist_zhang', '张药师', ROLES.PHARMACIST, 'store_001', 'area_east'],
    ['u_pharmacist_chen', 'pharmacist_chen', '陈药师', ROLES.PHARMACIST, 'store_002', 'area_east'],
    ['u_manager_zhao', 'manager_zhao', '赵经理', ROLES.AREA_MANAGER, null, 'area_east']
  ];

  const insertManyUsers = db.transaction((rows) => {
    for (const row of rows) insertUser.run(...row);
  });
  insertManyUsers(users);
  console.log('已插入 5 个用户');

  const insertOrder = db.prepare(`
    INSERT INTO prescription_orders (
      id, order_no, patient_name, patient_id_card,
      store_id, store_name, area_id, area_name,
      drugs_count, total_amount, status,
      handler_role, handler_id, handler_name,
      version, created_by, created_by_name,
      created_at, updated_at, due_at,
      abnormal_reason, abnormal_type, correction_note
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const orders = [
    [
      uuidv4(), 'RX20260601001', '张三', '110101199001011234',
      'store_001', '朝阳大药房（总店）', 'area_east', '华东区域',
      3, 258.50, ORDER_STATUS.PENDING_SIGN,
      ROLES.PHARMACIST, 'u_pharmacist_zhang', '张药师',
      1, 'u_clerk_wang', '王店员',
      hoursAgo(2), hoursAgo(2), hoursLater(46),
      null, null, null
    ],
    [
      uuidv4(), 'RX20260601002', '李四', '110101198505052345',
      'store_001', '朝阳大药房（总店）', 'area_east', '华东区域',
      5, 680.00, ORDER_STATUS.MATERIAL_SHORTAGE,
      ROLES.AREA_MANAGER, 'u_manager_zhao', '赵经理',
      2, 'u_clerk_wang', '王店员',
      hoursAgo(26), hoursAgo(10), hoursLater(22),
      '阿莫西林胶囊库存不足，仅剩 12 粒，处方需 24 粒', 'material_shortage', null
    ],
    [
      uuidv4(), 'RX20260601003', '王五', '110101197808083456',
      'store_002', '朝阳大药房（分店）', 'area_east', '华东区域',
      2, 120.00, ORDER_STATUS.OVERDUE,
      ROLES.AREA_MANAGER, 'u_manager_zhao', '赵经理',
      2, 'u_clerk_li', '李店员',
      hoursAgo(80), hoursAgo(72), hoursAgo(8),
      '已超过处方有效期 8 小时，需联系患者确认是否重新开方', 'overdue', null
    ],
    [
      uuidv4(), 'RX20260601004', '赵六', '110101199203034567',
      'store_001', '朝阳大药房（总店）', 'area_east', '华东区域',
      4, 320.00, ORDER_STATUS.RETURNED_CORRECTION,
      ROLES.STORE_CLERK, 'u_clerk_wang', '王店员',
      3, 'u_clerk_wang', '王店员',
      hoursAgo(50), hoursAgo(30), hoursLater(18),
      '处方图像模糊，身份证号码无法辨认；患者签名与处方不符', 'state_conflict', '请重新上传清晰的处方照片并核对患者身份信息'
    ],
    [
      uuidv4(), 'RX20260601005', '钱七', '110101198809095678',
      'store_001', '朝阳大药房（总店）', 'area_east', '华东区域',
      1, 45.00, ORDER_STATUS.SIGNED,
      ROLES.AREA_MANAGER, 'u_manager_zhao', '赵经理',
      2, 'u_clerk_wang', '王店员',
      hoursAgo(60), hoursAgo(36), hoursLater(12),
      null, null, null
    ],
    [
      uuidv4(), 'RX20260601006', '孙八', '110101199507076789',
      'store_002', '朝阳大药房（分店）', 'area_east', '华东区域',
      6, 890.00, ORDER_STATUS.PENDING_SIGN,
      ROLES.PHARMACIST, 'u_pharmacist_chen', '陈药师',
      1, 'u_clerk_li', '李店员',
      hoursAgo(4), hoursAgo(4), hoursLater(20),
      null, null, null
    ],
    [
      uuidv4(), 'RX20260601007', '周九', '110101198006067890',
      'store_001', '朝阳大药房（总店）', 'area_east', '华东区域',
      2, 180.00, ORDER_STATUS.ABNORMAL_RETURN,
      ROLES.AREA_MANAGER, 'u_manager_zhao', '赵经理',
      2, 'u_clerk_wang', '王店员',
      hoursAgo(20), hoursAgo(12), hoursLater(36),
      '药品批号存在问题，需退回厂家核查', 'abnormal_return', null
    ],
    [
      uuidv4(), 'RX20260601008', '吴十', '110101199102028901',
      'store_002', '朝阳大药房（分店）', 'area_east', '华东区域',
      3, 310.00, ORDER_STATUS.PENDING_SIGN,
      ROLES.PHARMACIST, 'u_pharmacist_chen', '陈药师',
      1, 'u_clerk_li', '李店员',
      hoursAgo(1), hoursAgo(1), hoursLater(71),
      null, null, null
    ]
  ];

  const insertManyOrders = db.transaction((rows) => {
    for (const row of rows) insertOrder.run(...row);
  });
  insertManyOrders(orders);
  console.log('已插入 8 条处方订单');

  const orderIds = db.prepare('SELECT id, order_no FROM prescription_orders ORDER BY order_no').all();
  const orderMap = {};
  orderIds.forEach(o => { orderMap[o.order_no] = o.id; });

  const insertAttachment = db.prepare(`
    INSERT INTO attachments (
      id, order_id, file_name, file_type, file_url,
      evidence_type, uploaded_by, uploaded_by_name, uploaded_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const attachments = [
    [uuidv4(), orderMap['RX20260601001'], '处方_张三.jpg', 'image/jpeg', '/uploads/RX20260601001_rx.jpg', 'prescription', 'u_clerk_wang', '王店员', hoursAgo(2)],
    [uuidv4(), orderMap['RX20260601001'], '身份证_张三.jpg', 'image/jpeg', '/uploads/RX20260601001_id.jpg', 'id_card', 'u_clerk_wang', '王店员', hoursAgo(2)],
    [uuidv4(), orderMap['RX20260601002'], '处方_李四.jpg', 'image/jpeg', '/uploads/RX20260601002_rx.jpg', 'prescription', 'u_clerk_wang', '王店员', hoursAgo(26)],
    [uuidv4(), orderMap['RX20260601003'], '处方_王五.jpg', 'image/jpeg', '/uploads/RX20260601003_rx.jpg', 'prescription', 'u_clerk_li', '李店员', hoursAgo(80)],
    [uuidv4(), orderMap['RX20260601004'], '处方_赵六_模糊.jpg', 'image/jpeg', '/uploads/RX20260601004_rx.jpg', 'prescription', 'u_clerk_wang', '王店员', hoursAgo(50)],
    [uuidv4(), orderMap['RX20260601005'], '处方_钱七.jpg', 'image/jpeg', '/uploads/RX20260601005_rx.jpg', 'prescription', 'u_clerk_wang', '王店员', hoursAgo(60)],
    [uuidv4(), orderMap['RX20260601005'], '身份证_钱七.jpg', 'image/jpeg', '/uploads/RX20260601005_id.jpg', 'id_card', 'u_clerk_wang', '王店员', hoursAgo(60)],
    [uuidv4(), orderMap['RX20260601005'], '签收确认单_钱七.pdf', 'application/pdf', '/uploads/RX20260601005_sign.pdf', 'sign_off', 'u_pharmacist_zhang', '张药师', hoursAgo(40)],
    [uuidv4(), orderMap['RX20260601006'], '处方_孙八.jpg', 'image/jpeg', '/uploads/RX20260601006_rx.jpg', 'prescription', 'u_clerk_li', '李店员', hoursAgo(4)],
    [uuidv4(), orderMap['RX20260601007'], '处方_周九.jpg', 'image/jpeg', '/uploads/RX20260601007_rx.jpg', 'prescription', 'u_clerk_wang', '王店员', hoursAgo(20)],
    [uuidv4(), orderMap['RX20260601008'], '处方_吴十.jpg', 'image/jpeg', '/uploads/RX20260601008_rx.jpg', 'prescription', 'u_clerk_li', '李店员', hoursAgo(1)]
  ];

  const insertManyAttachments = db.transaction((rows) => {
    for (const row of rows) insertAttachment.run(...row);
  });
  insertManyAttachments(attachments);
  console.log('已插入 11 条附件记录');

  const insertRecord = db.prepare(`
    INSERT INTO processing_records (
      id, order_id, order_version, from_status, to_status,
      handler_id, handler_name, handler_role, note, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const records = [
    [uuidv4(), orderMap['RX20260601001'], 1, null, ORDER_STATUS.PENDING_SIGN, 'u_clerk_wang', '王店员', ROLES.STORE_CLERK, '门店登记处方订单，等待执业药师处理', hoursAgo(2)],
    [uuidv4(), orderMap['RX20260601002'], 1, null, ORDER_STATUS.PENDING_SIGN, 'u_clerk_wang', '王店员', ROLES.STORE_CLERK, '门店登记处方订单', hoursAgo(26)],
    [uuidv4(), orderMap['RX20260601002'], 2, ORDER_STATUS.PENDING_SIGN, ORDER_STATUS.MATERIAL_SHORTAGE, 'u_pharmacist_zhang', '张药师', ROLES.PHARMACIST, '核验发现阿莫西林胶囊库存不足，标记缺料', hoursAgo(10)],
    [uuidv4(), orderMap['RX20260601003'], 1, null, ORDER_STATUS.PENDING_SIGN, 'u_clerk_li', '李店员', ROLES.STORE_CLERK, '门店登记处方订单', hoursAgo(80)],
    [uuidv4(), orderMap['RX20260601003'], 2, ORDER_STATUS.PENDING_SIGN, ORDER_STATUS.OVERDUE, 'u_pharmacist_chen', '陈药师', ROLES.PHARMACIST, '处方已超过 72 小时未处理，系统自动标记逾期，责任人：陈药师', hoursAgo(72)],
    [uuidv4(), orderMap['RX20260601004'], 1, null, ORDER_STATUS.PENDING_SIGN, 'u_clerk_wang', '王店员', ROLES.STORE_CLERK, '门店登记处方订单', hoursAgo(50)],
    [uuidv4(), orderMap['RX20260601004'], 2, ORDER_STATUS.PENDING_SIGN, ORDER_STATUS.SIGNED, 'u_pharmacist_zhang', '张药师', ROLES.PHARMACIST, '初步核验通过', hoursAgo(44)],
    [uuidv4(), orderMap['RX20260601004'], 3, ORDER_STATUS.SIGNED, ORDER_STATUS.RETURNED_CORRECTION, 'u_manager_zhao', '赵经理', ROLES.AREA_MANAGER, '复核时发现处方图像模糊、身份证号无法辨认，退回门店补正', hoursAgo(30)],
    [uuidv4(), orderMap['RX20260601005'], 1, null, ORDER_STATUS.PENDING_SIGN, 'u_clerk_wang', '王店员', ROLES.STORE_CLERK, '门店登记处方订单', hoursAgo(60)],
    [uuidv4(), orderMap['RX20260601005'], 2, ORDER_STATUS.PENDING_SIGN, ORDER_STATUS.SIGNED, 'u_pharmacist_zhang', '张药师', ROLES.PHARMACIST, '核验通过，已上传签收确认单', hoursAgo(40)],
    [uuidv4(), orderMap['RX20260601006'], 1, null, ORDER_STATUS.PENDING_SIGN, 'u_clerk_li', '李店员', ROLES.STORE_CLERK, '门店登记处方订单，等待执业药师处理', hoursAgo(4)],
    [uuidv4(), orderMap['RX20260601007'], 1, null, ORDER_STATUS.PENDING_SIGN, 'u_clerk_wang', '王店员', ROLES.STORE_CLERK, '门店登记处方订单', hoursAgo(20)],
    [uuidv4(), orderMap['RX20260601007'], 2, ORDER_STATUS.PENDING_SIGN, ORDER_STATUS.ABNORMAL_RETURN, 'u_pharmacist_zhang', '张药师', ROLES.PHARMACIST, '药品批号异常，标记异常回传', hoursAgo(12)],
    [uuidv4(), orderMap['RX20260601008'], 1, null, ORDER_STATUS.PENDING_SIGN, 'u_clerk_li', '李店员', ROLES.STORE_CLERK, '门店登记处方订单，等待执业药师处理', hoursAgo(1)]
  ];

  const insertManyRecords = db.transaction((rows) => {
    for (const row of rows) insertRecord.run(...row);
  });
  insertManyRecords(records);
  console.log('已插入 14 条处理记录');

  const insertAudit = db.prepare(`
    INSERT INTO audit_notes (
      id, order_id, order_version, operator_id, operator_name,
      operator_role, action, content, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const audits = [
    [uuidv4(), orderMap['RX20260601002'], 2, 'u_pharmacist_zhang', '张药师', ROLES.PHARMACIST, 'view', '查看处方订单详情', hoursAgo(10)],
    [uuidv4(), orderMap['RX20260601002'], 2, 'u_pharmacist_zhang', '张药师', ROLES.PHARMACIST, 'update_status', '将状态改为缺料，备注：阿莫西林胶囊库存不足', hoursAgo(10)],
    [uuidv4(), orderMap['RX20260601003'], 2, 'u_manager_zhao', '赵经理', ROLES.AREA_MANAGER, 'view', '查看逾期处方订单', hoursAgo(36)],
    [uuidv4(), orderMap['RX20260601004'], 3, 'u_manager_zhao', '赵经理', ROLES.AREA_MANAGER, 'return_correction', '复核不通过，退回门店补正：处方图像模糊、身份证号无法辨认', hoursAgo(30)],
    [uuidv4(), orderMap['RX20260601005'], 2, 'u_manager_zhao', '赵经理', ROLES.AREA_MANAGER, 'review', '复核通过，订单已完成归档', hoursAgo(24)],
    [uuidv4(), orderMap['RX20260601007'], 2, 'u_pharmacist_zhang', '张药师', ROLES.PHARMACIST, 'update_status', '将状态改为异常回传，备注：药品批号存疑', hoursAgo(12)]
  ];

  const insertManyAudits = db.transaction((rows) => {
    for (const row of rows) insertAudit.run(...row);
  });
  insertManyAudits(audits);
  console.log('已插入 6 条审计备注');

  const insertAbnormal = db.prepare(`
    INSERT INTO abnormal_reasons (
      id, order_id, abnormal_type, description, responsible_person,
      reported_by, reported_by_name, reported_at, resolved
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)
  `);

  const abnormals = [
    [uuidv4(), orderMap['RX20260601002']],
    [uuidv4(), orderMap['RX20260601003']],
    [uuidv4(), orderMap['RX20260601004']],
    [uuidv4(), orderMap['RX20260601007']]
  ].map(([id, oid]) => {
    const order = db.prepare('SELECT abnormal_type, abnormal_reason, handler_name FROM prescription_orders WHERE id = ?').get(oid);
    const reportedBy = 'u_manager_zhao';
    const reportedByName = '赵经理';
    return [id, oid, order.abnormal_type, order.abnormal_reason, order.handler_name, reportedBy, reportedByName, hoursAgo(10)];
  });

  const insertManyAbnormals = db.transaction((rows) => {
    for (const row of rows) insertAbnormal.run(...row);
  });
  insertManyAbnormals(abnormals);
  console.log('已插入 4 条异常原因记录');

  console.log('\n数据库初始化完成！');
  console.log('演示账号：');
  console.log('  门店店员：clerk_wang / clerk_li');
  console.log('  执业药师：pharmacist_zhang / pharmacist_chen');
  console.log('  区域经理：manager_zhao');
}

seed();
