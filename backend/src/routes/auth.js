const Router = require('koa-router');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { db } = require('../db');
const { JWT_SECRET, JWT_EXPIRES_IN } = require('../config');
const { success, error } = require('../utils/response');
const authMiddleware = require('../middleware/auth');
const { validate } = require('../middleware/validation');

const router = new Router({ prefix: '/api/auth' });

router.post('/login',
  validate({
    username: { required: true, type: 'string', minLength: 3, maxLength: 50 },
    password: { required: true, type: 'string', minLength: 6, maxLength: 50 }
  }),
  async (ctx) => {
    const { username, password } = ctx.request.body;

    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
    if (!user) {
      error(ctx, '用户名或密码错误', 1001);
      return;
    }

    const valid = bcrypt.compareSync(password, user.password);
    if (!valid) {
      error(ctx, '用户名或密码错误', 1001);
      return;
    }

    const token = jwt.sign(
      {
        id: user.id,
        username: user.username,
        real_name: user.real_name,
        role: user.role
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    success(ctx, {
      token,
      user: {
        id: user.id,
        username: user.username,
        real_name: user.real_name,
        role: user.role,
        created_at: user.created_at
      }
    }, '登录成功');
  }
);

router.get('/me', authMiddleware(), async (ctx) => {
  const user = ctx.state.user;
  const dbUser = db.prepare('SELECT id, username, real_name, role, created_at FROM users WHERE id = ?').get(user.id);
  if (!dbUser) {
    error(ctx, '用户不存在', 1002);
    return;
  }
  success(ctx, dbUser);
});

module.exports = router;
