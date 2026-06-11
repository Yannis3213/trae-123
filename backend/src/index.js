import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { serve } from '@hono/node-server';
import { PORT, CORS_ORIGIN } from './config.js';
import { authMiddleware } from './middleware/auth.js';

import authRoutes from './routes/auth.js';
import clueRoutes from './routes/clues.js';

const app = new Hono();

app.use('*', cors({
  origin: CORS_ORIGIN,
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  exposeHeaders: ['Content-Length'],
  maxAge: 600,
  credentials: true
}));

app.get('/api/health', (c) => {
  return c.json({ 
    code: 200, 
    message: '招商线索单系统服务运行正常',
    timestamp: new Date().toISOString(),
    port: PORT
  });
});

app.route('/api/auth', authRoutes);

app.use('/api/auth/me', authMiddleware());
app.use('/api/clues/*', authMiddleware());

app.route('/api/clues', clueRoutes);

app.onError((err, c) => {
  console.error('服务器错误:', err);
  return c.json({ 
    code: 500, 
    message: '服务器内部错误：' + err.message 
  }, 500);
});

app.notFound((c) => {
  return c.json({ 
    code: 404, 
    message: '接口不存在：' + c.req.path 
  }, 404);
});

console.log(`🚀 招商线索单系统后端服务启动中...`);
console.log(`📡 服务地址: http://localhost:${PORT}`);
console.log(`🔒 CORS 白名单: ${CORS_ORIGIN}`);
console.log(`⏱️  启动时间: ${new Date().toLocaleString('zh-CN')}`);

serve({
  fetch: app.fetch,
  port: PORT
}, (info) => {
  console.log(`✅ 服务已启动，监听端口: ${info.port}`);
});

export default app;
