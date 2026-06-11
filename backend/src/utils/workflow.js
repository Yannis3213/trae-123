const dayjs = require('dayjs');
const db = require('./db');
const {
  NODES,
  STATUSES,
  OPERATION_TYPES,
  EXCEPTION_TYPES,
  NODE_DEADLINE_DAYS,
  NODE_HANDLER_ROLES,
  NODE_REQUIRED_EVIDENCE,
  EVIDENCE_TYPE_LABELS
} = require('./constants');

const getDeadline = (node) => {
  const days = NODE_DEADLINE_DAYS[node] || 3;
  return dayjs().add(days, 'day').format('YYYY-MM-DD HH:mm:ss');
};

const checkEvidence = (formId, node) => {
  const required = NODE_REQUIRED_EVIDENCE[node] || [];
  if (required.length === 0) return { complete: true, missing: [] };

  const existingEvidence = db.prepare(`
    SELECT DISTINCT evidence_type FROM attachments WHERE form_id = ?
  `).all(formId).map(a => a.evidence_type);

  const missing = required.filter(e => !existingEvidence.includes(e));

  return {
    complete: missing.length === 0,
    missing,
    missingLabels: missing.map(m => EVIDENCE_TYPE_LABELS[m])
  };
};

const checkTimeout = (deadline) => {
  if (!deadline) return { isTimeout: false, isNearDeadline: false, daysRemaining: 999 };

  const now = dayjs();
  const deadlineTime = dayjs(deadline);
  const diffDays = deadlineTime.diff(now, 'day');

  return {
    isTimeout: diffDays < 0,
    isNearDeadline: diffDays >= 0 && diffDays <= 1,
    daysRemaining: diffDays
  };
};

const validateOperation = (form, operation, user) => {
  const errors = [];

  if (form.status === STATUSES.ARCHIVED) {
    errors.push({
      type: EXCEPTION_TYPES.STATUS_CONFLICT,
      message: '入驻单已归档，无法进行任何操作'
    });
    return { valid: false, errors };
  }

  const requiredRole = NODE_HANDLER_ROLES[form.current_node];
  if (requiredRole && requiredRole !== user.role) {
    errors.push({
      type: EXCEPTION_TYPES.PERMISSION_DENIED,
      message: `当前节点[${form.current_node}]需要角色[${requiredRole}]，您的角色[${user.role}]无操作权限`
    });
  }

  if (form.current_handler && form.current_handler !== user.username) {
    errors.push({
      type: EXCEPTION_TYPES.PERMISSION_DENIED,
      message: `当前处理人为[${form.current_handler}]，您不是指定处理人，无权操作`
    });
  }

  const { isTimeout } = checkTimeout(form.deadline);
  if (isTimeout && ![OPERATION_TYPES.SUPPLEMENT, OPERATION_TYPES.RETURN_SUPPLEMENT].includes(operation)) {
    errors.push({
      type: EXCEPTION_TYPES.TIMEOUT,
      message: '入驻单已超时，需先进行补正操作'
    });
  }

  return { valid: errors.length === 0, errors };
};

const recordProcessing = (tx, params) => {
  const {
    formId,
    operationType,
    operator,
    operatorRole,
    fromNode,
    toNode,
    fromStatus,
    toStatus,
    opinion,
    version
  } = params;

  tx.prepare(`
    INSERT INTO processing_records (
      form_id, operation_type, operator, operator_role,
      from_node, to_node, from_status, to_status, opinion, version
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    formId, operationType, operator, operatorRole,
    fromNode, toNode, fromStatus, toStatus, opinion, version
  );
};

const recordException = (tx, params) => {
  const {
    formId,
    exceptionType,
    exceptionDetail,
    exceptionNode,
    createdBy
  } = params;

  tx.prepare(`
    INSERT INTO exception_reasons (
      form_id, exception_type, exception_detail, exception_node, created_by
    ) VALUES (?, ?, ?, ?, ?)
  `).run(formId, exceptionType, exceptionDetail, exceptionNode, createdBy);
};

const updateFormStatus = (tx, params) => {
  const {
    formId,
    currentNode,
    status,
    currentHandler,
    previousHandler,
    previousOpinion,
    previousAttachmentId,
    deadline
  } = params;

  const existing = tx.prepare('SELECT * FROM merchant_entry_forms WHERE id = ?').get(formId);

  tx.prepare(`
    UPDATE merchant_entry_forms SET
      current_node = ?,
      status = ?,
      version = version + 1,
      current_handler = ?,
      previous_handler = ?,
      previous_opinion = ?,
      previous_attachment_id = ?,
      deadline = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(
    currentNode, status, currentHandler,
    previousHandler || existing.previous_handler,
    previousOpinion || existing.previous_opinion,
    previousAttachmentId || existing.previous_attachment_id,
    deadline || existing.deadline,
    formId
  );

  return existing.version + 1;
};

const getNextNodeAndHandler = (currentNode) => {
  const flow = {
    [NODES.ENTRY_REGISTRATION]: {
      nextNode: NODES.QUALIFICATION_AUDIT,
      handlerRole: NODE_HANDLER_ROLES[NODES.QUALIFICATION_AUDIT]
    },
    [NODES.QUALIFICATION_AUDIT]: {
      nextNode: NODES.ENTRY_FORM_REGISTRATION,
      handlerRole: NODE_HANDLER_ROLES[NODES.ENTRY_FORM_REGISTRATION]
    },
    [NODES.ENTRY_FORM_REGISTRATION]: {
      nextNode: NODES.FINAL_REVIEW,
      handlerRole: NODE_HANDLER_ROLES[NODES.FINAL_REVIEW]
    },
    [NODES.FINAL_REVIEW]: {
      nextNode: NODES.ARCHIVED,
      handlerRole: null
    }
  };

  return flow[currentNode] || null;
};

const getFormWithDetails = (formId) => {
  const form = db.prepare('SELECT * FROM merchant_entry_forms WHERE id = ?').get(formId);
  if (!form) return null;

  const attachments = db.prepare('SELECT * FROM attachments WHERE form_id = ? ORDER BY created_at DESC').all(formId);
  const records = db.prepare('SELECT * FROM processing_records WHERE form_id = ? ORDER BY created_at DESC').all(formId);
  const auditNotes = db.prepare('SELECT * FROM audit_notes WHERE form_id = ? ORDER BY created_at DESC').all(formId);
  const exceptions = db.prepare('SELECT * FROM exception_reasons WHERE form_id = ? ORDER BY created_at DESC').all(formId);

  const timeoutInfo = checkTimeout(form.deadline);
  const evidenceInfo = checkEvidence(formId, form.current_node);

  return {
    ...form,
    attachments,
    processingRecords: records,
    auditNotes,
    exceptions,
    timeoutInfo,
    evidenceInfo
  };
};

module.exports = {
  getDeadline,
  checkEvidence,
  checkTimeout,
  validateOperation,
  recordProcessing,
  recordException,
  updateFormStatus,
  getNextNodeAndHandler,
  getFormWithDetails
};
