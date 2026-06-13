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

function parseFollowupId(c) {
  const path = c.req.path
  const match = path.match(/\/followup\/(\d+)/)
  if (match) return parseInt(match[1])
  
  const batchMatch = path.match(/\/batch\/\w+/)
  if (batchMatch) return null
  
  return null
}

export function requireRole(...roles) {
  return async (c, next) => {
    const user = c.get('user')
    if (!user || !roles.includes(user.role)) {
      const followupId = parseFollowupId(c)
      const message = `权限不足: 需要角色 ${roles.join('/')}，当前角色 ${user?.role || '未知'}`
      
      if (followupId && user?.id) {
        try {
          await db.run(`
            INSERT INTO exception_reasons (followup_id, type, reason, operator_id)
            VALUES (?, 'unauthorized_action', ?, ?)
          `, [followupId, message, user.id])
          
          await db.run(`
            INSERT INTO audit_logs (followup_id, user_id, action, remark, extra_data)
            VALUES (?, ?, 'intercept', ?, ?)
          `, [followupId, user.id, message, JSON.stringify({ type: 'unauthorized_action', required_roles: roles, user_role: user.role })])
        } catch (err) {
          console.error('Failed to record interception:', err)
        }
      }
      
      return c.json({ error: message }, 403)
    }
    await next()
  }
}
