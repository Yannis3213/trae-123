const jwt = require('jsonwebtoken');
const { JWT_SECRET, ROLES, STATUS, REQUIRED_EVIDENCE_FIELDS } = require('../config');
const { UserModel, SideRecordModel } = require('../models');

function authMiddleware(ctx, next) {
  const authHeader = ctx.headers.authorization || ctx.headers['x-auth-token'];

  if (!authHeader) {
    ctx.status = 401;
    ctx.body = { success: false, message: '未提供认证凭证' };
    return;
  }

  try {
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = UserModel.findById(decoded.userId);

    if (!user) {
      ctx.status = 401;
      ctx.body = { success: false, message: '用户不存在' };
      return;
    }

    ctx.state.user = {
      id: user.id,
      username: user.username,
      name: user.name,
      role: user.role,
      department: user.department
    };

    return next();
  } catch (err) {
    ctx.status = 401;
    ctx.body = { success: false, message: '认证失败，请重新登录' };
    return;
  }
}

function requireRole(...allowedRoles) {
  return async (ctx, next) => {
    if (!ctx.state.user) {
      ctx.status = 401;
      ctx.body = { success: false, message: '未登录' };
      return;
    }

    if (!allowedRoles.includes(ctx.state.user.role)) {
      ctx.status = 403;
      ctx.body = { success: false, message: '权限不足，当前角色无此操作权限' };
      return;
    }

    await next();
  };
}

function validateEvidence(record, action) {
  const missing = [];
  if (action === 'submit' || action === 'review' || action === 'archive') {
    for (const field of REQUIRED_EVIDENCE_FIELDS) {
      const dbField = field === 'sitePhoto' ? 'sitePhoto' :
                      field === 'inspectionRecord' ? 'inspectionRecord' : 'signatures';
      if (!record[dbField]) {
        missing.push(field);
      }
    }
  }
  return missing;
}

function validateVersion(record, clientVersion) {
  if (clientVersion !== undefined && clientVersion !== null) {
    if (record.version !== parseInt(clientVersion, 10)) {
      return { valid: false, message: `版本冲突：当前版本v${record.version}，您提交的版本v${clientVersion}，请刷新后重试` };
    }
  }
  return { valid: true };
}

function validateHandler(record, userId) {
  if (record.currentHandlerId && record.currentHandlerId !== userId) {
    return { valid: false, message: `该单据当前处理人为 ${record.currentHandlerName}，您无权办理` };
  }
  return { valid: true };
}

function validateStatusTransition(record, targetStatus, userRole, userId) {
  const currentStatus = record.status;
  const transitions = getValidTransitions(currentStatus, userRole);

  if (!transitions.includes(targetStatus)) {
    return {
      valid: false,
      message: `状态不允许从「${currentStatus}」变更为「${targetStatus}」`
    };
  }

  return { valid: true };
}

function getValidTransitions(currentStatus, userRole) {
  const transitions = {
    [ROLES.REGISTRAR]: {
      [STATUS.PENDING_REVIEW]: [STATUS.PENDING_REVIEW, STATUS.RETURNED],
      [STATUS.RETURNED]: [STATUS.PENDING_REVIEW],
      [STATUS.MATERIAL_MISSING]: [STATUS.PENDING_REVIEW]
    },
    [ROLES.SUPERVISOR]: {
      [STATUS.PENDING_REVIEW]: [STATUS.REVIEW_PASSED, STATUS.RETURNED, STATUS.MATERIAL_MISSING, STATUS.OVERDUE, STATUS.STATUS_CONFLICT],
      [STATUS.MATERIAL_MISSING]: [STATUS.REVIEW_PASSED, STATUS.RETURNED, STATUS.OVERDUE],
      [STATUS.OVERDUE]: [STATUS.REVIEW_PASSED, STATUS.RETURNED, STATUS.MATERIAL_MISSING],
      [STATUS.STATUS_CONFLICT]: [STATUS.REVIEW_PASSED, STATUS.RETURNED, STATUS.MATERIAL_MISSING]
    },
    [ROLES.REVIEWER]: {
      [STATUS.REVIEW_PASSED]: [STATUS.SYNCED, STATUS.RETURNED, STATUS.MATERIAL_MISSING, STATUS.OVERDUE],
      [STATUS.OVERDUE]: [STATUS.SYNCED, STATUS.RETURNED, STATUS.MATERIAL_MISSING]
    }
  };

  const roleTransitions = transitions[userRole] || {};
  return roleTransitions[currentStatus] || [];
}

function canViewByRole(record, userRole, userId) {
  if (userRole === ROLES.REGISTRAR) {
    return record.registrarId === userId;
  }
  if (userRole === ROLES.SUPERVISOR) {
    return [STATUS.PENDING_REVIEW, STATUS.MATERIAL_MISSING, STATUS.OVERDUE, STATUS.STATUS_CONFLICT].includes(record.status)
      || record.currentHandlerId === userId;
  }
  if (userRole === ROLES.REVIEWER) {
    return [STATUS.REVIEW_PASSED, STATUS.OVERDUE, STATUS.SYNCED].includes(record.status);
  }
  return true;
}

function canOperateByRole(record, userRole, userId) {
  if (userRole === ROLES.REGISTRAR) {
    return [STATUS.PENDING_REVIEW, STATUS.RETURNED, STATUS.MATERIAL_MISSING].includes(record.status)
      && record.registrarId === userId;
  }
  if (userRole === ROLES.SUPERVISOR) {
    return [STATUS.PENDING_REVIEW, STATUS.MATERIAL_MISSING, STATUS.OVERDUE, STATUS.STATUS_CONFLICT].includes(record.status)
      && (!record.currentHandlerId || record.currentHandlerId === userId);
  }
  if (userRole === ROLES.REVIEWER) {
    return [STATUS.REVIEW_PASSED, STATUS.OVERDUE].includes(record.status);
  }
  return false;
}

module.exports = {
  authMiddleware,
  requireRole,
  validateEvidence,
  validateVersion,
  validateHandler,
  validateStatusTransition,
  getValidTransitions,
  canViewByRole,
  canOperateByRole
};
