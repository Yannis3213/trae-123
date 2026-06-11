import { Hono } from 'hono';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { getQuery } from '../db.js';
import { JWT_SECRET, TOKEN_EXPIRES_IN } from '../config.js';

const auth = new Hono();

auth.post('/login', async (c) => {
  try {
    const { username, password } = await c.req.json();

    if (!username || !password) {
      return c.json({ code: 400, message: '用户名和密码不能为空' }, 400);
    }

    const user = getQuery('SELECT * FROM users WHERE username = ?', [username]);

    if (!user) {
      return c.json({ code: 401, message: '用户名或密码错误' }, 401);
    }

    const isValidPassword = bcrypt.compareSync(password, user.password);

    if (!isValidPassword) {
      return c.json({ code: 401, message: '用户名或密码错误' }, 401);
    }

    const token = jwt.sign(
      {
        id: user.id,
        username: user.username,
        name: user.name,
        role: user.role,
        department: user.department
      },
      JWT_SECRET,
      { expiresIn: TOKEN_EXPIRES_IN }
    );

    return c.json({
      code: 200,
      message: '登录成功',
      data: {
        token,
        user: {
          id: user.id,
          username: user.username,
          name: user.name,
          role: user.role,
          department: user.department
        }
      }
    });
  } catch (error) {
    return c.json({ code: 500, message: '登录失败：' + error.message }, 500);
  }
});

auth.post('/logout', async (c) => {
  return c.json({ code: 200, message: '登出成功' });
});

auth.get('/me', async (c) => {
  const user = c.get('user');
  return c.json({
    code: 200,
    data: user
  });
});

export default auth;
