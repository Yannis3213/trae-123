const { AppError } = require('../middleware/errorHandler');

const STATUS_LABELS = {
  pending_assign: '待分派',
  assigned: '已分派',
  processing: '处理中',
  transferred: '已转办',
  returned_for_correction: '退回补正',
  reprocessing: '补正中',
  follow_up_scheduled: '待回访',
  followed_up: '已回访',
  reviewing: '复核中',
  archived: '已归档'
};

const STATUS_GROUPS = {
  normal: ['pending_assign', 'assigned', 'processing', 'followed_up', 'reviewing', 'archived'],
  approaching: [],
  overdue: []
};

const ROLE_LABELS = {
  nurse: '前台护士',
  doctor: '兽医师',
  director: '院长'
};

const PRIORITY_LABELS = {
  urgent: '紧急',
  high: '高',
  normal: '普通',
  low: '低'
};

const EXCEPTION_TYPE_LABELS = {
  material: '材料问题',
  permission: '权限问题',
  timeline: '时限问题',
  status: '状态问题'
};

const TRANSITIONS = {
  pending_assign: {
    assign: {
      to: 'assigned',
      allowedRoles: ['nurse'],
      label: '分派兽医师',
      requiresEvidence: [],
      updates: { assignee_id: true }
    }
  },
  assigned: {
    start_process: {
      to: 'processing',
      allowedRoles: ['doctor'],
      label: '开始接诊',
      requiresEvidence: [],
      updates: { handler_id: true }
    }
  },
  processing: {
    transfer: {
      to: 'transferred',
      allowedRoles: ['doctor'],
      label: '转办（待补充材料）',
      requiresEvidence: ['诊断记录'],
      optionalEvidence: true,
      updates: {}
    },
    schedule_follow_up: {
      to: 'follow_up_scheduled',
      allowedRoles: ['doctor'],
      label: '完成治疗，安排回访',
      requiresEvidence: ['诊断记录', '治疗方案', '处方单'],
      updates: {}
    }
  },
  transferred: {
    resume_process: {
      to: 'processing',
      allowedRoles: ['doctor'],
      label: '补充材料，恢复处理',
      requiresEvidence: ['补充材料'],
      updates: {}
    }
  },
  returned_for_correction: {
    reprocess: {
      to: 'reprocessing',
      allowedRoles: ['doctor', 'nurse'],
      label: '开始补正',
      requiresEvidence: [],
      updates: {}
    }
  },
  reprocessing: {
    submit_correction: {
      to: 'reviewing',
      allowedRoles: ['doctor'],
      label: '补正完成，提交复核',
      requiresEvidence: ['补正材料', '补正说明'],
      updates: { reviewer_id: true }
    }
  },
  follow_up_scheduled: {
    do_follow_up: {
      to: 'followed_up',
      allowedRoles: ['nurse'],
      label: '完成回访',
      requiresEvidence: ['回访记录'],
      updates: {}
    }
  },
  followed_up: {
    submit_review: {
      to: 'reviewing',
      allowedRoles: ['doctor'],
      label: '提交院长复核',
      requiresEvidence: [],
      updates: { reviewer_id: true }
    }
  },
  reviewing: {
    archive: {
      to: 'archived',
      allowedRoles: ['director'],
      label: '复核通过，归档',
      requiresEvidence: [],
      updates: {}
    },
    return_for_correction: {
      to: 'returned_for_correction',
      allowedRoles: ['director'],
      label: '退回补正',
      requiresEvidence: ['退回原因说明'],
      updates: {}
    }
  }
};

const getDeadlineStatus = (deadline) => {
  if (!deadline) return 'normal';
  const now = new Date();
  const dl = new Date(deadline);
  const diffHours = (dl - now) / (1000 * 60 * 60);

  if (diffHours < 0) return 'overdue';
  if (diffHours <= 24) return 'approaching';
  return 'normal';
};

const checkDeadline = (order) => {
  const status = getDeadlineStatus(order.deadline);
  if (status === 'overdue' && !['archived'].includes(order.status)) {
    return {
      isOverdue: true,
      exceptionType: 'timeline',
      exceptionReason: `就诊单已逾期，截止时间为 ${new Date(order.deadline).toLocaleString()}`
    };
  }
  return { isOverdue: status === 'overdue', exceptionType: null, exceptionReason: null };
};

const validateTransition = (db, order, action, user, payload = {}) => {
  const currentTransitions = TRANSITIONS[order.status];
  if (!currentTransitions || !currentTransitions[action]) {
    throw new AppError(
      `当前状态「${STATUS_LABELS[order.status]}」不支持操作「${action}」`,
      400,
      'status'
    );
  }

  const transition = currentTransitions[action];

  if (!transition.allowedRoles.includes(user.role)) {
    throw new AppError(
      `角色「${ROLE_LABELS[user.role]}」无权执行操作「${transition.label}」，需要角色：${transition.allowedRoles.map(r => ROLE_LABELS[r]).join(' / ')}`,
      403,
      'permission'
    );
  }

  if (user.role === 'doctor' && order.assignee_id && order.assignee_id !== user.id && order.handler_id && order.handler_id !== user.id) {
    throw new AppError(
      '越权操作：您不是该就诊单的分派兽医师，无法处理此单据',
      403,
      'permission'
    );
  }

  if (user.role === 'director' && order.reviewer_id && order.reviewer_id !== user.id) {
    throw new AppError(
      '越权操作：您不是该就诊单的复核院长',
      403,
      'permission'
    );
  }

  if (payload.version !== undefined && payload.version !== order.version) {
    throw new AppError(
      `版本冲突：当前版本为 ${order.version}，您提交的版本为 ${payload.version}，请刷新后重试`,
      409,
      'status'
    );
  }

  if (transition.requiresEvidence && transition.requiresEvidence.length > 0 && !transition.optionalEvidence) {
    const providedEvidence = payload.evidence_provided ? String(payload.evidence_provided).split(/[,，、]/).map(s => s.trim()).filter(Boolean) : [];
    const missing = transition.requiresEvidence.filter(e => !providedEvidence.some(p => p.includes(e) || e.includes(p)));
    if (missing.length > 0) {
      throw new AppError(
        `缺少必填证据材料：${missing.join('、')}`,
        400,
        'material'
      );
    }
  }

  if (transition.updates && transition.updates.assignee_id && !payload.assignee_id) {
    throw new AppError('分派操作必须指定兽医师', 400, 'material');
  }

  if (transition.updates && transition.updates.reviewer_id && !payload.reviewer_id) {
    payload.reviewer_id = user.id;
  }

  if (transition.updates && transition.updates.handler_id && !payload.handler_id) {
    payload.handler_id = user.id;
  }

  return transition;
};

const executeTransition = (db, order, action, user, payload = {}) => {
  const transition = validateTransition(db, order, action, user, payload);

  const deadlineCheck = checkDeadline(order);

  const stmt = db.prepare(`
    UPDATE visit_orders
    SET status = ?,
        version = version + 1,
        assignee_id = COALESCE(?, assignee_id),
        handler_id = COALESCE(?, handler_id),
        reviewer_id = COALESCE(?, reviewer_id),
        is_overdue = ?,
        exception_type = COALESCE(?, exception_type),
        exception_reason = COALESCE(?, exception_reason),
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND version = ?
  `);

  const result = stmt.run(
    transition.to,
    payload.assignee_id || null,
    payload.handler_id || null,
    payload.reviewer_id || null,
    deadlineCheck.isOverdue ? 1 : (order.is_overdue || 0),
    deadlineCheck.exceptionType,
    deadlineCheck.exceptionReason,
    order.id,
    payload.version || order.version
  );

  if (result.changes === 0) {
    throw new AppError(
      '状态变更失败：版本冲突或单据已被他人修改，请刷新后重试',
      409,
      'status'
    );
  }

  const recordStmt = db.prepare(`
    INSERT INTO processing_records (
      visit_order_id, action, from_status, to_status,
      operator_id, operator_role, comment,
      exception_type, exception_reason,
      evidence_required, evidence_provided
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  recordStmt.run(
    order.id,
    action,
    order.status,
    transition.to,
    user.id,
    user.role,
    payload.comment || transition.label,
    payload.exception_type || deadlineCheck.exceptionType,
    payload.exception_reason || deadlineCheck.exceptionReason,
    transition.requiresEvidence ? transition.requiresEvidence.join('、') : null,
    payload.evidence_provided || null
  );

  const updated = db.prepare('SELECT * FROM visit_orders WHERE id = ?').get(order.id);

  return {
    success: true,
    from: order.status,
    to: transition.to,
    order: updated,
    message: `已${transition.label}`
  };
};

const getAllowedActions = (order, user) => {
  const currentTransitions = TRANSITIONS[order.status] || {};
  const allowed = [];

  for (const [action, transition] of Object.entries(currentTransitions)) {
    if (transition.allowedRoles.includes(user.role)) {
      if (user.role === 'doctor' && order.assignee_id && order.assignee_id !== user.id && order.handler_id && order.handler_id !== user.id) {
        continue;
      }
      if (user.role === 'director' && order.reviewer_id && order.reviewer_id !== user.id && order.status === 'reviewing') {
        continue;
      }
      allowed.push({
        action,
        label: transition.label,
        to: transition.to,
        toLabel: STATUS_LABELS[transition.to],
        requiresEvidence: transition.requiresEvidence || []
      });
    }
  }

  return allowed;
};

const canViewOrder = (order, user) => {
  if (user.role === 'director') return true;
  if (user.role === 'nurse') return true;
  if (user.role === 'doctor') {
    return !order.assignee_id || order.assignee_id === user.id || order.handler_id === user.id;
  }
  return false;
};

module.exports = {
  STATUS_LABELS,
  STATUS_GROUPS,
  ROLE_LABELS,
  PRIORITY_LABELS,
  EXCEPTION_TYPE_LABELS,
  TRANSITIONS,
  getDeadlineStatus,
  checkDeadline,
  validateTransition,
  executeTransition,
  getAllowedActions,
  canViewOrder
};
