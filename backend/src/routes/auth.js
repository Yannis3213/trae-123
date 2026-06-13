import { Hono } from 'hono'
import db from '../db.js'
import bcrypt from 'bcryptjs'
import { generateToken, authMiddleware } from '../middleware/auth.js'
import { ROLE_NAMES } from '../constants.js'

const authRouter = new Hono()

authRouter.post('/login', async (c) => {
  const { username, password } = await c.req.json()
  
  const user = await db.get('SELECT * FROM users WHERE username = ?', [username])
  if (!user) {
    return c.json({ error: '用户名或密码错误' }, 401)
  }

  const isValid = bcrypt.compareSync(password, user.password_hash)
  if (!isValid) {
    return c.json({ error: '用户名或密码错误' }, 401)
  }

  const token = generateToken(user)
  return c.json({
    token,
    user: {
      id: user.id,
      username: user.username,
      name: user.name,
      role: user.role,
      roleName: ROLE_NAMES[user.role]
    }
  })
})

authRouter.get('/me', authMiddleware, (c) => {
  const user = c.get('user')
  return c.json({
    user: {
      ...user,
      roleName: ROLE_NAMES[user.role]
    }
  })
})

authRouter.get('/users', authMiddleware, async (c) => {
  const users = await db.all(`
    SELECT id, username, name, role FROM users
  `)
  return c.json(users.map(u => ({ ...u, roleName: ROLE_NAMES[u.role] })))
})

export { authRouter }
