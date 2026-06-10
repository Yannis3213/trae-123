const db = require('../db/database');
const { v4: uuidv4 } = require('uuid');
const { STATUS, ROLES, STATUS_NAMES, ROLE_NAMES } = require('../config');
const {
  validateWorkorderExistence,
  validateVersion,
  validateHandler,
  validateRequiredEvidence,
  canPerformAction,
  getWarningLevel,
  getCurrentNode,
  getNodeResponsible,
  createProcessingRecord,
  updateWorkorderStatus
} = require('../utils/workorderUtils');

function parseJsonField(value) {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch (e) {
    return value;
  }
}

function formatWorkorder(wo) {
  return {
    ...wo,
    production_schedule: parseJsonField(wo.production_schedule),
    material_issue: parseJsonField(wo.material_issue),
    completion_report: parseJsonField(wo.completion_report),
    status_name: STATUS_NAMES[wo.status] || wo.status,
    current_handler_role_name: wo.current_handler_role ? ROLE_NAMES[wo.current_handler_role] : null,
    warning_level: getWarningLevel(wo.deadline),
    current_node: getCurrentNode(wo)
  };
}

function getWorkorders(req, res) {
  const { status, keyword, warning_level, handler, page = 1, pageSize = 20 } = req.query;
  const userRole = req.user.role;
  const username = req.user.username;

  let query = `SELECT w.* FROM workorders w WHERE 1=1`;
  const params = [];

  if (status) {
    query += ` AND w.status = ?`;
    params.push(status);
  }

  if (keyword) {
    query += ` AND (w.code LIKE ? OR w.title LIKE ? OR w.product_name LIKE ?)`;
    params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
  }

  if (handler === 'mine') {
    query += ` AND (w.current_handler = ? OR w.planner = ? OR w.workshop_director = ?)`;
    params.push(username, username, username);
  }

  query += ` ORDER BY w.created_at DESC`;

  const offset = (page - 1) * pageSize;
  query += ` LIMIT ? OFFSET ?`;
  params.push(parseInt(pageSize), parseInt(offset));

  const workorders = db.prepare(query).all(...params).map(formatWorkorder);

  let countQuery = `SELECT COUNT(*) as total FROM workorders w WHERE 1=1`;
  const countParams = params.slice(0, -2);
  const { total } = db.prepare(countQuery).get(...countParams);

  const statsQuery = `
    SELECT
      SUM(CASE WHEN status = ? THEN 1 ELSE 0 END) as pending_correction_count,
      SUM(CASE WHEN status = ? THEN 1 ELSE 0 END) as under_review_count,
      SUM(CASE WHEN status = ? THEN 1 ELSE 0 END) as completed_count
    FROM workorders
  `;
  const stats = db.prepare(statsQuery).get(
    STATUS.PENDING_CORRECTION, STATUS.UNDER_REVIEW, STATUS.COMPLETED
  );

  res.json({
    success: true,
    data: {
      list: workorders,
      total,
      page: parseInt(page),
      pageSize: parseInt(pageSize),
      stats
    }
  });
}

function getWorkorderDetail(req, res) {
  const { id } = req.params;

  const validation = validateWorkorderExistence(id);
  if (!validation.valid) {
    return res.status(404).json({ success: false, error: validation.error, code: validation.code });
  }

  const workorder = formatWorkorder(validation.workorder);

  const records = db.prepare(`
    SELECT * FROM processing_records
    WHERE workorder_id = ?
    ORDER BY created_at DESC
  `).all(id).map(r => ({
    ...r,
    evidence: parseJsonField(r.evidence),
    operator_role_name: ROLE_NAMES[r.operator_role] || r.operator_role
  }));

  const attachments = db.prepare(`
    SELECT * FROM attachments
    WHERE workorder_id = ?
    ORDER BY uploaded_at DESC
  `).all(id);

  const auditNotes = db.prepare(`
    SELECT * FROM audit_notes
    WHERE workorder_id = ?
    ORDER BY created_at DESC
  `).all(id).map(n => ({
    ...n,
    author_role_name: ROLE_NAMES[n.author_role] || n.author_role
  }));

  const exceptions = db.prepare(`
    SELECT * FROM exceptions
    WHERE workorder_id = ?
    ORDER BY created_at DESC
  `).all(id);

  res.json({
    success: true,
    data: {
      workorder,
      records,
      attachments,
      auditNotes,
      exceptions
    }
  });
}

function createWorkorder(req, res) {
  const { code, title, product_name, quantity, unit, deadline, planner, workshop_director, factory_manager } = req.body;
  const userRole = req.user.role;
  const username = req.user.username;

  if (userRole !== ROLES.PLANNER) {
    return res.status(403).json({ success: false, error: '只有生产计划员可以创建工单', code: 'PERMISSION_DENIED' });
  }

  if (!code || !title || !product_name || !quantity) {
    return res.status(400).json({ success: false, error: '缺少必填字段', code: 'MISSING_FIELDS' });
  }

  const existing = db.prepare('SELECT id FROM workorders WHERE code = ?').get(code);
  if (existing) {
    return res.status(400).json({ success: false, error: '工单编号已存在', code: 'DUPLICATE_CODE' });
  }

  const id = 'wo_' + uuidv4().slice(0, 8);
  const plannerName = planner || username;

  const stmt = db.prepare(`
    INSERT INTO workorders (
      id, code, title, product_name, quantity, unit, status,
      current_handler_role, current_handler, version, deadline,
      planner, workshop_director, factory_manager
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    id, code, title, product_name, quantity, unit || '件',
    STATUS.PENDING_CORRECTION, ROLES.PLANNER, plannerName, 1, deadline || null,
    plannerName, workshop_director || '李明', factory_manager || '王强'
  );

  createProcessingRecord(
    id, '创建工单', null, STATUS.PENDING_CORRECTION,
    userRole, username, '创建生产工单', null, null, 1
  );

  const workorder = db.prepare('SELECT * FROM workorders WHERE id = ?').get(id);

  res.status(201).json({
    success: true,
    data: formatWorkorder(workorder)
  });
}

function scheduleProduction(req, res) {
  const { id } = req.params;
  const { version, schedule_data } = req.body;
  const userRole = req.user.role;
  const username = req.user.username;

  const validation = validateWorkorderExistence(id);
  if (!validation.valid) {
    return res.status(404).json({ success: false, error: validation.error, code: validation.code });
  }

  const wo = validation.workorder;

  const versionCheck = validateVersion(wo, version);
  if (!versionCheck.valid) {
    return res.status(409).json({ success: false, error: versionCheck.error, code: versionCheck.code });
  }

  const actionCheck = canPerformAction(wo, 'schedule_production', userRole);
  if (!actionCheck.valid) {
    return res.status(403).json({ success: false, error: actionCheck.error, code: actionCheck.code });
  }

  if (userRole === ROLES.PLANNER && wo.planner !== username) {
    return res.status(403).json({ success: false, error: '只能排程自己负责的工单', code: 'PERMISSION_DENIED' });
  }

  const scheduleInfo = {
    ...schedule_data,
    scheduled_by: username,
    scheduled_at: new Date().toISOString()
  };

  const newVersion = version + 1;
  db.prepare(`
    UPDATE workorders SET
      production_schedule = ?,
      version = ?,
      updated_at = datetime('now')
    WHERE id = ?
  `).run(JSON.stringify(scheduleInfo), newVersion, id);

  createProcessingRecord(
    id, '生产排程', wo.status, wo.status,
    userRole, username, '完成生产排程', scheduleInfo, version, newVersion
  );

  const updatedWo = db.prepare('SELECT * FROM workorders WHERE id = ?').get(id);

  res.json({
    success: true,
    data: formatWorkorder(updatedWo)
  });
}

function issueMaterial(req, res) {
  const { id } = req.params;
  const { version, material_data } = req.body;
  const userRole = req.user.role;
  const username = req.user.username;

  const validation = validateWorkorderExistence(id);
  if (!validation.valid) {
    return res.status(404).json({ success: false, error: validation.error, code: validation.code });
  }

  const wo = validation.workorder;

  const versionCheck = validateVersion(wo, version);
  if (!versionCheck.valid) {
    return res.status(409).json({ success: false, error: versionCheck.error, code: versionCheck.code });
  }

  const actionCheck = canPerformAction(wo, 'issue_material', userRole);
  if (!actionCheck.valid) {
    return res.status(403).json({ success: false, error: actionCheck.error, code: actionCheck.code });
  }

  const handlerCheck = validateHandler(wo, userRole, username);
  if (!handlerCheck.valid) {
    return res.status(403).json({ success: false, error: handlerCheck.error, code: handlerCheck.code });
  }

  if (!wo.production_schedule) {
    return res.status(400).json({ success: false, error: '请先完成生产排程', code: 'MISSING_SCHEDULE' });
  }

  const materialInfo = {
    ...material_data,
    received_by: username,
    received_at: new Date().toISOString()
  };

  const newVersion = version + 1;
  db.prepare(`
    UPDATE workorders SET
      material_issue = ?,
      version = ?,
      updated_at = datetime('now')
    WHERE id = ?
  `).run(JSON.stringify(materialInfo), newVersion, id);

  createProcessingRecord(
    id, '领料确认', wo.status, wo.status,
    userRole, username, '完成领料确认', materialInfo, version, newVersion
  );

  const updatedWo = db.prepare('SELECT * FROM workorders WHERE id = ?').get(id);

  res.json({
    success: true,
    data: formatWorkorder(updatedWo)
  });
}

function reportCompletion(req, res) {
  const { id } = req.params;
  const { version, completion_data } = req.body;
  const userRole = req.user.role;
  const username = req.user.username;

  const validation = validateWorkorderExistence(id);
  if (!validation.valid) {
    return res.status(404).json({ success: false, error: validation.error, code: validation.code });
  }

  const wo = validation.workorder;

  const versionCheck = validateVersion(wo, version);
  if (!versionCheck.valid) {
    return res.status(409).json({ success: false, error: versionCheck.error, code: versionCheck.code });
  }

  const actionCheck = canPerformAction(wo, 'report_completion', userRole);
  if (!actionCheck.valid) {
    return res.status(403).json({ success: false, error: actionCheck.error, code: actionCheck.code });
  }

  const handlerCheck = validateHandler(wo, userRole, username);
  if (!handlerCheck.valid) {
    return res.status(403).json({ success: false, error: handlerCheck.error, code: handlerCheck.code });
  }

  if (!wo.material_issue) {
    return res.status(400).json({ success: false, error: '请先完成领料确认', code: 'MISSING_MATERIAL' });
  }

  const completionInfo = {
    ...completion_data,
    report_by: username,
    report_at: new Date().toISOString()
  };

  const newVersion = version + 1;
  db.prepare(`
    UPDATE workorders SET
      completion_report = ?,
      version = ?,
      updated_at = datetime('now')
    WHERE id = ?
  `).run(JSON.stringify(completionInfo), newVersion, id);

  createProcessingRecord(
    id, '完工报工', wo.status, wo.status,
    userRole, username, '完成完工报工', completionInfo, version, newVersion
  );

  const updatedWo = db.prepare('SELECT * FROM workorders WHERE id = ?').get(id);

  res.json({
    success: true,
    data: formatWorkorder(updatedWo)
  });
}

function submitForReview(req, res) {
  const { id } = req.params;
  const { version, remark } = req.body;
  const userRole = req.user.role;
  const username = req.user.username;

  const validation = validateWorkorderExistence(id);
  if (!validation.valid) {
    return res.status(404).json({ success: false, error: validation.error, code: validation.code });
  }

  const wo = validation.workorder;

  const versionCheck = validateVersion(wo, version);
  if (!versionCheck.valid) {
    return res.status(409).json({ success: false, error: versionCheck.error, code: versionCheck.code });
  }

  const handlerCheck = validateHandler(wo, userRole, username);
  if (!handlerCheck.valid) {
    return res.status(403).json({ success: false, error: handlerCheck.error, code: handlerCheck.code });
  }

  const evidenceCheck = validateRequiredEvidence(wo, 'submit_for_review');
  if (!evidenceCheck.valid) {
    return res.status(400).json({ success: false, error: evidenceCheck.error, code: evidenceCheck.code, missing: evidenceCheck.missing });
  }

  if (wo.status !== STATUS.PENDING_CORRECTION) {
    return res.status(400).json({ success: false, error: '只有待补正状态的工单可以提交复核', code: 'STATUS_ERROR' });
  }

  const newVersion = updateWorkorderStatus(
    id, STATUS.UNDER_REVIEW, ROLES.WORKSHOP_DIRECTOR, wo.workshop_director, version
  );

  createProcessingRecord(
    id, '提交复核', STATUS.PENDING_CORRECTION, STATUS.UNDER_REVIEW,
    userRole, username, remark || '提交车间主任复核', null, version, newVersion
  );

  const updatedWo = db.prepare('SELECT * FROM workorders WHERE id = ?').get(id);

  res.json({
    success: true,
    data: formatWorkorder(updatedWo)
  });
}

function reviewApprove(req, res) {
  const { id } = req.params;
  const { version, remark } = req.body;
  const userRole = req.user.role;
  const username = req.user.username;

  const validation = validateWorkorderExistence(id);
  if (!validation.valid) {
    return res.status(404).json({ success: false, error: validation.error, code: validation.code });
  }

  const wo = validation.workorder;

  const versionCheck = validateVersion(wo, version);
  if (!versionCheck.valid) {
    return res.status(409).json({ success: false, error: versionCheck.error, code: versionCheck.code });
  }

  if (wo.status !== STATUS.UNDER_REVIEW) {
    return res.status(400).json({ success: false, error: '只有复核中的工单可以审核', code: 'STATUS_ERROR' });
  }

  if (userRole !== ROLES.WORKSHOP_DIRECTOR) {
    return res.status(403).json({ success: false, error: '只有车间主任可以复核', code: 'PERMISSION_DENIED' });
  }

  if (wo.workshop_director !== username) {
    return res.status(403).json({ success: false, error: '您不是该工单的车间主任', code: 'HANDLER_MISMATCH' });
  }

  const newVersion = updateWorkorderStatus(
    id, STATUS.UNDER_REVIEW, ROLES.FACTORY_MANAGER, wo.factory_manager, version
  );

  createProcessingRecord(
    id, '车间主任复核通过', STATUS.UNDER_REVIEW, STATUS.UNDER_REVIEW,
    userRole, username, remark || '复核通过，提交厂务经理确认', null, version, newVersion
  );

  const updatedWo = db.prepare('SELECT * FROM workorders WHERE id = ?').get(id);

  res.json({
    success: true,
    data: formatWorkorder(updatedWo)
  });
}

function reviewReject(req, res) {
  const { id } = req.params;
  const { version, remark, reject_reason } = req.body;
  const userRole = req.user.role;
  const username = req.user.username;

  const validation = validateWorkorderExistence(id);
  if (!validation.valid) {
    return res.status(404).json({ success: false, error: validation.error, code: validation.code });
  }

  const wo = validation.workorder;

  const versionCheck = validateVersion(wo, version);
  if (!versionCheck.valid) {
    return res.status(409).json({ success: false, error: versionCheck.error, code: versionCheck.code });
  }

  if (wo.status !== STATUS.UNDER_REVIEW) {
    return res.status(400).json({ success: false, error: '只有复核中的工单可以退回', code: 'STATUS_ERROR' });
  }

  if (userRole !== ROLES.WORKSHOP_DIRECTOR) {
    return res.status(403).json({ success: false, error: '只有车间主任可以退回工单', code: 'PERMISSION_DENIED' });
  }

  if (wo.workshop_director !== username) {
    return res.status(403).json({ success: false, error: '您不是该工单的车间主任', code: 'HANDLER_MISMATCH' });
  }

  if (!reject_reason) {
    return res.status(400).json({ success: false, error: '请填写退回原因', code: 'MISSING_REASON' });
  }

  const newVersion = updateWorkorderStatus(
    id, STATUS.PENDING_CORRECTION, ROLES.PLANNER, wo.planner, version
  );

  createProcessingRecord(
    id, '退回补正', STATUS.UNDER_REVIEW, STATUS.PENDING_CORRECTION,
    userRole, username, reject_reason, { reject_reason }, version, newVersion
  );

  const updatedWo = db.prepare('SELECT * FROM workorders WHERE id = ?').get(id);

  res.json({
    success: true,
    data: formatWorkorder(updatedWo)
  });
}

function factoryConfirm(req, res) {
  const { id } = req.params;
  const { version, remark } = req.body;
  const userRole = req.user.role;
  const username = req.user.username;

  const validation = validateWorkorderExistence(id);
  if (!validation.valid) {
    return res.status(404).json({ success: false, error: validation.error, code: validation.code });
  }

  const wo = validation.workorder;

  const versionCheck = validateVersion(wo, version);
  if (!versionCheck.valid) {
    return res.status(409).json({ success: false, error: versionCheck.error, code: versionCheck.code });
  }

  if (wo.status !== STATUS.UNDER_REVIEW) {
    return res.status(400).json({ success: false, error: '只有复核中的工单可以确认', code: 'STATUS_ERROR' });
  }

  if (userRole !== ROLES.FACTORY_MANAGER) {
    return res.status(403).json({ success: false, error: '只有厂务经理可以确认办结', code: 'PERMISSION_DENIED' });
  }

  if (wo.factory_manager !== username) {
    return res.status(403).json({ success: false, error: '您不是该工单的厂务经理', code: 'HANDLER_MISMATCH' });
  }

  const newVersion = version + 1;
  db.prepare(`
    UPDATE workorders SET
      status = ?,
      current_handler_role = NULL,
      current_handler = NULL,
      version = ?,
      completed_at = datetime('now'),
      updated_at = datetime('now')
    WHERE id = ?
  `).run(STATUS.COMPLETED, newVersion, id);

  createProcessingRecord(
    id, '厂务经理确认办结', STATUS.UNDER_REVIEW, STATUS.COMPLETED,
    userRole, username, remark || '确认办结', null, version, newVersion
  );

  const updatedWo = db.prepare('SELECT * FROM workorders WHERE id = ?').get(id);

  res.json({
    success: true,
    data: formatWorkorder(updatedWo)
  });
}

function addAuditNote(req, res) {
  const { id } = req.params;
  const { content } = req.body;
  const userRole = req.user.role;
  const username = req.user.username;

  const validation = validateWorkorderExistence(id);
  if (!validation.valid) {
    return res.status(404).json({ success: false, error: validation.error, code: validation.code });
  }

  if (!content || !content.trim()) {
    return res.status(400).json({ success: false, error: '备注内容不能为空', code: 'MISSING_CONTENT' });
  }

  const noteId = 'note_' + uuidv4().slice(0, 8);
  db.prepare(`
    INSERT INTO audit_notes (id, workorder_id, content, author_role, author)
    VALUES (?, ?, ?, ?, ?)
  `).run(noteId, id, content.trim(), userRole, username);

  const note = db.prepare('SELECT * FROM audit_notes WHERE id = ?').get(noteId);

  res.status(201).json({
    success: true,
    data: {
      ...note,
      author_role_name: ROLE_NAMES[note.author_role]
    }
  });
}

module.exports = {
  getWorkorders,
  getWorkorderDetail,
  createWorkorder,
  scheduleProduction,
  issueMaterial,
  reportCompletion,
  submitForReview,
  reviewApprove,
  reviewReject,
  factoryConfirm,
  addAuditNote,
  formatWorkorder,
  parseJsonField
};
