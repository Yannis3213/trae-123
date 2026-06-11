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

const ROLE_HANDLER_MAP = {
  expense_accountant: ['pending_review', 'confirming', 'exception'],
  finance_manager: ['verifying'],
  reimbursement_clerk: ['returned']
};

function getApplicationsByRole(userId, role, status = null) {
  let sql = `
    SELECT ra.*,
      (SELECT COUNT(*) FROM attachments a WHERE a.application_id = ra.id) as attachment_count,
      (SELECT COUNT(*) FROM exception_reasons er WHERE er.application_id = ra.id AND er.resolved = 0) as unresolved_exception_count
    FROM reimbursement_applications ra
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
    reviewing: 0,
    verifying: 0,
    confirming: 0,
    exception: 0,
    completed: 0,
    rejected: 0,
    returned: 0,
    overdue: 0,
    has_exception: 0
  };

  allWithoutFilter.forEach(item => {
    if (statistics.hasOwnProperty(item.status)) {
      statistics[item.status] = item.cnt;
    }
  });

  list.forEach(item => {
    if (item.is_overdue) statistics.overdue++;
    if (item.unresolved_exception_count > 0) statistics.has_exception++;
  });

  return { list, statistics };
}

function getApplicationDetail(id) {
  const application = db.prepare(`
    SELECT * FROM reimbursement_applications WHERE id = ?
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

  if (!STATUS_FLOW[action]) {
    return { success: false, message: `未知操作类型: ${action}` };
  }

  const flow = STATUS_FLOW[action];
  if (flow.role !== '*' && flow.role !== user.role) {
    return { success: false, message: `当前角色(${user.role})无权执行${action}操作` };
  }

  const app = db.prepare('SELECT * FROM reimbursement_applications WHERE id = ?').get(applicationId);
  if (!app) {
    return { success: false, message: '申请单不存在' };
  }

  if (version !== undefined && Number(version) !== app.version) {
    return { success: false, message: `版本冲突，当前版本: ${app.version}，提交版本: ${version}，请刷新后重试` };
  }

  if (!flow.from.includes(app.status) && !(flow.from.includes(null) && action === 'submit')) {
    return { success: false, message: `当前状态(${app.status})不允许${action}操作` };
  }

  if (app.current_handler_role && app.current_handler_role !== user.role && flow.role !== '*') {
    if (action === 'return' || action === 'reject' || action === 'exception') {
    } else if (app.current_handler && app.current_handler !== user.id) {
      return { success: false, message: `越权操作：当前处理人不是您，当前处理人角色为${app.current_handler_role}` };
    }
  }

  if (action === 'review') {
    if (app.version > 1) {
      const unresolved = db.prepare(`
        SELECT COUNT(*) as cnt FROM exception_reasons
        WHERE application_id = ? AND resolved = 0
      `).get(applicationId).cnt;
      if (unresolved > 0) {
        return { success: false, message: `复核失败：存在${unresolved}条未解决的异常原因，请先处理补正或退回` };
      }
      const lastReturn = db.prepare(`
        SELECT * FROM process_records
        WHERE application_id = ? AND action = 'return'
        ORDER BY id DESC LIMIT 1
      `).get(applicationId);
      if (lastReturn && (!comment || comment.trim().length < 5)) {
        return { success: false, message: '该申请曾被退回，复核时必须说明是否已核实退回意见（comment不少于5字）' };
      }
    }
    const lastRecord = db.prepare(`
      SELECT * FROM process_records
      WHERE application_id = ? AND action IN ('submit','rectify')
      ORDER BY id DESC LIMIT 1
    `).get(applicationId);
    if (lastRecord && lastRecord.operator_id === user.id) {
      return { success: false, message: '状态冲突：不能复核自己提交的申请' };
    }
    const attachCount = db.prepare('SELECT COUNT(*) as cnt FROM attachments WHERE application_id = ?').get(applicationId).cnt;
    if (attachCount === 0) {
      return { success: false, message: '缺证据：该申请无任何附件凭证，需退回或标记异常' };
    }
  }

  if (action === 'verify') {
    if (app.is_overdue) {
      return { success: false, message: '该申请已逾期，请先标记异常并说明逾期原因，不可直接推进复核' };
    }
    const unresolved = db.prepare(`
      SELECT COUNT(*) as cnt FROM exception_reasons
      WHERE application_id = ? AND resolved = 0 AND reason_code IN ('state_conflict','returned_rectify','risky_amount')
    `).get(applicationId).cnt;
    if (unresolved > 0) {
      return { success: false, message: `财务经理复核被拦截：存在${unresolved}条状态冲突/退回补正/高风险异常，需逐条处理` };
    }
    const lastReview = db.prepare(`
      SELECT * FROM process_records
      WHERE application_id = ? AND action = 'review'
      ORDER BY id DESC LIMIT 1
    `).get(applicationId);
    if (!lastReview) {
      return { success: false, message: '缺少上一处理人（费用会计）的审核结果，不可越级复核' };
    }
    if (!comment || comment.trim().length < 3) {
      return { success: false, message: '财务经理必须填写复核意见（不少于3字）' };
    }
  }

  if (action === 'confirm') {
    if (!payload.payment_evidence || payload.payment_evidence.trim().length < 5) {
      return { success: false, message: '付款确认必须填写付款凭证/流水号，缺付款记录时报销申请不得放行' };
    }
    if (app.status === 'exception') {
      const unresolved = db.prepare('SELECT COUNT(*) as cnt FROM exception_reasons WHERE application_id = ? AND resolved = 0').get(applicationId).cnt;
      if (unresolved > 0) {
        return { success: false, message: `存在${unresolved}条未解决异常，需先完成异常处理才能付款确认` };
      }
    }
    if (app.is_overdue) {
      if (!payload.overdue_note || payload.overdue_note.trim().length < 10) {
        return { success: false, message: '逾期申请付款确认需额外填写逾期说明（overdue_note不少于10字），不可悄悄放行' };
      }
    }
  }

  if ((action === 'submit' && app.status === 'returned') || action === 'rectify') {
    const attachCount = db.prepare('SELECT COUNT(*) as cnt FROM attachments WHERE application_id = ?').get(applicationId).cnt;
    if (attachCount === 0) {
      return { success: false, message: '退回重提前请至少上传一个附件凭证' };
    }
    if (!comment || comment.trim().length < 5) {
      return { success: false, message: '补正重提必须填写补正说明（不少于5字），说明上次退回问题已解决' };
    }
  }

  const tx = db.transaction(() => {
    let nextHandlerId = null;
    let nextHandlerRole = flow.nextHandlerRole;

    if (nextHandlerRole) {
      const handler = db.prepare('SELECT * FROM users WHERE role = ? LIMIT 1').get(nextHandlerRole);
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
    return { ...result, message: '操作成功' };
  } catch (err) {
    console.error('[processApplication] 事务失败:', err);
    return { success: false, message: '处理失败：' + err.message };
  }
}

function batchProcess(items, user) {
  const results = items.map(item => {
    try {
      const result = processApplication(item.id, user, item);
      return {
        id: item.id,
        success: result.success,
        message: result.message,
        action: item.action,
        ...(result.success ? { to_status: result.to_status, new_version: result.new_version } : {})
      };
    } catch (err) {
      return {
        id: item.id,
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

module.exports = {
  getApplicationsByRole,
  getApplicationDetail,
  processApplication,
  batchProcess
};
