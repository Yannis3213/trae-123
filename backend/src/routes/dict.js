const Router = require('koa-router');
const { authMiddleware, optionalAuthMiddleware } = require('../middleware/auth');
const {
  ROLES, ROLE_NAMES, ORDER_STATUS, STATUS_NAMES,
  STATUS_TRANSITIONS, ABNORMAL_TYPES, ABNORMAL_NAMES,
  WARNING_LEVELS, WARNING_NAMES
} = require('../utils/constants');

const router = new Router({ prefix: '/api/dict' });

function buildStatusPermissionDescriptions(role) {
  const result = {};
  const roleConfig = STATUS_TRANSITIONS[role] || {};
  const fromMap = roleConfig.from || {};

  Object.values(ORDER_STATUS).forEach(status => {
    const allowed = fromMap[status] || [];
    const allTargets = Object.values(ORDER_STATUS);
    const forbidden = allTargets.filter(s => !allowed.includes(s));

    result[status] = {
      status,
      status_name: STATUS_NAMES[status],
      allowed_targets: allowed,
      allowed_target_names: allowed.map(s => STATUS_NAMES[s]),
      forbidden_targets: forbidden,
      forbidden_target_names: forbidden.map(s => STATUS_NAMES[s]),
      description: allowed.length > 0
        ? `当前角色「${ROLE_NAMES[role]}」在「${STATUS_NAMES[status]}」状态可推进至：${allowed.map(s => STATUS_NAMES[s]).join('、') || '（无）'}`
        : `当前角色「${ROLE_NAMES[role]}」在「${STATUS_NAMES[status]}」状态无可用推进目标，需等其他角色处理`
    };
  });

  return result;
}

router.get('/', optionalAuthMiddleware, async (ctx) => {
  const user = ctx.state.currentUser;
  const allowedTransitions = user ? (STATUS_TRANSITIONS[user.role]?.from || {}) : {};
  const statusPermissions = user ? buildStatusPermissionDescriptions(user.role) : {};

  ctx.body = {
    code: 0,
    data: {
      currentUser: user ? {
        id: user.id,
        username: user.username,
        name: user.name,
        role: user.role,
        roleName: ROLE_NAMES[user.role]
      } : null,
      roles: Object.entries(ROLES).map(([k, v]) => ({ value: v, label: ROLE_NAMES[v], key: k })),
      statuses: Object.entries(ORDER_STATUS).map(([k, v]) => ({ value: v, label: STATUS_NAMES[v], key: k })),
      abnormalTypes: Object.entries(ABNORMAL_TYPES).map(([k, v]) => ({ value: v, label: ABNORMAL_NAMES[v], key: k })),
      warningLevels: Object.entries(WARNING_LEVELS).map(([k, v]) => ({ value: v, label: WARNING_NAMES[v], key: k })),
      warningQueueMeta: [
        { level: WARNING_LEVELS.OVERDUE, levelName: WARNING_NAMES[WARNING_LEVELS.OVERDUE], color: '#991b1b', desc: '已超期，应优先处理，可推进到退回补正或签收完成（区域经理）' },
        { level: WARNING_LEVELS.APPROACHING, levelName: WARNING_NAMES[WARNING_LEVELS.APPROACHING], color: '#92400e', desc: '24小时内到期，可继续核验但暂不可标记为逾期' },
        { level: WARNING_LEVELS.NORMAL, levelName: WARNING_NAMES[WARNING_LEVELS.NORMAL], color: '#065f46', desc: '24小时以上到期，正常办理队列' }
      ],
      transitions: allowedTransitions,
      statusPermissions
    }
  };
});

module.exports = router;
