const db = require('../utils/db');
const {
  ROLES, NODES, STATUSES, OPERATION_TYPES, EXCEPTION_TYPES,
  STATUS_LABELS, NODE_LABELS, NODE_HANDLER_ROLES
} = require('../utils/constants');
const {
  validateOperation, checkEvidence, checkTimeout, getDeadline,
  getNextNodeAndHandler, getNextHandler, recordProcessing,
  recordException, resolveExceptions, updateFormStatus, OPERATION_MATRIX
} = require('../utils/workflow');

async function routes(fastify) {
  fastify.post('/batch/process', { preHandler: [fastify.authenticate] }, async (request) => {
    const { formIds, operation, opinion, versionMap } = request.body;
    const user = request.user;

    const batchNo = `BATCH${Date.now()}`;
    const results = [];

    const tx = db.transaction((forms) => {
      forms.forEach((formInput) => {
        const { formId, version } = formInput;
        const currentForm = db.prepare('SELECT * FROM merchant_entry_forms WHERE id = ?').get(formId);

        if (!currentForm) {
          results.push({ formId, formNo: null, success: false, errorType: EXCEPTION_TYPES.MATERIAL_MISSING, errorMessage: '入驻单不存在' });
          return;
        }

        if (version !== undefined && version !== currentForm.version) {
          recordException(db, { formId, exceptionType: EXCEPTION_TYPES.VERSION_CONFLICT, exceptionDetail: `批量处理版本${version}与当前版本${currentForm.version}冲突`, exceptionNode: currentForm.current_node, createdBy: user.username });
          results.push({ formId, formNo: currentForm.form_no, success: false, errorType: EXCEPTION_TYPES.VERSION_CONFLICT, errorMessage: `版本冲突：当前版本为${currentForm.version}` });
          return;
        }

        const validation = validateOperation(currentForm, operation, user);
        if (!validation.valid) {
          validation.errors.forEach(err => {
            recordException(db, { formId, exceptionType: err.type, exceptionDetail: err.message, exceptionNode: currentForm.current_node, createdBy: user.username });
          });
          results.push({ formId, formNo: currentForm.form_no, success: false, errorType: validation.errors[0].type, errorMessage: validation.errors[0].message });
          return;
        }

        const matrix = OPERATION_MATRIX[operation];
        if (!matrix) {
          results.push({ formId, formNo: currentForm.form_no, success: false, errorType: EXCEPTION_TYPES.STATUS_CONFLICT, errorMessage: `不支持的批量操作: ${operation}` });
          return;
        }

        const skipEvidenceCheck = [OPERATION_TYPES.SIGN, OPERATION_TYPES.AUDIT_REJECT, OPERATION_TYPES.FINAL_REVIEW_REJECT].includes(operation);

        try {
          const fromNode = currentForm.current_node;
          const fromStatus = currentForm.status;
          let newVersion = currentForm.version;
          let toNode = fromNode;
          let toStatus = fromStatus;
          let newHandler = currentForm.current_handler;
          let newDeadline = currentForm.deadline;

          if (!skipEvidenceCheck) {
            const evidenceCheck = checkEvidence(formId, currentForm.current_node);
            if (!evidenceCheck.complete) {
              recordException(db, { formId, exceptionType: EXCEPTION_TYPES.EVIDENCE_MISSING, exceptionDetail: `批量处理缺少证据: ${evidenceCheck.missingLabels.join(', ')}`, exceptionNode: currentForm.current_node, createdBy: user.username });
              results.push({ formId, formNo: currentForm.form_no, success: false, errorType: EXCEPTION_TYPES.EVIDENCE_MISSING, errorMessage: `缺少证据: ${evidenceCheck.missingLabels.join(', ')}` });
              return;
            }
          }

          switch (operation) {
            case OPERATION_TYPES.SIGN: {
              toStatus = matrix.resultStatus(currentForm);
              toNode = fromNode;
              newHandler = user.username;
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
            case OPERATION_TYPES.REGISTER: {
              toStatus = STATUSES.REGISTRATION_COMPLETED;
              toNode = fromNode;
              newHandler = user.username;
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
            case OPERATION_TYPES.ARCHIVE: {
              toNode = NODES.ARCHIVED;
              toStatus = STATUSES.ARCHIVED;
              newHandler = null;
              newDeadline = null;
              break;
            }
            default:
              throw new Error(`不支持的批量操作: ${operation}`);
          }

          newVersion = updateFormStatus(db, {
            formId, currentNode: toNode, status: toStatus,
            currentHandler: newHandler, previousHandler: user.username,
            previousOpinion: opinion, deadline: newDeadline
          });

          if (toStatus === STATUSES.ARCHIVED) {
            db.prepare(`UPDATE merchant_entry_forms SET archived_at = CURRENT_TIMESTAMP WHERE id = ?`).run(formId);
          }

          recordProcessing(db, {
            formId, operationType: operation, operator: user.username,
            operatorRole: user.role, fromNode, toNode, fromStatus, toStatus,
            opinion: opinion || `批量${operation}`, version: newVersion
          });

          results.push({
            formId, formNo: currentForm.form_no, success: true,
            errorType: null, errorMessage: null,
            fromNode, fromStatus,
            newNode: toNode, newStatus: toStatus,
            newNodeLabel: NODE_LABELS[toNode],
            newStatusLabel: STATUS_LABELS[toStatus],
            newVersion,
            newHandler
          });
        } catch (err) {
          recordException(db, { formId, exceptionType: EXCEPTION_TYPES.STATUS_CONFLICT, exceptionDetail: `批量处理异常: ${err.message}`, exceptionNode: currentForm.current_node, createdBy: user.username });
          results.push({ formId, formNo: currentForm.form_no, success: false, errorType: EXCEPTION_TYPES.STATUS_CONFLICT, errorMessage: err.message });
        }
      });

      results.forEach(r => {
        db.prepare(`
          INSERT INTO batch_results (
            batch_no, form_id, form_no, success, error_type,
            error_message, operator, operation_type
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(batchNo, r.formId, r.formNo, r.success ? 1 : 0, r.errorType, r.errorMessage, user.username, operation);
      });
    });

    const forms = formIds.map(id => ({ formId: id, version: versionMap ? versionMap[id] : undefined }));
    tx(forms);

    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;

    return {
      success: true,
      data: { batchNo, operation, total: formIds.length, successCount, failCount, results }
    };
  });

  fastify.post('/batch/promote-overdue', {
    preHandler: [fastify.authenticate, fastify.requireRole(ROLES.PLATFORM_LEADER)]
  }, async (request) => {
    const { formIds, opinion } = request.body;
    const user = request.user;

    const batchNo = `PROMOTE${Date.now()}`;
    const results = [];

    const tx = db.transaction(() => {
      formIds.forEach(formId => {
        const form = db.prepare('SELECT * FROM merchant_entry_forms WHERE id = ?').get(formId);

        if (!form) {
          results.push({ formId, formNo: null, success: false, errorType: EXCEPTION_TYPES.MATERIAL_MISSING, errorMessage: '入驻单不存在' });
          return;
        }

        const { isTimeout } = checkTimeout(form.deadline);
        if (!isTimeout) {
          results.push({ formId, formNo: form.form_no, success: false, errorType: EXCEPTION_TYPES.STATUS_CONFLICT, errorMessage: '该入驻单未逾期，无法批量推进' });
          return;
        }

        if (form.status === STATUSES.ARCHIVED) {
          results.push({ formId, formNo: form.form_no, success: false, errorType: EXCEPTION_TYPES.STATUS_CONFLICT, errorMessage: '已归档的入驻单无法推进' });
          return;
        }

        const previousHandler = form.current_handler;
        const requiredRole = NODE_HANDLER_ROLES[form.current_node];

        const nextHandler = requiredRole ? db.prepare(`SELECT username FROM users WHERE role = ? AND username != ? ORDER BY id LIMIT 1`).get(requiredRole, previousHandler) : null;

        if (!nextHandler && requiredRole) {
          results.push({ formId, formNo: form.form_no, success: false, errorType: EXCEPTION_TYPES.PERMISSION_DENIED, errorMessage: '找不到可用的下一处理人' });
          return;
        }

        const fromNode = form.current_node;
        const fromStatus = form.status;

        recordException(db, {
          formId, exceptionType: EXCEPTION_TYPES.TIMEOUT,
          exceptionDetail: `逾期批量推进：原处理人${previousHandler}超时未处理`,
          exceptionNode: form.current_node, createdBy: user.username
        });

        const newDeadline = getDeadline(form.current_node);
        const newHandlerUsername = nextHandler ? nextHandler.username : null;

        db.prepare(`
          UPDATE merchant_entry_forms SET
            current_handler = ?,
            previous_handler = ?,
            deadline = ?,
            version = version + 1,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(newHandlerUsername, user.username, newDeadline, formId);

        recordProcessing(db, {
          formId, operationType: OPERATION_TYPES.BATCH_PROMOTE,
          operator: user.username, operatorRole: user.role,
          fromNode, toNode: form.current_node,
          fromStatus, toStatus: form.status,
          opinion: opinion || `逾期推进：原处理人${previousHandler}超时，转由${newHandlerUsername || '待分配'}处理`,
          version: form.version + 1
        });

        results.push({
          formId, formNo: form.form_no, success: true,
          newHandler: newHandlerUsername, newDeadline,
          newNode: form.current_node, newStatus: form.status,
          newNodeLabel: NODE_LABELS[form.current_node],
          newStatusLabel: STATUS_LABELS[form.status]
        });
      });
    });

    tx();

    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;

    return { success: true, data: { batchNo, total: formIds.length, successCount, failCount, results } };
  });

  fastify.get('/batch/results/:batchNo', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { batchNo } = request.params;
    const results = db.prepare(`SELECT * FROM batch_results WHERE batch_no = ? ORDER BY created_at`).all(batchNo);

    if (results.length === 0) {
      return reply.status(404).send({ success: false, error: { type: EXCEPTION_TYPES.MATERIAL_MISSING, message: '批次号不存在' } });
    }

    const stats = { total: results.length, successCount: results.filter(r => r.success).length, failCount: results.filter(r => !r.success).length };

    return {
      success: true,
      data: { batchNo, stats, results: results.map(r => ({ ...r, success: r.success === 1 })) }
    };
  });
}

module.exports = routes;
