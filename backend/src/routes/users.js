import { getDb } from '../db/init.js';
import { authenticate } from '../utils/auth.js';
import { ROLE_LABEL } from '../config.js';

export default async function userRoutes(fastify) {
  fastify.get('/api/users/list', async () => {
    const db = getDb();
    const users = db.prepare('SELECT id, username, role, display_name FROM users').all();
    db.close();
    return {
      ok: true,
      data: users.map(u => ({ ...u, role_label: ROLE_LABEL[u.role] })),
    };
  });

  fastify.post('/api/users/login', async (req, reply) => {
    const { username, password } = req.body || {};
    if (!username || !password) {
      return reply.code(400).send({ ok: false, code: 'BAD_REQUEST', message: '用户名和密码必填' });
    }
    const db = getDb();
    const user = db.prepare('SELECT * FROM users WHERE username = ? AND password = ?').get(username, password);
    db.close();
    if (!user) {
      return reply.code(401).send({ ok: false, code: 'INVALID_CREDENTIAL', message: '用户名或密码错误' });
    }
    return {
      ok: true,
      data: {
        id: user.id,
        username: user.username,
        role: user.role,
        role_label: ROLE_LABEL[user.role],
        display_name: user.display_name,
      },
    };
  });

  fastify.get('/api/users/me', async (req, reply) => {
    const auth = authenticate(req);
    if (!auth.ok) return reply.code(401).send(auth);
    const u = auth.user;
    return {
      ok: true,
      data: {
        id: u.id,
        username: u.username,
        role: u.role,
        role_label: ROLE_LABEL[u.role],
        display_name: u.display_name,
      },
    };
  });
}
