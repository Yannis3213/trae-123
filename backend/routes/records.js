const express = require('express');
const { requireAuth } = require('../middleware/auth');
const {
  STATUS_LABELS, ROLE_LABELS, EXCEPTION_TYPE_LABELS
} = require('../utils/statusFlow');

const router = express.Router();

router.get('/', requireAuth, (req, res) => {
  const { visit_order_id, operator_id, page = 1, page_size = 50 } = req.query;

  const conditions = [];
  const params = [];

  if (visit_order_id) {
    conditions.push('visit_order_id = ?');
    params.push(Number(visit_order_id));
  }
  if (operator_id) {
    conditions.push('operator_id = ?');
    params.push(Number(operator_id));
  }

  if (req.user.role === 'doctor') {
    conditions.push(`visit_order_id IN (
      SELECT id FROM visit_orders WHERE assignee_id = ? OR handler_id = ? OR assignee_id IS NULL
    )`);
    params.push(req.user.id, req.user.id);
  }

  const where = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

  const countSql = `SELECT COUNT(*) as total FROM processing_records ${where}`;
  const total = req.db.prepare(countSql).get(...params).total;

  const offset = (Number(page) - 1) * Number(page_size);
  const sql = `
    SELECT r.*, u.name as operator_name, vo.order_no, vo.pet_name
    FROM processing_records r
    LEFT JOIN users u ON r.operator_id = u.id
    LEFT JOIN visit_orders vo ON r.visit_order_id = vo.id
    ${where}
    ORDER BY r.created_at DESC
    LIMIT ? OFFSET ?
  `;

  const records = req.db.prepare(sql).all(...params, Number(page_size), offset).map(r => ({
    ...r,
    operatorRoleLabel: ROLE_LABELS[r.operator_role],
    fromStatusLabel: r.from_status ? STATUS_LABELS[r.from_status] : null,
    toStatusLabel: STATUS_LABELS[r.to_status],
    exceptionTypeLabel: r.exception_type ? EXCEPTION_TYPE_LABELS[r.exception_type] : null
  }));

  res.json({
    success: true,
    data: records,
    total,
    page: Number(page),
    page_size: Number(page_size)
  });
});

router.post('/:orderId', requireAuth, (req, res, next) => {
  try {
    const { comment } = req.body;
    if (!comment) {
      return next({ statusCode: 400, message: '备注内容不能为空', exceptionType: 'material' });
    }

    const order = req.db.prepare('SELECT * FROM visit_orders WHERE id = ?').get(req.params.orderId);
    if (!order) {
      return next({ statusCode: 404, message: '就诊单不存在', exceptionType: 'material' });
    }

    const stmt = req.db.prepare(`
      INSERT INTO processing_records (
        visit_order_id, action, from_status, to_status,
        operator_id, operator_role, comment
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      order.id, 'note', order.status, order.status,
      req.user.id, req.user.role, comment
    );

    res.json({
      success: true,
      message: '备注添加成功'
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
