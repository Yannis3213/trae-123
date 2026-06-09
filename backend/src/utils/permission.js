const db = require('../db');
const { STATUS_TRANSITIONS, ROLES, ABNORMAL_TYPES, WARNING_LEVELS, ORDER_STATUS } = require('./constants');

function canTransition(role, fromStatus, toStatus) {
  const roleConfig = STATUS_TRANSITIONS[role];
  if (!roleConfig) return false;
  if (!fromStatus) {
    return roleConfig.initial && roleConfig.initial.includes(toStatus);
  }
  const fromMap = roleConfig.from || {};
  const allowed = fromMap[fromStatus] || [];
  return allowed.includes(toStatus);
}

function isHandlerOfOrder(order, user) {
  if (user.role === ROLES.AREA_MANAGER) {
    return order.area_id === user.area_id;
  }
  if (user.role === ROLES.PHARMACIST || user.role === ROLES.STORE_CLERK) {
    return order.store_id === user.store_id;
  }
  return false;
}

function isCurrentHandlerOfOrder(order, user) {
  if (!order.handler_role || !order.handler_id) {
    return isHandlerOfOrder(order, user) && order.handler_role === user.role;
  }
  return order.handler_role === user.role && order.handler_id === user.id;
}

function getNextHandler(order, toStatus, currentUser) {
  const STORE_ROLES = [ROLES.STORE_CLERK];
  const PHARMACY_ROLES = [ROLES.PHARMACIST];
  const MANAGER_ROLES = [ROLES.AREA_MANAGER];

  if ([ORDER_STATUS.RETURNED_CORRECTION].includes(toStatus)) {
    const clerk = db.prepare(
      "SELECT * FROM users WHERE store_id = ? AND role = ? ORDER BY created_at LIMIT 1"
    ).get(order.store_id, ROLES.STORE_CLERK);
    return { handler_role: ROLES.STORE_CLERK, handler_id: clerk ? clerk.id : null, handler_name: clerk ? clerk.name : null };
  }

  if ([ORDER_STATUS.MATERIAL_SHORTAGE, ORDER_STATUS.OVERDUE, ORDER_STATUS.ABNORMAL_RETURN, ORDER_STATUS.SIGNED].includes(toStatus)) {
    const manager = db.prepare(
      "SELECT * FROM users WHERE area_id = ? AND role = ? ORDER BY created_at LIMIT 1"
    ).get(order.area_id, ROLES.AREA_MANAGER);
    return { handler_role: ROLES.AREA_MANAGER, handler_id: manager ? manager.id : null, handler_name: manager ? manager.name : null };
  }

  if ([ORDER_STATUS.PENDING_SIGN].includes(toStatus)) {
    const pharmacist = db.prepare(
      "SELECT * FROM users WHERE store_id = ? AND role = ? ORDER BY created_at LIMIT 1"
    ).get(order.store_id, ROLES.PHARMACIST);
    return { handler_role: ROLES.PHARMACIST, handler_id: pharmacist ? pharmacist.id : null, handler_name: pharmacist ? pharmacist.name : null };
  }

  return { handler_role: currentUser.role, handler_id: currentUser.id, handler_name: currentUser.name };
}

function computeWarningLevel(order, now = new Date()) {
  const due = new Date(order.due_at);
  const diffMs = due.getTime() - now.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);

  if (order.status === ORDER_STATUS.OVERDUE) {
    return WARNING_LEVELS.OVERDUE;
  }
  if (diffHours < 0) {
    return WARNING_LEVELS.OVERDUE;
  }
  if (diffHours <= 24) {
    return WARNING_LEVELS.APPROACHING;
  }
  return WARNING_LEVELS.NORMAL;
}

function getRequiredEvidenceTypes(status) {
  const requires = new Set();
  requires.add('prescription');
  if (status === ORDER_STATUS.SIGNED) {
    requires.add('sign_off');
  }
  return requires;
}

function checkEvidence(order, toStatus) {
  const required = getRequiredEvidenceTypes(toStatus);
  if (required.size === 0) return { ok: true };

  const attachments = db.prepare('SELECT evidence_type FROM attachments WHERE order_id = ?').all(order.id);
  const existing = new Set(attachments.map(a => a.evidence_type));

  const missing = [];
  for (const t of required) {
    if (!existing.has(t)) missing.push(t);
  }
  if (missing.length > 0) {
    return { ok: false, missing, message: `缺少必需证据：${missing.join('、')}` };
  }
  return { ok: true };
}

function validateTransition(order, toStatus, user, clientVersion) {
  if (!isHandlerOfOrder(order, user)) {
    return {
      ok: false,
      code: ABNORMAL_TYPES.UNAUTHORIZED,
      message: `越权操作：角色[${user.role}]非当前处理范围人员，无权处理该处方订单`
    };
  }
  if (!isCurrentHandlerOfOrder(order, user) && order.handler_id !== null) {
    return {
      ok: false,
      code: ABNORMAL_TYPES.UNAUTHORIZED,
      message: `越权操作：角色[${user.role}]非当前处理人，当前处理人为${order.handler_name}`
    };
  }
  if (clientVersion !== undefined && clientVersion !== null && clientVersion !== order.version) {
    return {
      ok: false,
      code: ABNORMAL_TYPES.OLD_VERSION,
      message: `旧版本提交：当前版本为 v${order.version}，您提交的是 v${clientVersion}，请刷新后重试`
    };
  }
  if (!canTransition(user.role, order.status, toStatus)) {
    return {
      ok: false,
      code: ABNORMAL_TYPES.STATE_CONFLICT,
      message: `状态冲突：当前状态为「${order.status}」，角色「${user.role}」不可变更为「${toStatus}」`
    };
  }
  const evCheck = checkEvidence(order, toStatus);
  if (!evCheck.ok) {
    return {
      ok: false,
      code: ABNORMAL_TYPES.MISSING_EVIDENCE,
      message: evCheck.message,
      missing: evCheck.missing
    };
  }
  return { ok: true };
}

module.exports = {
  canTransition,
  isHandlerOfOrder,
  isCurrentHandlerOfOrder,
  getNextHandler,
  computeWarningLevel,
  getRequiredEvidenceTypes,
  checkEvidence,
  validateTransition
};
