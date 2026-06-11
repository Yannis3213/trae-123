const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config');
const { error } = require('../utils/response');

module.exports = () => {
  return async (ctx, next) => {
    const authHeader = ctx.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      error(ctx, '未提供认证令牌', 401);
      return;
    }
    const token = authHeader.substring(7);
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      ctx.state.user = decoded;
      await next();
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        error(ctx, '令牌已过期', 401);
      } else if (err.name === 'JsonWebTokenError') {
        error(ctx, '无效的令牌', 401);
      } else {
        error(ctx, '认证失败', 401);
      }
    }
  };
};
