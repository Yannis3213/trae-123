const db = require('../utils/db');
const {
  ROLES,
  NODES,
  STATUSES,
  OPERATION_TYPES,
  EXCEPTION_TYPES,
  STATUS_LABELS,
  NODE_LABELS,
  NODE_HANDLER_ROLES
} = require('../utils/constants');
const {
  validateOperation,
  checkEvidence,
  checkTimeout,
  getDeadline,
  getNextNodeAndHandler,
  recordProcessing,
  recordException,
  updateFormStatus
} = require('../utils/workflow');

async function routes(fastify) {
  fastify.post('/batch/process', { preHandler: [fastify.authenticate] }, async (request) => {
    const { formIds, operation, opinion, versionMap } = request.body;
    const user = request.user;

    const batchNo = `BATCH${Date.now()}`;
    const results = [];

    const tx = db.transaction((forms) => {
      forms.forEach((form) => {
        const { formId, version } = form;

        const currentForm = db.prepare('SELECT * FROM merchant_entry_forms WHERE id = ?').get(formId);
        if (!currentForm) {
          results.push({
            formId,
            formNo: null,
            success: false,
            errorType: EXCEPTION_TYPES.MATERIAL_MISSING,
            errorMessage: '入驻单不存在'
          });
          return;
        }

        if (version !== undefined && version !== currentForm.version) {
          recordException(db, {
            formId,
            exceptionType: EXCEPTION_TYPES.VERSION_CONFLICT,
            exceptionDetail: `批量处理版本${version}与当前版本${currentForm.version}冲突`,
            exceptionNode: currentForm.current_node,
            createdBy: user.username
          });

          results.push({
            formId,
            formNo: currentForm.form_no,
            success: false,
            errorType: EXCEPTION_TYPES.VERSION_CONFLICT,
            errorMessage: `版本冲突：当前版本为${currentForm.version}`
          });
          return;
        }

        const validation = validateOperation(currentForm, operation, user);
        if (!validation.valid) {
          validation.errors.forEach(err => {
            recordException(db, {
              formId,
              exceptionType: err.type,
              exceptionDetail: err.message,
              exceptionNode: currentForm.current_node,
              createdBy: user.username
            });
          });

          results.push({
            formId,
            formNo: currentForm.form_no,
            success: false,
            errorType: validation.errors[0].type,
            errorMessage: validation.errors[0].message
          });
          return;
        }

        const evidenceCheck = checkEvidence(formId, currentForm.current_node);
        if (!evidenceCheck.complete) {
          recordException(db, {
            formId,
            exceptionType: EXCEPTION_TYPES.EVIDENCE_MISSING,
            exceptionDetail: `批量处理缺少证据: ${evidenceCheck.missingLabels.join(', ')}`,
            exceptionNode: currentForm.current_node,
            createdBy: user.username
          });

          results.push({
            formId,
            formNo: currentForm.form_no,
            success: false,
            errorType: EXCEPTION_TYPES.EVIDENCE_MISSING,
            errorMessage: `缺少证据: ${evidenceCheck.missingLabels.join(', ')}`
          });
          return;
        }

        try {
          let newVersion = currentForm.version;

          switch (operation) {
            case OPERATION_TYPES.SIGN: {
              newVersion = updateFormStatus(db, {
                formId,
                currentNode: currentForm.current_node,
                status: STATUSES.SIGN_COMPLETED,
                currentHandler: user.username,
                deadline: currentForm.deadline
              });

              recordProcessing(db, {
                formId,
                operationType: OPERATION_TYPES.SIGN,
                operator: user.username,
                operatorRole: user.role,
                fromNode: currentForm.current_node,
                toNode: currentForm.current_node,
                fromStatus: currentForm.status,
                toStatus: STATUSES.SIGN_COMPLETED,
                opinion: opinion || '批量签收完成',
                version: newVersion
              });
              break;
            }

            case OPERATION_TYPES.SUBMIT_AUDIT: {
              const next = getNextNodeAndHandler(currentForm.current_node);
              if (!next) throw new Error('无法确定下一节点');

              const nextHandler = db.prepare(`
                SELECT username FROM users WHERE role = ? ORDER BY id LIMIT 1
              `).get(next.handlerRole);

              newVersion = updateFormStatus(db, {
                formId,
                currentNode: next.nextNode,
                status: STATUSES.PENDING_AUDIT,
                currentHandler: nextHandler ? nextHandler.username : null,
                previousHandler: user.username,
                previousOpinion: opinion,
                deadline: getDeadline(next.nextNode)
              });

              recordProcessing(db, {
                formId,
                operationType: OPERATION_TYPES.SUBMIT_AUDIT,
                operator: user.username,
                operatorRole: user.role,
                fromNode: currentForm.current_node,
                toNode: next.nextNode,
                fromStatus: currentForm.status,
                toStatus: STATUSES.PENDING_AUDIT,
                opinion,
                version: newVersion
              });
              break;
            }

            case OPERATION_TYPES.AUDIT_PASS: {
              const next = getNextNodeAndHandler(currentForm.current_node);
              if (!next) throw new Error('无法确定下一节点');

              const nextHandler = next.handlerRole ? db.prepare(`
                SELECT username FROM users WHERE role = ? ORDER BY id LIMIT 1
              `).get(next.handlerRole) : null;

              newVersion = updateFormStatus(db, {
                formId,
                currentNode: next.nextNode,
                status: next.nextNode === NODES.ARCHIVED ? STATUSES.ARCHIVED : STATUSES.PENDING_REGISTRATION,
                currentHandler: nextHandler ? nextHandler.username : null,
                previousHandler: user.username,
                previousOpinion: opinion,
                deadline: next.nextNode === NODES.ARCHIVED ? null : getDeadline(next.nextNode)
              });

              if (next.nextNode === NODES.ARCHIVED) {
                db.prepare(`
                  UPDATE merchant_entry_forms SET archived_at = CURRENT_TIMESTAMP WHERE id = ?
                `).run(formId);
              }

              recordProcessing(db, {
                formId,
                operationType: OPERATION_TYPES.AUDIT_PASS,
                operator: user.username,
                operatorRole: user.role,
                fromNode: currentForm.current_node,
                toNode: next.nextNode,
                fromStatus: currentForm.status,
                toStatus: next.nextNode === NODES.ARCHIVED ? STATUSES.ARCHIVED : STATUSES.PENDING_REGISTRATION,
                opinion,
                version: newVersion
              });
              break;
            }

            case OPERATION_TYPES.REGISTER: {
              newVersion = updateFormStatus(db, {
                formId,
                currentNode: currentForm.current_node,
                status: STATUSES.REGISTRATION_COMPLETED,
                currentHandler: user.username,
                previousHandler: user.username,
                previousOpinion: opinion,
                deadline: currentForm.deadline
              });

              recordProcessing(db, {
                formId,
                operationType: OPERATION_TYPES.REGISTER,
                operator: user.username,
                operatorRole: user.role,
                fromNode: currentForm.current_node,
                toNode: currentForm.current_node,
                fromStatus: currentForm.status,
                toStatus: STATUSES.REGISTRATION_COMPLETED,
                opinion,
                version: newVersion
              });
              break;
            }

            case OPERATION_TYPES.SUBMIT_FINAL_REVIEW: {
              const next = getNextNodeAndHandler(currentForm.current_node);
              if (!next) throw new Error('无法确定下一节点');

              const nextHandler = db.prepare(`
                SELECT username FROM users WHERE role = ? ORDER BY id LIMIT 1
              `).get(next.handlerRole);

              newVersion = updateFormStatus(db, {
                formId,
                currentNode: next.nextNode,
                status: STATUSES.PENDING_FINAL_REVIEW,
                currentHandler: nextHandler ? nextHandler.username : null,
                previousHandler: user.username,
                previousOpinion: opinion,
                deadline: getDeadline(next.nextNode)
              });

              recordProcessing(db, {
                formId,
                operationType: OPERATION_TYPES.SUBMIT_FINAL_REVIEW,
                operator: user.username,
                operatorRole: user.role,
                fromNode: currentForm.current_node,
                toNode: next.nextNode,
                fromStatus: currentForm.status,
                toStatus: STATUSES.PENDING_FINAL_REVIEW,
                opinion,
                version: newVersion
              });
              break;
            }

            case OPERATION_TYPES.FINAL_REVIEW_PASS: {
              newVersion = updateFormStatus(db, {
                formId,
                currentNode: NODES.ARCHIVED,
                status: STATUSES.ARCHIVED,
                currentHandler: null,
                previousHandler: user.username,
                previousOpinion: opinion,
                deadline: null
              });

              db.prepare(`
                UPDATE merchant_entry_forms SET archived_at = CURRENT_TIMESTAMP WHERE id = ?
              `).run(formId);

              recordProcessing(db, {
                formId,
                operationType: OPERATION_TYPES.FINAL_REVIEW_PASS,
                operator: user.username,
                operatorRole: user.role,
                fromNode: currentForm.current_node,
                toNode: NODES.ARCHIVED,
                fromStatus: currentForm.status,
                toStatus: STATUSES.ARCHIVED,
                opinion,
                version: newVersion
              });
              break;
            }

            case OPERATION_TYPES.ARCHIVE: {
              newVersion = updateFormStatus(db, {
                formId,
                currentNode: NODES.ARCHIVED,
                status: STATUSES.ARCHIVED,
                currentHandler: null,
                previousHandler: user.username,
                previousOpinion: opinion || '批量归档',
                deadline: null
              });

              db.prepare(`
                UPDATE merchant_entry_forms SET archived_at = CURRENT_TIMESTAMP WHERE id = ?
              `).run(formId);

              recordProcessing(db, {
                formId,
                operationType: OPERATION_TYPES.ARCHIVE,
                operator: user.username,
                operatorRole: user.role,
                fromNode: currentForm.current_node,
                toNode: NODES.ARCHIVED,
                fromStatus: currentForm.status,
                toStatus: STATUSES.ARCHIVED,
                opinion: opinion || '批量归档',
                version: newVersion
              });
              break;
            }

            default:
              throw new Error(`不支持的批量操作: ${operation}`);
          }

          results.push({
            formId,
            formNo: currentForm.form_no,
            success: true,
            errorType: null,
            errorMessage: null,
            newStatus: STATUS_LABELS[currentForm.status],
            newNode: NODE_LABELS[currentForm.current_node]
          });
        } catch (err) {
          results.push({
            formId,
            formNo: currentForm.form_no,
            success: false,
            errorType: EXCEPTION_TYPES.STATUS_CONFLICT,
            errorMessage: err.message
          });
        }
      });

      results.forEach(r => {
        db.prepare(`
          INSERT INTO batch_results (
            batch_no, form_id, form_no, success, error_type,
            error_message, operator, operation_type
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          batchNo,
          r.formId,
          r.formNo,
          r.success ? 1 : 0,
          r.errorType,
          r.errorMessage,
          user.username,
          operation
        );
      });
    });

    const forms = formIds.map(id => ({
      formId: id,
      version: versionMap ? versionMap[id] : undefined
    }));

    tx(forms);

    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;

    return {
      success: true,
      data: {
        batchNo,
        operation,
        total: formIds.length,
        successCount,
        failCount,
        results
      }
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
          results.push({
            formId,
            formNo: null,
            success: false,
            errorType: EXCEPTION_TYPES.MATERIAL_MISSING,
            errorMessage: '入驻单不存在'
          });
          return;
        }

        const { isTimeout } = checkTimeout(form.deadline);
        if (!isTimeout) {
          results.push({
            formId,
            formNo: form.form_no,
            success: false,
            errorType: EXCEPTION_TYPES.STATUS_CONFLICT,
            errorMessage: '该入驻单未逾期，无法批量推进'
          });
          return;
        }

        if (form.status === STATUSES.ARCHIVED) {
          results.push({
            formId,
            formNo: form.form_no,
            success: false,
            errorType: EXCEPTION_TYPES.STATUS_CONFLICT,
            errorMessage: '已归档的入驻单无法推进'
          });
          return;
        }

        const previousHandler = form.current_handler;
        const requiredRole = NODE_HANDLER_ROLES[form.current_node];

        const nextHandler = requiredRole ? db.prepare(`
          SELECT username FROM users WHERE role = ? AND username != ? ORDER BY id LIMIT 1
        `).get(requiredRole, previousHandler) : null;

        if (!nextHandler && requiredRole) {
          results.push({
            formId,
            formNo: form.form_no,
            success: false,
            errorType: EXCEPTION_TYPES.PERMISSION_DENIED,
            errorMessage: '找不到可用的下一处理人'
          });
          return;
        }

        recordException(db, {
          formId,
          exceptionType: EXCEPTION_TYPES.TIMEOUT,
          exceptionDetail: `逾期批量推进：原处理人${previousHandler}超时未处理`,
          exceptionNode: form.current_node,
          createdBy: user.username
        });

        const newDeadline = getDeadline(form.current_node);

        db.prepare(`
          UPDATE merchant_entry_forms SET
            current_handler = ?,
            previous_handler = ?,
            deadline = ?,
            version = version + 1,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(
          nextHandler ? nextHandler.username : null,
          user.username,
          newDeadline,
          formId
        );

        recordProcessing(db, {
          formId,
          operationType: OPERATION_TYPES.BATCH_PROMOTE,
          operator: user.username,
          operatorRole: user.role,
          fromNode: form.current_node,
          toNode: form.current_node,
          fromStatus: form.status,
          toStatus: form.status,
          opinion: opinion || `逾期推进：原处理人${previousHandler}超时，转由${nextHandler ? nextHandler.username : '待分配'}处理`,
          version: form.version + 1
        });

        results.push({
          formId,
          formNo: form.form_no,
          success: true,
          newHandler: nextHandler ? nextHandler.username : null,
          newDeadline
        });
      });
    });

    tx();

    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;

    return {
      success: true,
      data: {
        batchNo,
        total: formIds.length,
        successCount,
        failCount,
        results
      }
    };
  });

  fastify.get('/batch/results/:batchNo', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { batchNo } = request.params;

    const results = db.prepare(`
      SELECT * FROM batch_results WHERE batch_no = ? ORDER BY created_at
    `).all(batchNo);

    if (results.length === 0) {
      return reply.status(404).send({
        success: false,
        error: {
          type: EXCEPTION_TYPES.MATERIAL_MISSING,
          message: '批次号不存在'
        }
      });
    }

    const stats = {
      total: results.length,
      successCount: results.filter(r => r.success).length,
      failCount: results.filter(r => !r.success).length
    };

    return {
      success: true,
      data: {
        batchNo,
        stats,
        results: results.map(r => ({
          ...r,
          success: r.success === 1
        }))
      }
    };
  });
}

module.exports = routes;
