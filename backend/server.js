const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('./db');
const { initDatabase } = require('./init-db');
const {
  ROLES, ROLE_NAMES, STATUS, STATUS_NAMES, ATTACHMENT_TYPES,
  generateToken, authMiddleware, roleMiddleware,
  canHandleRecord, validateEvidence, getDeadlineStatus
} = require('./auth');

const PORT = 8003;
const FRONTEND_URL = 'http://localhost:3003';

const app = express();
app.use(express.json({ limit: '10mb' }));
app.use(cors({
  origin: FRONTEND_URL,
  credentials: true
}));

const dbPath = path.join(__dirname, 'data.db');
if (!fs.existsSync(dbPath)) {
  console.log('数据库不存在，正在初始化...');
  initDatabase();
}

const db = getDb();

function getRecordWithDetails(recordId) {
  const record = db.prepare('SELECT * FROM morning_check_records WHERE id = ?').get(recordId);
  if (!record) return null;

  const child = db.prepare('SELECT * FROM children WHERE id = ?').get(record.child_id);
  const attachments = db.prepare('SELECT * FROM attachments WHERE record_id = ? ORDER BY uploaded_at DESC').all(recordId);
  const logs = db.prepare('SELECT * FROM processing_logs WHERE record_id = ? ORDER BY created_at DESC').all(recordId);
  const auditNotes = db.prepare('SELECT * FROM audit_notes WHERE record_id = ? ORDER BY created_at DESC').all(recordId);

  return {
    ...record,
    child,
    attachments,
    logs,
    audit_notes: auditNotes,
    deadline_status: getDeadlineStatus(record.deadline),
    status_name: STATUS_NAMES[record.status] || record.status,
    current_handler_role_name: record.current_handler_role ? ROLE_NAMES[record.current_handler_role] : null
  };
}

app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: '用户名和密码必填' });
  }

  const user = db.prepare('SELECT * FROM users WHERE username = ? AND password = ?').get(username, password);
  if (!user) {
    return res.status(401).json({ error: '用户名或密码错误' });
  }

  const token = generateToken(user);
  res.json({
    token,
    user: {
      id: user.id,
      username: user.username,
      name: user.name,
      role: user.role,
      role_name: ROLE_NAMES[user.role],
      department: user.department
    }
  });
});

app.get('/api/auth/me', authMiddleware, (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!user) {
    return res.status(404).json({ error: '用户不存在' });
  }
  res.json({
    id: user.id,
    username: user.username,
    name: user.name,
    role: user.role,
    role_name: ROLE_NAMES[user.role],
    department: user.department
  });
});

app.get('/api/records', authMiddleware, (req, res) => {
  const { status, deadline_status, child_name, archived } = req.query;
  const user = req.user;

  let baseQuery = `
    SELECT DISTINCT mcr.*, c.name as child_name, c.class_name
    FROM morning_check_records mcr
    LEFT JOIN children c ON mcr.child_id = c.id
    WHERE 1=1
  `;
  const params = [];

  if (user.role === ROLES.REGISTRAR) {
    baseQuery += ' AND (mcr.current_handler = ? OR mcr.archived = 1)';
    params.push(user.username);
  } else if (user.role === ROLES.SUPERVISOR) {
    baseQuery += ' AND (mcr.current_handler = ? OR mcr.archived = 1)';
    params.push(user.username);
  } else if (user.role === ROLES.PRINCIPAL) {
    baseQuery += ' AND (mcr.current_handler = ? OR mcr.status = ? OR mcr.archived = 1)';
    params.push(user.username, STATUS.ACCEPTED);
  }

  if (status) {
    baseQuery += ' AND mcr.status = ?';
    params.push(status);
  }

  if (archived !== undefined) {
    baseQuery += ' AND mcr.archived = ?';
    params.push(archived === 'true' ? 1 : 0);
  }

  if (child_name) {
    baseQuery += ' AND c.name LIKE ?';
    params.push(`%${child_name}%`);
  }

  baseQuery += ' ORDER BY mcr.updated_at DESC';

  let records = db.prepare(baseQuery).all(...params);

  records = records.map(r => {
    const attachments = db.prepare('SELECT * FROM attachments WHERE record_id = ? ORDER BY uploaded_at DESC').all(r.id);
    const child = {
      id: r.child_id,
      name: r.child_name,
      class_name: r.class_name
    };
    try {
      const fullChild = db.prepare('SELECT * FROM children WHERE id = ?').get(r.child_id);
      if (fullChild) Object.assign(child, fullChild);
    } catch (e) {}
    const abnormal_notices = attachments.filter(a => a.type === ATTACHMENT_TYPES.ABNORMAL_NOTICE);
    return {
      ...r,
      child,
      status_name: STATUS_NAMES[r.status] || r.status,
      deadline_status: getDeadlineStatus(r.deadline),
      current_handler_role_name: r.current_handler_role ? ROLE_NAMES[r.current_handler_role] : null,
      evidence_count: attachments.length,
      attachments,
      abnormal_notices,
      abnormal_notice_summary: abnormal_notices.length > 0
        ? abnormal_notices.map(a => a.name + (a.content ? `：${a.content}` : '')).join('；')
        : null
    };
  });

  if (deadline_status) {
    records = records.filter(r => r.deadline_status === deadline_status);
  }

  const stats = {
    total: records.length,
    pending_registration: records.filter(r => r.status === STATUS.PENDING_REGISTRATION).length,
    pending_review: records.filter(r => r.status === STATUS.PENDING_REVIEW).length,
    accepted: records.filter(r => r.status === STATUS.ACCEPTED).length,
    verified: records.filter(r => r.status === STATUS.VERIFIED).length,
    correction: records.filter(r => r.status === STATUS.PENDING_REGISTRAR_CORRECTION || r.status === STATUS.PENDING_SUPERVISOR_CORRECTION).length,
    overdue: records.filter(r => r.deadline_status === 'overdue').length,
    warning: records.filter(r => r.deadline_status === 'warning').length,
    normal: records.filter(r => r.deadline_status === 'normal' && !r.archived).length
  };

  res.json({ records, stats });
});

app.get('/api/records/:id', authMiddleware, (req, res) => {
  const record = getRecordWithDetails(req.params.id);
  if (!record) {
    return res.status(404).json({ error: '记录不存在' });
  }

  if (record.archived) {
    return res.json(record);
  }

  const user = req.user;
  const canView = (
    (user.role === ROLES.REGISTRAR && record.current_handler === user.username) ||
    (user.role === ROLES.SUPERVISOR && (record.current_handler === user.username || record.status === STATUS.ACCEPTED || record.status === STATUS.VERIFIED)) ||
    (user.role === ROLES.PRINCIPAL)
  );

  if (!canView) {
    return res.status(403).json({ error: '无权查看此记录' });
  }

  res.json(record);
});

app.post('/api/records', authMiddleware, roleMiddleware(ROLES.REGISTRAR), (req, res) => {
  const { child_id, check_date, temperature, health_status, abnormal_type, abnormal_reason, attachments, remark } = req.body;

  if (!child_id || !check_date || health_status === undefined) {
    return res.status(400).json({ error: '幼儿ID、晨检日期、健康状态必填' });
  }

  const existing = db.prepare('SELECT * FROM children WHERE id = ?').get(child_id);
  if (!existing) {
    return res.status(400).json({ error: '幼儿不存在' });
  }

  const now = new Date();
  const deadline = new Date(now);
  deadline.setDate(deadline.getDate() + 3);

  const recordId = uuidv4();
  let actualStatus;
  let handler;
  let handlerRole;

  if (health_status === 'abnormal') {
    actualStatus = STATUS.PENDING_REGISTRATION;
    handler = req.user.username;
    handlerRole = req.user.role;
  } else {
    actualStatus = STATUS.PENDING_REVIEW;
    const supervisors = db.prepare("SELECT * FROM users WHERE role = 'supervisor' LIMIT 1").get();
    if (!supervisors) {
      return res.status(500).json({ error: '系统中未配置审核主管' });
    }
    handler = supervisors.username;
    handlerRole = supervisors.role;
  }

  const tx = db.transaction(() => {
    db.prepare(`
      INSERT INTO morning_check_records
      (id, child_id, check_date, status, temperature, health_status, abnormal_type, abnormal_reason,
       current_handler, current_handler_role, version, deadline, created_at, updated_at, archived)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, 0)
    `).run(
      recordId, child_id, check_date, actualStatus, temperature, health_status, abnormal_type, abnormal_reason,
      handler, handlerRole, deadline.toISOString(), now.toISOString(), now.toISOString()
    );

    const insertAttachment = db.prepare(`
      INSERT INTO attachments (id, record_id, type, name, content, uploaded_by, uploaded_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    (attachments || []).forEach(a => {
      insertAttachment.run(uuidv4(), recordId, a.type, a.name, a.content, req.user.username, now.toISOString());
    });

    const allAttachments = db.prepare('SELECT * FROM attachments WHERE record_id = ?').all(recordId);
    const evidenceErrors = validateEvidence(recordId, 'submit', health_status, allAttachments);
    if (evidenceErrors.length > 0) {
      throw new Error(evidenceErrors.join('；'));
    }

    db.prepare(`
      INSERT INTO processing_logs
      (id, record_id, action, action_by, action_by_role, action_by_name, previous_status, new_status, remark, evidence_summary, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      uuidv4(), recordId, 'submit', req.user.username, req.user.role, req.user.name,
      null, actualStatus, remark || '发起晨检记录',
      `已上传${allAttachments.length}份证据`, now.toISOString()
    );
  });

  try {
    tx();
    const record = getRecordWithDetails(recordId);
    res.status(201).json(record);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/records/:id/handle', authMiddleware, (req, res) => {
  const recordId = req.params.id;
  const { action, correction_reason, reject_reason, remark, version, attachments, audit_note } = req.body;
  const user = req.user;

  if (!action) {
    return res.status(400).json({ error: '处理动作必填' });
  }

  if (!version) {
    return res.status(400).json({ error: '版本号必填，用于乐观锁校验' });
  }

  const record = db.prepare('SELECT * FROM morning_check_records WHERE id = ?').get(recordId);
  if (!record) {
    return res.status(404).json({ error: '记录不存在' });
  }

  if (record.version !== version) {
    return res.status(409).json({ error: `版本冲突：当前版本为${record.version}，您基于版本${version}提交，请刷新后重试` });
  }

  if (record.archived) {
    return res.status(400).json({ error: '记录已归档，无法再处理' });
  }

  if (!canHandleRecord(user, record)) {
    return res.status(403).json({ error: `当前角色(${ROLE_NAMES[user.role]})无权处理此状态(${STATUS_NAMES[record.status]})的记录` });
  }

  const validActions = ['accept', 'reject', 'correction_submit', 'verify', 'correction_accept'];
  if (!validActions.includes(action)) {
    return res.status(400).json({ error: `无效的处理动作：${action}` });
  }

  if ((record.status === STATUS.PENDING_REVIEW || record.status === STATUS.PENDING_SUPERVISOR_CORRECTION) && user.role !== ROLES.SUPERVISOR) {
    return res.status(403).json({ error: '只有晨检审核主管可接单审核' });
  }

  if (record.status === STATUS.ACCEPTED && user.role !== ROLES.PRINCIPAL) {
    return res.status(403).json({ error: '只有幼儿园复核负责人可复核归档' });
  }

  if (action === 'reject' && !reject_reason) {
    return res.status(400).json({ error: '退回必须填写退回意见' });
  }

  if ((action === 'correction_submit') && !correction_reason) {
    return res.status(400).json({ error: '补正必须填写补正原因' });
  }

  if (record.health_status === 'abnormal') {
    if (action === 'accept' || action === 'verify') {
      return res.status(400).json({ error: '异常记录只能补正或退回，不能直接推进到下一环节' });
    }
    if (record.status === STATUS.PENDING_REGISTRATION && user.role !== ROLES.REGISTRAR) {
      return res.status(403).json({ error: '异常登记仅晨检登记员可发起补正' });
    }
    if (record.status === STATUS.PENDING_REGISTRAR_CORRECTION && user.role !== ROLES.REGISTRAR) {
      return res.status(403).json({ error: '退回登记员的异常补正仅晨检登记员可处理' });
    }
    if (record.status === STATUS.PENDING_SUPERVISOR_CORRECTION && user.role !== ROLES.SUPERVISOR) {
      return res.status(403).json({ error: '退回主管的异常补正仅晨检审核主管可处理' });
    }
  }

  let newStatus;
  let newHandler;
  let newHandlerRole;
  let now = new Date().toISOString();
  let logAction = action;

  switch (action) {
    case 'accept':
      if (record.status === STATUS.PENDING_REVIEW || record.status === STATUS.PENDING_SUPERVISOR_CORRECTION) {
        newStatus = STATUS.ACCEPTED;
        const principal = db.prepare("SELECT * FROM users WHERE role = 'principal' LIMIT 1").get();
        if (!principal) return res.status(500).json({ error: '系统中未配置复核负责人' });
        newHandler = principal.username;
        newHandlerRole = principal.role;
      } else {
        return res.status(400).json({ error: '当前状态不可接单' });
      }
      break;

    case 'reject':
      if (record.status === STATUS.PENDING_REVIEW || record.status === STATUS.PENDING_SUPERVISOR_CORRECTION) {
        newStatus = STATUS.PENDING_REGISTRAR_CORRECTION;
        const registrars = db.prepare("SELECT * FROM users WHERE role = 'registrar' LIMIT 1").get();
        newHandler = registrars ? registrars.username : record.current_handler;
        newHandlerRole = ROLES.REGISTRAR;
      } else if (record.status === STATUS.ACCEPTED) {
        newStatus = STATUS.PENDING_SUPERVISOR_CORRECTION;
        const supervisors = db.prepare("SELECT * FROM users WHERE role = 'supervisor' LIMIT 1").get();
        if (!supervisors) return res.status(500).json({ error: '系统中未配置审核主管' });
        newHandler = supervisors.username;
        newHandlerRole = ROLES.SUPERVISOR;
      } else {
        return res.status(400).json({ error: '当前状态不可退回' });
      }
      break;

    case 'correction_submit':
      if (record.status === STATUS.PENDING_REGISTRAR_CORRECTION) {
        newStatus = STATUS.PENDING_REVIEW;
        const supervisors = db.prepare("SELECT * FROM users WHERE role = 'supervisor' LIMIT 1").get();
        if (!supervisors) return res.status(500).json({ error: '系统中未配置审核主管' });
        newHandler = supervisors.username;
        newHandlerRole = supervisors.role;
        logAction = 'correction_submit';
      } else if (record.status === STATUS.PENDING_REGISTRATION) {
        newStatus = STATUS.PENDING_REVIEW;
        const supervisors = db.prepare("SELECT * FROM users WHERE role = 'supervisor' LIMIT 1").get();
        if (!supervisors) return res.status(500).json({ error: '系统中未配置审核主管' });
        newHandler = supervisors.username;
        newHandlerRole = supervisors.role;
        logAction = 'submit';
      } else if (record.status === STATUS.PENDING_SUPERVISOR_CORRECTION) {
        newStatus = STATUS.ACCEPTED;
        const principal = db.prepare("SELECT * FROM users WHERE role = 'principal' LIMIT 1").get();
        if (!principal) return res.status(500).json({ error: '系统中未配置复核负责人' });
        newHandler = principal.username;
        newHandlerRole = principal.role;
        logAction = 'correction_submit';
      } else {
        return res.status(400).json({ error: '当前状态不可提交补正' });
      }
      break;

    case 'verify':
      if (record.status !== STATUS.ACCEPTED) {
        return res.status(400).json({ error: '只有已接单状态可复核归档' });
      }
      newStatus = STATUS.VERIFIED;
      newHandler = null;
      newHandlerRole = null;
      break;

    default:
      return res.status(400).json({ error: '不支持的处理动作' });
  }

  const tx = db.transaction(() => {
    if (attachments && attachments.length > 0) {
      const insertAttachment = db.prepare(`
        INSERT INTO attachments (id, record_id, type, name, content, uploaded_by, uploaded_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      attachments.forEach(a => {
        insertAttachment.run(uuidv4(), recordId, a.type, a.name, a.content, user.username, now);
      });
    }

    const allAttachments = db.prepare('SELECT * FROM attachments WHERE record_id = ?').all(recordId);
    if (action === 'correction_submit') {
      const evidenceErrors = validateEvidence(recordId, action, record.health_status, allAttachments);
      if (evidenceErrors.length > 0) {
        throw new Error(evidenceErrors.join('；'));
      }
    }

    let abnormalReason = record.abnormal_reason;
    if (action === 'correction_submit' && correction_reason) {
      abnormalReason = correction_reason;
    }

    db.prepare(`
      UPDATE morning_check_records
      SET status = ?, current_handler = ?, current_handler_role = ?, version = version + 1,
          updated_at = ?, abnormal_reason = ?,
          deadline = CASE
            WHEN ? = 'verified' THEN NULL
            ELSE datetime('now', '+3 days')
          END,
          archived = CASE WHEN ? = 'verified' THEN 1 ELSE 0 END
      WHERE id = ?
    `).run(newStatus, newHandler, newHandlerRole, now, abnormalReason, newStatus, newStatus, recordId);

    db.prepare(`
      INSERT INTO processing_logs
      (id, record_id, action, action_by, action_by_role, action_by_name, previous_status, new_status,
       remark, correction_reason, reject_reason, evidence_summary, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      uuidv4(), recordId, logAction, user.username, user.role, user.name,
      record.status, newStatus, remark, correction_reason, reject_reason,
      `证据共${allAttachments.length}份`, now
    );

    if (audit_note) {
      db.prepare(`
        INSERT INTO audit_notes (id, record_id, note, noted_by, created_at)
        VALUES (?, ?, ?, ?, ?)
      `).run(uuidv4(), recordId, audit_note, user.name, now);
    }
  });

  try {
    tx();
    const result = getRecordWithDetails(recordId);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/records/batch', authMiddleware, (req, res) => {
  const { record_ids, action, remark } = req.body;
  const user = req.user;
  const now = new Date().toISOString();

  if (!record_ids || !Array.isArray(record_ids) || record_ids.length === 0) {
    return res.status(400).json({ error: '请选择要批量处理的记录' });
  }

  if (!action) {
    return res.status(400).json({ error: '处理动作必填' });
  }

  const validBatchActions = ['accept', 'verify'];
  if (!validBatchActions.includes(action)) {
    return res.status(400).json({ error: '批量处理仅支持接单(accept)或归档(verify)' });
  }

  const logBatchFailure = db.prepare(`
    INSERT INTO processing_logs
    (id, record_id, action, action_by, action_by_role, action_by_name, previous_status, new_status,
     remark, reject_reason, evidence_summary, created_at)
    VALUES (?, ?, 'batch_failed', ?, ?, ?, ?, ?, ?, ?, '批量处理被拦截', ?)
  `);

  const appendAbnormalReason = db.prepare(`
    UPDATE morning_check_records
    SET abnormal_reason = CASE
        WHEN abnormal_reason IS NULL OR abnormal_reason = '' THEN ?
        ELSE abnormal_reason || '；[批量拦截] ' || ?
      END,
      updated_at = ?
    WHERE id = ?
  `);

  const results = [];

  const pushFailure = (record, reason) => {
    try {
      if (record) {
        logBatchFailure.run(
          uuidv4(), record.id, user.username, user.role, user.name,
          record.status, record.status, remark || '批量处理', reason, now
        );
        appendAbnormalReason.run(`[批量拦截${new Date().toLocaleString('zh-CN')}] ${reason}`, reason, now, record.id);
      }
    } catch (e) {
      console.error('写入批量失败流水异常', e);
    }
    results.push({ id: record ? record.id : 'unknown', success: false, reason });
  };

  for (const recordId of record_ids) {
    try {
      const record = db.prepare('SELECT * FROM morning_check_records WHERE id = ?').get(recordId);
      if (!record) {
        results.push({ id: recordId, success: false, reason: '记录不存在' });
        continue;
      }

      if (record.archived) {
        pushFailure(record, '记录已归档');
        continue;
      }

      const deadlineStatus = getDeadlineStatus(record.deadline);
      if (deadlineStatus === 'overdue') {
        const reason = `记录已逾期，当前责任人：${record.current_handler_role ? ROLE_NAMES[record.current_handler_role] : '未知'}(${record.current_handler || '未分配'})，请逐条前往详情处理`;
        pushFailure(record, reason);
        results[results.length - 1].deadline_status = deadlineStatus;
        continue;
      }

      if (!canHandleRecord(user, record)) {
        pushFailure(record, `当前角色(${ROLE_NAMES[user.role]})无权处理此状态(${STATUS_NAMES[record.status]})的记录`);
        continue;
      }

      if (record.health_status === 'abnormal') {
        pushFailure(record, '异常记录不支持批量处理，请逐条前往详情补正或退回');
        results[results.length - 1].health_status = record.health_status;
        continue;
      }

      if (action === 'accept' && record.status !== STATUS.PENDING_REVIEW && record.status !== STATUS.PENDING_SUPERVISOR_CORRECTION) {
        pushFailure(record, `状态为"${STATUS_NAMES[record.status]}"的记录不支持批量接单`);
        continue;
      }

      if (action === 'verify' && record.status !== STATUS.ACCEPTED) {
        pushFailure(record, `状态为"${STATUS_NAMES[record.status]}"的记录不支持批量归档`);
        continue;
      }

      if (user.role === ROLES.SUPERVISOR && action === 'accept') {
        if (record.status !== STATUS.PENDING_REVIEW && record.status !== STATUS.PENDING_SUPERVISOR_CORRECTION) {
          pushFailure(record, '只有待接单状态可批量接单');
          continue;
        }
      } else if (user.role === ROLES.PRINCIPAL && action === 'verify') {
        if (record.status !== STATUS.ACCEPTED) {
          pushFailure(record, '只有已接单状态可批量归档');
          continue;
        }
      } else {
        pushFailure(record, `当前角色(${ROLE_NAMES[user.role]})不支持执行批量${action === 'accept' ? '接单' : '归档'}`);
        continue;
      }

      let newStatus, newHandler, newHandlerRole;

      if (action === 'accept') {
        newStatus = STATUS.ACCEPTED;
        const principal = db.prepare("SELECT * FROM users WHERE role = 'principal' LIMIT 1").get();
        if (!principal) {
          pushFailure(record, '系统中未配置复核负责人');
          continue;
        }
        newHandler = principal.username;
        newHandlerRole = principal.role;
      } else if (action === 'verify') {
        newStatus = STATUS.VERIFIED;
        newHandler = null;
        newHandlerRole = null;
      }

      const tx = db.transaction(() => {
        db.prepare(`
          UPDATE morning_check_records
          SET status = ?, current_handler = ?, current_handler_role = ?, version = version + 1,
              updated_at = ?, deadline = CASE WHEN ? = 'verified' THEN NULL ELSE datetime('now', '+3 days') END,
              archived = CASE WHEN ? = 'verified' THEN 1 ELSE 0 END
          WHERE id = ?
        `).run(newStatus, newHandler, newHandlerRole, now, newStatus, newStatus, recordId);

        db.prepare(`
          INSERT INTO processing_logs
          (id, record_id, action, action_by, action_by_role, action_by_name, previous_status, new_status,
           remark, evidence_summary, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          uuidv4(), recordId, action, user.username, user.role, user.name,
          record.status, newStatus, remark || '批量处理', '批量处理', now
        );
      });

      try {
        tx();
        results.push({ id: recordId, success: true, new_status: newStatus, new_status_name: STATUS_NAMES[newStatus] });
      } catch (err) {
        pushFailure(record, err.message);
      }
    } catch (err) {
      results.push({ id: recordId, success: false, reason: err.message });
    }
  }

  const successCount = results.filter(r => r.success).length;
  const failCount = results.filter(r => !r.success).length;

  res.json({
    summary: {
      total: results.length,
      success: successCount,
      failed: failCount
    },
    results
  });
});

app.get('/api/children', authMiddleware, (req, res) => {
  const { name } = req.query;
  let query = 'SELECT * FROM children WHERE 1=1';
  const params = [];
  if (name) {
    query += ' AND name LIKE ?';
    params.push(`%${name}%`);
  }
  query += ' ORDER BY class_name, name';
  const children = db.prepare(query).all(...params);
  res.json(children);
});

app.get('/api/stats/summary', authMiddleware, (req, res) => {
  const user = req.user;
  let baseQuery = 'SELECT * FROM morning_check_records WHERE archived = 0';
  const params = [];

  if (user.role === ROLES.REGISTRAR || user.role === ROLES.SUPERVISOR) {
    baseQuery += ' AND current_handler = ?';
    params.push(user.username);
  }

  const records = db.prepare(baseQuery).all(...params);

  const stats = {
    total: records.length,
    by_status: {},
    by_deadline: { normal: 0, warning: 0, overdue: 0 },
    by_health: { normal: 0, abnormal: 0 }
  };

  Object.values(STATUS).forEach(s => {
    stats.by_status[s] = 0;
  });

  records.forEach(r => {
    stats.by_status[r.status] = (stats.by_status[r.status] || 0) + 1;
    const ds = getDeadlineStatus(r.deadline);
    stats.by_deadline[ds]++;
    stats.by_health[r.health_status] = (stats.by_health[r.health_status] || 0) + 1;
  });

  stats.status_names = STATUS_NAMES;
  stats.role_names = ROLE_NAMES;

  res.json(stats);
});

app.get('/api/constants', authMiddleware, (req, res) => {
  res.json({
    roles: ROLES,
    role_names: ROLE_NAMES,
    statuses: STATUS,
    status_names: STATUS_NAMES,
    attachment_types: ATTACHMENT_TYPES
  });
});

app.listen(PORT, () => {
  console.log(`幼儿园晨检记录后端服务已启动: http://localhost:${PORT}`);
  console.log(`前端地址: ${FRONTEND_URL}`);
});
