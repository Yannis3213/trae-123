const express = require('express');
const { requireAuth, requireRole } = require('../middleware/auth');
const { AppError } = require('../middleware/errorHandler');

const router = express.Router();

router.get('/:orderId', requireAuth, (req, res) => {
  const notes = req.db.prepare(`
    SELECT n.*, u.name as operator_name, u.role as operator_role
    FROM audit_notes n LEFT JOIN users u ON n.operator_id = u.id
    WHERE n.visit_order_id = ?
    ORDER BY n.created_at DESC
  `).all(req.params.orderId);

  res.json({
    success: true,
    data: notes
  });
});

router.post('/:orderId', requireRole('director', 'nurse'), (req, res, next) => {
  try {
    const { content } = req.body;
    if (!content || !content.trim()) {
      throw new AppError('审计备注内容不能为空', 400, 'material');
    }

    const order = req.db.prepare('SELECT id FROM visit_orders WHERE id = ?').get(req.params.orderId);
    if (!order) {
      throw new AppError('就诊单不存在', 404, 'material');
    }

    const stmt = req.db.prepare(`
      INSERT INTO audit_notes (visit_order_id, content, operator_id)
      VALUES (?, ?, ?)
    `);
    const result = stmt.run(order.id, content.trim(), req.user.id);

    const note = req.db.prepare(`
      SELECT n.*, u.name as operator_name, u.role as operator_role
      FROM audit_notes n LEFT JOIN users u ON n.operator_id = u.id
      WHERE n.id = ?
    `).get(result.lastInsertRowid);

    res.json({
      success: true,
      data: note,
      message: '审计备注添加成功'
    });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', requireRole('director'), (req, res, next) => {
  try {
    const note = req.db.prepare('SELECT * FROM audit_notes WHERE id = ?').get(req.params.id);
    if (!note) {
      throw new AppError('审计备注不存在', 404, 'material');
    }

    req.db.prepare('DELETE FROM audit_notes WHERE id = ?').run(req.params.id);

    res.json({
      success: true,
      message: '审计备注删除成功'
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
