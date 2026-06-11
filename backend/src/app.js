const Koa = require('koa');
const bodyParser = require('koa-bodyparser');
const cors = require('koa2-cors');
const { PORT, CORS } = require('./config');
const { initDatabase } = require('./db');
const { error: errorResp } = require('./utils/response');
const router = require('./routes');

const app = new Koa();

initDatabase();

app.use(async (ctx, next) => {
  const start = Date.now();
  try {
    await next();
    const duration = Date.now() - start;
    ctx.set('X-Response-Time', `${duration}ms`);
    if (ctx.status === 404 && !ctx.body) {
      errorResp(ctx, `接口不存在: ${ctx.method} ${ctx.path}`, 404);
    }
  } catch (err) {
    console.error('[Server Error]', err);
    errorResp(ctx, err.message || '服务器内部错误', err.code || 500);
  }
});

app.use(cors(CORS));

app.use(bodyParser({
  enableTypes: ['json', 'form'],
  formLimit: '10mb',
  jsonLimit: '10mb'
}));

app.use(router.routes());
app.use(router.allowedMethods());

app.listen(PORT, () => {
  console.log('');
  console.log('========================================');
  console.log('  报销系统后端服务已启动');
  console.log(`  监听端口: ${PORT}`);
  console.log(`  服务地址: http://localhost:${PORT}`);
  console.log(`  健康检查: http://localhost:${PORT}/health`);
  console.log('========================================');
  console.log('');
  console.log('演示账号 (密码均为 123456):');
  console.log('  报销专员  : clerk01  (reimbursement_clerk)');
  console.log('  费用会计  : accountant01 (expense_accountant)');
  console.log('  财务经理  : manager01 (finance_manager)');
  console.log('');
});

module.exports = app;
