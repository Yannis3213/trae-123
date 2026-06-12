const express = require('express');
const bcrypt = require('bcryptjs');
const { AppError } = require('../middleware/errorHandler');
const { requireAuth } = require('../middleware/auth');
const { ROLE_LABELS } = require('../utils/statusFlow');

const router = express.Router();

router.post('/login', (req, res, next) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      throw new AppError('用户名和密码不能为空', 400, 'material');
    }

    const user = req.db.prepare('SELECT * FROM users WHERE username = ?').get(username);
    if (!user) {
      throw new AppError('用户名或密码错误', 401, 'permission');
    }

    const valid = bcrypt.compareSync(password, user.password);
    if (!valid) {
      throw new AppError('用户名或密码错误', 401, 'permission');
    }

    res.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        role: user.role,
        roleLabel: ROLE_LABELS[user.role]
      }
    });
  } catch (err) {
    next(err);
  }
});

router.get('/me', requireAuth, (req, res) => {
  res.json({
    success: true,
    user: {
      id: req.user.id,
      username: req.user.username,
      name: req.user.name,
      role: req.user.role,
      roleLabel: ROLE_LABELS[req.user.role]
    }
  });
});

router.get('/users', requireAuth, (req, res) => {
  const users = req.db.prepare(`
    SELECT id, username, name, role, created_at FROM users ORDER BY id
  `).all();

  res.json({
    success: true,
    users: users.map(u => ({ ...u, roleLabel: ROLE_LABELS[u.role] }))
  });
});

router.get('/doctors', requireAuth, (req, res) => {
  const doctors = req.db.prepare(`
    SELECT id, username, name, role FROM users WHERE role = 'doctor' ORDER BY id
  `).all();

  res.json({
    success: true,
    users: doctors.map(u => ({ ...u, roleLabel: ROLE_LABELS[u.role] }))
  });
});

module.exports = router;
