const express = require('express');
const { AppError } = require('../middleware/errorHandler');
const { requireAuth, requireRole, requireAssigneeOrRole } = require('../middleware/auth');
const { validate } = require('../middleware/validator');
const {
  STATUS_LABELS, ROLE_LABELS, PRIORITY_LABELS, EXCEPTION_TYPE_LABELS,
  executeTransition, getAllowedActions, canViewOrder, getDeadlineStatus
} = require('../utils/statusFlow');

const router = express.Router();

const enrichOrder = (db, order) => {
  if (!order) return null;
  const result = { ...order };

  result.statusLabel = STATUS_LABELS[order.status] || order.status;
  result.priorityLabel = PRIORITY_LABELS[order.priority] || order.priority;
  result.deadlineStatus = getDeadlineStatus(order.deadline);
  if (order.exception_type) {
    result.exceptionTypeLabel = EXCEPTION_TYPE_LABELS[order.exception_type] || order.exception_type;
  }

  if (order.assignee_id) {
    const u = db.prepare('SELECT id, name, role FROM users WHERE id = ?').get(order.assignee_id);
    if (u) result.assignee = { ...u, roleLabel: ROLE_LABELS[u.role] };
  }
  if (order.handler_id) {
    const u = db.prepare('SELECT id, name, role FROM users WHERE id = ?').get(order.handler_id);
    if (u) result.handler = { ...u, roleLabel: ROLE_LABELS[u.role] };
  }
  if (order.reviewer_id) {
    const u = db.prepare('SELECT id, name, role FROM users WHERE id = ?').get(order.reviewer_id);
    if (u) result.reviewer = { ...u, roleLabel: ROLE_LABELS[u.role] };
  }
  if (order.created_by) {
    const u = db.prepare('SELECT id, name, role FROM users WHERE id = ?').get(order.created_by);
    if (u) result.creator = { ...u, roleLabel: ROLE_LABELS[u.role] };
  }

  return result;
};

router.get('/', requireAuth, (req, res) => {
  const {
    status, priority, assignee_id, handler_id, deadline_status,
    search, page = 1, page_size = 20
  } = req.query;

  const conditions = [];
  const params = [];

  if (status) {
    const statuses = String(status).split(',').filter(Boolean);
    if (statuses.length > 0) {
      conditions.push(`status IN (${statuses.map(() => '?').join(',')})`);
      params.push(...statuses);
    }
  }

  if (priority) {
    conditions.push('priority = ?');
    params.push(priority);
  }

  if (assignee_id) {
    conditions.push('assignee_id = ?');
    params.push(Number(assignee_id));
  }

  if (handler_id) {
    conditions.push('handler_id = ?');
    params.push(Number(handler_id));
  }

  if (req.user.role === 'doctor') {
    conditions.push('(assignee_id IS NULL OR assignee_id = ? OR handler_id = ?)');
    params.push(req.user.id, req.user.id);
  }

  if (search) {
    conditions.push('(order_no LIKE ? OR pet_name LIKE ? OR owner_name LIKE ? OR owner_phone LIKE ?)');
    const like = `%${search}%`;
    params.push(like, like, like, like);
  }

  let where = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

  const countSql = `SELECT COUNT(*) as total FROM visit_orders ${where}`;
  const total = req.db.prepare(countSql).get(...params).total;

  const offset = (Number(page) - 1) * Number(page_size);
  const listSql = `
    SELECT * FROM visit_orders ${where}
    ORDER BY
      CASE priority WHEN 'urgent' THEN 1 WHEN 'high' THEN 2 WHEN 'normal' THEN 3 ELSE 4 END,
      deadline ASC,
      id DESC
    LIMIT ? OFFSET ?
  `;
  const orders = req.db.prepare(listSql).all(...params, Number(page_size), offset);

  let enriched = orders.map(o => enrichOrder(req.db, o));

  if (deadline_status) {
    const statuses = String(deadline_status).split(',').filter(Boolean);
    enriched = enriched.filter(o => statuses.includes(o.deadlineStatus));
  }

  enriched = enriched.filter(o => canViewOrder(o, req.user));

  res.json({
    success: true,
    data: enriched,
    total: enriched.length,
    allTotal: total,
    page: Number(page),
    page_size: Number(page_size)
  });
});

router.post('/', requireRole('nurse'), validate({
  pet_name: { required: true, type: 'string', minLength: 1 },
  pet_type: { required: true, type: 'string', minLength: 1 },
  owner_name: { required: true, type: 'string', minLength: 1 },
  owner_phone: { required: true, type: 'string', minLength: 1 },
  deadline: { required: true, type: 'string' },
  priority: { enum: ['urgent', 'high', 'normal', 'low'] }
}), (req, res, next) => {
  try {
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const seq = String(Math.floor(Math.random() * 900) + 100);
    const orderNo = `V${now.getFullYear()}${month}${seq}`;

    const stmt = req.db.prepare(`
      INSERT INTO visit_orders (
        order_no, pet_name, pet_type, pet_breed, pet_age, pet_gender,
        owner_name, owner_phone, appointment_time, visit_time, follow_up_time,
        chief_complaint, diagnosis, treatment, follow_up_result,
        priority, deadline, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      orderNo,
      req.body.pet_name,
      req.body.pet_type,
      req.body.pet_breed || null,
      req.body.pet_age || null,
      req.body.pet_gender || null,
      req.body.owner_name,
      req.body.owner_phone,
      req.body.appointment_time || null,
      req.body.visit_time || null,
      req.body.follow_up_time || null,
      req.body.chief_complaint || null,
      req.body.diagnosis || null,
      req.body.treatment || null,
      req.body.follow_up_result || null,
      req.body.priority || 'normal',
      req.body.deadline,
      req.user.id
    );

    const recordStmt = req.db.prepare(`
      INSERT INTO processing_records (
        visit_order_id, action, from_status, to_status,
        operator_id, operator_role, comment,
        evidence_required, evidence_provided
      ) VALUES (?, ?, NULL, ?, ?, ?, ?, ?, ?)
    `);
    recordStmt.run(
      result.lastInsertRowid, 'create', 'pending_assign',
      req.user.id, req.user.role, '前台护士创建就诊单',
      '宠物建档、预约单', '宠物建档、预约单'
    );

    const order = req.db.prepare('SELECT * FROM visit_orders WHERE id = ?').get(result.lastInsertRowid);

    res.json({
      success: true,
      data: enrichOrder(req.db, order),
      message: '就诊单创建成功'
    });
  } catch (err) {
    next(err);
  }
});

router.get('/:id', requireAuth, (req, res, next) => {
  try {
    const order = req.db.prepare('SELECT * FROM visit_orders WHERE id = ?').get(req.params.id);
    if (!order) {
      throw new AppError('就诊单不存在', 404, 'material');
    }

    if (!canViewOrder(order, req.user)) {
      throw new AppError('越权访问：您无权查看此就诊单', 403, 'permission');
    }

    const enriched = enrichOrder(req.db, order);
    enriched.allowedActions = getAllowedActions(order, req.user);

    enriched.attachments = req.db.prepare(`
      SELECT a.*, u.name as uploader_name
      FROM attachments a LEFT JOIN users u ON a.uploaded_by = u.id
      WHERE a.visit_order_id = ? ORDER BY a.created_at DESC
    `).all(req.params.id);

    enriched.records = req.db.prepare(`
      SELECT r.*, u.name as operator_name
      FROM processing_records r LEFT JOIN users u ON r.operator_id = u.id
      WHERE r.visit_order_id = ? ORDER BY r.created_at DESC
    `).all(req.params.id).map(r => ({
      ...r,
      operatorRoleLabel: ROLE_LABELS[r.operator_role],
      fromStatusLabel: r.from_status ? STATUS_LABELS[r.from_status] : null,
      toStatusLabel: STATUS_LABELS[r.to_status],
      exceptionTypeLabel: r.exception_type ? EXCEPTION_TYPE_LABELS[r.exception_type] : null
    }));

    enriched.auditNotes = req.db.prepare(`
      SELECT n.*, u.name as operator_name
      FROM audit_notes n LEFT JOIN users u ON n.operator_id = u.id
      WHERE n.visit_order_id = ? ORDER BY n.created_at DESC
    `).all(req.params.id);

    res.json({
      success: true,
      data: enriched
    });
  } catch (err) {
    next(err);
  }
});

router.put('/:id', requireAssigneeOrRole('director', 'nurse'), (req, res, next) => {
  try {
    const order = req.visitOrder;
    const allowedFields = [
      'pet_name', 'pet_type', 'pet_breed', 'pet_age', 'pet_gender',
      'owner_name', 'owner_phone', 'appointment_time', 'visit_time',
      'follow_up_time', 'chief_complaint', 'diagnosis', 'treatment',
      'follow_up_result', 'priority', 'deadline', 'material_status'
    ];

    const sets = [];
    const params = [];

    for (const f of allowedFields) {
      if (req.body[f] !== undefined) {
        sets.push(`${f} = ?`);
        params.push(req.body[f]);
      }
    }

    if (sets.length === 0) {
      throw new AppError('没有可更新的字段', 400, 'material');
    }

    sets.push('updated_at = CURRENT_TIMESTAMP');
    params.push(order.id);

    req.db.prepare(`UPDATE visit_orders SET ${sets.join(', ')} WHERE id = ?`).run(...params);

    const updated = req.db.prepare('SELECT * FROM visit_orders WHERE id = ?').get(order.id);

    res.json({
      success: true,
      data: enrichOrder(req.db, updated),
      message: '就诊单更新成功'
    });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/transition', requireAuth, (req, res, next) => {
  try {
    const order = req.db.prepare('SELECT * FROM visit_orders WHERE id = ?').get(req.params.id);
    if (!order) {
      throw new AppError('就诊单不存在', 404, 'material');
    }

    const result = executeTransition(req.db, order, req.body.action, req.user, req.body);

    res.json({
      success: true,
      ...result,
      data: enrichOrder(req.db, result.order)
    });
  } catch (err) {
    next(err);
  }
});

router.post('/batch', requireAuth, (req, res, next) => {
  try {
    const { ids, action, payload = {} } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      throw new AppError('请选择要批量处理的就诊单', 400, 'material');
    }
    if (!action) {
      throw new AppError('请指定批量操作类型', 400, 'material');
    }

    const results = [];

    const tx = req.db.transaction(() => {
      for (const id of ids) {
        try {
          const order = req.db.prepare('SELECT * FROM visit_orders WHERE id = ?').get(id);
          if (!order) {
            results.push({ id, success: false, message: '就诊单不存在', exceptionType: 'material' });
            continue;
          }
          if (!canViewOrder(order, req.user)) {
            results.push({ id, success: false, message: '越权操作', exceptionType: 'permission' });
            continue;
          }
          const result = executeTransition(req.db, order, action, req.user, payload);
          results.push({
            id,
            order_no: order.order_no,
            success: true,
            message: result.message,
            from: result.from,
            to: result.to
          });
        } catch (err) {
          results.push({
            id,
            order_no: req.db.prepare('SELECT order_no FROM visit_orders WHERE id = ?').get(id)?.order_no || id,
            success: false,
            message: err.message,
            exceptionType: err.exceptionType || 'status'
          });
        }
      }
    });

    tx();

    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;

    res.json({
      success: true,
      message: `批量处理完成：成功 ${successCount} 条，失败 ${failCount} 条`,
      total: ids.length,
      successCount,
      failCount,
      results
    });
  } catch (err) {
    next(err);
  }
});

router.get('/:id/allowed-actions', requireAuth, (req, res) => {
  const order = req.db.prepare('SELECT * FROM visit_orders WHERE id = ?').get(req.params.id);
  if (!order) {
    return res.json({ success: false, message: '就诊单不存在' });
  }
  res.json({
    success: true,
    actions: getAllowedActions(order, req.user)
  });
});

module.exports = router;
