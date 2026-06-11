const { db } = require('../db');
const dayjs = require('dayjs');

const STATUS_FLOW = {
  submit: {
    from: [null, 'returned'],
    to: 'pending_review',
    role: 'reimbursement_clerk',
    nextHandlerRole: 'expense_accountant'
  },
  review: {
    from: ['pending_review'],
    to: 'verifying',
    role: 'expense_accountant',
    nextHandlerRole: 'finance_manager'
  },
  verify: {
    from: ['verifying'],
    to: 'confirming',
    role: 'finance_manager',
    nextHandlerRole: 'expense_accountant'
  },
  confirm: {
    from: ['confirming'],
    to: 'completed',
    role: 'expense_accountant',
    nextHandlerRole: null
  },
  return: {
    from: ['pending_review', 'verifying', 'confirming', 'exception'],
    to: 'returned',
    role: '*',
    nextHandlerRole: 'reimbursement_clerk'
  },
  reject: {
    from: ['pending_review', 'verifying', 'confirming', 'exception', 'returned'],
    to: 'rejected',
    role: '*',
    nextHandlerRole: null
  },
  exception: {
    from: ['pending_review', 'verifying', 'confirming'],
    to: 'exception',
    role: '*',
    nextHandlerRole: null
  },
  rectify: {
    from: ['returned', 'exception'],
    to: 'pending_review',
    role: 'reimbursement_clerk',
    nextHandlerRole: 'expense_accountant'
  }
};

function _getHandlerByRole(role) {
  const user = db.prepare('SELECT * FROM users WHERE role = ? LIMIT 1').get(role);
  return user || null;
}

function _checkActionAllowed(app, user, action) {
  const flow = STATUS_FLOW[action];
  if (!flow) return { allowed: false, reason: '未知操作类型' };

  if (flow.role !== '*' && flow.role !== user.role) {
    return { allowed: false, reason: `当前角色(${user.role})无权执行${action}操作` };
  }

  if (!flow.from.includes(app.status) && !(flow.from.includes(null) && action === 'submit')) {
    return { allowed: false, reason: `当前状态(${app.status})不允许${action}操作` };
  }

  if (action === 'submit') {
    if (user.role !== 'reimbursement_clerk') {
      return { allowed: false, reason: '只有报销专员可以提交申请' };
    }
    if (app.status === 'returned') {
      const attachCount = db.prepare('SELECT COUNT(*) as cnt FROM attachments WHERE application_id = ?').get(app.id).cnt;
      if (attachCount === 0) {
        return { allowed: false, reason: '退回重提前需至少上传一个附件凭证' };
      }
    }
    return { allowed: true };
  }

  if (action === 'rectify') {
    if (user.role !== 'reimbursement_clerk') {
      return { allowed: false, reason: '只有报销专员可以补正重提' };
    }
    if (app.applicant_id && app.applicant_id !== user.id) {
      return { allowed: false, reason: '越权操作：只能补正自己提交的申请' };
    }
    const attachCount = db.prepare('SELECT COUNT(*) as cnt FROM attachments WHERE application_id = ?').get(app.id).cnt;
    if (attachCount === 0) {
      return { allowed: false, reason: '补正重提前需至少上传一个附件凭证' };
    }
    return { allowed: true };
  }

  if (action === 'review') {
    if (app.current_handler_role && app.current_handler_role !== user.role) {
      return { allowed: false, reason: `越权操作：当前待审核处理人角色为${app.current_handler_role}` };
    }
    if (app.current_handler && app.current_handler !== user.id) {
      return { allowed: false, reason: '越权操作：当前待审核处理人不是您' };
    }
    const attachCount = db.prepare('SELECT COUNT(*) as cnt FROM attachments WHERE application_id = ?').get(app.id).cnt;
    if (attachCount === 0) {
      return { allowed: false, reason: '缺证据：该申请无任何附件凭证，需退回或标记异常' };
    }
    const lastRecord = db.prepare(`
      SELECT * FROM process_records
      WHERE application_id = ? AND action IN ('submit','rectify')
      ORDER BY id DESC LIMIT 1
    `).get(app.id);
    if (lastRecord && lastRecord.operator_id === user.id) {
      return { allowed: false, reason: '状态冲突：不能审核自己提交的申请' };
    }
    return { allowed: true, require_comment: app.version > 1 };
  }

  if (action === 'verify') {
    if (app.current_handler_role && app.current_handler_role !== user.role) {
      return { allowed: false, reason: `越权操作：当前待复核处理人角色为${app.current_handler_role}` };
    }
    if (app.current_handler && app.current_handler !== user.id) {
      return { allowed: false, reason: '越权操作：当前待复核处理人不是您' };
    }
    if (app.is_overdue) {
      return { allowed: false, reason: '该申请已逾期，请先标记异常并说明逾期原因，不可直接推进复核' };
    }
    const unresolved = db.prepare(`
      SELECT COUNT(*) as cnt FROM exception_reasons
      WHERE application_id = ? AND resolved = 0 AND reason_code IN ('state_conflict','returned_rectify','risky_amount')
    `).get(app.id).cnt;
    if (unresolved > 0) {
      return { allowed: false, reason: `存在${unresolved}条状态冲突/退回补正/高风险异常，需逐条处理` };
    }
    const lastReview = db.prepare(`
      SELECT * FROM process_records
      WHERE application_id = ? AND action = 'review'
      ORDER BY id DESC LIMIT 1
    `).get(app.id);
    if (!lastReview) {
      return { allowed: false, reason: '缺少上一处理人（费用会计）的审核结果，不可越级复核' };
    }
    return { allowed: true, require_comment: true };
  }

  if (action === 'confirm') {
    if (app.current_handler_role && app.current_handler_role !== user.role) {
      return { allowed: false, reason: `越权操作：当前待确认处理人角色为${app.current_handler_role}` };
    }
    if (app.current_handler && app.current_handler !== user.id) {
      return { allowed: false, reason: '越权操作：当前待确认处理人不是您' };
    }
    if (app.status === 'exception') {
      const unresolved = db.prepare('SELECT COUNT(*) as cnt FROM exception_reasons WHERE application_id = ? AND resolved = 0').get(app.id).cnt;
      if (unresolved > 0) {
        return { allowed: false, reason: `存在${unresolved}条未解决异常，需先完成异常处理才能付款确认` };
      }
    }
    return { allowed: true, require_payment_evidence: true, require_overdue_note: !!app.is_overdue };
  }

  if (action === 'return' || action === 'reject' || action === 'exception') {
    if (app.status === 'exception' && action === 'return') {
      if (app.current_handler_role && app.current_handler_role !== user.role) {
        return { allowed: false, reason: `当前异常处理人为${app.current_handler_role}角色，您(${user.role})无权操作` };
      }
    } else if (app.status !== 'exception' && app.status !== 'returned') {
      if (app.current_handler_role && app.current_handler_role !== user.role) {
        return { allowed: false, reason: `越权操作：当前处理人角色为${app.current_handler_role}，您(${user.role})无权执行${action}` };
      }
      if (app.current_handler && app.current_handler !== user.id) {
        return { allowed: false, reason: `越权操作：当前处理人不是您，无权${action === 'return' ? '退回' : action === 'reject' ? '拒绝' : '标记异常'}` };
      }
    }
    if (action === 'exception' && app.status === 'exception') {
      return { allowed: false, reason: '已是异常状态，无需重复标记' };
    }
    if (action === 'reject' && app.status === 'rejected') {
      return { allowed: false, reason: '已是拒绝状态' };
    }
    if (action === 'return' && app.status === 'returned') {
      return { allowed: false, reason: '已是退回状态' };
    }
    return { allowed: true, require_comment: true, require_reason_code: action === 'exception' };
  }

  return { allowed: false, reason: '不支持的操作' };
}

function getAllowedActions(app, user) {
  const actions = [];
  for (const action of Object.keys(STATUS_FLOW)) {
    const check = _checkActionAllowed(app, user, action);
    if (check.allowed) {
      actions.push({
        action,
        require_comment: !!check.require_comment,
        require_payment_evidence: !!check.require_payment_evidence,
        require_overdue_note: !!check.require_overdue_note,
        require_reason_code: !!check.require_reason_code
      });
    }
  }
  return actions;
}

function getApplicationsByRole(userId, role, status = null) {
  const user = { id: userId, role };

  let sql = `
    SELECT ra.*,
      u.real_name as handler_name,
      (SELECT COUNT(*) FROM attachments a WHERE a.application_id = ra.id) as attachment_count,
      (SELECT COUNT(*) FROM exception_reasons er WHERE er.application_id = ra.id AND er.resolved = 0) as unresolved_exception_count,
      (SELECT GROUP_CONCAT(er.reason_code || ': ' || SUBSTR(er.reason_detail, 1, 40), ' | ')
       FROM exception_reasons er WHERE er.application_id = ra.id AND er.resolved = 0) as exception_summary
    FROM reimbursement_applications ra
    LEFT JOIN users u ON ra.current_handler = u.id
    WHERE 1=1
  `;
  const params = [];

  if (role === 'reimbursement_clerk') {
    sql += ` AND (ra.applicant_id = ? OR ra.status IN ('returned', 'completed', 'rejected'))`;
    params.push(userId);
  } else {
    sql += ` AND (
      (ra.current_handler_role = ? AND ra.current_handler = ?)
      OR
      (ra.current_handler_role = ? AND ra.status IN (SELECT value FROM (
        SELECT 'pending_review' as value WHERE ? = 'expense_accountant'
        UNION ALL SELECT 'verifying' WHERE ? = 'finance_manager'
        UNION ALL SELECT 'confirming' WHERE ? = 'expense_accountant'
        UNION ALL SELECT 'exception' WHERE ? IN ('expense_accountant', 'finance_manager')
      )))
      OR ra.status IN ('completed', 'rejected')
    )`;
    params.push(role, userId, role, role, role, role, role);
  }

  if (status) {
    sql += ` AND ra.status = ?`;
    params.push(status);
  }

  sql += ` ORDER BY
    CASE ra.status
      WHEN 'exception' THEN 1
      WHEN 'pending_review' THEN 2
      WHEN 'verifying' THEN 3
      WHEN 'confirming' THEN 4
      WHEN 'returned' THEN 5
      WHEN 'completed' THEN 6
      WHEN 'rejected' THEN 7
      ELSE 8
    END,
    ra.is_overdue DESC,
    ra.due_date ASC,
    ra.created_at DESC
  `;

  const list = db.prepare(sql).all(...params);

  const allWithoutFilter = db.prepare(`
    SELECT status, COUNT(*) as cnt
    FROM reimbursement_applications ra
    WHERE (
      (? = 'reimbursement_clerk' AND (ra.applicant_id = ? OR ra.status IN ('returned', 'completed', 'rejected')))
      OR
      (? != 'reimbursement_clerk' AND (
        (ra.current_handler_role = ? AND ra.current_handler = ?)
        OR ra.status IN ('completed', 'rejected')
        OR (? = 'expense_accountant' AND ra.status IN ('pending_review', 'confirming', 'exception'))
        OR (? = 'finance_manager' AND ra.status = 'verifying')
      ))
    )
    GROUP BY status
  `).all(role, userId, role, role, userId, role, role);

  const statistics = {
    total: list.length,
    pending_review: 0,
    verifying: 0,
    confirming: 0,
    exception: 0,
    completed: 0,
    rejected: 0,
    returned: 0,
    overdue: 0,
    has_exception: 0,
    pending_count: 0,
    exception_count: 0,
    completed_count: 0
  };

  allWithoutFilter.forEach(item => {
    if (statistics.hasOwnProperty(item.status)) {
      statistics[item.status] = item.cnt;
    }
  });

  statistics.pending_count = statistics.pending_review + statistics.verifying + statistics.confirming;
  statistics.exception_count = statistics.exception;
  statistics.completed_count = statistics.completed + statistics.rejected + statistics.returned;

  list.forEach(item => {
    if (item.is_overdue) statistics.overdue++;
    if (item.unresolved_exception_count > 0) statistics.has_exception++;
    const actions = getAllowedActions(item, user);
    item.allowed_actions = actions.map(a => a.action);
    item.action_requirements = actions.reduce((acc, a) => {
      acc[a.action] = {
        require_comment: a.require_comment,
        require_payment_evidence: a.require_payment_evidence,
        require_overdue_note: a.require_overdue_note,
        require_reason_code: a.require_reason_code
      };
      return acc;
    }, {});
  });

  return { list, statistics };
}

function getApplicationDetail(id, user = null) {
  const application = db.prepare(`
    SELECT ra.*, u.real_name as handler_name
    FROM reimbursement_applications ra
    LEFT JOIN users u ON ra.current_handler = u.id
    WHERE ra.id = ?
  `).get(id);

  if (!application) return null;

  const attachments = db.prepare(`
    SELECT * FROM attachments WHERE application_id = ? ORDER BY uploaded_at ASC
  `).all(id);

  const processRecords = db.prepare(`
    SELECT * FROM process_records WHERE application_id = ? ORDER BY created_at ASC, id ASC
  `).all(id);

  const exceptions = db.prepare(`
    SELECT er.*, u.real_name as handler_name
    FROM exception_reasons er
    LEFT JOIN users u ON er.handler_id = u.id
    WHERE er.application_id = ?
    ORDER BY er.id ASC
  `).all(id);

  const auditNotes = db.prepare(`
    SELECT an.*, u.real_name as operator_name
    FROM audit_notes an
    LEFT JOIN users u ON an.operator_id = u.id
    WHERE an.application_id = ?
    ORDER BY an.created_at ASC
  `).all(id);

  processRecords.forEach(pr => {
    try {
      pr.evidence_snapshot = pr.evidence_snapshot ? JSON.parse(pr.evidence_snapshot) : null;
    } catch (e) {
      pr.evidence_snapshot = null;
    }
  });

  application.attachment_count = attachments.length;
  application.unresolved_exception_count = exceptions.filter(e => !e.resolved).length;
  application.exception_summary = exceptions
    .filter(e => !e.resolved)
    .map(e => `${e.reason_code}: ${e.reason_detail ? e.reason_detail.substring(0, 40) : ''}`)
    .join(' | ') || null;

  if (user) {
    const actions = getAllowedActions(application, user);
    application.allowed_actions = actions.map(a => a.action);
    application.action_requirements = actions.reduce((acc, a) => {
      acc[a.action] = {
        require_comment: a.require_comment,
        require_payment_evidence: a.require_payment_evidence,
        require_overdue_note: a.require_overdue_note,
        require_reason_code: a.require_reason_code
      };
      return acc;
    }, {});
  }

  return {
    ...application,
    attachments,
    process_records: processRecords,
    exceptions,
    audit_notes: auditNotes
  };
}

function processApplication(applicationId, user, payload) {
  const { action, comment = '', version, evidence_snapshot = null } = payload;

  const app = db.prepare('SELECT * FROM reimbursement_applications WHERE id = ?').get(applicationId);
  if (!app) {
    return { success: false, message: '申请单不存在' };
  }

  if (version !== undefined && Number(version) !== app.version) {
    return { success: false, message: `版本冲突，当前版本: ${app.version}，提交版本: ${version}，请刷新后重试` };
  }

  const check = _checkActionAllowed(app, user, action);
  if (!check.allowed) {
    return { success: false, message: check.reason };
  }

  if (check.require_comment && (!comment || comment.trim().length < 3)) {
    const actionLabel = action === 'return' ? '退回' : action === 'reject' ? '拒绝' : action === 'exception' ? '标记异常' : action === 'review' ? '审核' : action === 'verify' ? '复核' : action;
    const minLen = (action === 'review' && app.version > 1) || action === 'rectify' || (action === 'submit' && app.status === 'returned') ? 5 : 3;
    if (!comment || comment.trim().length < minLen) {
      return { success: false, message: `${actionLabel}操作必须填写意见（不少于${minLen}字）` };
    }
  }

  if (check.require_reason_code && !payload.reason_code) {
    return { success: false, message: '标记异常必须选择异常原因类型（reason_code）' };
  }

  if (check.require_payment_evidence && (!payload.payment_evidence || payload.payment_evidence.trim().length < 5)) {
    return { success: false, message: '付款确认必须填写付款凭证/流水号，缺付款记录时报销申请不得放行' };
  }

  if (check.require_overdue_note && (!payload.overdue_note || payload.overdue_note.trim().length < 10)) {
    return { success: false, message: '逾期申请付款确认需额外填写逾期说明（overdue_note不少于10字），不可悄悄放行' };
  }

  if ((action === 'submit' && app.status === 'returned') || action === 'rectify') {
    if (!comment || comment.trim().length < 5) {
      return { success: false, message: '补正重提必须填写补正说明（不少于5字），说明上次退回问题已解决' };
    }
  }

  const flow = STATUS_FLOW[action];

  const tx = db.transaction(() => {
    let nextHandlerId = null;
    let nextHandlerRole = flow.nextHandlerRole;

    if (nextHandlerRole) {
      const handler = _getHandlerByRole(nextHandlerRole);
      if (handler) nextHandlerId = handler.id;
    }

    const newVersion = (action === 'rectify' || (action === 'submit' && app.status === 'returned'))
      ? app.version + 1
      : app.version;

    const updateFields = `
      UPDATE reimbursement_applications
      SET status = ?,
          current_handler = ?,
          current_handler_role = ?,
          version = ?,
          updated_at = ?
          ${action === 'confirm' ? ', payment_evidence = ?' : ''}
      WHERE id = ?
    `;
    const updateParams = [
      flow.to,
      nextHandlerId,
      nextHandlerRole,
      newVersion,
      dayjs().format('YYYY-MM-DD HH:mm:ss')
    ];
    if (action === 'confirm') {
      updateParams.push(payload.payment_evidence);
    }
    updateParams.push(applicationId);
    db.prepare(updateFields).run(...updateParams);

    const recordId = db.prepare(`
      INSERT INTO process_records
      (application_id, operator_id, operator_name, operator_role, from_status, to_status,
       action, comment, evidence_snapshot, version, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      applicationId,
      user.id,
      user.real_name,
      user.role,
      app.status,
      flow.to,
      action,
      comment + (action === 'confirm' && payload.overdue_note ? ` | 逾期说明: ${payload.overdue_note}` : ''),
      evidence_snapshot ? JSON.stringify(evidence_snapshot) :
        (action === 'confirm' ? JSON.stringify({ payment_evidence: payload.payment_evidence }) : null),
      newVersion,
      dayjs().format('YYYY-MM-DD HH:mm:ss')
    ).lastInsertRowid;

    if (action === 'exception' && payload.reason_code) {
      db.prepare(`
        INSERT INTO exception_reasons
        (application_id, process_record_id, reason_code, reason_detail, handler_id, resolved)
        VALUES (?, ?, ?, ?, ?, 0)
      `).run(
        applicationId,
        recordId,
        payload.reason_code,
        payload.reason_detail || comment || '处理异常',
        payload.handler_id || app.applicant_id
      );
    }

    if (action === 'return') {
      db.prepare(`
        INSERT INTO exception_reasons
        (application_id, process_record_id, reason_code, reason_detail, handler_id, resolved)
        VALUES (?, ?, 'returned_rectify', ?, ?, 0)
      `).run(
        applicationId,
        recordId,
        comment || '退回补正，请按要求完善材料',
        app.applicant_id
      );
    }

    if ((action === 'rectify' || action === 'submit') && app.status === 'returned') {
      db.prepare(`
        UPDATE exception_reasons
        SET resolved = 1,
            resolved_at = ?,
            rectify_note = ?
        WHERE application_id = ? AND resolved = 0 AND reason_code = 'returned_rectify'
      `).run(
        dayjs().format('YYYY-MM-DD HH:mm:ss'),
        comment || '已补正并重新提交',
        applicationId
      );
    }

    if (action === 'rectify' && app.status === 'exception') {
      db.prepare(`
        UPDATE exception_reasons
        SET resolved = 1,
            resolved_at = ?,
            rectify_note = ?
        WHERE application_id = ? AND resolved = 0
      `).run(
        dayjs().format('YYYY-MM-DD HH:mm:ss'),
        comment || '异常已解除并重新提交',
        applicationId
      );
    }

    if (action === 'confirm' && app.is_overdue) {
      const timeoutExceptions = db.prepare(`
        SELECT id FROM exception_reasons
        WHERE application_id = ? AND reason_code = 'timeout' AND resolved = 0
      `).all(applicationId);
      timeoutExceptions.forEach(ex => {
        db.prepare(`
          UPDATE exception_reasons
          SET resolved = 1, resolved_at = ?, rectify_note = ?
          WHERE id = ?
        `).run(
          dayjs().format('YYYY-MM-DD HH:mm:ss'),
          payload.overdue_note || '已处理逾期并完成付款',
          ex.id
        );
      });
    }

    return { success: true, new_version: newVersion, to_status: flow.to, record_id: recordId };
  });

  try {
    const result = tx();
    const detail = getApplicationDetail(applicationId, user);
    return { ...result, message: '操作成功', detail };
  } catch (err) {
    console.error('[processApplication] 事务失败:', err);
    return { success: false, message: '处理失败：' + err.message };
  }
}

function batchProcess(items, user) {
  const appNos = {};
  try {
    const rows = db.prepare(`SELECT id, application_no FROM reimbursement_applications WHERE id IN (${items.map(() => '?').join(',')})`).all(...items.map(i => i.id));
    rows.forEach(r => { appNos[r.id] = r.application_no; });
  } catch (e) {}

  const results = items.map(item => {
    try {
      const result = processApplication(item.id, user, item);
      const detail = result.detail;
      const auditNote = `批量处理：${item.action}，结果：${result.success ? '成功' : '失败'}，原因：${result.message}`;
      try {
        db.prepare(`
          INSERT INTO audit_notes (application_id, note, operator_id, created_at)
          VALUES (?, ?, ?, ?)
        `).run(
          item.id,
          auditNote,
          user.id,
          dayjs().format('YYYY-MM-DD HH:mm:ss')
        );
      } catch (e) {
        console.error('[batchProcess] 写入audit_notes失败:', e);
      }

      return {
        id: item.id,
        application_no: appNos[item.id] || '',
        success: result.success,
        message: result.message,
        action: item.action,
        ...(result.success ? {
          to_status: result.to_status,
          new_version: result.new_version,
          exception_summary: detail?.exception_summary || null,
          rectify_note: detail?.exceptions?.filter(e => e.resolved && e.rectify_note).map(e => e.rectify_note).join('; ') || null
        } : {}),
        audit_note: auditNote
      };
    } catch (err) {
      return {
        id: item.id,
        application_no: appNos[item.id] || '',
        success: false,
        action: item.action,
        message: '系统异常: ' + err.message
      };
    }
  });

  const successCount = results.filter(r => r.success).length;
  const failCount = results.filter(r => !r.success).length;

  return {
    total: items.length,
    success_count: successCount,
    fail_count: failCount,
    results
  };
}

function getAllowedActionsBatch(ids, user) {
  const apps = db.prepare(`SELECT * FROM reimbursement_applications WHERE id IN (${ids.map(() => '?').join(',')}) ORDER BY id`).all(...ids);

  if (apps.length === 0) return { common_actions: [], actions_by_id: {} };

  let commonActions = null;
  const actionsById = {};

  for (const app of apps) {
    const actions = getAllowedActions(app, user).map(a => a.action);
    actionsById[app.id] = actions;
    if (commonActions === null) {
      commonActions = new Set(actions);
    } else {
      const next = new Set();
      for (const a of actions) {
        if (commonActions.has(a)) next.add(a);
      }
      commonActions = next;
    }
  }

  return {
    common_actions: Array.from(commonActions || []),
    actions_by_id: actionsById
  };
}

module.exports = {
  getApplicationsByRole,
  getApplicationDetail,
  processApplication,
  batchProcess,
  getAllowedActionsBatch,
  getAllowedActions
};
