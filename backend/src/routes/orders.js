const Router = require('koa-router');
const db = require('../db');
const { v4: uuidv4 } = require('uuid');
const { authMiddleware } = require('../middleware/auth');
const {
  ROLES, ORDER_STATUS, STATUS_NAMES, ROLE_NAMES,
  ABNORMAL_TYPES, ABNORMAL_NAMES, WARNING_LEVELS, WARNING_NAMES
} = require('../utils/constants');
const {
  validateTransition, getNextHandler, computeWarningLevel,
  isHandlerOfOrder, isAllowedSameStatusTransition
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

function writeProcessingRecord(tx, orderId, version, fromStatus, toStatus, user, note) {
  tx.prepare(`
    INSERT INTO processing_records (
      id, order_id, order_version, from_status, to_status,
      handler_id, handler_name, handler_role, note, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
  `).run(uuidv4(), orderId, version, fromStatus, toStatus, user.id, user.name, user.role, note || null);
}

function writeAuditNote(tx, orderId, version, user, action, content) {
  tx.prepare(`
    INSERT INTO audit_notes (
      id, order_id, order_version, operator_id, operator_name,
      operator_role, action, content, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
  `).run(uuidv4(), orderId, version, user.id, user.name, user.role, action, content || null);
}

function writeAbnormalReason(tx, orderId, abnormalType, description, responsible, user) {
  if (!abnormalType || !description) return;
  tx.prepare(`
    INSERT INTO abnormal_reasons (
      id, order_id, abnormal_type, description, responsible_person,
      reported_by, reported_by_name, reported_at, resolved
    ) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, 0)
  `).run(uuidv4(), orderId, abnormalType, description, responsible || null, user.id, user.name);
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

  let allSql = `SELECT due_at, status, handler_name FROM prescription_orders WHERE 1=1`;
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
  const warningResponsible = { normal: [], approaching: [], overdue: [] };
  allRows.forEach(r => {
    const w = computeWarningLevel(r);
    warningCount[w]++;
    if (r.handler_name && !warningResponsible[w].includes(r.handler_name)) {
      warningResponsible[w].push(r.handler_name);
    }
  });

  const mySql = `SELECT COUNT(*) as cnt FROM prescription_orders WHERE handler_role = ? AND (handler_id IS NULL OR handler_id = ?)`;
  const myCnt = db.prepare(mySql).get(user.role, user.id).cnt;

  ctx.body = {
    code: 0,
    data: {
      byStatus: Object.entries(statusCount).map(([k, v]) => ({ status: k, statusName: STATUS_NAMES[k], count: v })),
      byWarning: Object.entries(warningCount).map(([k, v]) => ({
        level: k, levelName: WARNING_NAMES[k], count: v,
        responsibles: warningResponsible[k]
      })),
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

  const storeNameMap = { store_001: '朝阳大药房（总店）', store_002: '朝阳大药房（分店）' };
  const areaNameMap = { area_east: '华东区域' };

  const orderId = uuidv4();
  const pharmacist = db.prepare("SELECT * FROM users WHERE store_id = ? AND role = ? ORDER BY created_at LIMIT 1").get(user.store_id, ROLES.PHARMACIST);

  const tx = db.transaction(() => {
    db.prepare(`
      INSERT INTO prescription_orders (
        id, order_no, patient_name, patient_id_card,
        store_id, store_name, area_id, area_name,
        drugs_count, total_amount, status,
        handler_role, handler_id, handler_name,
        version, created_by, created_by_name, due_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)
    `).run(
      orderId, orderNo, patient_name, patient_id_card || null,
      user.store_id, storeNameMap[user.store_id] || user.store_id,
      user.area_id, areaNameMap[user.area_id] || user.area_id,
      Number(drugs_count), Number(total_amount),
      ORDER_STATUS.PENDING_SIGN,
      ROLES.PHARMACIST, pharmacist ? pharmacist.id : null, pharmacist ? pharmacist.name : null,
      user.id, user.name,
      dueTime.toISOString()
    );

    writeProcessingRecord(db, orderId, 1, null, ORDER_STATUS.PENDING_SIGN, user, '门店店员登记处方订单');
    writeAuditNote(db, orderId, 1, user, 'create', `创建处方订单 ${orderNo}`);

    const insertAttachment = db.prepare(`
      INSERT INTO attachments (
        id, order_id, file_name, file_type, file_url,
        evidence_type, uploaded_by, uploaded_by_name, uploaded_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `);
    attachments.forEach(att => {
      insertAttachment.run(
        uuidv4(), orderId, att.file_name, att.file_type || 'application/octet-stream',
        att.file_url || '#', att.evidence_type || 'prescription', user.id, user.name
      );
    });
  });
  tx();

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
  if (!to_status) {
    ctx.status = 400;
    ctx.body = { code: 400, message: '请提供 to_status' };
    return;
  }

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

  const sameStatusAllowed = isAllowedSameStatusTransition(user.role, order.status, to_status);
  if (order.status === to_status && !sameStatusAllowed) {
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

  const finalAbnormalReason = abnormal_reason !== undefined && abnormal_reason !== null && abnormal_reason !== ''
    ? abnormal_reason
    : (sameStatusAllowed ? order.abnormal_reason : order.abnormal_reason);
  const finalAbnormalType = abnormal_type || order.abnormal_type;
  const finalCorrectionNote = correction_note !== undefined && correction_note !== null && correction_note !== ''
    ? correction_note
    : (sameStatusAllowed ? order.correction_note : order.correction_note);

  const tx = db.transaction(() => {
    const result = db.prepare(`
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
    `).run(
      to_status, newVersion,
      nextHandler.handler_role, nextHandler.handler_id, nextHandler.handler_name,
      finalAbnormalReason || null,
      finalAbnormalType || null,
      finalCorrectionNote || null,
      order.id, order.version
    );

    if (result.changes === 0) {
      const latest = db.prepare('SELECT version, status FROM prescription_orders WHERE id = ?').get(order.id);
      const err = new Error('VERSION_CONFLICT');
      err.latest = latest;
      throw err;
    }

    const actionNote = note || (sameStatusAllowed ? '区域经理复核归档' : null);
    writeProcessingRecord(db, order.id, newVersion, order.status, to_status, user, actionNote);

    const actionContent = sameStatusAllowed
      ? `复核归档：${note || '确认通过，状态保持「' + STATUS_NAMES[to_status] + '」'}`
      : `状态由「${STATUS_NAMES[order.status]}」变更为「${STATUS_NAMES[to_status]}」${note ? '，备注：' + note : ''}`;
    writeAuditNote(db, order.id, newVersion, user, sameStatusAllowed ? 'review' : 'update_status', actionContent);

    if ((abnormal_reason && abnormal_type) ||
        (to_status === ORDER_STATUS.MATERIAL_SHORTAGE) ||
        (to_status === ORDER_STATUS.OVERDUE)) {
      const abType = abnormal_type || (to_status === ORDER_STATUS.MATERIAL_SHORTAGE ? ABNORMAL_TYPES.MATERIAL_SHORTAGE : ABNORMAL_TYPES.OVERDUE);
      const abDesc = abnormal_reason || (to_status === ORDER_STATUS.MATERIAL_SHORTAGE ? '缺料，需补货或联系患者' : '已超过处方有效期，节点超时');
      writeAbnormalReason(db, order.id, abType, abDesc, order.handler_name, user);
    }
  });

  try {
    tx();
  } catch (e) {
    if (e.message === 'VERSION_CONFLICT') {
      ctx.status = 409;
      ctx.body = {
        code: 409,
        error_code: ABNORMAL_TYPES.OLD_VERSION,
        message: `版本冲突：当前版本已更新为 v${e.latest.version}，请刷新后重试`,
        current_version: e.latest.version,
        current_status: e.latest.status
      };
      return;
    }
    throw e;
  }

  const updated = db.prepare('SELECT * FROM prescription_orders WHERE id = ?').get(order.id);
  ctx.body = { code: 0, data: decorateOrder(updated, user) };
});

router.post('/batch', authMiddleware, async (ctx) => {
  const user = ctx.state.currentUser;
  const {
    ids, to_status, version_map = {}, note,
    abnormal_reason, abnormal_type, correction_note
  } = ctx.request.body || {};

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

    const sameStatusAllowed = isAllowedSameStatusTransition(user.role, order.status, to_status);
    if (order.status === to_status && !sameStatusAllowed) {
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

      const finalAbnormalReason = abnormal_reason || order.abnormal_reason;
      const finalAbnormalType = abnormal_type || order.abnormal_type;
      const finalCorrectionNote = correction_note || order.correction_note;

      let updated = null;
      const tx = db.transaction(() => {
        const r = db.prepare(`
          UPDATE prescription_orders SET
            status = ?, version = ?,
            handler_role = ?, handler_id = ?, handler_name = ?,
            abnormal_reason = ?, abnormal_type = ?, correction_note = ?,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = ? AND version = ?
        `).run(
          to_status, newVersion,
          nextHandler.handler_role, nextHandler.handler_id, nextHandler.handler_name,
          finalAbnormalReason || null,
          finalAbnormalType || null,
          finalCorrectionNote || null,
          order.id, order.version
        );

        if (r.changes === 0) {
          const err = new Error('VERSION_CONFLICT');
          throw err;
        }

        const actionNote = note || (sameStatusAllowed ? '批量复核归档' : '批量状态变更');
        writeProcessingRecord(db, order.id, newVersion, order.status, to_status, user, actionNote);

        const actionContent = sameStatusAllowed
          ? `批量复核归档：${note || '确认通过'}`
          : `批量处理：状态由「${STATUS_NAMES[order.status]}」变更为「${STATUS_NAMES[to_status]}」${note ? '，备注：' + note : ''}`;
        writeAuditNote(db, order.id, newVersion, user, 'batch_update', actionContent);

        if ((abnormal_reason && abnormal_type) ||
            (to_status === ORDER_STATUS.MATERIAL_SHORTAGE) ||
            (to_status === ORDER_STATUS.OVERDUE)) {
          const abType = abnormal_type || (to_status === ORDER_STATUS.MATERIAL_SHORTAGE ? ABNORMAL_TYPES.MATERIAL_SHORTAGE : ABNORMAL_TYPES.OVERDUE);
          const abDesc = abnormal_reason || (to_status === ORDER_STATUS.MATERIAL_SHORTAGE ? '批量标记缺料' : '批量标记逾期');
          writeAbnormalReason(db, order.id, abType, abDesc, order.handler_name, user);
        }

        updated = db.prepare('SELECT * FROM prescription_orders WHERE id = ?').get(order.id);
      });

      tx();

      results.push({
        id, order_no: order.order_no, success: true,
        message: sameStatusAllowed
          ? `已复核归档（保持「${STATUS_NAMES[to_status]}」）`
          : `已变更为「${STATUS_NAMES[to_status]}」`,
        new_version: newVersion,
        status: to_status,
        status_name: STATUS_NAMES[to_status],
        handler_name: updated ? updated.handler_name : null
      });
    } catch (e) {
      if (e.message === 'VERSION_CONFLICT') {
        results.push({
          id, order_no: order.order_no, success: false,
          error_code: ABNORMAL_TYPES.OLD_VERSION,
          message: '版本冲突，已被他人更新，请刷新后重试'
        });
      } else {
        results.push({
          id, order_no: order.order_no, success: false,
          message: `处理失败：${e.message}`
        });
      }
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
  const tx = db.transaction(() => {
    db.prepare(`
      INSERT INTO attachments (
        id, order_id, file_name, file_type, file_url,
        evidence_type, uploaded_by, uploaded_by_name, uploaded_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `).run(
      attId, order.id, file_name, file_type || 'application/octet-stream',
      file_url || '#', evidence_type, user.id, user.name
    );
    writeAuditNote(db, order.id, order.version, user, 'upload_attachment', `上传附件：${file_name}（${evidence_type}）`);
  });
  tx();

  const created = db.prepare('SELECT * FROM attachments WHERE id = ?').get(attId);
  ctx.status = 201;
  ctx.body = { code: 0, data: created };
});

module.exports = router;
