import { getDb } from '../db/init.js';
import { authenticate, requireHandler, verifyVersion, checkDuplicateAction } from '../utils/auth.js';
import { EVIDENCE_LABEL, STATUS_LABEL, ROLE_LABEL } from '../config.js';
import {
  nowIso, nextId, formatOrderDetail, logProcessingRecord, bumpOrderVersion,
  getOrderEvidenceTypes, buildOrderSummary,
} from '../utils/helpers.js';

const ALLOWED_EVIDENCE = ['id_card', 'registration_form', 'deposit_slip', 'review_note', 'other'];

export default async function attachmentRoutes(fastify) {
  fastify.get('/api/orders/:id/attachments', async (req, reply) => {
    const auth = authenticate(req);
    if (!auth.ok) return reply.code(401).send(auth);

    const db = getDb();
    const order = db.prepare('SELECT id FROM orders WHERE id = ?').get(req.params.id);
    if (!order) { db.close(); return reply.code(404).send({ ok: false, code: 'NOT_FOUND', message: '订单不存在' }); }

    const rows = db.prepare(`
      SELECT a.*, u.display_name as uploaded_by_name
      FROM attachments a LEFT JOIN users u ON a.uploaded_by = u.id
      WHERE a.order_id = ? ORDER BY a.uploaded_at DESC
    `).all(req.params.id).map(a => ({ ...a, evidence_type_label: EVIDENCE_LABEL[a.evidence_type] || a.evidence_type }));
    db.close();
    return { ok: true, data: rows };
  });

  fastify.post('/api/orders/:id/attachments', async (req, reply) => {
    const auth = authenticate(req);
    if (!auth.ok) return reply.code(401).send(auth);

    const { file_name, file_type, evidence_type, version, remark } = req.body || {};
    if (!file_name || !evidence_type) {
      return reply.code(400).send({ ok: false, code: 'BAD_REQUEST', message: '文件名、证据类型必填' });
    }
    if (!ALLOWED_EVIDENCE.includes(evidence_type)) {
      return reply.code(400).send({ ok: false, code: 'BAD_EVIDENCE_TYPE', message: `证据类型必须是：${ALLOWED_EVIDENCE.join('/')}` });
    }

    const db = getDb();
    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
    if (!order) { db.close(); return reply.code(404).send({ ok: false, code: 'NOT_FOUND', message: '订单不存在' }); }

    const hc = requireHandler(auth, order);
    if (!hc.ok) { db.close(); return reply.code(403).send({ ...hc, order_summary: buildOrderSummary(order) }); }

    if (version != null) {
      const vv = verifyVersion(order, version);
      if (!vv.ok) { db.close(); return reply.code(409).send({ ...vv, order_summary: buildOrderSummary(order) }); }
    }

    const id = nextId('a');
    const ts = nowIso();
    db.prepare(`
      INSERT INTO attachments (id, order_id, file_name, file_type, evidence_type, uploaded_by, uploaded_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, req.params.id, file_name, file_type || 'application/octet-stream', evidence_type, auth.user.id, ts);

    logProcessingRecord(db, {
      order_id: order.id, action: 'attach',
      from_status: order.status, to_status: order.status,
      operator_id: auth.user.id, operator_name: auth.user.display_name, operator_role: auth.user.role,
      handler_before: order.current_handler, handler_after: order.current_handler,
      deadline_before: order.deadline, deadline_after: order.deadline,
      evidence_required: '', evidence_provided: evidence_type,
      remark: `上传证据【${EVIDENCE_LABEL[evidence_type] || evidence_type}】：${file_name}${remark ? ` | ${remark}` : ''}`,
      version_before: order.version, version_after: order.version,
    });

    const attachment = {
      id, order_id: order.id, file_name, file_type: file_type || 'application/octet-stream',
      evidence_type, evidence_type_label: EVIDENCE_LABEL[evidence_type],
      uploaded_by: auth.user.id, uploaded_by_name: auth.user.display_name, uploaded_at: ts,
    };
    const afterOrder = db.prepare('SELECT * FROM orders WHERE id = ?').get(order.id);
    db.close();
    return {
      ok: true,
      data: {
        attachment,
        order_summary: buildOrderSummary(afterOrder),
        message: '证据上传成功，审计轨迹已记录',
        refresh_queue: true,
      },
    };
  });

  fastify.get('/api/orders/:id/records', async (req, reply) => {
    const auth = authenticate(req);
    if (!auth.ok) return reply.code(401).send(auth);
    const db = getDb();
    const rows = db.prepare(`
      SELECT * FROM processing_records WHERE order_id = ? ORDER BY created_at ASC, id ASC
    `).all(req.params.id);
    db.close();
    return { ok: true, data: rows };
  });

  fastify.get('/api/orders/:id/exceptions', async (req, reply) => {
    const auth = authenticate(req);
    if (!auth.ok) return reply.code(401).send(auth);
    const db = getDb();
    const rows = db.prepare(`
      SELECT er.*, u.display_name as resolved_by_name
      FROM exception_reasons er LEFT JOIN users u ON er.resolved_by = u.id
      WHERE er.order_id = ? ORDER BY created_at DESC
    `).all(req.params.id);
    db.close();
    return { ok: true, data: rows };
  });

  fastify.post('/api/orders/:id/exceptions/:eid/resolve', async (req, reply) => {
    const auth = authenticate(req);
    if (!auth.ok) return reply.code(401).send(auth);
    const db = getDb();
    const ex = db.prepare('SELECT * FROM exception_reasons WHERE id = ? AND order_id = ?').get(req.params.eid, req.params.id);
    if (!ex) { db.close(); return reply.code(404).send({ ok: false, code: 'NOT_FOUND', message: '异常记录不存在' }); }
    db.prepare(`UPDATE exception_reasons SET resolved = 1, resolved_by = ?, resolved_at = ? WHERE id = ?`)
      .run(auth.user.id, nowIso(), ex.id);
    logProcessingRecord(db, {
      order_id: req.params.id, action: 'resolve_exception',
      from_status: null, to_status: null,
      operator_id: auth.user.id, operator_name: auth.user.display_name, operator_role: auth.user.role,
      handler_before: null, handler_after: null,
      deadline_before: null, deadline_after: null,
      evidence_required: '', evidence_provided: '',
      remark: `标记异常已解决：${ex.reason_label}`,
      version_before: 0, version_after: 0,
    });
    const afterOrder = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
    db.close();
    return {
      ok: true,
      data: {
        message: '异常已标记解决',
        order_summary: buildOrderSummary(afterOrder),
        refresh_queue: true,
      },
    };
  });

  fastify.get('/api/orders/:id/notes', async (req, reply) => {
    const auth = authenticate(req);
    if (!auth.ok) return reply.code(401).send(auth);
    const db = getDb();
    const rows = db.prepare(`SELECT * FROM audit_notes WHERE order_id = ? ORDER BY created_at DESC`).all(req.params.id);
    db.close();
    return { ok: true, data: rows };
  });

  fastify.post('/api/orders/:id/notes', async (req, reply) => {
    const auth = authenticate(req);
    if (!auth.ok) return reply.code(401).send(auth);
    const { note_type = 'normal', content } = req.body || {};
    if (!content) return reply.code(400).send({ ok: false, code: 'BAD_REQUEST', message: '备注内容必填' });
    if (!['normal', 'correction', 'exception'].includes(note_type)) {
      return reply.code(400).send({ ok: false, code: 'BAD_NOTE_TYPE', message: '备注类型错误' });
    }
    const db = getDb();
    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
    if (!order) { db.close(); return reply.code(404).send({ ok: false, code: 'NOT_FOUND', message: '订单不存在' }); }
    const id = nextId('n');
    db.prepare(`
      INSERT INTO audit_notes (id, order_id, note_type, content, created_by, created_by_name, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, req.params.id, note_type, content, auth.user.id, auth.user.display_name, nowIso());
    const afterOrder = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
    db.close();
    return {
      ok: true,
      data: {
        id,
        message: '备注已添加至审计轨迹',
        order_summary: buildOrderSummary(afterOrder),
        refresh_queue: false,
      },
    };
  });
}
