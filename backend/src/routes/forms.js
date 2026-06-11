const db = require('../utils/db');
const {
  ROLES, NODES, NODE_LABELS, STATUSES, STATUS_LABELS,
  OPERATION_TYPES, EXCEPTION_TYPES, EXCEPTION_TYPE_LABELS,
  EVIDENCE_TYPES, EVIDENCE_TYPE_LABELS, NODE_HANDLER_ROLES, BUSINESS_TYPES
} = require('../utils/constants');
const {
  getDeadline, checkEvidence, checkTimeout, validateOperation,
  recordProcessing, recordException, resolveExceptions, updateFormStatus,
  getNextNodeAndHandler, getNextHandler, getFormWithDetails,
  getSupplementInfo, OPERATION_MATRIX, SUPPLEMENT_RETURN_MAP
} = require('../utils/workflow');

async function routes(fastify) {
  fastify.get('/forms', { preHandler: [fastify.authenticate] }, async (request) => {
    const { page = 1, pageSize = 10, status, currentNode, keyword, deadlineGroup, businessType } = request.query;
    const user = request.user;
    const offset = (page - 1) * pageSize;

    let whereClause = 'WHERE 1=1';
    const params = [];

    if (user.role === ROLES.MERCHANT_REGISTRAR) {
      whereClause += ` AND (
        current_node IN ('${NODES.ENTRY_REGISTRATION}', '${NODES.ENTRY_FORM_REGISTRATION}')
        OR created_by = ?
      )`;
      params.push(user.username);
    } else if (user.role === ROLES.AUDIT_SUPERVISOR) {
      whereClause += ` AND current_node IN ('${NODES.QUALIFICATION_AUDIT}')`;
    } else if (user.role === ROLES.PLATFORM_LEADER) {
      whereClause += ` AND current_node IN ('${NODES.FINAL_REVIEW}', '${NODES.ARCHIVED}')`;
    }

    if (status) { whereClause += ' AND status = ?'; params.push(status); }
    if (currentNode) { whereClause += ' AND current_node = ?'; params.push(currentNode); }
    if (keyword) {
      whereClause += ' AND (merchant_name LIKE ? OR form_no LIKE ? OR contact_name LIKE ?)';
      const kw = `%${keyword}%`; params.push(kw, kw, kw);
    }
    if (businessType) { whereClause += ' AND business_type = ?'; params.push(businessType); }

    if (deadlineGroup) {
      const now = new Date().toISOString();
      if (deadlineGroup === 'overdue') {
        whereClause += ' AND deadline IS NOT NULL AND deadline < ? AND status != ?';
        params.push(now, STATUSES.ARCHIVED);
      } else if (deadlineGroup === 'near') {
        whereClause += ` AND deadline IS NOT NULL AND deadline >= ? AND deadline <= datetime('now', '+1 day') AND status != ?`;
        params.push(now, STATUSES.ARCHIVED);
      } else if (deadlineGroup === 'normal') {
        whereClause += ` AND (deadline IS NULL OR deadline > datetime('now', '+1 day')) AND status != ?`;
        params.push(STATUSES.ARCHIVED);
      }
    }

    const { total } = db.prepare(`SELECT COUNT(*) as total FROM merchant_entry_forms ${whereClause}`).get(...params);
    const forms = db.prepare(`SELECT * FROM merchant_entry_forms ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`).all(...params, pageSize, offset);

    const statsRaw = db.prepare(`SELECT status, current_node, COUNT(*) as count FROM merchant_entry_forms ${whereClause} GROUP BY status, current_node`).all(...params);

    const enhancedForms = forms.map(form => {
      const timeoutInfo = checkTimeout(form.deadline);
      return { ...form, statusLabel: STATUS_LABELS[form.status], currentNodeLabel: NODE_LABELS[form.current_node], timeoutInfo };
    });

    const statusStats = {};
    const nodeStats = {};
    statsRaw.forEach(s => {
      statusStats[s.status] = (statusStats[s.status] || 0) + s.count;
      nodeStats[s.current_node] = (nodeStats[s.current_node] || 0) + s.count;
    });

    return {
      success: true,
      data: {
        list: enhancedForms,
        pagination: { page: parseInt(page), pageSize: parseInt(pageSize), total, totalPages: Math.ceil(total / pageSize) },
        stats: { byStatus: statusStats, byNode: nodeStats }
      }
    };
  });

  fastify.get('/forms/:id', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params;
    const form = getFormWithDetails(id);
    if (!form) {
      return reply.status(404).send({ success: false, error: { type: EXCEPTION_TYPES.MATERIAL_MISSING, message: '入驻单不存在' } });
    }

    const user = request.user;
    const requiredRole = NODE_HANDLER_ROLES[form.current_node];
    const canOperate = !requiredRole || requiredRole === user.role;

    return {
      success: true,
      data: {
        form: {
          ...form,
          statusLabel: STATUS_LABELS[form.status],
          currentNodeLabel: NODE_LABELS[form.current_node],
          canOperate,
          attachments: form.attachments.map(a => ({ ...a, evidenceTypeLabel: EVIDENCE_TYPE_LABELS[a.evidence_type] })),
          processingRecords: form.processingRecords.map(r => ({
            ...r,
            operatorRoleLabel: r.operator_role,
            fromNodeLabel: r.from_node ? NODE_LABELS[r.from_node] : '',
            toNodeLabel: r.to_node ? NODE_LABELS[r.to_node] : '',
            fromStatusLabel: r.from_status ? STATUS_LABELS[r.from_status] : '',
            toStatusLabel: r.to_status ? STATUS_LABELS[r.to_status] : ''
          })),
          exceptions: form.exceptions.map(e => ({ ...e, exceptionTypeLabel: EXCEPTION_TYPE_LABELS[e.exception_type] }))
        }
      }
    };
  });

  fastify.get('/forms/:id/supplement-info', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params;
    const info = getSupplementInfo(id);
    if (!info) {
      return reply.status(404).send({ success: false, error: { type: EXCEPTION_TYPES.MATERIAL_MISSING, message: '入驻单不存在' } });
    }
    return { success: true, data: { supplementInfo: info } };
  });

  fastify.post('/forms', { preHandler: [fastify.authenticate, fastify.requireRole(ROLES.MERCHANT_REGISTRAR)] }, async (request, reply) => {
    const { body } = request;
    const user = request.user;

    const requiredFields = ['merchantName', 'contactName', 'contactPhone', 'businessType'];
    const missingFields = requiredFields.filter(f => !body[f]);
    if (missingFields.length > 0) {
      return reply.status(400).send({ success: false, error: { type: EXCEPTION_TYPES.MATERIAL_MISSING, message: `必填字段缺失: ${missingFields.join(', ')}` } });
    }
    if (!BUSINESS_TYPES.includes(body.businessType)) {
      return reply.status(400).send({ success: false, error: { type: EXCEPTION_TYPES.MATERIAL_MISSING, message: `业务类型必须是: ${BUSINESS_TYPES.join(', ')}` } });
    }

    const formNo = `ME${Date.now()}${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;

    const tx = db.transaction(() => {
      const result = db.prepare(`
        INSERT INTO merchant_entry_forms (
          form_no, merchant_name, credit_code, contact_name, contact_phone,
          contact_email, business_type, registered_capital, business_scope,
          business_license_no, tax_registration_no, organization_code,
          legal_person_name, legal_person_id_card, bank_account_name,
          bank_account_no, bank_name, warehouse_address, office_address,
          current_node, status, current_handler, deadline, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        formNo, body.merchantName, body.creditCode || null, body.contactName,
        body.contactPhone, body.contactEmail || null, body.businessType,
        body.registeredCapital || null, body.businessScope || null,
        body.businessLicenseNo || null, body.taxRegistrationNo || null,
        body.organizationCode || null, body.legalPersonName || null,
        body.legalPersonIdCard || null, body.bankAccountName || null,
        body.bankAccountNo || null, body.bankName || null,
        body.warehouseAddress || null, body.officeAddress || null,
        NODES.ENTRY_REGISTRATION, STATUSES.PENDING_SIGN,
        user.username, getDeadline(NODES.ENTRY_REGISTRATION), user.username
      );

      const formId = result.lastInsertRowid;

      recordProcessing(db, {
        formId, operationType: OPERATION_TYPES.CREATE, operator: user.username,
        operatorRole: user.role, fromNode: null, toNode: NODES.ENTRY_REGISTRATION,
        fromStatus: null, toStatus: STATUSES.PENDING_SIGN, opinion: '创建商家入驻单', version: 1
      });

      if (body.attachments && body.attachments.length > 0) {
        const attachStmt = db.prepare(`INSERT INTO attachments (form_id, file_name, file_type, file_size, file_path, upload_by, evidence_type, remark) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
        body.attachments.forEach(att => {
          attachStmt.run(formId, att.fileName, att.fileType || null, att.fileSize || 0, att.filePath || null, user.username, att.evidenceType, att.remark || null);
        });
      }
      return formId;
    });

    try {
      const formId = tx();
      return { success: true, data: { id: formId, formNo } };
    } catch (err) {
      return reply.status(500).send({ success: false, error: { type: EXCEPTION_TYPES.STATUS_CONFLICT, message: `创建失败: ${err.message}` } });
    }
  });

  fastify.post('/forms/:id/operation', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params;
    const { operation, opinion, version, supplementData, attachments } = request.body;
    const user = request.user;

    const form = db.prepare('SELECT * FROM merchant_entry_forms WHERE id = ?').get(id);
    if (!form) {
      return reply.status(404).send({ success: false, error: { type: EXCEPTION_TYPES.MATERIAL_MISSING, message: '入驻单不存在' } });
    }

    if (version !== undefined && version !== form.version) {
      recordException(db, {
        formId: id, exceptionType: EXCEPTION_TYPES.VERSION_CONFLICT,
        exceptionDetail: `提交版本${version}与当前版本${form.version}冲突，请刷新后重试`,
        exceptionNode: form.current_node, createdBy: user.username
      });
      return reply.status(409).send({ success: false, error: { type: EXCEPTION_TYPES.VERSION_CONFLICT, message: `版本冲突：当前版本为${form.version}，请刷新页面后重试` } });
    }

    const validation = validateOperation(form, operation, user);
    if (!validation.valid) {
      validation.errors.forEach(err => {
        recordException(db, { formId: id, exceptionType: err.type, exceptionDetail: err.message, exceptionNode: form.current_node, createdBy: user.username });
      });
      return reply.status(400).send({ success: false, error: validation.errors[0] });
    }

    const skipEvidenceCheck = [OPERATION_TYPES.SUPPLEMENT, OPERATION_TYPES.RETURN_SUPPLEMENT, OPERATION_TYPES.SIGN, OPERATION_TYPES.AUDIT_REJECT, OPERATION_TYPES.FINAL_REVIEW_REJECT].includes(operation);

    const matrix = OPERATION_MATRIX[operation];
    if (!matrix) {
      return reply.status(400).send({ success: false, error: { type: EXCEPTION_TYPES.STATUS_CONFLICT, message: `不支持的操作: ${operation}` } });
    }

    const fromStatus = form.status;
    const fromNode = form.current_node;

    const tx = db.transaction(() => {
      let newVersion = form.version;
      let attachmentId = null;

      if (attachments && attachments.length > 0) {
        const attachStmt = db.prepare(`INSERT INTO attachments (form_id, file_name, file_type, file_size, file_path, upload_by, evidence_type, remark) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
        attachments.forEach(att => {
          const result = attachStmt.run(id, att.fileName, att.fileType || null, att.fileSize || 0, att.filePath || null, user.username, att.evidenceType, att.remark || null);
          if (!attachmentId) attachmentId = result.lastInsertRowid;
        });
      }

      if (!skipEvidenceCheck) {
        const postAttachEvidenceCheck = checkEvidence(id, form.current_node);
        if (!postAttachEvidenceCheck.complete) {
          recordException(db, {
            formId: id, exceptionType: EXCEPTION_TYPES.EVIDENCE_MISSING,
            exceptionDetail: `当前节点缺少必要证据: ${postAttachEvidenceCheck.missingLabels.join(', ')}`,
            exceptionNode: form.current_node, createdBy: user.username
          });
          throw new Error(`缺少必要证据材料: ${postAttachEvidenceCheck.missingLabels.join(', ')}，请先补正`);
        }
      }

      if (supplementData) {
        const fieldMap = {
          merchantName: 'merchant_name', creditCode: 'credit_code', contactName: 'contact_name',
          contactPhone: 'contact_phone', contactEmail: 'contact_email', businessType: 'business_type',
          registeredCapital: 'registered_capital', businessScope: 'business_scope',
          businessLicenseNo: 'business_license_no', taxRegistrationNo: 'tax_registration_no',
          organizationCode: 'organization_code', legalPersonName: 'legal_person_name',
          legalPersonIdCard: 'legal_person_id_card', bankAccountName: 'bank_account_name',
          bankAccountNo: 'bank_account_no', bankName: 'bank_name',
          warehouseAddress: 'warehouse_address', officeAddress: 'office_address'
        };
        const updateFields = [];
        const updateValues = [];
        Object.keys(supplementData).forEach(key => {
          const dbField = fieldMap[key];
          if (dbField) { updateFields.push(`${dbField} = ?`); updateValues.push(supplementData[key]); }
        });
        if (updateFields.length > 0) {
          updateValues.push(id);
          db.prepare(`UPDATE merchant_entry_forms SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(...updateValues);
        }
      }

      let toNode = fromNode;
      let toStatus = matrix.resultStatus(form);
      let newHandler = form.current_handler;
      let newDeadline = form.deadline;

      switch (operation) {
        case OPERATION_TYPES.SIGN: {
          toNode = fromNode;
          toStatus = matrix.resultStatus(form);
          newHandler = user.username;
          newDeadline = form.deadline;
          break;
        }
        case OPERATION_TYPES.SUBMIT_AUDIT: {
          const next = getNextNodeAndHandler(fromNode);
          if (!next) throw new Error('无法确定下一节点');
          const nextHandlerUser = getNextHandler(db, next.handlerRole);
          toNode = next.nextNode;
          toStatus = STATUSES.PENDING_AUDIT;
          newHandler = nextHandlerUser ? nextHandlerUser.username : null;
          newDeadline = getDeadline(next.nextNode);
          break;
        }
        case OPERATION_TYPES.AUDIT_PASS: {
          const next = getNextNodeAndHandler(fromNode);
          if (!next) throw new Error('无法确定下一节点');
          const nextHandlerUser = getNextHandler(db, next.handlerRole);
          toNode = next.nextNode;
          toStatus = STATUSES.PENDING_REGISTRATION;
          newHandler = nextHandlerUser ? nextHandlerUser.username : null;
          newDeadline = getDeadline(next.nextNode);
          break;
        }
        case OPERATION_TYPES.AUDIT_REJECT: {
          toNode = fromNode;
          toStatus = STATUSES.ABNORMAL_RETURN;
          newHandler = form.created_by || 'registrar';
          newDeadline = getDeadline(fromNode);
          recordException(db, {
            formId: id, exceptionType: EXCEPTION_TYPES.MATERIAL_MISSING,
            exceptionDetail: `审核拒绝: ${opinion || '材料不符合要求'}`,
            exceptionNode: fromNode, createdBy: user.username
          });
          break;
        }
        case OPERATION_TYPES.REGISTER: {
          toNode = fromNode;
          toStatus = STATUSES.REGISTRATION_COMPLETED;
          newHandler = user.username;
          newDeadline = form.deadline;
          break;
        }
        case OPERATION_TYPES.SUBMIT_FINAL_REVIEW: {
          const next = getNextNodeAndHandler(fromNode);
          if (!next) throw new Error('无法确定下一节点');
          const nextHandlerUser = getNextHandler(db, next.handlerRole);
          toNode = next.nextNode;
          toStatus = STATUSES.PENDING_FINAL_REVIEW;
          newHandler = nextHandlerUser ? nextHandlerUser.username : null;
          newDeadline = getDeadline(next.nextNode);
          break;
        }
        case OPERATION_TYPES.FINAL_REVIEW_PASS: {
          toNode = NODES.ARCHIVED;
          toStatus = STATUSES.ARCHIVED;
          newHandler = null;
          newDeadline = null;
          break;
        }
        case OPERATION_TYPES.FINAL_REVIEW_REJECT: {
          toNode = fromNode;
          toStatus = STATUSES.ABNORMAL_RETURN;
          newHandler = form.created_by || 'registrar';
          newDeadline = getDeadline(fromNode);
          recordException(db, {
            formId: id, exceptionType: EXCEPTION_TYPES.MATERIAL_MISSING,
            exceptionDetail: `复核拒绝: ${opinion || '材料不符合要求'}`,
            exceptionNode: fromNode, createdBy: user.username
          });
          break;
        }
        case OPERATION_TYPES.SUPPLEMENT: {
          toNode = fromNode;
          toStatus = matrix.resultStatus(form);

          const nodeRole = NODE_HANDLER_ROLES[fromNode];
          const handlerUser = getNextHandler(db, nodeRole);
          newHandler = handlerUser ? handlerUser.username : user.username;
          newDeadline = getDeadline(fromNode);

          recordException(db, {
            formId: id, exceptionType: EXCEPTION_TYPES.EVIDENCE_MISSING,
            exceptionDetail: `补正操作：原状态[${STATUS_LABELS[fromStatus]}]→新状态[${STATUS_LABELS[toStatus]}]，${opinion || '补正材料'}`,
            exceptionNode: fromNode, createdBy: user.username
          });

          resolveExceptions(db, id, user.username, opinion || `补正完成：${STATUS_LABELS[fromStatus]}→${STATUS_LABELS[toStatus]}`);
          break;
        }
        case OPERATION_TYPES.RETURN_SUPPLEMENT: {
          toNode = fromNode;
          toStatus = STATUSES.SUPPLEMENT_REQUIRED;

          const returnInfo = SUPPLEMENT_RETURN_MAP[fromNode];
          if (returnInfo) {
            newHandler = returnInfo.returnToHandler(form);
          } else {
            newHandler = form.created_by || 'registrar';
          }
          newDeadline = getDeadline(fromNode);

          const evidenceInfo = checkEvidence(id, fromNode);
          const missingDesc = evidenceInfo.missingLabels.length > 0 ? `，缺少证据: ${evidenceInfo.missingLabels.join('、')}` : '';

          recordException(db, {
            formId: id, exceptionType: EXCEPTION_TYPES.MATERIAL_MISSING,
            exceptionDetail: `退回补正: ${opinion || '材料不完整，需要补充'}${missingDesc}`,
            exceptionNode: fromNode, createdBy: user.username
          });
          break;
        }
        case OPERATION_TYPES.ARCHIVE: {
          toNode = NODES.ARCHIVED;
          toStatus = STATUSES.ARCHIVED;
          newHandler = null;
          newDeadline = null;
          break;
        }
        default:
          throw new Error(`不支持的操作类型: ${operation}`);
      }

      newVersion = updateFormStatus(db, {
        formId: id, currentNode: toNode, status: toStatus,
        currentHandler: newHandler, previousHandler: user.username,
        previousOpinion: opinion, previousAttachmentId: attachmentId, deadline: newDeadline
      });

      if (toStatus === STATUSES.ARCHIVED) {
        db.prepare(`UPDATE merchant_entry_forms SET archived_at = CURRENT_TIMESTAMP WHERE id = ?`).run(id);
      }

      recordProcessing(db, {
        formId: id, operationType: operation, operator: user.username,
        operatorRole: user.role, fromNode, toNode, fromStatus, toStatus,
        opinion: opinion || `${operation}操作`, version: newVersion
      });

      return { newVersion, toNode, toStatus };
    });

    try {
      const result = tx();
      const updatedForm = getFormWithDetails(id);

      return {
        success: true,
        data: {
          form: {
            ...updatedForm,
            statusLabel: STATUS_LABELS[updatedForm.status],
            currentNodeLabel: NODE_LABELS[updatedForm.current_node],
            version: result.newVersion
          },
          transition: {
            fromNode, fromStatus,
            toNode: result.toNode,
            toStatus: result.toStatus,
            toNodeLabel: NODE_LABELS[result.toNode],
            toStatusLabel: STATUS_LABELS[result.toStatus]
          },
          message: '操作成功'
        }
      };
    } catch (err) {
      return reply.status(500).send({ success: false, error: { type: EXCEPTION_TYPES.STATUS_CONFLICT, message: `操作失败: ${err.message}` } });
    }
  });

  fastify.get('/forms/constants', { preHandler: [fastify.authenticate] }, async () => {
    return {
      success: true,
      data: {
        statuses: Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label })),
        nodes: Object.entries(NODE_LABELS).map(([value, label]) => ({ value, label })),
        evidenceTypes: Object.entries(EVIDENCE_TYPE_LABELS).map(([value, label]) => ({ value, label })),
        exceptionTypes: Object.entries(EXCEPTION_TYPE_LABELS).map(([value, label]) => ({ value, label })),
        businessTypes: BUSINESS_TYPES.map(t => ({ value: t, label: t })),
        roles: [
          { value: ROLES.MERCHANT_REGISTRAR, label: '商家入驻登记员' },
          { value: ROLES.AUDIT_SUPERVISOR, label: '商家入驻审核主管' },
          { value: ROLES.PLATFORM_LEADER, label: 'B2B批发平台复核负责人' }
        ]
      }
    };
  });

  fastify.get('/forms/statistics', { preHandler: [fastify.authenticate] }, async (request) => {
    const user = request.user;
    let whereClause = 'WHERE 1=1';
    const params = [];

    if (user.role === ROLES.MERCHANT_REGISTRAR) {
      whereClause += ` AND (current_node IN ('${NODES.ENTRY_REGISTRATION}', '${NODES.ENTRY_FORM_REGISTRATION}') OR created_by = ?)`;
      params.push(user.username);
    } else if (user.role === ROLES.AUDIT_SUPERVISOR) {
      whereClause += ` AND current_node IN ('${NODES.QUALIFICATION_AUDIT}')`;
    } else if (user.role === ROLES.PLATFORM_LEADER) {
      whereClause += ` AND current_node IN ('${NODES.FINAL_REVIEW}', '${NODES.ARCHIVED}')`;
    }

    const sql = `
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = '${STATUSES.PENDING_SIGN}' THEN 1 ELSE 0 END) as pendingSign,
        SUM(CASE WHEN status = '${STATUSES.ABNORMAL_RETURN}' THEN 1 ELSE 0 END) as abnormalReturn,
        SUM(CASE WHEN status = '${STATUSES.SIGN_COMPLETED}' THEN 1 ELSE 0 END) as signCompleted,
        SUM(CASE WHEN status = '${STATUSES.PENDING_AUDIT}' THEN 1 ELSE 0 END) as pendingAudit,
        SUM(CASE WHEN status = '${STATUSES.AUDIT_PASSED}' THEN 1 ELSE 0 END) as auditPassed,
        SUM(CASE WHEN status = '${STATUSES.SUPPLEMENT_REQUIRED}' THEN 1 ELSE 0 END) as supplementRequired,
        SUM(CASE WHEN status = '${STATUSES.ARCHIVED}' THEN 1 ELSE 0 END) as archived,
        SUM(CASE WHEN deadline IS NOT NULL AND deadline < datetime('now') AND status != '${STATUSES.ARCHIVED}' THEN 1 ELSE 0 END) as overdue,
        SUM(CASE WHEN deadline IS NOT NULL AND deadline >= datetime('now') AND deadline <= datetime('now', '+1 day') AND status != '${STATUSES.ARCHIVED}' THEN 1 ELSE 0 END) as nearDeadline
      FROM merchant_entry_forms ${whereClause}
    `;
    const stats = db.prepare(sql).get(...params);
    return { success: true, data: { statistics: stats } };
  });

  fastify.post('/forms/:id/audit-notes', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params;
    const { noteContent } = request.body;
    const user = request.user;

    const form = db.prepare('SELECT id FROM merchant_entry_forms WHERE id = ?').get(id);
    if (!form) {
      return reply.status(404).send({ success: false, error: { type: EXCEPTION_TYPES.MATERIAL_MISSING, message: '入驻单不存在' } });
    }
    if (!noteContent || !noteContent.trim()) {
      return reply.status(400).send({ success: false, error: { type: EXCEPTION_TYPES.MATERIAL_MISSING, message: '备注内容不能为空' } });
    }

    const result = db.prepare(`INSERT INTO audit_notes (form_id, note_content, created_by) VALUES (?, ?, ?)`).run(id, noteContent.trim(), user.username);
    const note = db.prepare('SELECT * FROM audit_notes WHERE id = ?').get(result.lastInsertRowid);
    return { success: true, data: { note } };
  });
}

module.exports = routes;
