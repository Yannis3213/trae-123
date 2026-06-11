const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../utils/db');
const { ROLE_LABELS, EXCEPTION_TYPES } = require('../utils/constants');

async function routes(fastify) {
  fastify.post('/auth/login', async (request, reply) => {
    const { username, password } = request.body;

    if (!username || !password) {
      return reply.status(400).send({
        success: false,
        error: {
          type: EXCEPTION_TYPES.MATERIAL_MISSING,
          message: '用户名和密码不能为空'
        }
      });
    }

    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);

    if (!user) {
      return reply.status(401).send({
        success: false,
        error: {
          type: EXCEPTION_TYPES.PERMISSION_DENIED,
          message: '用户不存在'
        }
      });
    }

    const isValid = bcrypt.compareSync(password, user.password);

    if (!isValid) {
      return reply.status(401).send({
        success: false,
        error: {
          type: EXCEPTION_TYPES.PERMISSION_DENIED,
          message: '密码错误'
        }
      });
    }

    const token = jwt.sign(
      { username: user.username, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    return {
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          username: user.username,
          realName: user.real_name,
          role: user.role,
          roleLabel: ROLE_LABELS[user.role],
          department: user.department
        }
      }
    };
  });

  fastify.get('/auth/me', { preHandler: [fastify.authenticate] }, async (request) => {
    return {
      success: true,
      data: {
        user: {
          ...request.user,
          roleLabel: ROLE_LABELS[request.user.role]
        }
      }
    };
  });

  fastify.get('/auth/users', { preHandler: [fastify.authenticate] }, async (request) => {
    const users = db.prepare(`
      SELECT id, username, real_name, role, department, created_at
      FROM users ORDER BY created_at
    `).all();

    return {
      success: true,
      data: {
        users: users.map(u => ({
          ...u,
          realName: u.real_name,
          roleLabel: ROLE_LABELS[u.role],
          createdAt: u.created_at
        }))
      }
    };
  });
}

module.exports = routes;
