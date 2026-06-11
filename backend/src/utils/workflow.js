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
  EVIDENCE_TYPE_LABELS,
  ROLES
} = require('./constants');

const OPERATION_MATRIX = {
  [OPERATION_TYPES.SIGN]: {
    allowedNodes: [NODES.ENTRY_REGISTRATION, NODES.ENTRY_FORM_REGISTRATION],
    allowedStatuses: [STATUSES.PENDING_SIGN, STATUSES.ABNORMAL_RETURN, STATUSES.SUPPLEMENT_REQUIRED],
    allowedRoles: [ROLES.MERCHANT_REGISTRAR],
    requireHandler: true,
    resultStatus: (form) => {
      if (form.current_node === NODES.ENTRY_FORM_REGISTRATION) return STATUSES.PENDING_REGISTRATION;
      return STATUSES.SIGN_COMPLETED;
    }
  },
  [OPERATION_TYPES.SUBMIT_AUDIT]: {
    allowedNodes: [NODES.ENTRY_REGISTRATION],
    allowedStatuses: [STATUSES.SIGN_COMPLETED],
    allowedRoles: [ROLES.MERCHANT_REGISTRAR],
    requireHandler: true,
    resultStatus: () => STATUSES.PENDING_AUDIT
  },
  [OPERATION_TYPES.AUDIT_PASS]: {
    allowedNodes: [NODES.QUALIFICATION_AUDIT],
    allowedStatuses: [STATUSES.PENDING_AUDIT],
    allowedRoles: [ROLES.AUDIT_SUPERVISOR],
    requireHandler: true,
    resultStatus: () => STATUSES.PENDING_REGISTRATION
  },
  [OPERATION_TYPES.AUDIT_REJECT]: {
    allowedNodes: [NODES.QUALIFICATION_AUDIT],
    allowedStatuses: [STATUSES.PENDING_AUDIT],
    allowedRoles: [ROLES.AUDIT_SUPERVISOR],
    requireHandler: true,
    resultStatus: () => STATUSES.ABNORMAL_RETURN
  },
  [OPERATION_TYPES.REGISTER]: {
    allowedNodes: [NODES.ENTRY_FORM_REGISTRATION],
    allowedStatuses: [STATUSES.PENDING_REGISTRATION],
    allowedRoles: [ROLES.MERCHANT_REGISTRAR],
    requireHandler: true,
    resultStatus: () => STATUSES.REGISTRATION_COMPLETED
  },
  [OPERATION_TYPES.SUBMIT_FINAL_REVIEW]: {
    allowedNodes: [NODES.ENTRY_FORM_REGISTRATION],
    allowedStatuses: [STATUSES.REGISTRATION_COMPLETED],
    allowedRoles: [ROLES.MERCHANT_REGISTRAR],
    requireHandler: true,
    resultStatus: () => STATUSES.PENDING_FINAL_REVIEW
  },
  [OPERATION_TYPES.FINAL_REVIEW_PASS]: {
    allowedNodes: [NODES.FINAL_REVIEW],
    allowedStatuses: [STATUSES.PENDING_FINAL_REVIEW],
    allowedRoles: [ROLES.PLATFORM_LEADER],
    requireHandler: true,
    resultStatus: () => STATUSES.ARCHIVED
  },
  [OPERATION_TYPES.FINAL_REVIEW_REJECT]: {
    allowedNodes: [NODES.FINAL_REVIEW],
    allowedStatuses: [STATUSES.PENDING_FINAL_REVIEW],
    allowedRoles: [ROLES.PLATFORM_LEADER],
    requireHandler: true,
    resultStatus: () => STATUSES.ABNORMAL_RETURN
  },
  [OPERATION_TYPES.SUPPLEMENT]: {
    allowedNodes: [NODES.ENTRY_REGISTRATION, NODES.QUALIFICATION_AUDIT, NODES.ENTRY_FORM_REGISTRATION, NODES.FINAL_REVIEW],
    allowedStatuses: [STATUSES.ABNORMAL_RETURN, STATUSES.SUPPLEMENT_REQUIRED],
    allowedRoles: [ROLES.MERCHANT_REGISTRAR, ROLES.AUDIT_SUPERVISOR],
    requireHandler: false,
    resultStatus: (form) => {
      if (form.current_node === NODES.QUALIFICATION_AUDIT) return STATUSES.PENDING_AUDIT;
      if (form.current_node === NODES.ENTRY_FORM_REGISTRATION) return STATUSES.PENDING_REGISTRATION;
      if (form.current_node === NODES.FINAL_REVIEW) return STATUSES.PENDING_FINAL_REVIEW;
      return STATUSES.SIGN_COMPLETED;
    }
  },
  [OPERATION_TYPES.RETURN_SUPPLEMENT]: {
    allowedNodes: [NODES.QUALIFICATION_AUDIT, NODES.ENTRY_FORM_REGISTRATION, NODES.FINAL_REVIEW],
    allowedStatuses: [STATUSES.PENDING_AUDIT, STATUSES.PENDING_REGISTRATION, STATUSES.PENDING_FINAL_REVIEW],
    allowedRoles: [ROLES.AUDIT_SUPERVISOR, ROLES.PLATFORM_LEADER],
    requireHandler: true,
    resultStatus: () => STATUSES.SUPPLEMENT_REQUIRED
  },
  [OPERATION_TYPES.ARCHIVE]: {
    allowedNodes: [NODES.FINAL_REVIEW],
    allowedStatuses: [STATUSES.FINAL_REVIEW_PASSED],
    allowedRoles: [ROLES.PLATFORM_LEADER],
    requireHandler: true,
    resultStatus: () => STATUSES.ARCHIVED
  }
};

const SUPPLEMENT_RETURN_MAP = {
  [NODES.QUALIFICATION_AUDIT]: {
    returnToHandler: (form) => form.created_by || 'registrar',
    returnToRole: ROLES.MERCHANT_REGISTRAR,
    missingEvidenceTypes: [EVIDENCE_TYPE_LABELS.tax_certificate, EVIDENCE_TYPE_LABELS.id_card, EVIDENCE_TYPE_LABELS.business_license]
  },
  [NODES.ENTRY_FORM_REGISTRATION]: {
    returnToHandler: (form) => form.created_by || 'registrar',
    returnToRole: ROLES.MERCHANT_REGISTRAR,
    missingEvidenceTypes: [EVIDENCE_TYPE_LABELS.bank_certificate]
  },
  [NODES.FINAL_REVIEW]: {
    returnToHandler: (form) => form.previous_handler || form.created_by || 'registrar',
    returnToRole: ROLES.MERCHANT_REGISTRAR,
    missingEvidenceTypes: [EVIDENCE_TYPE_LABELS.business_license, EVIDENCE_TYPE_LABELS.tax_certificate, EVIDENCE_TYPE_LABELS.id_card, EVIDENCE_TYPE_LABELS.bank_certificate]
  }
};

const getDeadline = (node) => {
  const days = NODE_DEADLINE_DAYS[node] || 3;
  return dayjs().add(days, 'day').format('YYYY-MM-DD HH:mm:ss');
};

const checkEvidence = (formId, node) => {
  const required = NODE_REQUIRED_EVIDENCE[node] || [];
  if (required.length === 0) return { complete: true, missing: [], missingLabels: [] };

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

const checkDuplicateSubmit = (formId, operation, username) => {
  const recent = db.prepare(`
    SELECT id FROM processing_records
    WHERE form_id = ? AND operation_type = ? AND operator = ?
    AND created_at > datetime('now', '-5 seconds')
    LIMIT 1
  `).get(formId, operation, username);
  return !!recent;
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

  const matrix = OPERATION_MATRIX[operation];
  if (!matrix) {
    errors.push({
      type: EXCEPTION_TYPES.STATUS_CONFLICT,
      message: `不支持的操作类型: ${operation}`
    });
    return { valid: false, errors };
  }

  if (!matrix.allowedNodes.includes(form.current_node)) {
    errors.push({
      type: EXCEPTION_TYPES.STATUS_CONFLICT,
      message: `操作[${operation}]不允许在节点[${form.current_node}]执行，允许的节点: ${matrix.allowedNodes.join(', ')}`
    });
  }

  if (!matrix.allowedStatuses.includes(form.status)) {
    errors.push({
      type: EXCEPTION_TYPES.STATUS_CONFLICT,
      message: `操作[${operation}]不允许在状态[${form.status}]下执行，允许的状态: ${matrix.allowedStatuses.join(', ')}`
    });
  }

  if (!matrix.allowedRoles.includes(user.role)) {
    errors.push({
      type: EXCEPTION_TYPES.PERMISSION_DENIED,
      message: `操作[${operation}]需要角色[${matrix.allowedRoles.join('/')}]，您的角色[${user.role}]无操作权限`
    });
  }

  if (matrix.requireHandler && form.current_handler && form.current_handler !== user.username) {
    errors.push({
      type: EXCEPTION_TYPES.PERMISSION_DENIED,
      message: `当前处理人为[${form.current_handler}]，您不是指定处理人，无权操作`
    });
  }

  if (checkDuplicateSubmit(form.id, operation, user.username)) {
    errors.push({
      type: EXCEPTION_TYPES.DUPLICATE_SUBMIT,
      message: '请勿重复提交，5秒内不允许对同一单据执行相同操作'
    });
  }

  const { isTimeout } = checkTimeout(form.deadline);
  if (isTimeout && operation !== OPERATION_TYPES.SUPPLEMENT && form.status !== STATUSES.SUPPLEMENT_REQUIRED && form.status !== STATUSES.ABNORMAL_RETURN) {
    errors.push({
      type: EXCEPTION_TYPES.TIMEOUT,
      message: '入驻单已超时，需先进行补正操作'
    });
  }

  return { valid: errors.length === 0, errors };
};

const recordProcessing = (tx, params) => {
  const {
    formId, operationType, operator, operatorRole,
    fromNode, toNode, fromStatus, toStatus, opinion, version
  } = params;
  tx.prepare(`
    INSERT INTO processing_records (
      form_id, operation_type, operator, operator_role,
      from_node, to_node, from_status, to_status, opinion, version
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(formId, operationType, operator, operatorRole, fromNode, toNode, fromStatus, toStatus, opinion, version);
};

const recordException = (tx, params) => {
  const {
    formId, exceptionType, exceptionDetail, exceptionNode, createdBy,
    missingTypes, resolutionNote
  } = params;
  tx.prepare(`
    INSERT INTO exception_reasons (
      form_id, exception_type, exception_detail, exception_node, created_by
    ) VALUES (?, ?, ?, ?, ?)
  `).run(formId, exceptionType, exceptionDetail, exceptionNode, createdBy);
};

const resolveExceptions = (tx, formId, username, resolutionNote) => {
  const unresolved = tx.prepare(`
    SELECT id FROM exception_reasons WHERE form_id = ? AND resolved = 0
  `).all(formId);
  unresolved.forEach(e => {
    tx.prepare(`
      UPDATE exception_reasons SET
        resolved = 1,
        resolved_by = ?,
        resolved_at = CURRENT_TIMESTAMP,
        resolution_note = ?
      WHERE id = ?
    `).run(username, resolutionNote || '补正完成，异常已解决', e.id);
  });
};

const updateFormStatus = (tx, params) => {
  const {
    formId, currentNode, status, currentHandler,
    previousHandler, previousOpinion, previousAttachmentId, deadline
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

const getNextHandler = (tx, role, excludeUser) => {
  if (!role) return null;
  if (excludeUser) {
    return tx.prepare(`SELECT username FROM users WHERE role = ? AND username != ? ORDER BY id LIMIT 1`).get(role, excludeUser);
  }
  return tx.prepare(`SELECT username FROM users WHERE role = ? ORDER BY id LIMIT 1`).get(role);
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

  const supplementInfo = buildSupplementInfo(form, evidenceInfo);

  return {
    ...form,
    attachments,
    processingRecords: records,
    auditNotes,
    exceptions,
    timeoutInfo,
    evidenceInfo,
    supplementInfo
  };
};

const buildSupplementInfo = (form, evidenceInfo) => {
  const nodeFieldMap = {
    [NODES.ENTRY_REGISTRATION]: {
      requiredFields: ['businessLicenseNo', 'taxRegistrationNo', 'organizationCode'],
      fieldLabels: { businessLicenseNo: '营业执照号', taxRegistrationNo: '税务登记号', organizationCode: '组织机构代码' },
      requiredEvidence: [EVIDENCE_TYPE_LABELS.business_license]
    },
    [NODES.QUALIFICATION_AUDIT]: {
      requiredFields: ['taxRegistrationNo', 'legalPersonName', 'legalPersonIdCard'],
      fieldLabels: { taxRegistrationNo: '税务登记号', legalPersonName: '法人姓名', legalPersonIdCard: '法人身份证号' },
      requiredEvidence: [EVIDENCE_TYPE_LABELS.tax_certificate, EVIDENCE_TYPE_LABELS.id_card]
    },
    [NODES.ENTRY_FORM_REGISTRATION]: {
      requiredFields: ['bankAccountName', 'bankAccountNo', 'bankName'],
      fieldLabels: { bankAccountName: '银行账户名', bankAccountNo: '银行账号', bankName: '开户银行' },
      requiredEvidence: [EVIDENCE_TYPE_LABELS.bank_certificate]
    },
    [NODES.FINAL_REVIEW]: {
      requiredFields: [],
      fieldLabels: {},
      requiredEvidence: [EVIDENCE_TYPE_LABELS.business_license, EVIDENCE_TYPE_LABELS.tax_certificate, EVIDENCE_TYPE_LABELS.id_card, EVIDENCE_TYPE_LABELS.bank_certificate]
    }
  };

  const nodeInfo = nodeFieldMap[form.current_node] || { requiredFields: [], fieldLabels: {}, requiredEvidence: [] };

  const missingFields = nodeInfo.requiredFields.filter(f => !form[fieldToDbField(f)]);
  const missingFieldLabels = missingFields.map(f => nodeInfo.fieldLabels[f]);

  return {
    canSupplement: [STATUSES.ABNORMAL_RETURN, STATUSES.SUPPLEMENT_REQUIRED].includes(form.status),
    currentNode: form.current_node,
    requiredFields: nodeInfo.requiredFields,
    fieldLabels: nodeInfo.fieldLabels,
    missingFields,
    missingFieldLabels,
    missingEvidence: evidenceInfo.missingLabels,
    requiredEvidence: nodeInfo.requiredEvidence
  };
};

const fieldToDbField = (field) => {
  const map = {
    businessLicenseNo: 'business_license_no',
    taxRegistrationNo: 'tax_registration_no',
    organizationCode: 'organization_code',
    legalPersonName: 'legal_person_name',
    legalPersonIdCard: 'legal_person_id_card',
    bankAccountName: 'bank_account_name',
    bankAccountNo: 'bank_account_no',
    bankName: 'bank_name'
  };
  return map[field] || field;
};

const getSupplementInfo = (formId) => {
  const form = db.prepare('SELECT * FROM merchant_entry_forms WHERE id = ?').get(formId);
  if (!form) return null;
  const evidenceInfo = checkEvidence(formId, form.current_node);
  return buildSupplementInfo(form, evidenceInfo);
};

module.exports = {
  getDeadline,
  checkEvidence,
  checkTimeout,
  checkDuplicateSubmit,
  validateOperation,
  recordProcessing,
  recordException,
  resolveExceptions,
  updateFormStatus,
  getNextNodeAndHandler,
  getNextHandler,
  getFormWithDetails,
  getSupplementInfo,
  buildSupplementInfo,
  OPERATION_MATRIX,
  SUPPLEMENT_RETURN_MAP
};
