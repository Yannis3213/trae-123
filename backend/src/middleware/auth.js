import jwt from 'jsonwebtoken';
import { JWT_SECRET, ROLES } from '../config.js';

export function authMiddleware() {
  return async (c, next) => {
    const authHeader = c.req.header('Authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return c.json({ code: 401, message: '未提供认证令牌' }, 401);
    }

    const token = authHeader.slice(7);

    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      c.set('user', decoded);
      await next();
    } catch (error) {
      return c.json({ code: 401, message: '认证令牌无效或已过期' }, 401);
    }
  };
}

export function roleMiddleware(...allowedRoles) {
  return async (c, next) => {
    const user = c.get('user');
    
    if (!user) {
      return c.json({ code: 401, message: '用户未认证' }, 401);
    }

    if (!allowedRoles.includes(user.role)) {
      return c.json({ code: 403, message: '权限不足，无法执行此操作' }, 403);
    }

    await next();
  };
}

export function isRegistrar() {
  return roleMiddleware(ROLES.REGISTRAR);
}

export function isAuditor() {
  return roleMiddleware(ROLES.AUDITOR);
}

export function isReviewer() {
  return roleMiddleware(ROLES.REVIEWER);
}

export function isAuditorOrReviewer() {
  return roleMiddleware(ROLES.AUDITOR, ROLES.REVIEWER);
}

export function isAllRoles() {
  return roleMiddleware(ROLES.REGISTRAR, ROLES.AUDITOR, ROLES.REVIEWER);
}
