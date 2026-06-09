const Router = require('koa-router');
const { authMiddleware, optionalAuthMiddleware } = require('../middleware/auth');
const {
  ROLES, ROLE_NAMES, ORDER_STATUS, STATUS_NAMES,
  STATUS_TRANSITIONS, ABNORMAL_TYPES, ABNORMAL_NAMES,
  WARNING_LEVELS, WARNING_NAMES
} = require('../utils/constants');

const router = new Router({ prefix: '/api/dict' });

router.get('/', optionalAuthMiddleware, async (ctx) => {
  const user = ctx.state.currentUser;
  const allowedTransitions = user ? (STATUS_TRANSITIONS[user.role]?.from || {}) : {};

  ctx.body = {
    code: 0,
    data: {
      roles: Object.entries(ROLES).map(([k, v]) => ({ value: v, label: ROLE_NAMES[v], key: k })),
      statuses: Object.entries(ORDER_STATUS).map(([k, v]) => ({ value: v, label: STATUS_NAMES[v], key: k })),
      abnormalTypes: Object.entries(ABNORMAL_TYPES).map(([k, v]) => ({ value: v, label: ABNORMAL_NAMES[v], key: k })),
      warningLevels: Object.entries(WARNING_LEVELS).map(([k, v]) => ({ value: v, label: WARNING_NAMES[v], key: k })),
      transitions: allowedTransitions
    }
  };
});

module.exports = router;
