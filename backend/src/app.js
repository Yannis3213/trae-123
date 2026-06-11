const Koa = require('koa');
const cors = require('@koa/cors');
const { koaBody } = require('koa-body');
const path = require('path');

const { BACKEND_PORT, FRONTEND_PORT } = require('./config');
const authRoutes = require('./routes/auth');
const sideRecordRoutes = require('./routes/sideRecords');
const initDatabase = require('./scripts/initDb');

const app = new Koa();

initDatabase();

app.use(cors({
  origin: `http://localhost:${FRONTEND_PORT}`,
  credentials: true,
  allowHeaders: ['Content-Type', 'Authorization', 'X-Auth-Token'],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
}));

app.use(koaBody({
  jsonLimit: '10mb',
  multipart: true,
  formidable: {
    uploadDir: path.join(__dirname, '..', 'uploads'),
    keepExtensions: true
  }
}));

app.use(async (ctx, next) => {
  try {
    await next();
  } catch (err) {
    console.error('[Error]', err);
    ctx.status = err.status || 500;
    ctx.body = {
      success: false,
      message: err.message || '服务器内部错误'
    };
  }
});

app.use(async (ctx, next) => {
  if (ctx.method === 'OPTIONS') {
    ctx.status = 200;
    return;
  }
  await next();
});

app.use(authRoutes.routes()).use(authRoutes.allowedMethods());
app.use(sideRecordRoutes.routes()).use(sideRecordRoutes.allowedMethods());

app.use(async (ctx) => {
  if (ctx.path === '/api/health') {
    ctx.body = { success: true, message: '旁站记录单系统后端服务运行正常', timestamp: new Date().toISOString() };
    return;
  }
  ctx.status = 404;
  ctx.body = { success: false, message: '接口不存在' };
});

app.listen(BACKEND_PORT, () => {
  console.log(`========================================`);
  console.log(`  旁站记录单系统后端服务启动成功`);
  console.log(`  后端地址: http://localhost:${BACKEND_PORT}`);
  console.log(`  健康检查: http://localhost:${BACKEND_PORT}/api/health`);
  console.log(`  CORS 白名单: http://localhost:${FRONTEND_PORT}`);
  console.log(`========================================`);
});

module.exports = app;
