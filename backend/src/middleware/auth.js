const db = require('../db');

function authMiddleware(ctx, next) {
  const userId = ctx.request.headers['x-user-id'];
  if (!userId) {
    ctx.status = 401;
    ctx.body = { code: 401, message: '未提供用户标识，请通过 X-User-Id 头传递' };
    return;
  }

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  if (!user) {
    ctx.status = 401;
    ctx.body = { code: 401, message: '用户不存在' };
    return;
  }

  ctx.state.currentUser = user;
  return next();
}

function optionalAuthMiddleware(ctx, next) {
  const userId = ctx.request.headers['x-user-id'];
  if (userId) {
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
    if (user) {
      ctx.state.currentUser = user;
    }
  }
  return next();
}

module.exports = {
  authMiddleware,
  optionalAuthMiddleware
};
