const Koa = require('koa');
const Router = require('koa-router');
const bodyParser = require('koa-bodyparser');
const cors = require('@koa/cors');

const authRoutes = require('./routes/auth');
const orderRoutes = require('./routes/orders');
const auditRoutes = require('./routes/audit');
const dictRoutes = require('./routes/dict');

const PORT = 8004;
const CORS_WHITELIST = [
  'http://localhost:3004',
  'http://127.0.0.1:3004'
];

const app = new Koa();

app.use(cors({
  origin: (ctx) => {
    const origin = ctx.request.header.origin;
    if (!origin) return CORS_WHITELIST[0];
    if (CORS_WHITELIST.includes(origin)) return origin;
    return CORS_WHITELIST[0];
  },
  credentials: true,
  allowHeaders: ['Content-Type', 'X-User-Id', 'Authorization'],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
}));

app.use(bodyParser({ jsonLimit: '10mb' }));

app.use(async (ctx, next) => {
  try {
    await next();
  } catch (err) {
    console.error('Unhandled error:', err);
    ctx.status = err.status || 500;
    ctx.body = {
      code: err.status || 500,
      message: err.message || '服务器内部错误'
    };
  }
});

app.use(async (ctx, next) => {
  if (ctx.method === 'OPTIONS') {
    ctx.status = 204;
    return;
  }
  await next();
});

const rootRouter = new Router();

rootRouter.get('/', (ctx) => {
  ctx.body = {
    name: '连锁药房-月底集中处理处方订单系统 - 后端 API',
    version: '1.0.0',
    port: PORT,
    endpoints: [
      'POST /api/auth/login',
      'GET  /api/auth/me',
      'GET  /api/auth/users',
      'GET  /api/orders',
      'GET  /api/orders/statistics',
      'GET  /api/orders/:id',
      'POST /api/orders',
      'POST /api/orders/:id/status',
      'POST /api/orders/batch',
      'POST /api/orders/:id/attachments',
      'GET  /api/audit',
      'GET  /api/audit/abnormal',
      'GET  /api/dict'
    ]
  };
});

app.use(rootRouter.routes());
app.use(rootRouter.allowedMethods());

app.use(authRoutes.routes());
app.use(authRoutes.allowedMethods());

app.use(orderRoutes.routes());
app.use(orderRoutes.allowedMethods());

app.use(auditRoutes.routes());
app.use(auditRoutes.allowedMethods());

app.use(dictRoutes.routes());
app.use(dictRoutes.allowedMethods());

app.listen(PORT, () => {
  console.log(`🚀 连锁药房处方订单系统 - 后端服务已启动`);
  console.log(`📍 监听端口: ${PORT}`);
  console.log(`🔗 API 地址: http://localhost:${PORT}`);
  console.log(`✅ CORS 白名单: ${CORS_WHITELIST.join(', ')}`);
});

module.exports = app;
