import dayjs from 'dayjs';
import { getDb } from '../db/init.js';
import {
  authenticate, requireRole, requireHandler, verifyVersion,
  checkStatusTransition, checkEvidence, checkDuplicateAction,
} from '../utils/auth.js';
import { EVIDENCE_RULES, STATUS_LABEL, ROLE_LABEL, EVIDENCE_LABEL, ACTION_MAP } from '../config.js';
import {
  nowIso, nextId, logProcessingRecord, bumpOrderVersion, computeUrgency,
  getOrderEvidenceTypes, formatOrderDetail, addAuditNote, addException, resolveException,
} from '../utils/helpers.js';

const EVIDENCE_TYPES = ['id_card', 'registration_form', 'deposit_slip', 'review_note', 'other'];

export default async function orderRoutes(fastify) {
  fastify.get('/api/orders', async (req, reply) => {
    const auth = authenticate(req);
    if (!auth.ok) return reply.code(401).send(auth);

    const {
      status, keyword, urgency, handler_scope = 'mine',
      order_type, page = 1, page_size = 20,
    } = req.query || {};

    const db = getDb();
    const sql = ['SELECT o.* FROM orders o WHERE 1=1'];
    const params = [];

    if (status) {
      const statusList = Array.isArray(status) ? status : [status];
      sql.push(`AND o.status IN (${statusList.map(() => '?').join(',')})`);
      params.push(...statusList);
    }

    if (keyword) {
      sql.push('AND (o.order_no LIKE ? OR o.guest_name LIKE ? OR o.room_no LIKE ?)');
      const kw = `%${keyword}%`;
      params.push(kw, kw, kw);
    }

    if (order_type) {
      sql.push('AND o.order_type = ?');
      params.push(order_type);
    }

    const role = auth.user.role;
    if (handler_scope === 'mine') {
      sql.push('AND (o.current_role = ? OR o.created_by = ?)');
      params.push(role, auth.user.id);
    }

    sql.push('ORDER BY CASE o.status WHEN ? THEN 0 WHEN ? THEN 1 WHEN ? THEN 2 ELSE 3 END, o.deadline IS NULL, o.deadline ASC, o.created_at DESC');
    params.push('pending', 'transferred', 'reviewed');

    const countSql = sql.join(' ').replace('SELECT o.* FROM orders o WHERE 1=1', 'SELECT COUNT(*) as cnt FROM orders o WHERE 1=1');
    const total = db.prepare(countSql).get(...params).cnt;

    const limit = Math.min(parseInt(page_size, 10) || 20, 200);
    const offset = ((parseInt(page, 10) || 1) - 1) * limit;
    const rows = db.prepare(`${sql.join(' ')} LIMIT ? OFFSET ?`).all(...params, limit, offset);

    const orders = rows.map(o => {
      const evidenceTypes = getOrderEvidenceTypes(db, o.id);
      const urgency = computeUrgency(o.deadline);
      return {
        ...o,
        status_label: STATUS_LABEL[o.status] || o.status,
        deadline_urgency: urgency,
        evidence_types: evidenceTypes,
        evidence_labels: evidenceTypes.map(e => EVIDENCE_LABEL[e] || e),
        current_role_label: o.current_role ? ROLE_LABEL[o.current_role] : '',
        handler_name: o.current_handler
          ? (db.prepare('SELECT display_name FROM users WHERE id = ?').get(o.current_handler)?.display_name || '')
          : '',
      };
    });

    if (urgency) {
      const filtered = orders.filter(o => o.deadline_urgency.level === urgency);
      db.close();
      return {
        ok: true,
        data: { list: filtered, total: filtered.length, page: 1, page_size: limit },
      };
    }

    const stats = buildStats(db, role, auth.user.id);
    db.close();

    return {
      ok: true,
      data: { list: orders, total, page: parseInt(page, 10) || 1, page_size: limit, stats },
    };
  });

  fastify.get('/api/orders/:id', async (req, reply) => {
    const auth = authenticate(req);
    if (!auth.ok) return reply.code(401).send(auth);

    const db = getDb();
    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
    if (!order) {
      db.close();
      return reply.code(404).send({ ok: false, code: 'NOT_FOUND', message: '住客订单不存在' });
    }

    const detail = formatOrderDetail(db, order);
    detail.current_role_label = detail.current_role ? ROLE_LABEL[detail.current_role] : '';
    detail.created_by_name = db.prepare('SELECT display_name FROM users WHERE id = ?').get(detail.created_by)?.display_name || '';
    detail.handler_name = detail.current_handler
      ? (db.prepare('SELECT display_name FROM users WHERE id = ?').get(detail.current_handler)?.display_name || '')
      : '';

    const attachments = db.prepare(`
      SELECT a.*, u.display_name as uploaded_by_name
      FROM attachments a LEFT JOIN users u ON a.uploaded_by = u.id
      WHERE a.order_id = ? ORDER BY a.uploaded_at DESC
    `).all(order.id).map(a => ({ ...a, evidence_type_label: EVIDENCE_LABEL[a.evidence_type] || a.evidence_type }));

    const records = db.prepare(`
      SELECT * FROM processing_records WHERE order_id = ? ORDER BY created_at ASC, id ASC
    `).all(order.id);

    const notes = db.prepare(`
      SELECT * FROM audit_notes WHERE order_id = ? ORDER BY created_at DESC
    `).all(order.id);

    const exceptions = db.prepare(`
      SELECT er.*, u.display_name as resolved_by_name
      FROM exception_reasons er LEFT JOIN users u ON er.resolved_by = u.id
      WHERE er.order_id = ? ORDER BY created_at DESC
    `).all(order.id);

    const canShowSubordinates = ['transferred', 'reviewed', 'archived'].includes(order.status)
      || (order.current_role === 'reviewer');
    const subordinateRecords = canShowSubordinates
      ? records.filter(r => ['前台接待核查', '客房主管核查', '前厅接待', '客房主管', '前厅接待和客房主管核查无异常',
                             '前厅、客房均完成回访记录', '前厅接待已确认身份信息，客房主管已查房，待值班经理复核',
                             '客房主管已退房核查，无物品损坏，前厅接待已核实消费记录']
          .some(keyword => r.remark?.includes(keyword) || r.action_label?.includes(keyword))
          || ['前厅接待记录', '客房主管记录'].some(t => r.action === t))
      : [];

    db.close();

    return {
      ok: true,
      data: {
        order: detail,
        attachments,
        processing_records: records,
        audit_notes: notes,
        exceptions,
        subordinate_records: subordinateRecords,
        permission: buildPermission(auth.user, order),
      },
    };
  });

  fastify.post('/api/orders', async (req, reply) => {
    const auth = authenticate(req);
    const roleCheck = requireRole(auth, ['registrar']);
    if (!roleCheck.ok) return reply.code(403).send(roleCheck);

    const {
      order_no, guest_name, room_no, check_in_date, check_out_date,
      amount, order_type = 'normal', deadline_hours = 24,
      evidence_types = [], remark, note_content,
    } = req.body || {};

    if (!order_no || !guest_name || !check_in_date || amount == null) {
      return reply.code(400).send({
        ok: false, code: 'BAD_REQUEST',
        message: '订单号、住客姓名、入住日期、金额为必填项',
      });
    }

    const db = getDb();
    if (db.prepare('SELECT id FROM orders WHERE order_no = ?').get(order_no)) {
      db.close();
      return reply.code(409).send({ ok: false, code: 'DUPLICATE_ORDER_NO', message: '订单号已存在' });
    }

    const requiredEvidence = EVIDENCE_RULES.registrar;
    const evCheck = checkEvidence({ id: 'new' }, evidence_types, requiredEvidence);
    if (!evCheck.ok) {
      db.close();
      return reply.code(422).send({
        ok: false, code: evCheck.code,
        message: `登记环节材料校验失败：${evCheck.message}`,
        missing: evCheck.missing,
      });
    }

    const now = nowIso();
    const deadline = new Date(Date.now() + parseInt(deadline_hours, 10) * 3600 * 1000).toISOString();
    const orderId = nextId('o');

    const tx = db.transaction(() => {
      db.prepare(`
        INSERT INTO orders (id, order_no, guest_name, room_no, check_in_date, check_out_date,
          amount, order_type, status, current_handler, current_role, deadline,
          version, created_by, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)
      `).run(orderId, order_no, guest_name, room_no || null, check_in_date, check_out_date || null,
        parseFloat(amount), order_type, 'pending', auth.user.id, 'registrar', deadline,
        auth.user.id, now, now);

      // ====== 关键修复：登记时勾选的证据要真实写入 attachments 表（否则后续校验必失败）
      for (const et of evidence_types.filter(x => EVIDENCE_TYPES.includes(x))) {
        db.prepare(`
          INSERT INTO attachments (id, order_id, file_name, file_type, evidence_type, uploaded_by, uploaded_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(
          nextId('a'),
          orderId,
          `登记时上传_${EVIDENCE_LABEL[et] || et}_${order_no}.pdf`,
          'application/pdf',
          et,
          auth.user.id,
          now,
        );
      }

      logProcessingRecord(db, {
        order_id: orderId, action: 'create',
        from_status: null, to_status: 'pending',
        operator_id: auth.user.id, operator_name: auth.user.display_name, operator_role: auth.user.role,
        handler_before: null, handler_after: auth.user.id,
        deadline_before: null, deadline_after: deadline,
        evidence_required: requiredEvidence.join(','),
        evidence_provided: evidence_types.filter(x => EVIDENCE_TYPES.includes(x)).join(','),
        remark: remark || '住客登记员发起登记',
        version_before: 0, version_after: 1,
      });

      if (note_content) addAuditNote(db, orderId, 'normal', note_content, auth.user);
    });
    tx();

    const order = formatOrderDetail(db, db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId));
    db.close();
    return { ok: true, data: { order, message: '住客订单登记成功' } };
  });

  fastify.post('/api/orders/:id/transfer', async (req, reply) => {
    return await handleOrderAction(req, reply, 'transfer');
  });

  fastify.post('/api/orders/:id/review', async (req, reply) => {
    return await handleOrderAction(req, reply, 'review');
  });

  fastify.post('/api/orders/:id/archive', async (req, reply) => {
    return await handleOrderAction(req, reply, 'archive');
  });

  fastify.post('/api/orders/:id/return', async (req, reply) => {
    return await handleOrderAction(req, reply, 'return');
  });

  fastify.post('/api/orders/:id/correct', async (req, reply) => {
    return await handleOrderAction(req, reply, 'correct');
  });

  fastify.post('/api/orders/batch/push-overdue', async (req, reply) => {
    const auth = authenticate(req);
    const roleCheck = requireRole(auth, ['reviewer', 'supervisor']);
    if (!roleCheck.ok) return reply.code(403).send(roleCheck);

    const { order_ids = [] } = req.body || {};
    if (!Array.isArray(order_ids) || order_ids.length === 0) {
      return reply.code(400).send({ ok: false, code: 'BAD_REQUEST', message: '批量推进订单ID列表必填' });
    }

    const db = getDb();
    const results = [];

    for (const orderId of order_ids) {
      const tx = db.transaction(() => {
        const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
        if (!order) {
          results.push({ order_id: orderId, success: false, code: 'NOT_FOUND', message: '订单不存在' });
          return;
        }

        const urgency = computeUrgency(order.deadline);
        if (urgency.level !== 'overdue') {
          results.push({ order_id: orderId, order_no: order.order_no,
            success: false, code: 'NOT_OVERDUE', message: `订单${order.order_no}状态：${urgency.label}，非逾期，跳过` });
          return;
        }

        if (order.current_handler && order.current_handler !== auth.user.id && order.current_role !== auth.user.role) {
          results.push({ order_id: orderId, order_no: order.order_no,
            success: false, code: 'PERMISSION_DENIED',
            message: `订单${order.order_no}当前处理人是${order.current_handler}或${order.current_role}环节，您无权推进` });
          return;
        }

        if (order.status === 'archived') {
          results.push({ order_id: orderId, order_no: order.order_no,
            success: false, code: 'ALREADY_ARCHIVED', message: `订单${order.order_no}已归档，不能再次推进` });
          return;
        }

        if (order.status === 'reviewed' && auth.user.role === 'reviewer') {
          const updated = bumpOrderVersion(db, orderId, {
            status: 'archived', archived_at: nowIso(),
            current_handler: auth.user.id, current_role: 'reviewer',
          });
          logProcessingRecord(db, {
            order_id: orderId, action: 'archive',
            from_status: order.status, to_status: 'archived',
            operator_id: auth.user.id, operator_name: auth.user.display_name, operator_role: auth.user.role,
            handler_before: order.current_handler, handler_after: auth.user.id,
            deadline_before: order.deadline, deadline_after: order.deadline,
            evidence_required: '', evidence_provided: '',
            remark: '逾期批量推进：复核完成订单归档',
            version_before: order.version, version_after: updated.version,
          });
          results.push({ order_id: orderId, order_no: order.order_no,
            success: true, message: `订单${order.order_no}已归档` });
          return;
        }

        if (order.status === 'transferred' && order.current_role === 'supervisor' && auth.user.role === 'supervisor') {
          const evidenceTypes = getOrderEvidenceTypes(db, orderId);
          const requiredEvidence = EVIDENCE_RULES.supervisor;
          const evCheck = checkEvidence(order, evidenceTypes, requiredEvidence);
          if (!evCheck.ok) {
            results.push({ order_id: orderId, order_no: order.order_no,
              success: false, code: evCheck.code,
              message: `订单${order.order_no}缺少必填证据：${evCheck.missing.join('、')}，无法推进` });
            return;
          }
          const updated = bumpOrderVersion(db, orderId, {
            current_handler: 'u_reviewer', current_role: 'reviewer',
          });
          logProcessingRecord(db, {
            order_id: orderId, action: 'transfer',
            from_status: order.status, to_status: 'transferred',
            operator_id: auth.user.id, operator_name: auth.user.display_name, operator_role: auth.user.role,
            handler_before: order.current_handler, handler_after: 'u_reviewer',
            deadline_before: order.deadline, deadline_after: order.deadline,
            evidence_required: requiredEvidence.join(','),
            evidence_provided: evidenceTypes.join(','),
            remark: '逾期批量推进：主管审核通过，转办集团复核',
            version_before: order.version, version_after: updated.version,
          });
          results.push({ order_id: orderId, order_no: order.order_no,
            success: true, message: `订单${order.order_no}已转办集团复核` });
          return;
        }

        results.push({ order_id: orderId, order_no: order.order_no,
          success: false, code: 'CANNOT_PUSH',
          message: `订单${order.order_no}当前状态=${order.status}/环节=${order.current_role}，您的角色=${auth.user.role}，不满足批量推进条件` });
      });
      try { tx(); } catch (err) {
        results.push({ order_id: orderId, success: false, code: 'TX_ERROR', message: err.message });
      }
    }

    db.close();
    return { ok: true, data: { results, total: results.length, success_count: results.filter(r => r.success).length } };
  });

  async function handleOrderAction(req, reply, action) {
    const auth = authenticate(req);
    if (!auth.ok) return reply.code(401).send(auth);

    const {
      target_handler_id, target_handler_role,
      version, evidence_types = [], remark, note_content,
      exception_code, exception_label, exception_desc, exception_severity = 'medium',
      page_status,
    } = req.body || {};

    const db = getDb();
    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
    if (!order) {
      db.close();
      return reply.code(404).send({ ok: false, code: 'NOT_FOUND', message: '住客订单不存在' });
    }

    const roleRule = {
      transfer: { from: ['registrar', 'supervisor'] },
      review: { from: ['reviewer'] },
      archive: { from: ['reviewer'] },
      return: { from: ['supervisor', 'reviewer'] },
      correct: { from: ['registrar'] },
    }[action];
    if (!roleRule) {
      db.close();
      return reply.code(400).send({ ok: false, code: 'BAD_ACTION', message: `未知动作：${action}` });
    }

    const roleCheck = requireRole(auth, roleRule.from);
    if (!roleCheck.ok) { db.close(); return reply.code(403).send(roleCheck); }

    // ====== 角色边界校验：比较页面携带状态 vs 后端真实记录 ======
    if (page_status && page_status !== order.status) {
      db.close();
      return reply.code(409).send({
        ok: false, code: 'STATUS_SYNC_CONFLICT',
        message: `角色边界校验失败：页面显示状态【${STATUS_LABEL[page_status] || page_status}】与后端记录【${STATUS_LABEL[order.status]}】不一致，请刷新队列或详情后再操作，避免静默覆盖`,
        page_status, backend_status: order.status,
      });
    }

    if (['transfer', 'review', 'archive', 'return', 'correct'].includes(action)) {
      const hc = requireHandler(auth, order);
      if (!hc.ok) { db.close(); return reply.code(403).send(hc); }
    }

    const vv = verifyVersion(order, version);
    if (!vv.ok) { db.close(); return reply.code(409).send(vv); }

    const dup = checkDuplicateAction(order, action, auth.user.id);
    if (!dup.ok) { db.close(); return reply.code(409).send(dup); }

    let targetStatus = order.status;
    let toHandler = order.current_handler;
    let toRole = order.current_role;
    let requiredEvidence = [];
    let evidenceCheckResult = { ok: true };
    // ====== 关键修复：证据必须读 attachments 表实际记录，不可信前端勾选 ======
    const actualEvidenceTypes = getOrderEvidenceTypes(db, order.id);

    switch (action) {
      case 'transfer':
        targetStatus = 'transferred';
        if (target_handler_role === 'reviewer' || order.current_role === 'supervisor') {
          toRole = 'reviewer';
          toHandler = target_handler_id || 'u_reviewer';
          requiredEvidence = EVIDENCE_RULES.supervisor;
        } else {
          toRole = 'supervisor';
          toHandler = target_handler_id || 'u_supervisor';
          requiredEvidence = EVIDENCE_RULES.registrar;
        }
        evidenceCheckResult = checkEvidence(order, actualEvidenceTypes, requiredEvidence);
        break;
      case 'review':
        targetStatus = 'reviewed';
        toRole = 'reviewer';
        toHandler = auth.user.id;
        requiredEvidence = EVIDENCE_RULES.reviewer;
        break;
      case 'archive':
        targetStatus = 'archived';
        toRole = 'reviewer';
        toHandler = auth.user.id;
        break;
      case 'return':
        targetStatus = 'transferred';
        toRole = 'registrar';
        toHandler = order.created_by;
        break;
      case 'correct':
        targetStatus = 'transferred';
        toRole = 'supervisor';
        toHandler = 'u_supervisor';
        requiredEvidence = EVIDENCE_RULES.registrar;
        evidenceCheckResult = checkEvidence(order, actualEvidenceTypes, requiredEvidence);
        break;
    }

    if (action !== 'return') {
      const st = checkStatusTransition(order, targetStatus, action);
      if (!st.ok) { db.close(); return reply.code(409).send(st); }
    }

    if (!evidenceCheckResult.ok) {
      db.close();
      return reply.code(422).send({
        ok: false, code: evidenceCheckResult.code,
        message: `【${ACTION_MAP[action] || action}】证据校验失败（已校验 attachments 表实际记录，非前端勾选）：${evidenceCheckResult.message}`,
        missing: evidenceCheckResult.missing,
        actual_evidence: actualEvidenceTypes,
        required_evidence: requiredEvidence,
      });
    }

    const tx = db.transaction(() => {
      const updated = bumpOrderVersion(db, order.id, {
        status: targetStatus,
        current_handler: toHandler,
        current_role: toRole,
        archived_at: targetStatus === 'archived' ? nowIso() : undefined,
      });

      const labelMap = {
        transfer: order.current_role === 'supervisor' ? '转办至集团复核' : '转办至审核主管',
        review: '集团复核通过（已回访）',
        archive: '复核归档完成',
        return: `退回${ROLE_LABEL.registrar}补正`,
        correct: '补正材料后转办审核主管',
      };

      logProcessingRecord(db, {
        order_id: order.id, action,
        from_status: order.status, to_status: targetStatus,
        operator_id: auth.user.id, operator_name: auth.user.display_name, operator_role: auth.user.role,
        handler_before: order.current_handler, handler_after: toHandler,
        deadline_before: order.deadline, deadline_after: order.deadline,
        evidence_required: requiredEvidence.join(','),
        evidence_provided: actualEvidenceTypes.join(','),
        remark: remark || labelMap[action] || `执行${action}`,
        version_before: order.version, version_after: updated.version,
      });

      if (action === 'return' && exception_label) {
        addException(db, order.id, exception_code || 'CORRECTION_REQUIRED', exception_label,
          exception_desc || remark || '退回补正', exception_severity, auth.user);
      }
      if (action === 'correct') {
        const openEx = db.prepare('SELECT id FROM exception_reasons WHERE order_id = ? AND resolved = 0').all(order.id);
        for (const e of openEx) resolveException(db, e.id, auth.user);
      }
      if (note_content) addAuditNote(db, order.id, action === 'return' ? 'correction' : 'normal', note_content, auth.user);
    });

    try {
      tx();
    } catch (err) {
      db.close();
      return reply.code(500).send({ ok: false, code: 'TX_ERROR', message: `事务执行失败：${err.message}` });
    }

    const after = formatOrderDetail(db, db.prepare('SELECT * FROM orders WHERE id = ?').get(order.id));
    db.close();
    return {
      ok: true,
      data: {
        order: after,
        message: `${ROLE_LABEL[auth.user.role]}执行【${ACTION_MAP[action] || action}】成功，状态已回写为【${STATUS_LABEL[targetStatus]}】，队列将刷新`,
        refresh_queue: true,
      },
    };
  }

  function buildStats(db, role, userId) {
    const base = db.prepare(`
      SELECT status, COUNT(*) as cnt FROM orders GROUP BY status
    `).all().reduce((acc, r) => ({ ...acc, [r.status]: r.cnt }), {});

    const roleSql = `SELECT status, COUNT(*) as cnt FROM orders WHERE current_role = ? GROUP BY status`;
    const roleBase = db.prepare(roleSql).all(role).reduce((acc, r) => ({ ...acc, [r.status]: r.cnt }), {});

    const myPending = db.prepare(`
      SELECT COUNT(*) as cnt FROM orders WHERE current_handler = ? AND status IN ('pending','transferred')
    `).get(userId).cnt;

    const overdue = db.prepare(`SELECT deadline, status FROM orders`).all()
      .filter(r => r.status !== 'archived' && computeUrgency(r.deadline).level === 'overdue').length;
    const warning = db.prepare(`SELECT deadline, status FROM orders`).all()
      .filter(r => r.status !== 'archived' && computeUrgency(r.deadline).level === 'warning').length;

    return {
      all: {
        pending: base.pending || 0,
        transferred: base.transferred || 0,
        reviewed: base.reviewed || 0,
        archived: base.archived || 0,
      },
      mine: {
        pending: roleBase.pending || 0,
        transferred: roleBase.transferred || 0,
        reviewed: roleBase.reviewed || 0,
        my_to_handle: myPending,
      },
      urgency: { overdue, warning },
    };
  }

  function buildPermission(user, order) {
    const isHandler = order.current_handler === user.id && order.current_role === user.role;
    return {
      can_transfer: isHandler && (user.role === 'registrar' && ['pending', 'transferred'].includes(order.status))
        || (isHandler && user.role === 'supervisor' && order.status === 'transferred' && order.current_role === 'supervisor'),
      can_return: isHandler && user.role === 'supervisor' && order.status === 'transferred' && order.current_role === 'supervisor',
      can_correct: isHandler && user.role === 'registrar' && order.status === 'transferred' && order.current_role === 'registrar',
      can_review: isHandler && user.role === 'reviewer' && order.status === 'transferred' && order.current_role === 'reviewer',
      can_archive: isHandler && user.role === 'reviewer' && order.status === 'reviewed',
      can_view_subordinates: user.role === 'reviewer' || order.current_role === 'reviewer' || order.status !== 'pending',
    };
  }
}
