const jwt = require('jsonwebtoken');
const db = require('../utils/db');
const { EXCEPTION_TYPES } = require('../utils/constants');

const authenticate = async (request, reply) => {
  const authHeader = request.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return reply.status(401).send({
      success: false,
      error: {
        type: EXCEPTION_TYPES.PERMISSION_DENIED,
        message: '未提供有效的认证令牌'
      }
    });
  }

  const token = authHeader.substring(7);

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = db.prepare('SELECT id, username, real_name, role, department FROM users WHERE username = ?').get(decoded.username);

    if (!user) {
      return reply.status(401).send({
        success: false,
        error: {
          type: EXCEPTION_TYPES.PERMISSION_DENIED,
          message: '用户不存在或已被禁用'
        }
      });
    }

    request.user = user;
  } catch (err) {
    return reply.status(401).send({
      success: false,
      error: {
        type: EXCEPTION_TYPES.PERMISSION_DENIED,
        message: '认证令牌无效或已过期'
      }
    });
  }
};

const requireRole = (...roles) => {
  return async (request, reply) => {
    if (!request.user) {
      return reply.status(401).send({
        success: false,
        error: {
          type: EXCEPTION_TYPES.PERMISSION_DENIED,
          message: '用户未认证'
        }
      });
    }

    if (!roles.includes(request.user.role)) {
      return reply.status(403).send({
        success: false,
        error: {
          type: EXCEPTION_TYPES.PERMISSION_DENIED,
          message: '权限不足，该操作需要指定角色'
        }
      });
    }
  };
};

module.exports = { authenticate, requireRole };
