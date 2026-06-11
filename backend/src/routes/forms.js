const db = require('../utils/db');
const {
  ROLES,
  NODES,
  NODE_LABELS,
  STATUSES,
  STATUS_LABELS,
  OPERATION_TYPES,
  EXCEPTION_TYPES,
  EXCEPTION_TYPE_LABELS,
  EVIDENCE_TYPES,
  EVIDENCE_TYPE_LABELS,
  NODE_HANDLER_ROLES,
  BUSINESS_TYPES
} = require('../utils/constants');
const {
  getDeadline,
  checkEvidence,
  checkTimeout,
  validateOperation,
  recordProcessing,
  recordException,
  updateFormStatus,
  getNextNodeAndHandler,
  getFormWithDetails
} = require('../utils/workflow');

async function routes(fastify) {
  fastify.get('/forms', { preHandler: [fastify.authenticate] }, async (request) => {
    const {
      page = 1,
      pageSize = 10,
      status,
      currentNode,
      keyword,
      deadlineGroup,
      businessType
    } = request.query;

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
      whereClause += ` AND current_node = '${NODES.QUALIFICATION_AUDIT}'`;
    } else if (user.role === ROLES.PLATFORM_LEADER) {
      whereClause += ` AND current_node IN ('${NODES.FINAL_REVIEW}', '${NODES.ARCHIVED}')`;
    }

    if (status) {
      whereClause += ' AND status = ?';
      params.push(status);
    }

    if (currentNode) {
      whereClause += ' AND current_node = ?';
      params.push(currentNode);
    }

    if (keyword) {
      whereClause += ' AND (merchant_name LIKE ? OR form_no LIKE ? OR contact_name LIKE ?)';
      const kw = `%${keyword}%`;
      params.push(kw, kw, kw);
    }

    if (businessType) {
      whereClause += ' AND business_type = ?';
      params.push(businessType);
    }

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

    const countSql = `SELECT COUNT(*) as total FROM merchant_entry_forms ${whereClause}`;
    const { total } = db.prepare(countSql).get(...params);

    const listSql = `
      SELECT * FROM merchant_entry_forms
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `;
    const forms = db.prepare(listSql).all(...params, pageSize, offset);

    const statsSql = `
      SELECT status, current_node, COUNT(*) as count
      FROM merchant_entry_forms
      ${whereClause}
      GROUP BY status, current_node
    `;
    const statsRaw = db.prepare(statsSql).all(...params);

    const deadlineStatsSql = `
      SELECT
        CASE
          WHEN deadline IS NULL OR deadline > datetime('now', '+1 day') THEN 'normal'
          WHEN deadline >= datetime('now') AND deadline <= datetime('now', '+1 day') THEN 'near'
          WHEN deadline < datetime('now') THEN 'overdue'
          ELSE 'normal'
        END as deadline_group,
        COUNT(*) as count
      FROM merchant_entry_forms
      ${whereClause.replace('WHERE 1=1', 'WHERE status != ?')}
      GROUP BY deadline_group
    `;
    const deadlineParams = user.role === ROLES.MERCHANT_REGISTRAR
      ? [STATUSES.ARCHIVED, user.username]
      : [STATUSES.ARCHIVED];

    const deadlineStats = db.prepare(deadlineStatsSql).all(...deadlineParams);

    const enhancedForms = forms.map(form => {
      const timeoutInfo = checkTimeout(form.deadline);
      return {
        ...form,
        statusLabel: STATUS_LABELS[form.status],
        currentNodeLabel: NODE_LABELS[form.current_node],
        timeoutInfo
      };
    });

    const statusStats = {};
    const nodeStats = {};
    statsRaw.forEach(s => {
      statusStats[s.status] = (statusStats[s.status] || 0) + s.count;
      nodeStats[s.current_node] = (nodeStats[s.current_node] || 0) + s.count;
    });

    const deadlineGroupStats = { normal: 0, near: 0, overdue: 0 };
    deadlineStats.forEach(d => {
      deadlineGroupStats[d.deadline_group] = d.count;
    });

    return {
      success: true,
      data: {
        list: enhancedForms,
        pagination: {
          page: parseInt(page),
          pageSize: parseInt(pageSize),
          total,
          totalPages: Math.ceil(total / pageSize)
        },
        stats: {
          byStatus: statusStats,
          byNode: nodeStats,
          byDeadline: deadlineGroupStats
        }
      }
    };
  });

  fastify.get('/forms/:id', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params;
    const form = getFormWithDetails(id);

    if (!form) {
      return reply.status(404).send({
        success: false,
        error: {
          type: EXCEPTION_TYPES.MATERIAL_MISSING,
          message: '入驻单不存在'
        }
      });
    }

    const user = request.user;
    const requiredRole = NODE_HANDLER_ROLES[form.current_node];
    const canOperate = !requiredRole || requiredRole === user.role;

    const response = {
      ...form,
      statusLabel: STATUS_LABELS[form.status],
      currentNodeLabel: NODE_LABELS[form.current_node],
      canOperate,
      attachments: form.attachments.map(a => ({
        ...a,
        evidenceTypeLabel: EVIDENCE_TYPE_LABELS[a.evidence_type]
      })),
      processingRecords: form.processingRecords.map(r => ({
        ...r,
        operatorRoleLabel: NODE_HANDLER_ROLES[r.operator_role] ? '' : r.operator_role,
        fromNodeLabel: r.from_node ? NODE_LABELS[r.from_node] : '',
        toNodeLabel: r.to_node ? NODE_LABELS[r.to_node] : '',
        fromStatusLabel: r.from_status ? STATUS_LABELS[r.from_status] : '',
        toStatusLabel: r.to_status ? STATUS_LABELS[r.to_status] : ''
      })),
      exceptions: form.exceptions.map(e => ({
        ...e,
        exceptionTypeLabel: EXCEPTION_TYPE_LABELS[e.exception_type]
      }))
    };

    return {
      success: true,
      data: { form: response }
    };
  });

  fastify.post('/forms', {
    preHandler: [fastify.authenticate, fastify.requireRole(ROLES.MERCHANT_REGISTRAR)]
  }, async (request, reply) => {
    const { body } = request;
    const user = request.user;

    const requiredFields = ['merchantName', 'contactName', 'contactPhone', 'businessType'];
    const missingFields = requiredFields.filter(f => !body[f]);

    if (missingFields.length > 0) {
      return reply.status(400).send({
        success: false,
        error: {
          type: EXCEPTION_TYPES.MATERIAL_MISSING,
          message: `必填字段缺失: ${missingFields.join(', ')}`
        }
      });
    }

    if (!BUSINESS_TYPES.includes(body.businessType)) {
      return reply.status(400).send({
        success: false,
        error: {
          type: EXCEPTION_TYPES.MATERIAL_MISSING,
          message: `业务类型必须是: ${BUSINESS_TYPES.join(', ')}`
        }
      });
    }

    const formNo = `ME${Date.now()}${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;

    const tx = db.transaction(() => {
      const stmt = db.prepare(`
        INSERT INTO merchant_entry_forms (
          form_no, merchant_name, credit_code, contact_name, contact_phone,
          contact_email, business_type, registered_capital, business_scope,
          business_license_no, tax_registration_no, organization_code,
          legal_person_name, legal_person_id_card, bank_account_name,
          bank_account_no, bank_name, warehouse_address, office_address,
          current_node, status, current_handler, deadline, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const result = stmt.run(
        formNo,
        body.merchantName,
        body.creditCode || null,
        body.contactName,
        body.contactPhone,
        body.contactEmail || null,
        body.businessType,
        body.registeredCapital || null,
        body.businessScope || null,
        body.businessLicenseNo || null,
        body.taxRegistrationNo || null,
        body.organizationCode || null,
        body.legalPersonName || null,
        body.legalPersonIdCard || null,
        body.bankAccountName || null,
        body.bankAccountNo || null,
        body.bankName || null,
        body.warehouseAddress || null,
        body.officeAddress || null,
        NODES.ENTRY_REGISTRATION,
        STATUSES.PENDING_SIGN,
        user.username,
        getDeadline(NODES.ENTRY_REGISTRATION),
        user.username
      );

      const formId = result.lastInsertRowid;

      recordProcessing(db, {
        formId,
        operationType: OPERATION_TYPES.CREATE,
        operator: user.username,
        operatorRole: user.role,
        fromNode: null,
        toNode: NODES.ENTRY_REGISTRATION,
        fromStatus: null,
        toStatus: STATUSES.PENDING_SIGN,
        opinion: '创建商家入驻单',
        version: 1
      });

      if (body.attachments && body.attachments.length > 0) {
        const attachStmt = db.prepare(`
          INSERT INTO attachments (
            form_id, file_name, file_type, file_size, file_path,
            upload_by, evidence_type, remark
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);

        body.attachments.forEach(att => {
          attachStmt.run(
            formId,
            att.fileName,
            att.fileType || null,
            att.fileSize || 0,
            att.filePath || null,
            user.username,
            att.evidenceType,
            att.remark || null
          );
        });
      }

      return formId;
    });

    try {
      const formId = tx();
      return {
        success: true,
        data: { id: formId, formNo }
      };
    } catch (err) {
      return reply.status(500).send({
        success: false,
        error: {
          type: EXCEPTION_TYPES.STATUS_CONFLICT,
          message: `创建失败: ${err.message}`
        }
      });
    }
  });

  fastify.post('/forms/:id/operation', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params;
    const { operation, opinion, version, supplementData, attachments } = request.body;
    const user = request.user;

    const form = db.prepare('SELECT * FROM merchant_entry_forms WHERE id = ?').get(id);

    if (!form) {
      return reply.status(404).send({
        success: false,
        error: {
          type: EXCEPTION_TYPES.MATERIAL_MISSING,
          message: '入驻单不存在'
        }
      });
    }

    if (version !== undefined && version !== form.version) {
      recordException(db, {
        formId: id,
        exceptionType: EXCEPTION_TYPES.VERSION_CONFLICT,
        exceptionDetail: `提交版本${version}与当前版本${form.version}冲突，请刷新后重试`,
        exceptionNode: form.current_node,
        createdBy: user.username
      });

      return reply.status(409).send({
        success: false,
        error: {
          type: EXCEPTION_TYPES.VERSION_CONFLICT,
          message: `版本冲突：当前版本为${form.version}，请刷新页面后重试`
        }
      });
    }

    const validation = validateOperation(form, operation, user);
    if (!validation.valid) {
      validation.errors.forEach(err => {
        recordException(db, {
          formId: id,
          exceptionType: err.type,
          exceptionDetail: err.message,
          exceptionNode: form.current_node,
          createdBy: user.username
        });
      });

      return reply.status(400).send({
        success: false,
        error: validation.errors[0]
      });
    }

    const evidenceCheck = checkEvidence(id, form.current_node);
    if (!evidenceCheck.complete && ![OPERATION_TYPES.SUPPLEMENT, OPERATION_TYPES.RETURN_SUPPLEMENT].includes(operation)) {
      recordException(db, {
        formId: id,
        exceptionType: EXCEPTION_TYPES.EVIDENCE_MISSING,
        exceptionDetail: `当前节点缺少必要证据: ${evidenceCheck.missingLabels.join(', ')}`,
        exceptionNode: form.current_node,
        createdBy: user.username
      });

      return reply.status(400).send({
        success: false,
        error: {
          type: EXCEPTION_TYPES.EVIDENCE_MISSING,
          message: `缺少必要证据材料: ${evidenceCheck.missingLabels.join(', ')}，请先补正`
        }
      });
    }

    const tx = db.transaction(() => {
      let newVersion = form.version;
      let attachmentId = null;

      if (attachments && attachments.length > 0) {
        const attachStmt = db.prepare(`
          INSERT INTO attachments (
            form_id, file_name, file_type, file_size, file_path,
            upload_by, evidence_type, remark
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);

        attachments.forEach(att => {
          const result = attachStmt.run(
            id,
            att.fileName,
            att.fileType || null,
            att.fileSize || 0,
            att.filePath || null,
            user.username,
            att.evidenceType,
            att.remark || null
          );
          if (!attachmentId) attachmentId = result.lastInsertRowid;
        });
      }

      if (supplementData) {
        const updateFields = [];
        const updateValues = [];

        const fieldMap = {
          merchantName: 'merchant_name',
          creditCode: 'credit_code',
          contactName: 'contact_name',
          contactPhone: 'contact_phone',
          contactEmail: 'contact_email',
          businessType: 'business_type',
          registeredCapital: 'registered_capital',
          businessScope: 'business_scope',
          businessLicenseNo: 'business_license_no',
          taxRegistrationNo: 'tax_registration_no',
          organizationCode: 'organization_code',
          legalPersonName: 'legal_person_name',
          legalPersonIdCard: 'legal_person_id_card',
          bankAccountName: 'bank_account_name',
          bankAccountNo: 'bank_account_no',
          bankName: 'bank_name',
          warehouseAddress: 'warehouse_address',
          officeAddress: 'office_address'
        };

        Object.keys(supplementData).forEach(key => {
          const dbField = fieldMap[key];
          if (dbField) {
            updateFields.push(`${dbField} = ?`);
            updateValues.push(supplementData[key]);
          }
        });

        if (updateFields.length > 0) {
          updateValues.push(id);
          db.prepare(`
            UPDATE merchant_entry_forms SET
              ${updateFields.join(', ')},
              updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `).run(...updateValues);
        }
      }

      switch (operation) {
        case OPERATION_TYPES.SIGN: {
          newVersion = updateFormStatus(db, {
            formId: id,
            currentNode: form.current_node,
            status: STATUSES.SIGN_COMPLETED,
            currentHandler: user.username,
            deadline: form.deadline
          });

          recordProcessing(db, {
            formId: id,
            operationType: OPERATION_TYPES.SIGN,
            operator: user.username,
            operatorRole: user.role,
            fromNode: form.current_node,
            toNode: form.current_node,
            fromStatus: form.status,
            toStatus: STATUSES.SIGN_COMPLETED,
            opinion: opinion || '签收完成',
            version: newVersion
          });
          break;
        }

        case OPERATION_TYPES.SUBMIT_AUDIT: {
          const next = getNextNodeAndHandler(form.current_node);
          if (!next) throw new Error('无法确定下一节点');

          const nextHandler = db.prepare(`
            SELECT username FROM users WHERE role = ? ORDER BY id LIMIT 1
          `).get(next.handlerRole);

          newVersion = updateFormStatus(db, {
            formId: id,
            currentNode: next.nextNode,
            status: STATUSES.PENDING_AUDIT,
            currentHandler: nextHandler ? nextHandler.username : null,
            previousHandler: user.username,
            previousOpinion: opinion,
            previousAttachmentId: attachmentId,
            deadline: getDeadline(next.nextNode)
          });

          recordProcessing(db, {
            formId: id,
            operationType: OPERATION_TYPES.SUBMIT_AUDIT,
            operator: user.username,
            operatorRole: user.role,
            fromNode: form.current_node,
            toNode: next.nextNode,
            fromStatus: form.status,
            toStatus: STATUSES.PENDING_AUDIT,
            opinion,
            version: newVersion
          });
          break;
        }

        case OPERATION_TYPES.AUDIT_PASS: {
          const next = getNextNodeAndHandler(form.current_node);
          if (!next) throw new Error('无法确定下一节点');

          const nextHandler = next.handlerRole ? db.prepare(`
            SELECT username FROM users WHERE role = ? ORDER BY id LIMIT 1
          `).get(next.handlerRole) : null;

          newVersion = updateFormStatus(db, {
            formId: id,
            currentNode: next.nextNode,
            status: next.nextNode === NODES.ARCHIVED ? STATUSES.ARCHIVED : STATUSES.PENDING_REGISTRATION,
            currentHandler: nextHandler ? nextHandler.username : null,
            previousHandler: user.username,
            previousOpinion: opinion,
            previousAttachmentId: attachmentId,
            deadline: next.nextNode === NODES.ARCHIVED ? null : getDeadline(next.nextNode)
          });

          if (next.nextNode === NODES.ARCHIVED) {
            db.prepare(`
              UPDATE merchant_entry_forms SET archived_at = CURRENT_TIMESTAMP WHERE id = ?
            `).run(id);
          }

          recordProcessing(db, {
            formId: id,
            operationType: OPERATION_TYPES.AUDIT_PASS,
            operator: user.username,
            operatorRole: user.role,
            fromNode: form.current_node,
            toNode: next.nextNode,
            fromStatus: form.status,
            toStatus: next.nextNode === NODES.ARCHIVED ? STATUSES.ARCHIVED : STATUSES.PENDING_REGISTRATION,
            opinion,
            version: newVersion
          });
          break;
        }

        case OPERATION_TYPES.AUDIT_REJECT: {
          newVersion = updateFormStatus(db, {
            formId: id,
            currentNode: form.current_node,
            status: STATUSES.ABNORMAL_RETURN,
            currentHandler: form.previous_handler || form.created_by,
            previousHandler: user.username,
            previousOpinion: opinion,
            previousAttachmentId: attachmentId,
            deadline: getDeadline(form.current_node)
          });

          recordException(db, {
            formId: id,
            exceptionType: EXCEPTION_TYPES.MATERIAL_MISSING,
            exceptionDetail: `审核拒绝: ${opinion || '材料不符合要求'}`,
            exceptionNode: form.current_node,
            createdBy: user.username
          });

          recordProcessing(db, {
            formId: id,
            operationType: OPERATION_TYPES.AUDIT_REJECT,
            operator: user.username,
            operatorRole: user.role,
            fromNode: form.current_node,
            toNode: form.current_node,
            fromStatus: form.status,
            toStatus: STATUSES.ABNORMAL_RETURN,
            opinion,
            version: newVersion
          });
          break;
        }

        case OPERATION_TYPES.REGISTER: {
          newVersion = updateFormStatus(db, {
            formId: id,
            currentNode: form.current_node,
            status: STATUSES.REGISTRATION_COMPLETED,
            currentHandler: user.username,
            previousHandler: user.username,
            previousOpinion: opinion,
            previousAttachmentId: attachmentId,
            deadline: form.deadline
          });

          recordProcessing(db, {
            formId: id,
            operationType: OPERATION_TYPES.REGISTER,
            operator: user.username,
            operatorRole: user.role,
            fromNode: form.current_node,
            toNode: form.current_node,
            fromStatus: form.status,
            toStatus: STATUSES.REGISTRATION_COMPLETED,
            opinion,
            version: newVersion
          });
          break;
        }

        case OPERATION_TYPES.SUBMIT_FINAL_REVIEW: {
          const next = getNextNodeAndHandler(form.current_node);
          if (!next) throw new Error('无法确定下一节点');

          const nextHandler = db.prepare(`
            SELECT username FROM users WHERE role = ? ORDER BY id LIMIT 1
          `).get(next.handlerRole);

          newVersion = updateFormStatus(db, {
            formId: id,
            currentNode: next.nextNode,
            status: STATUSES.PENDING_FINAL_REVIEW,
            currentHandler: nextHandler ? nextHandler.username : null,
            previousHandler: user.username,
            previousOpinion: opinion,
            previousAttachmentId: attachmentId,
            deadline: getDeadline(next.nextNode)
          });

          recordProcessing(db, {
            formId: id,
            operationType: OPERATION_TYPES.SUBMIT_FINAL_REVIEW,
            operator: user.username,
            operatorRole: user.role,
            fromNode: form.current_node,
            toNode: next.nextNode,
            fromStatus: form.status,
            toStatus: STATUSES.PENDING_FINAL_REVIEW,
            opinion,
            version: newVersion
          });
          break;
        }

        case OPERATION_TYPES.FINAL_REVIEW_PASS: {
          newVersion = updateFormStatus(db, {
            formId: id,
            currentNode: NODES.ARCHIVED,
            status: STATUSES.ARCHIVED,
            currentHandler: null,
            previousHandler: user.username,
            previousOpinion: opinion,
            previousAttachmentId: attachmentId,
            deadline: null
          });

          db.prepare(`
            UPDATE merchant_entry_forms SET archived_at = CURRENT_TIMESTAMP WHERE id = ?
          `).run(id);

          recordProcessing(db, {
            formId: id,
            operationType: OPERATION_TYPES.FINAL_REVIEW_PASS,
            operator: user.username,
            operatorRole: user.role,
            fromNode: form.current_node,
            toNode: NODES.ARCHIVED,
            fromStatus: form.status,
            toStatus: STATUSES.ARCHIVED,
            opinion,
            version: newVersion
          });
          break;
        }

        case OPERATION_TYPES.FINAL_REVIEW_REJECT: {
          newVersion = updateFormStatus(db, {
            formId: id,
            currentNode: form.current_node,
            status: STATUSES.ABNORMAL_RETURN,
            currentHandler: form.previous_handler || form.created_by,
            previousHandler: user.username,
            previousOpinion: opinion,
            previousAttachmentId: attachmentId,
            deadline: getDeadline(form.current_node)
          });

          recordException(db, {
            formId: id,
            exceptionType: EXCEPTION_TYPES.MATERIAL_MISSING,
            exceptionDetail: `复核拒绝: ${opinion || '材料不符合要求'}`,
            exceptionNode: form.current_node,
            createdBy: user.username
          });

          recordProcessing(db, {
            formId: id,
            operationType: OPERATION_TYPES.FINAL_REVIEW_REJECT,
            operator: user.username,
            operatorRole: user.role,
            fromNode: form.current_node,
            toNode: form.current_node,
            fromStatus: form.status,
            toStatus: STATUSES.ABNORMAL_RETURN,
            opinion,
            version: newVersion
          });
          break;
        }

        case OPERATION_TYPES.SUPPLEMENT: {
          newVersion = updateFormStatus(db, {
            formId: id,
            currentNode: form.current_node,
            status: STATUSES.SIGN_COMPLETED,
            currentHandler: user.username,
            previousHandler: user.username,
            previousOpinion: opinion || '补正完成',
            previousAttachmentId: attachmentId,
            deadline: getDeadline(form.current_node)
          });

          const unresolvedExceptions = db.prepare(`
            SELECT id FROM exception_reasons WHERE form_id = ? AND resolved = 0
          `).all(id);

          unresolvedExceptions.forEach(e => {
            db.prepare(`
              UPDATE exception_reasons SET
                resolved = 1,
                resolved_by = ?,
                resolved_at = CURRENT_TIMESTAMP,
                resolution_note = ?
              WHERE id = ?
            `).run(user.username, opinion || '补正完成', e.id);
          });

          recordProcessing(db, {
            formId: id,
            operationType: OPERATION_TYPES.SUPPLEMENT,
            operator: user.username,
            operatorRole: user.role,
            fromNode: form.current_node,
            toNode: form.current_node,
            fromStatus: form.status,
            toStatus: STATUSES.SIGN_COMPLETED,
            opinion: opinion || '补正完成',
            version: newVersion
          });
          break;
        }

        case OPERATION_TYPES.RETURN_SUPPLEMENT: {
          newVersion = updateFormStatus(db, {
            formId: id,
            currentNode: form.current_node,
            status: STATUSES.SUPPLEMENT_REQUIRED,
            currentHandler: form.previous_handler || form.created_by,
            previousHandler: user.username,
            previousOpinion: opinion,
            previousAttachmentId: attachmentId,
            deadline: getDeadline(form.current_node)
          });

          recordException(db, {
            formId: id,
            exceptionType: EXCEPTION_TYPES.MATERIAL_MISSING,
            exceptionDetail: `退回补正: ${opinion || '材料不完整，需要补充'}`,
            exceptionNode: form.current_node,
            createdBy: user.username
          });

          recordProcessing(db, {
            formId: id,
            operationType: OPERATION_TYPES.RETURN_SUPPLEMENT,
            operator: user.username,
            operatorRole: user.role,
            fromNode: form.current_node,
            toNode: form.current_node,
            fromStatus: form.status,
            toStatus: STATUSES.SUPPLEMENT_REQUIRED,
            opinion,
            version: newVersion
          });
          break;
        }

        case OPERATION_TYPES.ARCHIVE: {
          newVersion = updateFormStatus(db, {
            formId: id,
            currentNode: NODES.ARCHIVED,
            status: STATUSES.ARCHIVED,
            currentHandler: null,
            previousHandler: user.username,
            previousOpinion: opinion || '归档完成',
            previousAttachmentId: attachmentId,
            deadline: null
          });

          db.prepare(`
            UPDATE merchant_entry_forms SET archived_at = CURRENT_TIMESTAMP WHERE id = ?
          `).run(id);

          recordProcessing(db, {
            formId: id,
            operationType: OPERATION_TYPES.ARCHIVE,
            operator: user.username,
            operatorRole: user.role,
            fromNode: form.current_node,
            toNode: NODES.ARCHIVED,
            fromStatus: form.status,
            toStatus: STATUSES.ARCHIVED,
            opinion: opinion || '归档完成',
            version: newVersion
          });
          break;
        }

        default:
          throw new Error(`不支持的操作类型: ${operation}`);
      }

      return newVersion;
    });

    try {
      const newVersion = tx();
      const updatedForm = getFormWithDetails(id);

      return {
        success: true,
        data: {
          form: {
            ...updatedForm,
            statusLabel: STATUS_LABELS[updatedForm.status],
            currentNodeLabel: NODE_LABELS[updatedForm.current_node],
            version: newVersion
          },
          message: '操作成功'
        }
      };
    } catch (err) {
      return reply.status(500).send({
        success: false,
        error: {
          type: EXCEPTION_TYPES.STATUS_CONFLICT,
          message: `操作失败: ${err.message}`
        }
      });
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
      whereClause += ` AND (
        current_node IN ('${NODES.ENTRY_REGISTRATION}', '${NODES.ENTRY_FORM_REGISTRATION}')
        OR created_by = ?
      )`;
      params.push(user.username);
    } else if (user.role === ROLES.AUDIT_SUPERVISOR) {
      whereClause += ` AND current_node = '${NODES.QUALIFICATION_AUDIT}'`;
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
      FROM merchant_entry_forms
      ${whereClause}
    `;

    const stats = db.prepare(sql).get(...params);

    return {
      success: true,
      data: { statistics: stats }
    };
  });

  fastify.post('/forms/:id/audit-notes', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params;
    const { noteContent } = request.body;
    const user = request.user;

    const form = db.prepare('SELECT id FROM merchant_entry_forms WHERE id = ?').get(id);
    if (!form) {
      return reply.status(404).send({
        success: false,
        error: {
          type: EXCEPTION_TYPES.MATERIAL_MISSING,
          message: '入驻单不存在'
        }
      });
    }

    if (!noteContent || !noteContent.trim()) {
      return reply.status(400).send({
        success: false,
        error: {
          type: EXCEPTION_TYPES.MATERIAL_MISSING,
          message: '备注内容不能为空'
        }
      });
    }

    const result = db.prepare(`
      INSERT INTO audit_notes (form_id, note_content, created_by)
      VALUES (?, ?, ?)
    `).run(id, noteContent.trim(), user.username);

    const note = db.prepare('SELECT * FROM audit_notes WHERE id = ?').get(result.lastInsertRowid);

    return {
      success: true,
      data: { note }
    };
  });
}

module.exports = routes;
