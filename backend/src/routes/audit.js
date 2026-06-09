const Router = require('koa-router');
const db = require('../db');
const { authMiddleware } = require('../middleware/auth');
const { ROLE_NAMES, STATUS_NAMES, ABNORMAL_NAMES } = require('../utils/constants');

const router = new Router({ prefix: '/api/audit' });

router.get('/', authMiddleware, async (ctx) => {
  const user = ctx.state.currentUser;
  const { order_id, limit = 50, offset = 0 } = ctx.query;

  let sql = `SELECT * FROM audit_notes WHERE 1=1`;
  const params = [];

  if (order_id) {
    sql += ` AND order_id = ?`;
    params.push(order_id);
  }

  sql += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
  params.push(Number(limit), Number(offset));

  const rows = db.prepare(sql).all(...params);

  ctx.body = {
    code: 0,
    data: rows.map(r => ({
      ...r,
      operator_role_name: ROLE_NAMES[r.operator_role]
    }))
  };
});

router.get('/abnormal', authMiddleware, async (ctx) => {
  const user = ctx.state.currentUser;
  const { order_id, resolved } = ctx.query;

  let sql = `SELECT ar.*, po.order_no, po.patient_name, po.status, po.handler_name as current_handler
             FROM abnormal_reasons ar
             LEFT JOIN prescription_orders po ON ar.order_id = po.id
             WHERE 1=1`;
  const params = [];

  if (user.role !== 'area_manager') {
    if (user.store_id) {
      sql += ` AND po.store_id = ?`;
      params.push(user.store_id);
    }
  } else if (user.area_id) {
    sql += ` AND po.area_id = ?`;
    params.push(user.area_id);
  }

  if (order_id) {
    sql += ` AND ar.order_id = ?`;
    params.push(order_id);
  }
  if (resolved !== undefined) {
    sql += ` AND ar.resolved = ?`;
    params.push(resolved === 'true' || resolved === 1 ? 1 : 0);
  }
  sql += ` ORDER BY ar.reported_at DESC`;

  const rows = db.prepare(sql).all(...params);

  ctx.body = {
    code: 0,
    data: rows.map(r => ({
      ...r,
      abnormal_type_name: ABNORMAL_NAMES[r.abnormal_type] || r.abnormal_type,
      status_name: STATUS_NAMES[r.status] || r.status,
      resolved: !!r.resolved
    }))
  };
});

module.exports = router;
