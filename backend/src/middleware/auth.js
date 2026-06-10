const { ROLES, ROLE_NAMES, STATUS } = require('../config');

function roleAuth(allowedRoles = []) {
  return (req, res, next) => {
    const role = req.headers['x-user-role'];
    const username = req.headers['x-user-name'];

    if (!role || !username) {
      return res.status(401).json({
        success: false,
        error: '未授权：缺少角色或用户信息',
        code: 'UNAUTHORIZED'
      });
    }

    const validRoles = Object.values(ROLES);
    if (!validRoles.includes(role)) {
      return res.status(403).json({
        success: false,
        error: '无效的角色',
        code: 'INVALID_ROLE'
      });
    }

    if (allowedRoles.length > 0 && !allowedRoles.includes(role)) {
      return res.status(403).json({
        success: false,
        error: `权限不足：需要 ${allowedRoles.map(r => ROLE_NAMES[r]).join(' 或 ')} 角色`,
        code: 'PERMISSION_DENIED'
      });
    }

    req.user = { role, username };
    next();
  };
}

module.exports = { roleAuth };
