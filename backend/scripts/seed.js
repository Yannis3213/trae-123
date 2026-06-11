const Database = require('better-sqlite3');
const path = require('path');
const bcrypt = require('bcryptjs');

const dbPath = path.join(__dirname, '..', 'data', 'orders.db');
const db = new Database(dbPath);

db.pragma('foreign_keys = ON');

const hashPassword = (pwd) => bcrypt.hashSync(pwd, 10);

const insertUser = db.prepare(`
  INSERT OR REPLACE INTO users (id, username, password, name, role, store_id)
  VALUES (?, ?, ?, ?, ?, ?)
`);

const insertStore = db.prepare(`
  INSERT OR REPLACE INTO stores (id, name, address, manager_id)
  VALUES (?, ?, ?, ?)
`);

const insertOrder = db.prepare(`
  INSERT OR REPLACE INTO store_orders (
    id, order_no, store_id, order_date, expected_arrival, status,
    current_handler, current_role, version, total_amount,
    material_evidence, acceptance_evidence, inventory_evidence,
    exception_reason, exception_type, deadline, node_started_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const insertOrderItem = db.prepare(`
  INSERT OR REPLACE INTO order_items (
    id, order_id, material_name, spec, quantity, unit, unit_price,
    arrived_quantity, accepted_quantity
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const insertAttachment = db.prepare(`
  INSERT OR REPLACE INTO attachments (
    id, order_id, file_name, file_path, file_type, file_size,
    uploaded_by, upload_type
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`);

const insertRecord = db.prepare(`
  INSERT OR REPLACE INTO processing_records (
    id, order_id, action, from_status, to_status, operator_id,
    operator_role, operator_name, remark, evidence, version
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const insertException = db.prepare(`
  INSERT OR REPLACE INTO exception_reasons (
    id, order_id, exception_type, description, detected_by,
    detected_at, resolved, resolved_by, resolved_at, resolution
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const insertAuditNote = db.prepare(`
  INSERT OR REPLACE INTO audit_notes (id, order_id, note, noted_by)
  VALUES (?, ?, ?, ?)
`);

const now = new Date();
const formatDate = (d) => d.toISOString().slice(0, 10);
const formatDateTime = (d) => d.toISOString().replace('T', ' ').slice(0, 19);
const addDays = (d, days) => { const nd = new Date(d); nd.setDate(nd.getDate() + days); return nd; };
const addHours = (d, hours) => { const nd = new Date(d); nd.setHours(nd.getHours() + hours); return nd; };

const tx = db.transaction(() => {
  insertStore.run(1, '望京店', '北京市朝阳区望京SOHO', 1);
  insertStore.run(2, '国贸店', '北京市朝阳区国贸大厦', 2);
  insertStore.run(3, '中关村店', '北京市海淀区中关村大街', 3);

  insertUser.run(1, 'store1', hashPassword('123456'), '张店长', 'store_manager', 1);
  insertUser.run(2, 'store2', hashPassword('123456'), '李店长', 'store_manager', 2);
  insertUser.run(3, 'store3', hashPassword('123456'), '王店长', 'store_manager', 3);
  insertUser.run(4, 'qc1', hashPassword('123456'), '陈品控', 'qc_specialist', null);
  insertUser.run(5, 'ops1', hashPassword('123456'), '刘经理', 'operations_manager', null);

  const normalDeadline = addDays(now, 3);
  const urgentDeadline = addHours(now, 6);
  const overdueDeadline = addDays(now, -2);
  const nearDeadline = addHours(now, 20);

  insertOrder.run(
    1, 'DD20260601001', 1, formatDate(addDays(now, -5)), formatDate(addDays(now, -2)),
    'pending_material', 'store1', 'store_manager', 1, 5800.00,
    null, null, null, null, null,
    formatDateTime(normalDeadline), formatDateTime(addDays(now, -1))
  );

  insertOrderItem.run(1, 1, '东北大米', '25kg/袋', 20, '袋', 120.00, 0, 0);
  insertOrderItem.run(2, 1, '金龙鱼调和油', '5L/桶', 15, '桶', 85.00, 0, 0);
  insertOrderItem.run(3, 1, '草原羔羊肉卷', '5kg/箱', 8, '箱', 220.00, 0, 0);
  insertOrderItem.run(4, 1, '五常糯米', '10kg/袋', 10, '袋', 68.00, 0, 0);

  insertRecord.run(1, 1, '创建订货单', 'pending_material', 'pending_material', 1, 'store_manager', '张店长',
    '月初原料需求申请', JSON.stringify({ source: 'pos_system' }), 1);

  insertOrder.run(
    2, 'DD20260601002', 2, formatDate(addDays(now, -4)), formatDate(addDays(now, -1)),
    'pending_acceptance', 'qc1', 'qc_specialist', 2, 8650.00,
    JSON.stringify({ has_invoice: true, invoice_no: 'INV-2026-06001', material_complete: true }),
    null, null, null, null,
    formatDateTime(urgentDeadline), formatDateTime(addHours(now, -1))
  );

  insertOrderItem.run(5, 2, '澳洲和牛', '10kg/箱', 6, '箱', 880.00, 6, 0);
  insertOrderItem.run(6, 2, '挪威三文鱼', '5kg/箱', 5, '箱', 420.00, 5, 0);
  insertOrderItem.run(7, 2, '法国鹅肝', '2kg/盒', 3, '盒', 350.00, 3, 0);

  insertAttachment.run(1, 2, '采购发票.jpg', '/uploads/2/invoice.jpg', 'image/jpeg', 245000, 2, 'material');
  insertAttachment.run(2, 2, '订货单扫描件.pdf', '/uploads/2/order.pdf', 'application/pdf', 156000, 2, 'material');

  insertRecord.run(2, 2, '提交订货材料', 'pending_material', 'pending_acceptance', 2, 'store_manager', '李店长',
    '材料已齐全，申请进入验收', JSON.stringify({ invoice_no: 'INV-2026-06001' }), 1);

  insertOrder.run(
    3, 'DD20260601003', 1, formatDate(addDays(now, -6)), formatDate(addDays(now, -3)),
    'pending_review', 'ops1', 'operations_manager', 3, 3200.00,
    JSON.stringify({ has_invoice: true, material_complete: true }),
    JSON.stringify({ acceptance_passed: true, inspector: '陈品控', check_date: formatDate(now) }),
    null, null, null,
    formatDateTime(normalDeadline), formatDateTime(now)
  );

  insertOrderItem.run(8, 3, '有机蔬菜套装', '10kg/箱', 12, '箱', 180.00, 12, 12);
  insertOrderItem.run(9, 3, '散养土鸡', '2只/箱', 5, '箱', 160.00, 5, 5);

  insertAttachment.run(3, 3, '验收单.pdf', '/uploads/3/acceptance.pdf', 'application/pdf', 234000, 4, 'acceptance');
  insertAttachment.run(4, 3, '质检照片.jpg', '/uploads/3/quality.jpg', 'image/jpeg', 312000, 4, 'acceptance');

  insertRecord.run(3, 3, '提交订货材料', 'pending_material', 'pending_acceptance', 1, 'store_manager', '张店长', null, null, 1);
  insertRecord.run(4, 3, '验收通过', 'pending_acceptance', 'pending_review', 4, 'qc_specialist', '陈品控',
    '到货数量准确，质量合格', JSON.stringify({ samples: 5, pass_rate: '100%' }), 2);

  insertOrder.run(
    4, 'DD20260601004', 3, formatDate(addDays(now, -3)), formatDate(addDays(now, 2)),
    'exception', 'store3', 'store_manager', 2, 1560.00,
    null, null, null,
    '缺少采购发票和验收单', 'missing_material',
    formatDateTime(nearDeadline), formatDateTime(addDays(now, -1))
  );

  insertOrderItem.run(10, 4, '青岛啤酒', '500ml*24', 20, '箱', 68.00, 15, 0);
  insertOrderItem.run(11, 4, '五常大米', '25kg/袋', 8, '袋', 125.00, 8, 0);

  insertException.run(1, 4, 'missing_material', '店长未上传采购发票和订货单扫描件，材料不齐全', 4,
    formatDateTime(addHours(now, -3)), 0, null, null, null);

  insertRecord.run(5, 4, '提交订货材料', 'pending_material', 'pending_acceptance', 3, 'store_manager', '王店长',
    '申请验收', null, 1);
  insertRecord.run(6, 4, '材料审核不通过', 'pending_acceptance', 'exception', 4, 'qc_specialist', '陈品控',
    '缺少采购发票和验收单，需补齐后重新提交', JSON.stringify({ missing_items: ['发票', '订货单扫描件'] }), 2);

  insertAuditNote.run(1, 4, '此单多次催交材料，店长仍未补齐，需重点关注', 4);

  insertOrder.run(
    5, 'DD20260601005', 2, formatDate(addDays(now, -7)), formatDate(addDays(now, -5)),
    'exception', 'qc1', 'qc_specialist', 1, 4280.00,
    JSON.stringify({ has_invoice: true, material_complete: true }),
    null, null,
    '验收节点已超时48小时', 'timeout',
    formatDateTime(overdueDeadline), formatDateTime(addDays(now, -3))
  );

  insertOrderItem.run(12, 5, '深海大虾', '2kg/盒', 10, '盒', 168.00, 0, 0);
  insertOrderItem.run(13, 5, '进口牛肉', '10kg/箱', 3, '箱', 820.00, 0, 0);

  insertException.run(2, 5, 'timeout', '验收节点应于2天前完成，已超时48小时，责任人：陈品控', null,
    formatDateTime(overdueDeadline), 0, null, null, null);

  insertAttachment.run(5, 5, '采购发票.pdf', '/uploads/5/invoice.pdf', 'application/pdf', 189000, 2, 'material');

  insertRecord.run(7, 5, '提交订货材料', 'pending_material', 'pending_acceptance', 2, 'store_manager', '李店长',
    '材料齐全', JSON.stringify({ invoice_no: 'INV-2026-06005' }), 1);

  insertOrder.run(
    6, 'DD20260601006', 1, formatDate(addDays(now, -8)), formatDate(addDays(now, -6)),
    'recheck_pending', 'qc1', 'qc_specialist', 4, 2890.00,
    JSON.stringify({ has_invoice: true, material_complete: true }),
    JSON.stringify({ acceptance_passed: false, inspector: '陈品控' }),
    null,
    '营运经理退回要求重新验收', 'rejection',
    formatDateTime(nearDeadline), formatDateTime(addHours(now, -5))
  );

  insertOrderItem.run(14, 6, '培根肉片', '2kg/包', 15, '包', 78.00, 15, 10);
  insertOrderItem.run(15, 6, '芝士片', '1kg/包', 10, '包', 92.00, 10, 8);
  insertOrderItem.run(16, 6, '淡奶油', '1L/盒', 8, '盒', 45.00, 8, 8);

  insertException.run(3, 6, 'rejection', '营运经理退回：验收不合格的5包培根未标注异常原因，需补正后重新提交', 5,
    formatDateTime(addHours(now, -2)), 0, null, null, null);

  insertAttachment.run(6, 6, '退货补正说明.pdf', '/uploads/6/correction.pdf', 'application/pdf', 145000, 5, 'correction');

  insertRecord.run(8, 6, '提交订货材料', 'pending_material', 'pending_acceptance', 1, 'store_manager', '张店长', null, null, 1);
  insertRecord.run(9, 6, '验收完成', 'pending_acceptance', 'pending_review', 4, 'qc_specialist', '陈品控',
    '部分质量问题已标注', JSON.stringify({ damaged: 5 }), 2);
  insertRecord.run(10, 6, '退回补正', 'pending_review', 'recheck_pending', 5, 'operations_manager', '刘经理',
    '退回品控重新验收，5包培根的异常原因未标注清楚', JSON.stringify({ correction_items: ['异常原因标注'] }), 3);

  insertOrder.run(
    7, 'DD20260601007', 3, formatDate(addDays(now, -10)), formatDate(addDays(now, -8)),
    'completed', 'ops1', 'operations_manager', 4, 6750.00,
    JSON.stringify({ has_invoice: true, material_complete: true }),
    JSON.stringify({ acceptance_passed: true, inspector: '陈品控' }),
    JSON.stringify({ inventory_updated: true, warehouse: '中心仓A区', stock_date: formatDate(now) }),
    null, null,
    formatDateTime(addDays(now, -1)), formatDateTime(addDays(now, -2))
  );

  insertOrderItem.run(17, 7, '有机番茄', '10kg/箱', 25, '箱', 85.00, 25, 25);
  insertOrderItem.run(18, 7, '新鲜黄瓜', '10kg/箱', 20, '箱', 65.00, 20, 20);
  insertOrderItem.run(19, 7, '紫甘蓝', '5kg/袋', 15, '袋', 58.00, 15, 15);

  insertAttachment.run(7, 7, '入库单.pdf', '/uploads/7/inventory.pdf', 'application/pdf', 210000, 5, 'inventory');

  insertRecord.run(11, 7, '提交订货材料', 'pending_material', 'pending_acceptance', 3, 'store_manager', '王店长', null, null, 1);
  insertRecord.run(12, 7, '验收通过', 'pending_acceptance', 'pending_review', 4, 'qc_specialist', '陈品控', null, null, 2);
  insertRecord.run(13, 7, '库存回写完成', 'pending_review', 'completed', 5, 'operations_manager', '刘经理',
    '已完成库存回写，流程结束', JSON.stringify({ stock_location: 'A-015' }), 3);

  insertOrder.run(
    8, 'DD20260601008', 2, formatDate(addDays(now, -2)), formatDate(addDays(now, 1)),
    'pending_review', 'ops1', 'operations_manager', 3, 5200.00,
    JSON.stringify({ has_invoice: true, material_complete: true }),
    JSON.stringify({ acceptance_passed: true, inspector: '陈品控', check_date: formatDate(now) }),
    null,
    '店长在验收环节试图修改已提交材料，版本冲突已拦截', 'status_conflict',
    formatDateTime(normalDeadline), formatDateTime(addHours(now, -1))
  );

  insertOrderItem.run(20, 8, '雪花牛肉', '5kg/盒', 4, '盒', 680.00, 4, 4);
  insertOrderItem.run(21, 8, '鹅肝酱', '500g/瓶', 6, '瓶', 280.00, 6, 6);
  insertOrderItem.run(22, 8, '松露', '100g/盒', 2, '盒', 450.00, 2, 2);

  insertException.run(4, 8, 'status_conflict', '店长在品控验收环节试图撤回并修改订货材料，版本号不匹配，已拦截', 4,
    formatDateTime(addHours(now, -2)), 0, null, null, null);

  insertRecord.run(14, 8, '提交订货材料', 'pending_material', 'pending_acceptance', 2, 'store_manager', '李店长', null, null, 1);
  insertRecord.run(15, 8, '冲突拦截', 'pending_acceptance', 'pending_acceptance', 2, 'store_manager', '李店长',
    '试图在验收环节修改材料，已拦截', JSON.stringify({ expected_version: 2, submitted_version: 1 }), 2);
  insertRecord.run(16, 8, '验收完成', 'pending_acceptance', 'pending_review', 4, 'qc_specialist', '陈品控',
    '品控已验收，待库存复核', JSON.stringify({ pass_rate: '100%' }), 3);

  insertOrder.run(
    9, 'DD20260601009', 3, formatDate(addDays(now, -1)), formatDate(addDays(now, 3)),
    'pending_material', 'store3', 'store_manager', 1, 2100.00,
    null, null, null, null, null,
    formatDateTime(normalDeadline), formatDateTime(now)
  );

  insertOrderItem.run(23, 9, '面粉', '25kg/袋', 10, '袋', 95.00, 0, 0);
  insertOrderItem.run(24, 9, '酵母', '500g/包', 8, '包', 35.00, 0, 0);
  insertOrderItem.run(25, 9, '黄油', '5kg/箱', 3, '箱', 280.00, 0, 0);

  insertOrder.run(
    10, 'DD20260601010', 1, formatDate(addDays(now, -2)), formatDate(addDays(now, 2)),
    'pending_material', 'store1', 'store_manager', 1, 1850.00,
    null, null, null, null, null,
    formatDateTime(nearDeadline), formatDateTime(addHours(now, -6))
  );

  insertOrderItem.run(26, 10, '百事可乐', '330ml*24', 15, '箱', 52.00, 0, 0);
  insertOrderItem.run(27, 10, '矿泉水', '550ml*24', 20, '箱', 28.00, 0, 0);
  insertOrderItem.run(28, 10, '果汁饮料', '1L*12', 10, '箱', 48.00, 0, 0);

  console.log('种子数据初始化完成');
  console.log('演示账号:');
  console.log('  门店店长(望京店): store1 / 123456');
  console.log('  门店店长(国贸店): store2 / 123456');
  console.log('  门店店长(中关村店): store3 / 123456');
  console.log('  品控专员: qc1 / 123456');
  console.log('  营运经理: ops1 / 123456');
  console.log('');
  console.log('异常样例:');
  console.log('  1. 缺材料 (DD20260601004): 店长未上传采购发票');
  console.log('  2. 超时 (DD20260601005): 验收节点已超时48小时');
  console.log('  3. 退回补正 (DD20260601006): 营运经理退回重验');
  console.log('  4. 状态冲突 (DD20260601008): 版本号不匹配拦截');
});

tx();
db.close();
