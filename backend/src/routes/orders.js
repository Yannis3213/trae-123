const Router = require('koa-router');
const db = require('../db');
const { v4: uuidv4 } = require('uuid');
const { authMiddleware } = require('../middleware/auth');
const {
  ROLES, ORDER_STATUS, STATUS_NAMES, ROLE_NAMES,
  ABNORMAL_TYPES, ABNORMAL_NAMES, WARNING_LEVELS, WARNING_NAMES
} = require('../utils/constants');
const {
  validateTransition, getNextHandler, computeWarningLevel, isHandlerOfOrder
} = require('../utils/permission');

const router = new Router({ prefix: '/api/orders' });

function decorateOrder(order, user) {
  const now = new Date();
  const warning = computeWarningLevel(order, now);
  return {
    ...order,
    statusName: STATUS_NAMES[order.status],
    warningLevel: warning,
    warningName: WARNING_NAMES[warning],
    isMine: user ? (isHandlerOfOrder(order, user) && order.handler_role === user.role && (!order.handler_id || order.handler_id === user.id)) : false
  };
}

router.get('/', authMiddleware, async (ctx) => {
  const user = ctx.state.currentUser;
  const { status, warning, keyword, onlyMine = 'false' } = ctx.query;

  let sql = `SELECT * FROM prescription_orders WHERE 1=1`;
  const params = [];

  if (user.role === ROLES.AREA_MANAGER) {
    sql += ` AND area_id = ?`;
    params.push(user.area_id);
  } else {
    sql += ` AND store_id = ?`;
    params.push(user.store_id);
  }

  if (status) {
    sql += ` AND status = ?`;
    params.push(status);
  }
  if (keyword) {
    sql += ` AND (order_no LIKE ? OR patient_name LIKE ?)`;
    params.push(`%${keyword}%`, `%${keyword}%`);
  }
  if (onlyMine === 'true' || onlyMine === true) {
    sql += ` AND (handler_role = ? AND (handler_id IS NULL OR handler_id = ?))`;
    params.push(user.role, user.id);
  }

  sql += ` ORDER BY
    CASE status
      WHEN 'pending_sign' THEN 1
      WHEN 'abnormal_return' THEN 2
      WHEN 'material_shortage' THEN 3
      WHEN 'overdue' THEN 4
      WHEN 'returned_correction' THEN 5
      WHEN 'signed' THEN 6
      ELSE 7
    END,
    due_at ASC,
    created_at DESC`;

  let rows = db.prepare(sql).all(...params);

  if (warning) {
    rows = rows.filter(r => computeWarningLevel(r) === warning);
  }

  ctx.body = {
    code: 0,
    data: rows.map(r => decorateOrder(r, user))
  };
});

router.get('/statistics', authMiddleware, async (ctx) => {
  const user = ctx.state.currentUser;
  let sql = `SELECT status, COUNT(*) as cnt FROM prescription_orders WHERE 1=1`;
  const params = [];

  if (user.role === ROLES.AREA_MANAGER) {
    sql += ` AND area_id = ?`;
    params.push(user.area_id);
  } else {
    sql += ` AND store_id = ?`;
    params.push(user.store_id);
  }
  sql += ` GROUP BY status`;
  const statusRows = db.prepare(sql).all(...params);

  const statusCount = {};
  Object.values(ORDER_STATUS).forEach(s => { statusCount[s] = 0; });
  statusRows.forEach(r => { statusCount[r.status] = r.cnt; });

  let allSql = `SELECT due_at, status FROM prescription_orders WHERE 1=1`;
  const allParams = [];
  if (user.role === ROLES.AREA_MANAGER) {
    allSql += ` AND area_id = ?`;
    allParams.push(user.area_id);
  } else {
    allSql += ` AND store_id = ?`;
    allParams.push(user.store_id);
  }
  const allRows = db.prepare(allSql).all(...allParams);
  const warningCount = { normal: 0, approaching: 0, overdue: 0 };
  allRows.forEach(r => {
    const w = computeWarningLevel(r);
    warningCount[w]++;
  });

  const mySql = `SELECT COUNT(*) as cnt FROM prescription_orders WHERE handler_role = ? AND (handler_id IS NULL OR handler_id = ?)`;
  const myCnt = db.prepare(mySql).get(user.role, user.id).cnt;

  ctx.body = {
    code: 0,
    data: {
      byStatus: Object.entries(statusCount).map(([k, v]) => ({ status: k, statusName: STATUS_NAMES[k], count: v })),
      byWarning: Object.entries(warningCount).map(([k, v]) => ({ level: k, levelName: WARNING_NAMES[k], count: v })),
      myPending: myCnt,
      total: allRows.length
    }
  };
});

router.get('/:id', authMiddleware, async (ctx) => {
  const user = ctx.state.currentUser;
  const order = db.prepare('SELECT * FROM prescription_orders WHERE id = ?').get(ctx.params.id);
  if (!order) {
    ctx.status = 404;
    ctx.body = { code: 404, message: '处方订单不存在' };
    return;
  }
  if (!isHandlerOfOrder(order, user)) {
    ctx.status = 403;
    ctx.body = { code: 403, message: '您无权查看该处方订单' };
    return;
  }

  const attachments = db.prepare('SELECT * FROM attachments WHERE order_id = ? ORDER BY uploaded_at').all(order.id);
  const records = db.prepare('SELECT * FROM processing_records WHERE order_id = ? ORDER BY created_at DESC').all(order.id);
  const audits = db.prepare('SELECT * FROM audit_notes WHERE order_id = ? ORDER BY created_at DESC').all(order.id);
  const abnormals = db.prepare('SELECT * FROM abnormal_reasons WHERE order_id = ? ORDER BY reported_at DESC').all(order.id);

  ctx.body = {
    code: 0,
    data: {
      ...decorateOrder(order, user),
      attachments: attachments.map(a => ({ ...a })),
      records: records.map(r => ({
        ...r,
        from_status_name: r.from_status ? STATUS_NAMES[r.from_status] : null,
        to_status_name: STATUS_NAMES[r.to_status],
        handler_role_name: ROLE_NAMES[r.handler_role]
      })),
      audits: audits.map(a => ({
        ...a,
        operator_role_name: ROLE_NAMES[a.operator_role]
      })),
      abnormals: abnormals.map(a => ({
        ...a,
        abnormal_type_name: ABNORMAL_NAMES[a.abnormal_type] || a.abnormal_type,
        resolved: !!a.resolved
      }))
    }
  };
});

router.post('/', authMiddleware, async (ctx) => {
  const user = ctx.state.currentUser;
  if (user.role !== ROLES.STORE_CLERK) {
    ctx.status = 403;
    ctx.body = { code: 403, message: '仅门店店员可创建处方订单' };
    return;
  }
  const {
    patient_name, patient_id_card, drugs_count = 0, total_amount = 0,
    due_at, attachments = []
  } = ctx.request.body || {};

  if (!patient_name) {
    ctx.status = 400;
    ctx.body = { code: 400, message: '请提供患者姓名' };
    return;
  }

  const orderNo = `RX${new Date().toISOString().slice(0, 10).replace(/-/g, '')}${String(Math.floor(Math.random() * 9000) + 1000)}`;
  const dueTime = due_at ? new Date(due_at) : new Date(Date.now() + 72 * 3600 * 1000);

  const storeInfo = db.prepare('SELECT store_id, area_id FROM users WHERE id = ?').get(user.id);
  const storeNameMap = { store_001: '朝阳大药房（总店）', store_002: '朝阳大药房（分店）' };
  const areaNameMap = { area_east: '华东区域' };

  const orderId = uuidv4();
  const pharmacist = db.prepare("SELECT * FROM users WHERE store_id = ? AND role = ? LIMIT 1").get(user.store_id, ROLES.PHARMACIST);

  const insertOrder = db.prepare(`
    INSERT INTO prescription_orders (
      id, order_no, patient_name, patient_id_card,
      store_id, store_name, area_id, area_name,
      drugs_count, total_amount, status,
      handler_role, handler_id, handler_name,
      version, created_by, created_by_name, due_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)
  `);

  insertOrder.run(
    orderId, orderNo, patient_name, patient_id_card || null,
    user.store_id, storeNameMap[user.store_id] || user.store_id,
    user.area_id, areaNameMap[user.area_id] || user.area_id,
    Number(drugs_count), Number(total_amount),
    ORDER_STATUS.PENDING_SIGN,
    ROLES.PHARMACIST, pharmacist ? pharmacist.id : null, pharmacist ? pharmacist.name : null,
    user.id, user.name,
    dueTime.toISOString()
  );

  const insertRecord = db.prepare(`
    INSERT INTO processing_records (
      id, order_id, order_version, from_status, to_status,
      handler_id, handler_name, handler_role, note, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
  `);
  insertRecord.run(uuidv4(), orderId, 1, null, ORDER_STATUS.PENDING_SIGN, user.id, user.name, user.role, '门店店员登记处方订单');

  const insertAudit = db.prepare(`
    INSERT INTO audit_notes (
      id, order_id, order_version, operator_id, operator_name,
      operator_role, action, content
    ) VALUES (?, ?, ?, ?, ?, ?, 'create', ?)
  `);
  insertAudit.run(uuidv4(), orderId, 1, user.id, user.name, user.role, `创建处方订单 ${orderNo}`);

  const insertAttachment = db.prepare(`
    INSERT INTO attachments (
      id, order_id, file_name, file_type, file_url,
      evidence_type, uploaded_by, uploaded_by_name
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  attachments.forEach(att => {
    insertAttachment.run(
      uuidv4(), orderId, att.file_name, att.file_type || 'application/octet-stream',
      att.file_url || '#', att.evidence_type || 'prescription', user.id, user.name
    );
  });

  const created = db.prepare('SELECT * FROM prescription_orders WHERE id = ?').get(orderId);
  ctx.status = 201;
  ctx.body = { code: 0, data: decorateOrder(created, user) };
});

router.post('/:id/status', authMiddleware, async (ctx) => {
  const user = ctx.state.currentUser;
  const { to_status, version, note, abnormal_reason, abnormal_type, correction_note } = ctx.request.body || {};
  const order = db.prepare('SELECT * FROM prescription_orders WHERE id = ?').get(ctx.params.id);

  if (!order) {
    ctx.status = 404;
    ctx.body = { code: 404, message: '处方订单不存在' };
    return;
  }

  if (order.status === to_status && to_status === ORDER_STATUS.SIGNED && user.role === ROLES.AREA_MANAGER) {
  } else {
    const validation = validateTransition(order, to_status, user, version);
    if (!validation.ok) {
      ctx.status = 400;
      ctx.body = {
        code: 400,
        error_code: validation.code,
        message: validation.message,
        missing: validation.missing || undefined,
        current_status: order.status,
        current_status_name: STATUS_NAMES[order.status],
        current_version: order.version
      };
      return;
    }
  }

  if (order.status === to_status && to_status === ORDER_STATUS.SIGNED && user.role === ROLES.AREA_MANAGER) {
  } else if (order.status === to_status) {
    ctx.status = 400;
    ctx.body = {
      code: 400,
      error_code: ABNORMAL_TYPES.DUPLICATE_SUBMIT,
      message: `重复提交：订单已是「${STATUS_NAMES[to_status]}」状态，无需重复处理`
    };
    return;
  }

  const newVersion = order.version + 1;
  const nextHandler = getNextHandler(order, to_status, user);

  const updateOrder = db.prepare(`
    UPDATE prescription_orders SET
      status = ?,
      version = ?,
      handler_role = ?,
      handler_id = ?,
      handler_name = ?,
      abnormal_reason = ?,
      abnormal_type = ?,
      correction_note = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND version = ?
  `);
  const result = updateOrder.run(
    to_status, newVersion,
    nextHandler.handler_role, nextHandler.handler_id, nextHandler.handler_name,
    abnormal_reason || order.abnormal_reason,
    abnormal_type || order.abnormal_type,
    correction_note || order.correction_note,
    order.id, order.version
  );

  if (result.changes === 0) {
    const latest = db.prepare('SELECT version, status FROM prescription_orders WHERE id = ?').get(order.id);
    ctx.status = 409;
    ctx.body = {
      code: 409,
      error_code: ABNORMAL_TYPES.OLD_VERSION,
      message: `版本冲突：当前版本已更新为 v${latest.version}，请刷新后重试`,
      current_version: latest.version,
      current_status: latest.status
    };
    return;
  }

  const insertRecord = db.prepare(`
    INSERT INTO processing_records (
      id, order_id, order_version, from_status, to_status,
      handler_id, handler_name, handler_role, note
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  insertRecord.run(
    uuidv4(), order.id, newVersion, order.status, to_status,
    user.id, user.name, user.role, note || (order.status === to_status ? '区域经理复核归档' : null)
  );

  const insertAudit = db.prepare(`
    INSERT INTO audit_notes (
      id, order_id, order_version, operator_id, operator_name,
      operator_role, action, content
    ) VALUES (?, ?, ?, ?, ?, ?, 'update_status', ?)
  `);
  const actionContent = order.status === to_status
    ? `复核归档：${note || '确认通过'}`
    : `状态由「${STATUS_NAMES[order.status]}」变更为「${STATUS_NAMES[to_status]}」${note ? '，备注：' + note : ''}`;
  insertAudit.run(uuidv4(), order.id, newVersion, user.id, user.name, user.role, actionContent);

  if (abnormal_reason && abnormal_type) {
    const insertAbnormal = db.prepare(`
      INSERT INTO abnormal_reasons (
        id, order_id, abnormal_type, description, responsible_person,
        reported_by, reported_by_name
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    insertAbnormal.run(
      uuidv4(), order.id, abnormal_type, abnormal_reason,
      order.handler_name, user.id, user.name
    );
  }

  const updated = db.prepare('SELECT * FROM prescription_orders WHERE id = ?').get(order.id);
  ctx.body = { code: 0, data: decorateOrder(updated, user) };
});

router.post('/batch', authMiddleware, async (ctx) => {
  const user = ctx.state.currentUser;
  const { ids, to_status, version_map = {}, note } = ctx.request.body || {};

  if (!Array.isArray(ids) || ids.length === 0) {
    ctx.status = 400;
    ctx.body = { code: 400, message: '请选择要批量处理的订单' };
    return;
  }
  if (!to_status) {
    ctx.status = 400;
    ctx.body = { code: 400, message: '请指定目标状态' };
    return;
  }

  const results = [];
  const orderRows = db.prepare('SELECT * FROM prescription_orders WHERE id IN (' + ids.map(() => '?').join(',') + ')').all(...ids);
  const orderMap = {};
  orderRows.forEach(o => { orderMap[o.id] = o; });

  for (const id of ids) {
    const order = orderMap[id];
    if (!order) {
      results.push({ id, success: false, message: '订单不存在' });
      continue;
    }
    const clientVersion = version_map[id];

    const validation = validateTransition(order, to_status, user, clientVersion);
    if (!validation.ok) {
      results.push({
        id, order_no: order.order_no, success: false,
        error_code: validation.code, message: validation.message
      });
      continue;
    }

    if (order.status === to_status && to_status === ORDER_STATUS.SIGNED && user.role === ROLES.AREA_MANAGER) {
    } else if (order.status === to_status) {
      results.push({
        id, order_no: order.order_no, success: false,
        error_code: ABNORMAL_TYPES.DUPLICATE_SUBMIT,
        message: `重复提交：订单已是「${STATUS_NAMES[to_status]}」`
      });
      continue;
    }

    try {
      const newVersion = order.version + 1;
      const nextHandler = getNextHandler(order, to_status, user);

      const updateOrder = db.prepare(`
        UPDATE prescription_orders SET
          status = ?, version = ?,
          handler_role = ?, handler_id = ?, handler_name = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND version = ?
      `);
      const r = updateOrder.run(
        to_status, newVersion,
        nextHandler.handler_role, nextHandler.handler_id, nextHandler.handler_name,
        order.id, order.version
      );

      if (r.changes === 0) {
        results.push({
          id, order_no: order.order_no, success: false,
          error_code: ABNORMAL_TYPES.OLD_VERSION,
          message: '版本冲突，已被他人更新'
        });
        continue;
      }

      const insertRecord = db.prepare(`
        INSERT INTO processing_records (
          id, order_id, order_version, from_status, to_status,
          handler_id, handler_name, handler_role, note
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      insertRecord.run(
        uuidv4(), order.id, newVersion, order.status, to_status,
        user.id, user.name, user.role, note || (order.status === to_status ? '批量复核归档' : '批量状态变更')
      );

      const insertAudit = db.prepare(`
        INSERT INTO audit_notes (
          id, order_id, order_version, operator_id, operator_name,
          operator_role, action, content
        ) VALUES (?, ?, ?, ?, ?, ?, 'batch_update', ?)
      `);
      insertAudit.run(
        uuidv4(), order.id, newVersion, user.id, user.name, user.role,
        `批量处理：状态变更为「${STATUS_NAMES[to_status]}」`
      );

      results.push({
        id, order_no: order.order_no, success: true,
        message: `已变更为「${STATUS_NAMES[to_status]}」`,
        new_version: newVersion
      });
    } catch (e) {
      results.push({
        id, order_no: order.order_no, success: false,
        message: `处理失败：${e.message}`
      });
    }
  }

  const successCount = results.filter(r => r.success).length;
  const failCount = results.length - successCount;

  ctx.body = {
    code: 0,
    data: {
      total: results.length,
      success: successCount,
      failed: failCount,
      results
    }
  };
});

router.post('/:id/attachments', authMiddleware, async (ctx) => {
  const user = ctx.state.currentUser;
  const order = db.prepare('SELECT * FROM prescription_orders WHERE id = ?').get(ctx.params.id);
  if (!order) {
    ctx.status = 404;
    ctx.body = { code: 404, message: '处方订单不存在' };
    return;
  }
  if (!isHandlerOfOrder(order, user)) {
    ctx.status = 403;
    ctx.body = { code: 403, message: '您无权操作该处方订单' };
    return;
  }
  const { file_name, file_type, file_url, evidence_type } = ctx.request.body || {};
  if (!file_name || !evidence_type) {
    ctx.status = 400;
    ctx.body = { code: 400, message: '请提供文件名和证据类型' };
    return;
  }
  const attId = uuidv4();
  db.prepare(`
    INSERT INTO attachments (
      id, order_id, file_name, file_type, file_url,
      evidence_type, uploaded_by, uploaded_by_name
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    attId, order.id, file_name, file_type || 'application/octet-stream',
    file_url || '#', evidence_type, user.id, user.name
  );

  db.prepare(`
    INSERT INTO audit_notes (
      id, order_id, order_version, operator_id, operator_name,
      operator_role, action, content
    ) VALUES (?, ?, ?, ?, ?, ?, 'upload_attachment', ?)
  `).run(uuidv4(), order.id, order.version, user.id, user.name, user.role, `上传附件：${file_name}（${evidence_type}）`);

  const created = db.prepare('SELECT * FROM attachments WHERE id = ?').get(attId);
  ctx.status = 201;
  ctx.body = { code: 0, data: created };
});

module.exports = router;
