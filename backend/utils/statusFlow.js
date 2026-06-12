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
    },
    overdue_assign: {
      to: 'assigned',
      allowedRoles: ['director'],
      label: '逾期强派（院长干预）',
      requiresEvidence: ['逾期处理说明'],
      updates: { assignee_id: true },
      isOverdueAction: true
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
      updates: {},
      onExecute: (order, payload) => ({
        material_status: 'incomplete',
        exception_type: 'material',
        exception_reason: payload.exception_reason || '材料不完整，需补充后恢复处理'
      })
    },
    schedule_follow_up: {
      to: 'follow_up_scheduled',
      allowedRoles: ['doctor'],
      label: '完成治疗，安排回访',
      requiresEvidence: ['诊断记录', '治疗方案', '处方单'],
      updates: {},
      onExecute: () => ({
        material_status: 'complete',
        exception_type: null,
        exception_reason: null
      })
    }
  },
  transferred: {
    resume_process: {
      to: 'processing',
      allowedRoles: ['doctor'],
      label: '补充材料，恢复处理',
      requiresEvidence: ['补充材料'],
      updates: {},
      onExecute: (order, payload) => ({
        material_status: 'complete',
        exception_type: null,
        exception_reason: null,
        correction_action: payload.correction_action || '补充缺失材料，恢复处理流程'
      })
    }
  },
  returned_for_correction: {
    reprocess: {
      to: 'reprocessing',
      allowedRoles: ['doctor', 'nurse'],
      label: '开始补正',
      requiresEvidence: [],
      updates: {},
      onExecute: (order, payload) => ({
        correction_action: payload.correction_action || '按退回要求进行补正',
        exception_reason: `补正中：${payload.correction_action || '按退回要求进行补正'}`
      })
    }
  },
  reprocessing: {
    submit_correction: {
      to: 'reviewing',
      allowedRoles: ['doctor'],
      label: '补正完成，提交复核',
      requiresEvidence: ['补正材料', '补正说明'],
      updates: { reviewer_id: true },
      onExecute: (order, payload) => ({
        material_status: 'complete',
        exception_type: null,
        exception_reason: null,
        correction_action: payload.correction_action || `补正完成并提交：${(payload.evidence_provided || '补正材料')}`
      })
    }
  },
  follow_up_scheduled: {
    do_follow_up: {
      to: 'followed_up',
      allowedRoles: ['nurse'],
      label: '完成回访',
      requiresEvidence: ['回访记录'],
      updates: {},
      onExecute: () => ({
        exception_type: null,
        exception_reason: null
      })
    }
  },
  followed_up: {
    submit_review: {
      to: 'reviewing',
      allowedRoles: ['doctor'],
      label: '提交院长复核',
      requiresEvidence: [],
      updates: { reviewer_id: true },
      onExecute: () => ({
        exception_type: null,
        exception_reason: null
      })
    }
  },
  reviewing: {
    archive: {
      to: 'archived',
      allowedRoles: ['director'],
      label: '复核通过，归档',
      requiresEvidence: [],
      updates: {},
      onExecute: () => ({
        exception_type: null,
        exception_reason: null,
        correction_action: null,
        is_overdue: 0
      })
    },
    return_for_correction: {
      to: 'returned_for_correction',
      allowedRoles: ['director'],
      label: '退回补正',
      requiresEvidence: ['退回原因说明'],
      updates: {},
      onExecute: (order, payload) => ({
        material_status: 'incomplete',
        exception_type: payload.exception_type || 'material',
        exception_reason: payload.exception_reason || '材料不完整，需补正后重新提交',
        correction_action: null
      })
    }
  }
};

const OVERDUE_ADVANCE_MAP = {
  pending_assign: { to: 'assigned', label: '逾期推进：强制分派', requiresAssignee: true },
  assigned: { to: 'processing', label: '逾期推进：强制接诊' },
  processing: { to: 'follow_up_scheduled', label: '逾期推进：强制完成治疗' },
  transferred: { to: 'processing', label: '逾期推进：强制恢复处理' },
  returned_for_correction: { to: 'reprocessing', label: '逾期推进：强制开始补正' },
  reprocessing: { to: 'reviewing', label: '逾期推进：强制提交复核', requiresEvidence: true },
  follow_up_scheduled: { to: 'followed_up', label: '逾期推进：强制完成回访' },
  followed_up: { to: 'reviewing', label: '逾期推进：强制提交复核' },
  reviewing: { to: 'archived', label: '逾期推进：强制归档' }
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
      exceptionReason: `就诊单已逾期，截止时间为 ${new Date(order.deadline).toLocaleString()}，当前责任人：${order.assignee_id ? '分派兽医师' : (order.handler_id ? '接诊兽医师' : '未分派')}`
    };
  }
  return { isOverdue: status === 'overdue', exceptionType: null, exceptionReason: null };
};

const validateTransition = (db, order, action, user, payload = {}) => {
  if (action === 'overdue_advance') {
    return validateOverdueAdvance(db, order, user, payload);
  }

  const currentTransitions = TRANSITIONS[order.status];
  if (!currentTransitions || !currentTransitions[action]) {
    throw new AppError(
      `当前状态「${STATUS_LABELS[order.status]}」不支持操作「${action}」，允许的操作：${Object.keys(currentTransitions || {}).join('、') || '无'}`,
      400,
      'status'
    );
  }

  const transition = currentTransitions[action];

  if (!transition.allowedRoles.includes(user.role)) {
    throw new AppError(
      `权限不足：角色「${ROLE_LABELS[user.role]}」无权执行「${transition.label}」，需要角色：${transition.allowedRoles.map(r => ROLE_LABELS[r]).join(' / ')}`,
      403,
      'permission'
    );
  }

  if (user.role === 'doctor' && order.assignee_id && order.assignee_id !== user.id && order.handler_id && order.handler_id !== user.id) {
    throw new AppError(
      `越权操作：您（${ROLE_LABELS[user.role]}）不是该就诊单的责任兽医师（分派：用户${order.assignee_id}，接诊：用户${order.handler_id || '无'}），无法处理此单据`,
      403,
      'permission'
    );
  }

  if (user.role === 'director' && order.reviewer_id && order.reviewer_id !== user.id && ['reviewing'].includes(order.status)) {
    throw new AppError(
      `越权操作：您不是该就诊单的指定复核院长（复核人：用户${order.reviewer_id}），无法在此状态下操作`,
      403,
      'permission'
    );
  }

  if (payload.version !== undefined && payload.version !== order.version) {
    throw new AppError(
      `版本冲突：当前版本为 ${order.version}，您提交的版本为 ${payload.version}，单据已被他人修改，请刷新后重试`,
      409,
      'status'
    );
  }

  if (transition.requiresEvidence && transition.requiresEvidence.length > 0 && !transition.optionalEvidence) {
    const providedEvidence = payload.evidence_provided ? String(payload.evidence_provided).split(/[,，、]/).map(s => s.trim()).filter(Boolean) : [];
    const missing = transition.requiresEvidence.filter(e => !providedEvidence.some(p => p.includes(e) || e.includes(p)));
    if (missing.length > 0) {
      throw new AppError(
        `缺少必填证据材料：${missing.join('、')}（已提供：${providedEvidence.join('、') || '无'}，需要：${transition.requiresEvidence.join('、')}）`,
        400,
        'material'
      );
    }
  }

  if (transition.isOverdueAction) {
    const dlStatus = getDeadlineStatus(order.deadline);
    if (dlStatus !== 'overdue') {
      throw new AppError(
        `逾期操作校验失败：该就诊单当前未逾期（到期状态：${dlStatus === 'approaching' ? '临期' : '正常'}），不能使用逾期强制操作`,
        400,
        'timeline'
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

const validateOverdueAdvance = (db, order, user, payload = {}) => {
  if (user.role !== 'director') {
    throw new AppError(
      `逾期推进权限不足：仅院长可执行逾期强制推进，当前角色「${ROLE_LABELS[user.role]}」无此权限`,
      403,
      'permission'
    );
  }

  if (order.status === 'archived') {
    throw new AppError(
      '状态冲突：已归档的单据无法进行逾期推进',
      400,
      'status'
    );
  }

  const advance = OVERDUE_ADVANCE_MAP[order.status];
  if (!advance) {
    throw new AppError(
      `逾期推进不支持当前状态「${STATUS_LABELS[order.status]}」`,
      400,
      'status'
    );
  }

  const dlStatus = getDeadlineStatus(order.deadline);
  if (dlStatus !== 'overdue') {
    throw new AppError(
      `逾期推进校验失败：该就诊单当前未逾期（到期状态：${dlStatus === 'approaching' ? '临期' : '正常'}），不可使用逾期强制推进`,
      400,
      'timeline'
    );
  }

  if (payload.version !== undefined && payload.version !== order.version) {
    throw new AppError(
      `版本冲突：当前版本 ${order.version}，提交版本 ${payload.version}，请刷新后重试`,
      409,
      'status'
    );
  }

  if (advance.requiresAssignee && !payload.assignee_id) {
    throw new AppError(
      '逾期推进「强制分派」必须指定兽医师',
      400,
      'material'
    );
  }

  if (advance.requiresEvidence && !payload.evidence_provided) {
    throw new AppError(
      `逾期推进「${advance.label}」必须提供证据材料`,
      400,
      'material'
    );
  }

  return {
    to: advance.to,
    allowedRoles: ['director'],
    label: advance.label,
    requiresEvidence: advance.requiresEvidence ? ['逾期处理证据'] : [],
    updates: payload.assignee_id ? { assignee_id: true } : {},
    onExecute: () => ({
      exception_type: 'timeline',
      exception_reason: `逾期强制推进：${advance.label}（操作人：${ROLE_LABELS[user.role]}）`,
      correction_action: `逾期处理：${advance.label}`
    }),
    isOverdueAdvance: true
  };
};

const executeTransition = (db, order, action, user, payload = {}) => {
  const transition = validateTransition(db, order, action, user, payload);

  const deadlineCheck = checkDeadline(order);

  const extraUpdates = transition.onExecute
    ? transition.onExecute(order, payload)
    : {};

  const setClauses = ['status = ?', 'version = version + 1', 'updated_at = CURRENT_TIMESTAMP'];
  const params = [transition.to];

  if (payload.assignee_id || (transition.updates?.assignee_id && payload.assignee_id !== undefined)) {
    setClauses.push('assignee_id = ?');
    params.push(payload.assignee_id);
  }

  const newHandlerId = payload.handler_id || (transition.updates?.handler_id ? user.id : null);
  if (newHandlerId !== null) {
    setClauses.push('handler_id = ?');
    params.push(newHandlerId);
  }

  const newReviewerId = payload.reviewer_id || (transition.updates?.reviewer_id ? user.id : null);
  if (newReviewerId !== null) {
    setClauses.push('reviewer_id = ?');
    params.push(newReviewerId);
  }

  if ('is_overdue' in extraUpdates) {
    setClauses.push('is_overdue = ?');
    params.push(extraUpdates.is_overdue);
  } else {
    setClauses.push('is_overdue = ?');
    params.push(deadlineCheck.isOverdue ? 1 : (order.is_overdue || 0));
  }

  if ('material_status' in extraUpdates) {
    setClauses.push('material_status = ?');
    params.push(extraUpdates.material_status);
  }

  if ('exception_type' in extraUpdates) {
    setClauses.push('exception_type = ?');
    params.push(extraUpdates.exception_type);
  } else if (deadlineCheck.exceptionType && !order.exception_type) {
    setClauses.push('exception_type = ?');
    params.push(deadlineCheck.exceptionType);
  }

  if ('exception_reason' in extraUpdates) {
    setClauses.push('exception_reason = ?');
    params.push(extraUpdates.exception_reason);
  } else if (deadlineCheck.exceptionReason && !order.exception_reason) {
    setClauses.push('exception_reason = ?');
    params.push(deadlineCheck.exceptionReason);
  }

  if ('correction_action' in extraUpdates) {
    setClauses.push('correction_action = ?');
    params.push(extraUpdates.correction_action);
  }

  const whereParams = [order.id, payload.version !== undefined ? payload.version : order.version];

  const sql = `UPDATE visit_orders SET ${setClauses.join(', ')} WHERE id = ? AND version = ?`;
  const stmt = db.prepare(sql);
  const result = stmt.run(...params, ...whereParams);

  if (result.changes === 0) {
    throw new AppError(
      '状态变更失败：版本冲突或单据已被他人修改，请刷新页面获取最新数据后重试',
      409,
      'status'
    );
  }

  const recordExceptionType = ('exception_type' in extraUpdates)
    ? extraUpdates.exception_type
    : (deadlineCheck.exceptionType || order.exception_type || null);
  const recordExceptionReason = ('exception_reason' in extraUpdates)
    ? extraUpdates.exception_reason
    : (deadlineCheck.exceptionReason || order.exception_reason || null);
  const recordCorrectionAction = ('correction_action' in extraUpdates)
    ? extraUpdates.correction_action
    : (payload.correction_action || order.correction_action || null);

  const recordStmt = db.prepare(`
    INSERT INTO processing_records (
      visit_order_id, action, from_status, to_status,
      operator_id, operator_role, comment,
      exception_type, exception_reason,
      evidence_required, evidence_provided,
      correction_action
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  recordStmt.run(
    order.id,
    action,
    order.status,
    transition.to,
    user.id,
    user.role,
    payload.comment || transition.label,
    recordExceptionType,
    recordExceptionReason,
    transition.requiresEvidence ? transition.requiresEvidence.join('、') : null,
    payload.evidence_provided || null,
    recordCorrectionAction
  );

  const updated = db.prepare('SELECT * FROM visit_orders WHERE id = ?').get(order.id);

  return {
    success: true,
    from: order.status,
    to: transition.to,
    order: updated,
    message: `已${transition.label}`,
    exceptionType: updated.exception_type,
    exceptionReason: updated.exception_reason,
    correctionAction: updated.correction_action
  };
};

const getAllowedActions = (order, user) => {
  const currentTransitions = TRANSITIONS[order.status] || {};
  const allowed = [];

  for (const [action, transition] of Object.entries(currentTransitions)) {
    if (!transition.allowedRoles.includes(user.role)) {
      continue;
    }
    if (user.role === 'doctor' && order.assignee_id && order.assignee_id !== user.id && order.handler_id && order.handler_id !== user.id) {
      continue;
    }
    if (user.role === 'director' && order.reviewer_id && order.reviewer_id !== user.id && order.status === 'reviewing') {
      if (action !== 'return_for_correction' && action !== 'archive') {
        continue;
      }
    }
    allowed.push({
      action,
      label: transition.label,
      to: transition.to,
      toLabel: STATUS_LABELS[transition.to],
      requiresEvidence: transition.requiresEvidence || [],
      isOverdueAction: transition.isOverdueAction || false
    });
  }

  if (user.role === 'director' && order.status !== 'archived' && OVERDUE_ADVANCE_MAP[order.status]) {
    const dlStatus = getDeadlineStatus(order.deadline);
    if (dlStatus === 'overdue') {
      const advance = OVERDUE_ADVANCE_MAP[order.status];
      allowed.push({
        action: 'overdue_advance',
        label: advance.label,
        to: advance.to,
        toLabel: STATUS_LABELS[advance.to],
        requiresEvidence: advance.requiresEvidence ? ['逾期处理证据'] : [],
        isOverdueAction: true,
        requiresAssignee: advance.requiresAssignee || false
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
  OVERDUE_ADVANCE_MAP,
  getDeadlineStatus,
  checkDeadline,
  validateTransition,
  executeTransition,
  getAllowedActions,
  canViewOrder
};
