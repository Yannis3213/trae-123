const Router = require('koa-router');
const db = require('../db');
const { authMiddleware } = require('../middleware/auth');
const { ROLE_NAMES } = require('../utils/constants');

const router = new Router({ prefix: '/api/auth' });

router.post('/login', async (ctx) => {
  const { username } = ctx.request.body || {};
  if (!username) {
    ctx.status = 400;
    ctx.body = { code: 400, message: '请提供 username' };
    return;
  }
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!user) {
    ctx.status = 404;
    ctx.body = { code: 404, message: '用户不存在' };
    return;
  }
  ctx.body = {
    code: 0,
    data: {
      id: user.id,
      username: user.username,
      name: user.name,
      role: user.role,
      roleName: ROLE_NAMES[user.role],
      store_id: user.store_id,
      area_id: user.area_id,
      token: user.id
    }
  };
});

router.get('/me', authMiddleware, async (ctx) => {
  const user = ctx.state.currentUser;
  ctx.body = {
    code: 0,
    data: {
      id: user.id,
      username: user.username,
      name: user.name,
      role: user.role,
      roleName: ROLE_NAMES[user.role],
      store_id: user.store_id,
      area_id: user.area_id
    }
  };
});

router.get('/users', authMiddleware, async (ctx) => {
  const users = db.prepare('SELECT id, username, name, role, store_id, area_id FROM users ORDER BY role, name').all();
  ctx.body = {
    code: 0,
    data: users.map(u => ({ ...u, roleName: ROLE_NAMES[u.role] }))
  };
});

module.exports = router;
