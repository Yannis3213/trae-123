import { getDb } from '../db/init.js';
import { ROLE_LABEL } from '../config.js';

export function authenticate(req) {
  const userId = req.headers['x-user-id'] || req.headers['X-User-Id'];
  if (!userId) {
    return { ok: false, code: 'MISSING_USER', message: '未设置当前登录用户 (X-User-Id)' };
  }
  const db = getDb();
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  db.close();
  if (!user) {
    return { ok: false, code: 'INVALID_USER', message: '用户不存在或已离职' };
  }
  return { ok: true, user };
}

export function requireRole(auth, roles) {
  if (!auth.ok) return auth;
  if (!roles.includes(auth.user.role)) {
    return {
      ok: false,
      code: 'PERMISSION_DENIED',
      message: `当前角色【${ROLE_LABEL[auth.user.role]}】无权执行此操作，需要：${roles.map(r => ROLE_LABEL[r]).join('/')}`,
    };
  }
  return auth;
}

export function requireHandler(auth, order) {
  if (!auth.ok) return auth;
  if (order.current_handler && order.current_handler !== auth.user.id) {
    return {
      ok: false,
      code: 'NOT_YOUR_HANDLER',
      message: `当前订单处理人为【${order.current_handler}】，您【${auth.user.id}】不是指定处理人`,
    };
  }
  if (order.current_role && order.current_role !== auth.user.role) {
    return {
      ok: false,
      code: 'ROLE_MISMATCH',
      message: `订单当前处于【${ROLE_LABEL[order.current_role]}】处理环节，您的角色【${ROLE_LABEL[auth.user.role]}】不匹配`,
    };
  }
  return auth;
}

export function verifyVersion(order, submittedVersion) {
  if (submittedVersion == null) {
    return { ok: false, code: 'MISSING_VERSION', message: '提交时缺少版本号，请刷新列表后重试' };
  }
  if (submittedVersion !== order.version) {
    return {
      ok: false,
      code: 'VERSION_CONFLICT',
      message: `版本冲突：您基于 v${submittedVersion} 提交，但当前后端记录已是 v${order.version}，请刷新后重试`,
    };
  }
  return { ok: true };
}

export function checkStatusTransition(order, targetStatus, action) {
  const transitions = {
    pending: ['transferred'],
    transferred: ['transferred', 'reviewed', 'archived'],
    reviewed: ['archived'],
    archived: [],
  };
  const allowed = transitions[order.status] || [];
  if (!allowed.includes(targetStatus) && action !== 'return' && action !== 'correct') {
    return {
      ok: false,
      code: 'STATUS_CONFLICT',
      message: `状态冲突：订单当前为【${order.status}】，无法流转到【${targetStatus}】`,
    };
  }
  return { ok: true };
}

export function checkEvidence(order, providedEvidence, requiredTypes) {
  const missing = requiredTypes.filter(t => !providedEvidence.includes(t));
  if (missing.length > 0) {
    return {
      ok: false,
      code: 'MISSING_EVIDENCE',
      message: `缺少必填证据：${missing.join('、')}`,
      missing,
    };
  }
  return { ok: true };
}

export function checkDuplicateAction(order, action, operatorId) {
  const db = getDb();
  const last = db.prepare(`
    SELECT * FROM processing_records WHERE order_id = ? ORDER BY created_at DESC LIMIT 1
  `).get(order.id);
  db.close();
  if (last && last.action === action && last.operator_id === operatorId) {
    return {
      ok: false,
      code: 'DUPLICATE_ACTION',
      message: `重复提交：您刚刚已执行过【${action}】操作，请刷新页面后查看最新状态`,
    };
  }
  return { ok: true };
}
