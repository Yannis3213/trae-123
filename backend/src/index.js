import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { serve } from '@hono/node-server'
import { authRouter } from './routes/auth.js'
import { followupRouter } from './routes/followup.js'
import { chronicRecordRouter } from './routes/chronicRecord.js'
import { medicationRouter } from './routes/medication.js'
import { auditRouter } from './routes/audit.js'
import { batchRouter } from './routes/batch.js'

const app = new Hono()

const FRONTEND_PORT = 3107
const BACKEND_PORT = 8107

app.use('/*', cors({
  origin: [
    `http://localhost:${FRONTEND_PORT}`,
    `http://127.0.0.1:${FRONTEND_PORT}`
  ],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}))

app.get('/api/health', (c) => {
  return c.json({ status: 'ok', port: BACKEND_PORT })
})

app.route('/api/auth', authRouter)
app.route('/api/followup', followupRouter)
app.route('/api/chronic-record', chronicRecordRouter)
app.route('/api/medication', medicationRouter)
app.route('/api/audit', auditRouter)
app.route('/api/batch', batchRouter)

console.log(`Server running on port ${BACKEND_PORT}`)
console.log(`Frontend allowed from: http://localhost:${FRONTEND_PORT}`)

serve({
  fetch: app.fetch,
  port: BACKEND_PORT
})
