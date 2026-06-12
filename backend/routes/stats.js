const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { STATUS_LABELS, EXCEPTION_TYPE_LABELS } = require('../utils/statusFlow');

const router = express.Router();

router.get('/', requireAuth, (req, res) => {
  const conditions = [];
  const params = [];

  if (req.user.role === 'doctor') {
    conditions.push('(assignee_id = ? OR handler_id = ? OR assignee_id IS NULL)');
    params.push(req.user.id, req.user.id);
  }

  const where = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

  const byStatus = req.db.prepare(`
    SELECT status, COUNT(*) as count FROM visit_orders ${where} GROUP BY status
  `).all(...params);

  const byPriority = req.db.prepare(`
    SELECT priority, COUNT(*) as count FROM visit_orders ${where} GROUP BY priority
  `).all(...params);

  const now = new Date();
  const approachingTime = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
  const nowStr = now.toISOString();

  let overdueWhere = where;
  let overdueParams = [...params];
  if (overdueWhere) {
    overdueWhere += ` AND deadline < ? AND status != 'archived'`;
  } else {
    overdueWhere = `WHERE deadline < ? AND status != 'archived'`;
  }
  overdueParams.push(nowStr);
  const overdue = req.db.prepare(`SELECT COUNT(*) as count FROM visit_orders ${overdueWhere}`).get(...overdueParams).count;

  let approachingWhere = where;
  let approachingParams = [...params];
  if (approachingWhere) {
    approachingWhere += ` AND deadline >= ? AND deadline < ? AND status != 'archived'`;
  } else {
    approachingWhere = `WHERE deadline >= ? AND deadline < ? AND status != 'archived'`;
  }
  approachingParams.push(nowStr, approachingTime);
  const approaching = req.db.prepare(`SELECT COUNT(*) as count FROM visit_orders ${approachingWhere}`).get(...approachingParams).count;

  let normalWhere = where;
  let normalParams = [...params];
  if (normalWhere) {
    normalWhere += ` AND deadline >= ? AND status != 'archived'`;
  } else {
    normalWhere = `WHERE deadline >= ? AND status != 'archived'`;
  }
  normalParams.push(approachingTime);
  const normal = req.db.prepare(`SELECT COUNT(*) as count FROM visit_orders ${normalWhere}`).get(...normalParams).count;

  const total = req.db.prepare(`SELECT COUNT(*) as count FROM visit_orders ${where}`).get(...params).count;

  let exceptionWhere = where;
  let exceptionParams = [...params];
  if (exceptionWhere) {
    exceptionWhere += ` AND exception_type IS NOT NULL`;
  } else {
    exceptionWhere = `WHERE exception_type IS NOT NULL`;
  }
  const byException = req.db.prepare(`
    SELECT exception_type, COUNT(*) as count FROM visit_orders ${exceptionWhere} GROUP BY exception_type
  `).all(...exceptionParams);

  let handlerWhere = where;
  let handlerParams = [...params];
  if (handlerWhere) {
    handlerWhere += ` AND assignee_id IS NOT NULL`;
  } else {
    handlerWhere = `WHERE assignee_id IS NOT NULL`;
  }
  const byHandler = req.db.prepare(`
    SELECT
      COALESCE(assignee_id, 0) as user_id,
      u.name as user_name,
      COUNT(*) as count,
      SUM(CASE WHEN deadline < ? AND status != 'archived' THEN 1 ELSE 0 END) as overdue_count
    FROM visit_orders vo
    LEFT JOIN users u ON vo.assignee_id = u.id
    ${handlerWhere}
    GROUP BY assignee_id
    ORDER BY overdue_count DESC, count DESC
  `).all(...handlerParams, nowStr);

  const blockedCount = req.db.prepare(`
    SELECT COUNT(*) as count FROM processing_records WHERE action = 'overdue_advance_blocked'
  `).get().count;

  const blockedByType = req.db.prepare(`
    SELECT exception_type, COUNT(*) as count FROM processing_records
    WHERE action = 'overdue_advance_blocked' GROUP BY exception_type
  `).all();

  res.json({
    success: true,
    data: {
      total,
      byDeadline: { normal, approaching, overdue },
      byStatus: byStatus.map(s => ({ ...s, label: STATUS_LABELS[s.status] || s.status })),
      byPriority,
      byException: byException.map(e => ({ ...e, label: EXCEPTION_TYPE_LABELS[e.exception_type] || e.exception_type })),
      byHandler,
      overdueBlocked: { total: blockedCount, byType: blockedByType.map(b => ({ ...b, label: EXCEPTION_TYPE_LABELS[b.exception_type] || b.exception_type })) }
    }
  });
});

module.exports = router;
