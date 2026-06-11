const express = require('express');
const cors = require('cors');
const Database = require('better-sqlite3');
const path = require('path');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const fs = require('fs');

const PORT = 8001;
const FRONTEND_PORT = 3001;
const FRONTEND_URL = `http://localhost:${FRONTEND_PORT}`;

const app = express();

const corsOptions = {
  origin: [FRONTEND_URL, `http://127.0.0.1:${FRONTEND_PORT}`],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-User-Id', 'X-User-Role']
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const orderDir = path.join(uploadDir, req.params.orderId || 'temp');
    if (!fs.existsSync(orderDir)) {
      fs.mkdirSync(orderDir, { recursive: true });
    }
    cb(null, orderDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${file.originalname}`;
    cb(null, uniqueName);
  }
});

const upload = multer({ storage });

const dbPath = path.join(__dirname, 'data', 'orders.db');
let db;

try {
  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
} catch (err) {
  console.error('数据库连接失败，请先运行 npm run init-db 和 npm run seed');
  process.exit(1);
}

const parseJsonField = (value) => {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
};

const serializeOrder = (row) => {
  if (!row) return null;
  return {
    ...row,
    material_evidence: parseJsonField(row.material_evidence),
    acceptance_evidence: parseJsonField(row.acceptance_evidence),
    inventory_evidence: parseJsonField(row.inventory_evidence)
  };
};

const statusMap = {
  pending_material: { label: '待确认', color: '#faad14', filter: 'pending' },
  pending_acceptance: { label: '待验收', color: '#1890ff', filter: 'pending' },
  pending_review: { label: '待复核', color: '#722ed1', filter: 'pending' },
  exception: { label: '异常', color: '#f5222d', filter: 'exception' },
  recheck_pending: { label: '已复查', color: '#eb2f96', filter: 'rechecked' },
  completed: { label: '已完成', color: '#52c41a', filter: 'completed' },
  rejected: { label: '已拒绝', color: '#8c8c8c', filter: 'completed' }
};

const roleMap = {
  store_manager: { label: '门店店长', nextStatus: 'pending_acceptance' },
  qc_specialist: { label: '品控专员', nextStatus: 'pending_review' },
  operations_manager: { label: '营运经理', nextStatus: 'completed' }
};

const getDeadlineStatus = (deadline, nodeStartedAt) => {
  if (!deadline) return 'normal';
  const now = new Date();
  const dl = new Date(deadline);
  const diffHours = (dl - now) / (1000 * 60 * 60);
  
  if (diffHours < 0) return 'overdue';
  if (diffHours <= 24) return 'near';
  return 'normal';
};

const authMiddleware = (req, res, next) => {
  const userId = req.headers['x-user-id'];
  const userRole = req.headers['x-user-role'];
  
  if (!userId || !userRole) {
    return res.status(401).json({ error: '未授权访问，请先登录' });
  }
  
  const user = db.prepare('SELECT * FROM users WHERE id = ? AND role = ?').get(userId, userRole);
  if (!user) {
    return res.status(401).json({ error: '用户信息无效' });
  }
  
  req.user = user;
  next();
};

const validateSubmission = (order, user, submittedVersion) => {
  const errors = [];

  if (order.current_role !== user.role) {
    return { valid: false, error: `越权操作：当前节点处理角色为${roleMap[order.current_role]?.label || order.current_role}，您的角色（${roleMap[user.role]?.label || user.role}）无操作权限` };
  }

  if (order.current_handler !== user.username) {
    return { valid: false, error: `处理人不匹配：当前节点处理人为${order.current_handler}，您的账号为${user.username}，无权操作此订单` };
  }

  if (order.version !== submittedVersion) {
    return { valid: false, error: `版本冲突：当前版本为v${order.version}，您提交的是v${submittedVersion}，数据已被他人修改，请刷新页面后重试` };
  }

  return { valid: true };
};

const validateEvidence = (status, evidence, type) => {
  if (type === 'material' && (status === 'pending_material' || status === 'exception')) {
    if (!evidence || !evidence.has_invoice) {
      return { valid: false, error: '缺少必填证据：采购发票未上传，请勾选"是否有采购发票"后重试' };
    }
    if (!evidence.material_complete) {
      return { valid: false, error: '材料不完整：请确认所有订货材料已齐全后再提交' };
    }
  }
  if (type === 'acceptance' && (status === 'pending_acceptance' || status === 'recheck_pending')) {
    if (!evidence || typeof evidence.acceptance_passed === 'undefined') {
      return { valid: false, error: '缺少必填证据：验收结果未填写，请选择"验收通过"或"验收不通过"' };
    }
  }
  if (type === 'inventory' && status === 'pending_review') {
    if (!evidence || !evidence.inventory_updated) {
      return { valid: false, error: '缺少必填证据：库存回写凭证未确认，请勾选"库存已回写"后重试' };
    }
  }
  return { valid: true };
};

const validateDeadline = (order) => {
  if (!order.deadline) return { valid: true };
  const now = new Date();
  const dl = new Date(order.deadline);
  if (dl < now) {
    return { valid: false, error: `验收时限已过：截止时间为${order.deadline}，已逾期${Math.floor((now - dl) / (1000 * 60 * 60))}小时，责任人：${roleMap[order.current_role]?.label || order.current_handler}，请联系营运经理处理` };
  }
  const diffHours = (dl - now) / (1000 * 60 * 60);
  if (diffHours <= 24) {
    return { valid: true, warning: `注意：距离截止时间仅剩${Math.floor(diffHours)}小时，请尽快处理` };
  }
  return { valid: true };
};

app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  
  if (!user) {
    return res.status(401).json({ error: '用户名或密码错误' });
  }
  
  if (!bcrypt.compareSync(password, user.password)) {
    return res.status(401).json({ error: '用户名或密码错误' });
  }
  
  res.json({
    id: user.id,
    username: user.username,
    name: user.name,
    role: user.role,
    roleLabel: roleMap[user.role]?.label,
    storeId: user.store_id
  });
});

app.get('/api/users', authMiddleware, (req, res) => {
  const users = db.prepare('SELECT id, username, name, role, store_id FROM users').all();
  res.json(users.map(u => ({ ...u, roleLabel: roleMap[u.role]?.label })));
});

app.get('/api/orders', authMiddleware, (req, res) => {
  const { filter, status, storeId, search } = req.query;
  let sql = `
    SELECT o.*, s.name as store_name, s.address as store_address
    FROM store_orders o
    LEFT JOIN stores s ON o.store_id = s.id
    WHERE 1=1
  `;
  const params = [];
  
  if (filter === 'pending') {
    sql += ' AND o.status IN (?, ?, ?)';
    params.push('pending_material', 'pending_acceptance', 'pending_review');
  } else if (filter === 'exception') {
    sql += ' AND o.status = ?';
    params.push('exception');
  } else if (filter === 'rechecked') {
    sql += ' AND o.status = ?';
    params.push('recheck_pending');
  }
  
  if (status) {
    sql += ' AND o.status = ?';
    params.push(status);
  }
  
  if (storeId) {
    sql += ' AND o.store_id = ?';
    params.push(storeId);
  }
  
  if (search) {
    sql += ' AND (o.order_no LIKE ? OR s.name LIKE ?)';
    params.push(`%${search}%`, `%${search}%`);
  }
  
  sql += ' ORDER BY o.created_at DESC';
  
  const orders = db.prepare(sql).all(...params).map(row => {
    const order = serializeOrder(row);
    const statusInfo = statusMap[order.status];
    return {
      ...order,
      status_label: statusInfo?.label,
      status_color: statusInfo?.color,
      deadline_status: getDeadlineStatus(order.deadline, order.node_started_at),
      current_role_label: roleMap[order.current_role]?.label
    };
  });
  
  res.json(orders);
});

app.get('/api/orders/stats', authMiddleware, (req, res) => {
  const stats = db.prepare(`
    SELECT 
      status,
      COUNT(*) as count
    FROM store_orders
    GROUP BY status
  `).all();
  
  const counts = {
    pending: 0,
    exception: 0,
    rechecked: 0,
    completed: 0,
    total: 0
  };
  
  const now = new Date();
  const deadlineStats = { normal: 0, near: 0, overdue: 0 };
  
  const allOrders = db.prepare('SELECT status, deadline, node_started_at FROM store_orders').all();
  
  allOrders.forEach(row => {
    counts.total++;
    const info = statusMap[row.status];
    if (info && counts[info.filter] !== undefined) {
      counts[info.filter]++;
    }
    const dlStatus = getDeadlineStatus(row.deadline, row.node_started_at);
    deadlineStats[dlStatus]++;
  });
  
  res.json({ counts, deadlineStats });
});

app.get('/api/orders/overdue-queue', authMiddleware, (req, res) => {
  const { status } = req.query;
  const orders = db.prepare(`
    SELECT o.*, s.name as store_name, u.name as handler_name
    FROM store_orders o
    LEFT JOIN stores s ON o.store_id = s.id
    LEFT JOIN users u ON o.current_handler = u.username
    WHERE o.status NOT IN ('completed', 'rejected')
    ORDER BY o.deadline IS NULL, o.deadline ASC
  `).all().map(row => {
    const order = serializeOrder(row);
    const dlStatus = getDeadlineStatus(order.deadline, order.node_started_at);
    const now = new Date();
    const dl = new Date(order.deadline);
    const diffHours = (dl - now) / (1000 * 60 * 60);
    
    return {
      ...order,
      deadline_status: dlStatus,
      deadline_label: dlStatus === 'overdue' ? `已逾期${Math.abs(Math.floor(diffHours))}小时` :
                     dlStatus === 'near' ? `剩余${Math.floor(diffHours)}小时` :
                     `剩余${Math.floor(diffHours / 24)}天`,
      status_label: statusMap[order.status]?.label,
      status_color: statusMap[order.status]?.color,
      responsible_person: row.handler_name,
      current_role_label: roleMap[order.current_role]?.label
    };
  });
  
  let filtered = orders;
  if (status) {
    filtered = orders.filter(o => o.deadline_status === status);
  }
  
  res.json(filtered);
});

app.get('/api/orders/:id', authMiddleware, (req, res) => {
  const order = db.prepare(`
    SELECT o.*, s.name as store_name, s.address as store_address
    FROM store_orders o
    LEFT JOIN stores s ON o.store_id = s.id
    WHERE o.id = ?
  `).get(req.params.id);
  
  if (!order) {
    return res.status(404).json({ error: '订单不存在' });
  }
  
  const serialized = serializeOrder(order);
  const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(req.params.id);
  const attachments = db.prepare(`
    SELECT a.*, u.name as uploader_name
    FROM attachments a
    LEFT JOIN users u ON a.uploaded_by = u.id
    WHERE a.order_id = ?
    ORDER BY a.created_at DESC
  `).all(req.params.id);
  const records = db.prepare(`
    SELECT pr.*, u.name as operator_name
    FROM processing_records pr
    LEFT JOIN users u ON pr.operator_id = u.id
    WHERE pr.order_id = ?
    ORDER BY pr.created_at DESC
  `).all(req.params.id).map(r => ({ ...r, evidence: parseJsonField(r.evidence) }));
  const exceptions = db.prepare(`
    SELECT er.*, u.name as detected_by_name, ur.name as resolved_by_name
    FROM exception_reasons er
    LEFT JOIN users u ON er.detected_by = u.id
    LEFT JOIN users ur ON er.resolved_by = ur.id
    WHERE er.order_id = ?
    ORDER BY er.detected_at DESC
  `).all(req.params.id);
  const auditNotes = db.prepare(`
    SELECT an.*, u.name as noted_by_name
    FROM audit_notes an
    LEFT JOIN users u ON an.noted_by = u.id
    WHERE an.order_id = ?
    ORDER BY an.created_at DESC
  `).all(req.params.id);
  
  const statusInfo = statusMap[serialized.status];
  
  res.json({
    ...serialized,
    items,
    attachments,
    records,
    exceptions,
    audit_notes: auditNotes,
    status_label: statusInfo?.label,
    status_color: statusInfo?.color,
    deadline_status: getDeadlineStatus(serialized.deadline, serialized.node_started_at),
    current_role_label: roleMap[serialized.current_role]?.label
  });
});

app.post('/api/orders', authMiddleware, (req, res) => {
  const { store_id, order_date, expected_arrival, items } = req.body;
  
  if (!store_id || !order_date || !items || items.length === 0) {
    return res.status(400).json({ error: '门店、订货日期和明细不能为空' });
  }
  
  const now = new Date();
  const orderNo = `DD${order_date.replace(/-/g, '')}${String(Math.floor(Math.random() * 1000)).padStart(3, '0')}`;
  
  const totalAmount = items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
  
  const tx = db.transaction(() => {
    const result = db.prepare(`
      INSERT INTO store_orders (
        order_no, store_id, order_date, expected_arrival, status,
        current_handler, current_role, version, total_amount,
        deadline, node_started_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)
    `).run(
      orderNo, store_id, order_date, expected_arrival, 'pending_material',
      req.user.username, 'store_manager', totalAmount,
      new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().replace('T', ' ').slice(0, 19),
      now.toISOString().replace('T', ' ').slice(0, 19)
    );
    
    const orderId = result.lastInsertRowid;
    
    const insertItem = db.prepare(`
      INSERT INTO order_items (order_id, material_name, spec, quantity, unit, unit_price)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    
    items.forEach(item => {
      insertItem.run(orderId, item.material_name, item.spec || '', item.quantity, item.unit, item.unit_price);
    });
    
    db.prepare(`
      INSERT INTO processing_records (
        order_id, action, from_status, to_status, operator_id,
        operator_role, operator_name, remark, evidence, version
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      orderId, '创建订货单', 'pending_material', 'pending_material',
      req.user.id, req.user.role, req.user.name,
      '新建原料订货单',
      JSON.stringify({ source: 'manual' }),
      1
    );
    
    return orderId;
  });
  
  try {
    const orderId = tx();
    res.json({ id: orderId, order_no: orderNo, message: '创建成功' });
  } catch (err) {
    res.status(500).json({ error: '创建失败：' + err.message });
  }
});

app.post('/api/orders/:id/submit-material', authMiddleware, (req, res) => {
  const orderId = req.params.id;
  const { version, evidence, remark } = req.body;
  
  const order = db.prepare('SELECT * FROM store_orders WHERE id = ?').get(orderId);
  if (!order) {
    return res.status(404).json({ error: '订单不存在' });
  }
  
  if (order.status !== 'pending_material' && order.status !== 'exception') {
    return res.status(400).json({ error: `状态冲突：当前状态为${statusMap[order.status]?.label}，不能提交材料` });
  }

  const validation = validateSubmission(order, req.user, version);
  if (!validation.valid) {
    return res.status(400).json({ error: validation.error });
  }
  
  if (req.user.role !== 'store_manager') {
    return res.status(403).json({ error: '越权操作：只有门店店长可以提交订货材料' });
  }
  
  if (req.user.store_id && req.user.store_id !== order.store_id) {
    return res.status(403).json({ error: '越权操作：只能处理本店的订货单' });
  }
  
  const evidenceCheck = validateEvidence(order.status, evidence, 'material');
  if (!evidenceCheck.valid) {
    return res.status(400).json({ error: evidenceCheck.error });
  }
  
  const tx = db.transaction(() => {
    db.prepare(`
      UPDATE store_orders SET
        status = 'pending_acceptance',
        current_handler = 'qc1',
        current_role = 'qc_specialist',
        version = version + 1,
        material_evidence = ?,
        exception_reason = NULL,
        exception_type = NULL,
        node_started_at = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND version = ?
    `).run(
      JSON.stringify(evidence),
      new Date().toISOString().replace('T', ' ').slice(0, 19),
      orderId,
      version
    );
    
    db.prepare(`
      INSERT INTO processing_records (
        order_id, action, from_status, to_status, operator_id,
        operator_role, operator_name, remark, evidence, version
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      orderId, '提交订货材料', order.status, 'pending_acceptance',
      req.user.id, req.user.role, req.user.name,
      remark || '材料已齐全，申请验收',
      JSON.stringify(evidence),
      version + 1
    );
    
    if (order.exception_type) {
      db.prepare(`
        UPDATE exception_reasons SET
          resolved = 1,
          resolved_by = ?,
          resolved_at = ?,
          resolution = ?
        WHERE order_id = ? AND exception_type = ? AND resolved = 0
      `).run(
        req.user.id,
        new Date().toISOString().replace('T', ' ').slice(0, 19),
        '材料已补齐，重新提交',
        orderId,
        order.exception_type
      );
    }
  });
  
  try {
    tx();
    res.json({ success: true, message: '材料提交成功，已进入验收环节', newVersion: version + 1 });
  } catch (err) {
    res.status(500).json({ error: '提交失败：' + err.message });
  }
});

app.post('/api/orders/:id/submit-acceptance', authMiddleware, (req, res) => {
  const orderId = req.params.id;
  const { version, evidence, remark, items, passed } = req.body;
  
  const order = db.prepare('SELECT * FROM store_orders WHERE id = ?').get(orderId);
  if (!order) {
    return res.status(404).json({ error: '订单不存在' });
  }
  
  if (order.status !== 'pending_acceptance' && order.status !== 'recheck_pending') {
    return res.status(400).json({ error: `状态冲突：当前状态为${statusMap[order.status]?.label}，不能进行验收` });
  }

  const validation = validateSubmission(order, req.user, version);
  if (!validation.valid) {
    return res.status(400).json({ error: validation.error });
  }
  
  if (req.user.role !== 'qc_specialist') {
    return res.status(403).json({ error: '越权操作：只有品控专员可以进行到货验收' });
  }
  
  const evidenceCheck = validateEvidence(order.status, evidence, 'acceptance');
  if (!evidenceCheck.valid) {
    return res.status(400).json({ error: evidenceCheck.error });
  }

  const deadlineCheck = validateDeadline(order);
  let deadlineWarning = null;
  if (!deadlineCheck.valid && passed !== false) {
    return res.status(400).json({ error: deadlineCheck.error });
  }
  if (deadlineCheck.warning) {
    deadlineWarning = deadlineCheck.warning;
  }
  
  const tx = db.transaction(() => {
    if (items && items.length > 0) {
      const updateItem = db.prepare(`
        UPDATE order_items SET
          arrived_quantity = ?,
          accepted_quantity = ?
        WHERE id = ? AND order_id = ?
      `);
      items.forEach(item => {
        updateItem.run(item.arrived_quantity || 0, item.accepted_quantity || 0, item.id, orderId);
      });
    }
    
    const nextStatus = passed !== false ? 'pending_review' : 'exception';
    const nextHandler = passed !== false ? 'ops1' : order.current_handler;
    const nextRole = passed !== false ? 'operations_manager' : order.current_role;
    
    db.prepare(`
      UPDATE store_orders SET
        status = ?,
        current_handler = ?,
        current_role = ?,
        version = version + 1,
        acceptance_evidence = ?,
        exception_reason = ?,
        exception_type = ?,
        node_started_at = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND version = ?
    `).run(
      nextStatus, nextHandler, nextRole,
      JSON.stringify(evidence),
      passed === false ? '验收不通过' : null,
      passed === false ? 'rejection' : null,
      new Date().toISOString().replace('T', ' ').slice(0, 19),
      orderId,
      version
    );
    
    db.prepare(`
      INSERT INTO processing_records (
        order_id, action, from_status, to_status, operator_id,
        operator_role, operator_name, remark, evidence, version
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      orderId,
      passed !== false ? '验收通过' : '验收不通过',
      order.status, nextStatus,
      req.user.id, req.user.role, req.user.name,
      remark || (passed !== false ? '到货验收合格' : '验收存在问题'),
      JSON.stringify(evidence),
      version + 1
    );
    
    if (passed === false) {
      db.prepare(`
        INSERT INTO exception_reasons (
          order_id, exception_type, description, detected_by
        ) VALUES (?, ?, ?, ?)
      `).run(
        orderId, 'rejection',
        remark || '品控验收不通过',
        req.user.id
      );
    }
    
    if (order.status === 'recheck_pending') {
      db.prepare(`
        UPDATE exception_reasons SET
          resolved = 1,
          resolved_by = ?,
          resolved_at = ?,
          resolution = ?
        WHERE order_id = ? AND resolved = 0
      `).run(
        req.user.id,
        new Date().toISOString().replace('T', ' ').slice(0, 19),
        '补正完成，重新验收通过',
        orderId
      );
    }
  });
  
  try {
    tx();
    res.json({
      success: true,
      message: passed !== false ? '验收通过，已进入复核环节' : '验收不通过',
      newVersion: version + 1,
      warning: deadlineWarning
    });
  } catch (err) {
    res.status(500).json({ error: '提交失败：' + err.message });
  }
});

app.post('/api/orders/:id/submit-review', authMiddleware, (req, res) => {
  const orderId = req.params.id;
  const { version, evidence, remark, action } = req.body;
  
  const order = db.prepare('SELECT * FROM store_orders WHERE id = ?').get(orderId);
  if (!order) {
    return res.status(404).json({ error: '订单不存在' });
  }
  
  if (order.status !== 'pending_review') {
    return res.status(400).json({ error: `状态冲突：当前状态为${statusMap[order.status]?.label}，不能进行复核` });
  }

  const validation = validateSubmission(order, req.user, version);
  if (!validation.valid) {
    return res.status(400).json({ error: validation.error });
  }
  
  if (req.user.role !== 'operations_manager') {
    return res.status(403).json({ error: '越权操作：只有营运经理可以进行库存回写复核' });
  }
  
  const evidenceCheck = validateEvidence(order.status, evidence, 'inventory');
  if (!evidenceCheck.valid) {
    return res.status(400).json({ error: evidenceCheck.error });
  }
  
  const tx = db.transaction(() => {
    let nextStatus, nextHandler, nextRole, actionName;
    
    if (action === 'reject') {
      nextStatus = 'recheck_pending';
      nextHandler = 'qc1';
      nextRole = 'qc_specialist';
      actionName = '退回补正';
    } else {
      nextStatus = 'completed';
      nextHandler = 'ops1';
      nextRole = 'operations_manager';
      actionName = '库存回写完成';
    }
    
    db.prepare(`
      UPDATE store_orders SET
        status = ?,
        current_handler = ?,
        current_role = ?,
        version = version + 1,
        inventory_evidence = ?,
        exception_reason = ?,
        exception_type = ?,
        node_started_at = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND version = ?
    `).run(
      nextStatus, nextHandler, nextRole,
      JSON.stringify(evidence),
      action === 'reject' ? '营运经理退回补正' : null,
      action === 'reject' ? 'rejection' : null,
      new Date().toISOString().replace('T', ' ').slice(0, 19),
      orderId,
      version
    );
    
    db.prepare(`
      INSERT INTO processing_records (
        order_id, action, from_status, to_status, operator_id,
        operator_role, operator_name, remark, evidence, version
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      orderId, actionName, order.status, nextStatus,
      req.user.id, req.user.role, req.user.name,
      remark || (action === 'reject' ? '退回重新验收' : '库存回写完成'),
      JSON.stringify(evidence),
      version + 1
    );
    
    if (action === 'reject') {
      db.prepare(`
        INSERT INTO exception_reasons (
          order_id, exception_type, description, detected_by
        ) VALUES (?, ?, ?, ?)
      `).run(
        orderId, 'rejection',
        remark || '营运经理复核不通过，退回补正',
        req.user.id
      );
    }
  });
  
  try {
    tx();
    res.json({
      success: true,
      message: action === 'reject' ? '已退回品控重新验收' : '库存回写完成，流程结束',
      newVersion: version + 1
    });
  } catch (err) {
    res.status(500).json({ error: '提交失败：' + err.message });
  }
});

app.post('/api/orders/batch-process', authMiddleware, (req, res) => {
  const { ids, action, data, snapshots } = req.body;
  
  if (!ids || ids.length === 0) {
    return res.status(400).json({ error: '请选择要处理的订单' });
  }

  const validActions = ['timeout-push', 'batch-material', 'batch-acceptance', 'batch-review'];
  if (!validActions.includes(action)) {
    return res.status(400).json({ error: `不支持的批量操作类型: ${action}` });
  }
  
  const results = [];

  const validateBatchItem = (order, snapshot) => {
    const errors = [];

    if (snapshot) {
      if (snapshot.version !== order.version) {
        errors.push(`版本快照不一致：加载时v${snapshot.version}，当前v${order.version}，数据已被修改`);
      }
      if (snapshot.status !== order.status) {
        errors.push(`状态快照不一致：加载时${statusMap[snapshot.status]?.label || snapshot.status}，当前${statusMap[order.status]?.label || order.status}`);
      }
      if (snapshot.current_handler !== order.current_handler) {
        errors.push(`处理人快照不一致：加载时${snapshot.current_handler}，当前${order.current_handler}`);
      }
      if (snapshot.current_role !== order.current_role) {
        errors.push(`角色快照不一致：加载时${snapshot.current_role}，当前${order.current_role}`);
      }
    }

    if (order.current_role !== req.user.role) {
      errors.push(`角色不匹配：当前节点需${roleMap[order.current_role]?.label || order.current_role}处理，您是${roleMap[req.user.role]?.label}`);
    }

    if (order.current_handler !== req.user.username) {
      errors.push(`处理人不匹配：当前处理人为${order.current_handler}，您的账号是${req.user.username}`);
    }

    if (order.status === 'completed' || order.status === 'rejected') {
      errors.push(`订单已${statusMap[order.status]?.label}，无需处理`);
    }

    return errors;
  };

  const handleTimeoutPush = (order, snapshot) => {
    const baseErrors = validateBatchItem(order, snapshot);
    if (baseErrors.length > 0) {
      return { 
        id: order.id, 
        order_no: order.order_no, 
        success: false, 
        reason: baseErrors.join('；') 
      };
    }

    if (!order.deadline) {
      return {
        id: order.id,
        order_no: order.order_no,
        success: false,
        reason: '订单无截止时间，无法判断是否逾期'
      };
    }

    const now = new Date();
    const dl = new Date(order.deadline);
    const diffHours = (dl - now) / (1000 * 60 * 60);

    if (diffHours > 0) {
      return {
        id: order.id,
        order_no: order.order_no,
        success: false,
        reason: `订单未逾期（剩余${Math.floor(diffHours)}小时），截止时间${order.deadline}`
      };
    }

    const materialEvidence = parseJsonField(order.material_evidence);
    if (!materialEvidence || !materialEvidence.has_invoice) {
      return {
        id: order.id,
        order_no: order.order_no,
        success: false,
        reason: '缺少材料证据：采购发票未上传，无法推进逾期标记'
      };
    }
    if (!materialEvidence || !materialEvidence.material_complete) {
      return {
        id: order.id,
        order_no: order.order_no,
        success: false,
        reason: '缺少材料证据：订货材料不齐全，需先补齐材料'
      };
    }

    const overdueHours = Math.abs(Math.floor(diffHours));

    try {
      const exceptionDesc = `节点已逾期${overdueHours}小时，责任人：${roleMap[order.current_role]?.label}（${order.current_handler}）`;

      db.prepare(`
        UPDATE store_orders SET
          exception_reason = ?,
          exception_type = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(exceptionDesc, 'timeout', order.id);

      const existing = db.prepare(
        'SELECT id FROM exception_reasons WHERE order_id = ? AND exception_type = ? AND resolved = 0'
      ).get(order.id, 'timeout');

      if (!existing) {
        db.prepare(`
          INSERT INTO exception_reasons (
            order_id, exception_type, description, detected_by
          ) VALUES (?, ?, ?, ?)
        `).run(order.id, 'timeout', exceptionDesc, req.user.id);
      }

      db.prepare(`
        INSERT INTO processing_records (
          order_id, action, from_status, to_status, operator_id,
          operator_role, operator_name, remark, evidence, version
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        order.id, '逾期批量推进', order.status, order.status,
        req.user.id, req.user.role, req.user.name,
        `批量标记逾期：${exceptionDesc}`,
        JSON.stringify({ 
          overdue_hours: overdueHours, 
          responsible: order.current_handler,
          responsible_role: order.current_role,
          batch_action: 'timeout-push'
        }),
        order.version
      );

      return { 
        id: order.id, 
        order_no: order.order_no, 
        success: true, 
        message: `已标记为超时异常（逾期${overdueHours}小时）`,
        overdue_hours: overdueHours
      };
    } catch (err) {
      return { 
        id: order.id, 
        order_no: order.order_no, 
        success: false, 
        reason: `处理失败：${err.message}` 
      };
    }
  };

  const handleBatchMaterial = (order, snapshot) => {
    const baseErrors = validateBatchItem(order, snapshot);
    if (baseErrors.length > 0) {
      return { 
        id: order.id, 
        order_no: order.order_no, 
        success: false, 
        reason: baseErrors.join('；') 
      };
    }

    if (order.status !== 'pending_material' && order.status !== 'exception') {
      return {
        id: order.id,
        order_no: order.order_no,
        success: false,
        reason: `状态不允许：当前状态${statusMap[order.status]?.label}，不能批量提交材料`
      };
    }

    const evidence = data?.evidence || {};
    const evidenceCheck = validateEvidence(order.status, evidence, 'material');
    if (!evidenceCheck.valid) {
      return {
        id: order.id,
        order_no: order.order_no,
        success: false,
        reason: evidenceCheck.error
      };
    }

    try {
      db.prepare(`
        UPDATE store_orders SET
          status = 'pending_acceptance',
          current_handler = 'qc1',
          current_role = 'qc_specialist',
          version = version + 1,
          material_evidence = ?,
          exception_reason = NULL,
          exception_type = NULL,
          node_started_at = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND version = ?
      `).run(
        JSON.stringify(evidence),
        new Date().toISOString().replace('T', ' ').slice(0, 19),
        order.id,
        order.version
      );

      db.prepare(`
        INSERT INTO processing_records (
          order_id, action, from_status, to_status, operator_id,
          operator_role, operator_name, remark, evidence, version
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        order.id, '批量提交材料', order.status, 'pending_acceptance',
        req.user.id, req.user.role, req.user.name,
        '批量操作：材料已齐全，进入验收环节',
        JSON.stringify(evidence),
        order.version + 1
      );

      if (order.exception_type) {
        db.prepare(`
          UPDATE exception_reasons SET
            resolved = 1,
            resolved_by = ?,
            resolved_at = ?,
            resolution = ?
          WHERE order_id = ? AND exception_type = ? AND resolved = 0
        `).run(
          req.user.id,
          new Date().toISOString().replace('T', ' ').slice(0, 19),
          '批量提交：材料已补齐',
          order.id,
          order.exception_type
        );
      }

      return {
        id: order.id,
        order_no: order.order_no,
        success: true,
        message: '材料提交成功，已进入验收环节',
        new_version: order.version + 1
      };
    } catch (err) {
      return { id: order.id, order_no: order.order_no, success: false, reason: err.message };
    }
  };

  const handleBatchAcceptance = (order, snapshot) => {
    const baseErrors = validateBatchItem(order, snapshot);
    if (baseErrors.length > 0) {
      return { 
        id: order.id, 
        order_no: order.order_no, 
        success: false, 
        reason: baseErrors.join('；') 
      };
    }

    if (order.status !== 'pending_acceptance' && order.status !== 'recheck_pending') {
      return {
        id: order.id,
        order_no: order.order_no,
        success: false,
        reason: `状态不允许：当前状态${statusMap[order.status]?.label}，不能批量验收`
      };
    }

    const deadlineCheck = validateDeadline(order);
    if (!deadlineCheck.valid) {
      return {
        id: order.id,
        order_no: order.order_no,
        success: false,
        reason: deadlineCheck.error
      };
    }

    const evidence = data?.evidence || { acceptance_passed: true, inspector: req.user.name };
    const evidenceCheck = validateEvidence(order.status, evidence, 'acceptance');
    if (!evidenceCheck.valid) {
      return {
        id: order.id,
        order_no: order.order_no,
        success: false,
        reason: evidenceCheck.error
      };
    }

    try {
      const nextStatus = evidence.acceptance_passed !== false ? 'pending_review' : 'exception';
      const nextHandler = evidence.acceptance_passed !== false ? 'ops1' : order.current_handler;
      const nextRole = evidence.acceptance_passed !== false ? 'operations_manager' : order.current_role;

      db.prepare(`
        UPDATE store_orders SET
          status = ?,
          current_handler = ?,
          current_role = ?,
          version = version + 1,
          acceptance_evidence = ?,
          exception_reason = ?,
          exception_type = ?,
          node_started_at = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND version = ?
      `).run(
        nextStatus, nextHandler, nextRole,
        JSON.stringify(evidence),
        evidence.acceptance_passed === false ? '批量验收不通过' : null,
        evidence.acceptance_passed === false ? 'rejection' : null,
        new Date().toISOString().replace('T', ' ').slice(0, 19),
        order.id,
        order.version
      );

      db.prepare(`
        INSERT INTO processing_records (
          order_id, action, from_status, to_status, operator_id,
          operator_role, operator_name, remark, evidence, version
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        order.id, 
        evidence.acceptance_passed !== false ? '批量验收通过' : '批量验收不通过',
        order.status, nextStatus,
        req.user.id, req.user.role, req.user.name,
        '批量验收操作',
        JSON.stringify(evidence),
        order.version + 1
      );

      if (evidence.acceptance_passed === false) {
        db.prepare(`
          INSERT INTO exception_reasons (
            order_id, exception_type, description, detected_by
          ) VALUES (?, ?, ?, ?)
        `).run(order.id, 'rejection', '批量验收不通过', req.user.id);
      }

      if (order.status === 'recheck_pending') {
        db.prepare(`
          UPDATE exception_reasons SET
            resolved = 1,
            resolved_by = ?,
            resolved_at = ?,
            resolution = ?
          WHERE order_id = ? AND resolved = 0
        `).run(
          req.user.id,
          new Date().toISOString().replace('T', ' ').slice(0, 19),
          '批量补正完成，重新验收通过',
          order.id
        );
      }

      return {
        id: order.id,
        order_no: order.order_no,
        success: true,
        message: evidence.acceptance_passed !== false ? '验收通过，已进入复核环节' : '验收不通过',
        new_version: order.version + 1
      };
    } catch (err) {
      return { id: order.id, order_no: order.order_no, success: false, reason: err.message };
    }
  };

  const handleBatchReview = (order, snapshot) => {
    const baseErrors = validateBatchItem(order, snapshot);
    if (baseErrors.length > 0) {
      return { 
        id: order.id, 
        order_no: order.order_no, 
        success: false, 
        reason: baseErrors.join('；') 
      };
    }

    if (order.status !== 'pending_review') {
      return {
        id: order.id,
        order_no: order.order_no,
        success: false,
        reason: `状态不允许：当前状态${statusMap[order.status]?.label}，不能批量复核`
      };
    }

    const evidence = data?.evidence || { inventory_updated: true, warehouse: '中心仓' };
    const reviewAction = data?.action || 'approve';

    if (reviewAction === 'approve') {
      const evidenceCheck = validateEvidence(order.status, evidence, 'inventory');
      if (!evidenceCheck.valid) {
        return {
          id: order.id,
          order_no: order.order_no,
          success: false,
          reason: evidenceCheck.error
        };
      }
    }

    try {
      let nextStatus, nextHandler, nextRole, actionName;

      if (reviewAction === 'reject') {
        nextStatus = 'recheck_pending';
        nextHandler = 'qc1';
        nextRole = 'qc_specialist';
        actionName = '批量退回补正';
      } else {
        nextStatus = 'completed';
        nextHandler = req.user.username;
        nextRole = req.user.role;
        actionName = '批量库存回写完成';
      }

      db.prepare(`
        UPDATE store_orders SET
          status = ?,
          current_handler = ?,
          current_role = ?,
          version = version + 1,
          inventory_evidence = ?,
          exception_reason = ?,
          exception_type = ?,
          node_started_at = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND version = ?
      `).run(
        nextStatus, nextHandler, nextRole,
        JSON.stringify(evidence),
        reviewAction === 'reject' ? '批量退回补正' : null,
        reviewAction === 'reject' ? 'rejection' : null,
        new Date().toISOString().replace('T', ' ').slice(0, 19),
        order.id,
        order.version
      );

      db.prepare(`
        INSERT INTO processing_records (
          order_id, action, from_status, to_status, operator_id,
          operator_role, operator_name, remark, evidence, version
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        order.id, actionName, order.status, nextStatus,
        req.user.id, req.user.role, req.user.name,
        '批量复核操作',
        JSON.stringify(evidence),
        order.version + 1
      );

      if (reviewAction === 'reject') {
        db.prepare(`
          INSERT INTO exception_reasons (
            order_id, exception_type, description, detected_by
          ) VALUES (?, ?, ?, ?)
        `).run(order.id, 'rejection', '批量复核退回补正', req.user.id);
      }

      return {
        id: order.id,
        order_no: order.order_no,
        success: true,
        message: reviewAction === 'reject' ? '已退回品控重新验收' : '库存回写完成，流程结束',
        new_version: order.version + 1
      };
    } catch (err) {
      return { id: order.id, order_no: order.order_no, success: false, reason: err.message };
    }
  };

  const actionHandlers = {
    'timeout-push': handleTimeoutPush,
    'batch-material': handleBatchMaterial,
    'batch-acceptance': handleBatchAcceptance,
    'batch-review': handleBatchReview
  };

  const handler = actionHandlers[action];
  
  const tx = db.transaction(() => {
    ids.forEach(id => {
      const order = db.prepare('SELECT * FROM store_orders WHERE id = ?').get(id);
      if (!order) {
        results.push({ id, success: false, reason: '订单不存在' });
        return;
      }
      const snapshot = snapshots?.[String(id)] || null;
      results.push(handler(order, snapshot));
    });
  });
  
  try {
    tx();
    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;
    res.json({ 
      results, 
      success_count: successCount,
      fail_count: failCount,
      total: results.length
    });
  } catch (err) {
    res.status(500).json({ error: '批量处理失败：' + err.message });
  }
});

app.post('/api/orders/:id/attachments', authMiddleware, upload.array('files'), (req, res) => {
  const orderId = req.params.id;
  const { upload_type } = req.body;
  
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: '请选择要上传的文件' });
  }
  
  const insertAttach = db.prepare(`
    INSERT INTO attachments (
      order_id, file_name, file_path, file_type, file_size,
      uploaded_by, upload_type
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  
  const attachments = req.files.map(file => {
    const result = insertAttach.run(
      orderId,
      file.originalname,
      file.path,
      file.mimetype,
      file.size,
      req.user.id,
      upload_type || 'material'
    );
    return {
      id: result.lastInsertRowid,
      file_name: file.originalname,
      file_size: file.size,
      file_type: file.mimetype,
      upload_type: upload_type || 'material'
    };
  });
  
  res.json({ attachments, message: '上传成功' });
});

app.get('/api/orders/:id/records', authMiddleware, (req, res) => {
  const records = db.prepare(`
    SELECT pr.*, u.name as operator_name
    FROM processing_records pr
    LEFT JOIN users u ON pr.operator_id = u.id
    WHERE pr.order_id = ?
    ORDER BY pr.created_at DESC
  `).all(req.params.id).map(r => ({ ...r, evidence: parseJsonField(r.evidence) }));
  
  res.json(records);
});

app.post('/api/orders/:id/audit-notes', authMiddleware, (req, res) => {
  const { note } = req.body;
  
  if (!note || note.trim().length === 0) {
    return res.status(400).json({ error: '备注内容不能为空' });
  }
  
  const result = db.prepare(`
    INSERT INTO audit_notes (order_id, note, noted_by)
    VALUES (?, ?, ?)
  `).run(req.params.id, note.trim(), req.user.id);
  
  res.json({ id: result.lastInsertRowid, message: '备注已添加' });
});

app.get('/api/stores', authMiddleware, (req, res) => {
  const stores = db.prepare('SELECT * FROM stores').all();
  res.json(stores);
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: '服务器内部错误' });
});

app.listen(PORT, () => {
  console.log(`餐饮连锁总部订货单系统 - 后端服务`);
  console.log(`后端端口: ${PORT}`);
  console.log(`前端地址: ${FRONTEND_URL}`);
  console.log(`CORS 白名单: ${FRONTEND_URL}`);
});
