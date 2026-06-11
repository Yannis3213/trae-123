const Router = require('koa-router');
const AuthService = require('../services/authService');
const { authMiddleware } = require('../middleware/auth');

const router = new Router({ prefix: '/api/auth' });

router.post('/login', async (ctx) => {
  const { username, password } = ctx.request.body;
  if (!username || !password) {
    ctx.body = { success: false, message: '用户名和密码不能为空' };
    return;
  }

  const result = await AuthService.login(username, password);
  ctx.body = result;
});

router.get('/me', authMiddleware, async (ctx) => {
  const user = AuthService.getCurrentUser(ctx.state.user.id);
  ctx.body = { success: true, data: user };
});

router.get('/users', authMiddleware, async (ctx) => {
  const users = AuthService.listUsers();
  ctx.body = { success: true, data: users };
});

module.exports = router;
