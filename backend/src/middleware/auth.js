import jwt from 'jsonwebtoken'
import db from '../db.js'

const JWT_SECRET = 'chronic-followup-secret-key-2024'

export function generateToken(user) {
  return jwt.sign(
    { id: user.id, username: user.username, role: user.role },
    JWT_SECRET,
    { expiresIn: '24h' }
  )
}

export async function authMiddleware(c, next) {
  const authHeader = c.req.header('Authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: '未授权访问' }, 401)
  }

  try {
    const token = authHeader.split(' ')[1]
    const decoded = jwt.verify(token, JWT_SECRET)
    const user = await db.get('SELECT id, username, role, name FROM users WHERE id = ?', [decoded.id])
    
    if (!user) {
      return c.json({ error: '用户不存在' }, 401)
    }
    
    c.set('user', user)
    await next()
  } catch (err) {
    return c.json({ error: 'Token无效或已过期' }, 401)
  }
}

export function requireRole(...roles) {
  return async (c, next) => {
    const user = c.get('user')
    if (!user || !roles.includes(user.role)) {
      return c.json({ error: '权限不足' }, 403)
    }
    await next()
  }
}
