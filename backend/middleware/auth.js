const { AppError } = require('./errorHandler');

const parseUserFromHeaders = (req) => {
  const userId = req.headers['x-user-id'] ? parseInt(req.headers['x-user-id']) : null;
  const role = req.headers['x-role'] || null;

  if (!userId || !role) {
    return null;
  }

  const user = req.db.prepare('SELECT * FROM users WHERE id = ? AND role = ?').get(userId, role);
  return user || null;
};

const requireAuth = (req, res, next) => {
  const user = parseUserFromHeaders(req);
  if (!user) {
    return next(new AppError('未认证或认证信息无效，请先登录', 401, 'permission'));
  }
  req.user = user;
  next();
};

const requireRole = (...roles) => {
  return (req, res, next) => {
    const user = parseUserFromHeaders(req);
    if (!user) {
      return next(new AppError('未认证或认证信息无效，请先登录', 401, 'permission'));
    }
    if (!roles.includes(user.role)) {
      return next(new AppError(
        `权限不足：当前角色为「${user.role}」，需要角色：${roles.join(' / ')}`,
        403,
        'permission'
      ));
    }
    req.user = user;
    next();
  };
};

const requireAssigneeOrRole = (...roles) => {
  return (req, res, next) => {
    const user = parseUserFromHeaders(req);
    if (!user) {
      return next(new AppError('未认证或认证信息无效，请先登录', 401, 'permission'));
    }
    req.user = user;

    const orderId = req.params.id || req.body.visitOrderId;
    if (!orderId) {
      return next(new AppError('缺少就诊单ID参数', 400, 'material'));
    }

    const order = req.db.prepare('SELECT * FROM visit_orders WHERE id = ?').get(orderId);
    if (!order) {
      return next(new AppError('就诊单不存在', 404, 'material'));
    }

    const isAssignee = order.assignee_id === user.id || order.handler_id === user.id || order.reviewer_id === user.id;
    const hasRole = roles.includes(user.role);

    if (!isAssignee && !hasRole) {
      return next(new AppError(
        `越权操作：您既不是该单据的责任人，也不具备所需角色权限`,
        403,
        'permission'
      ));
    }

    req.visitOrder = order;
    next();
  };
};

module.exports = {
  parseUserFromHeaders,
  requireAuth,
  requireRole,
  requireAssigneeOrRole
};
