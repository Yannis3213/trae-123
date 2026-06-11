const { error } = require('../utils/response');

module.exports = (allowedRoles = []) => {
  return async (ctx, next) => {
    const user = ctx.state.user;
    if (!user) {
      error(ctx, '用户未登录', 401);
      return;
    }
    if (allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
      error(ctx, `权限不足，需要角色: ${allowedRoles.join(', ')}`, 403);
      return;
    }
    await next();
  };
};
