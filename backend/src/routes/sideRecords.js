const Router = require('koa-router');
const SideRecordService = require('../services/sideRecordService');
const { authMiddleware, requireRole } = require('../middleware/auth');
const { ROLES } = require('../config');

const router = new Router({ prefix: '/api/side-records' });

router.use(authMiddleware);

router.post('/', requireRole(ROLES.REGISTRAR), async (ctx) => {
  const userId = ctx.state.user.id;
  const result = SideRecordService.create(ctx.request.body, userId);
  ctx.body = { success: true, data: result };
});

router.get('/', async (ctx) => {
  const userId = ctx.state.user.id;
  const userRole = ctx.state.user.role;
  const filters = ctx.query;
  const records = await SideRecordService.list(filters, userId, userRole);
  ctx.body = { success: true, data: records };
});

router.get('/:id', async (ctx) => {
  const userId = ctx.state.user.id;
  const record = SideRecordService.getDetail(ctx.params.id, userId);
  if (!record) {
    ctx.status = 404;
    ctx.body = { success: false, message: '旁站记录单不存在' };
    return;
  }
  ctx.body = { success: true, data: record };
});

router.post('/:id/submit', requireRole(ROLES.REGISTRAR), async (ctx) => {
  const userId = ctx.state.user.id;
  const userRole = ctx.state.user.role;
  const result = SideRecordService.submit(ctx.params.id, ctx.request.body, userId, userRole);
  ctx.body = result;
});

router.post('/:id/review', requireRole(ROLES.SUPERVISOR), async (ctx) => {
  const userId = ctx.state.user.id;
  const userRole = ctx.state.user.role;
  const result = SideRecordService.review(ctx.params.id, ctx.request.body, userId, userRole);
  ctx.body = result;
});

router.post('/:id/archive', requireRole(ROLES.REVIEWER), async (ctx) => {
  const userId = ctx.state.user.id;
  const userRole = ctx.state.user.role;
  const result = SideRecordService.archive(ctx.params.id, ctx.request.body, userId, userRole);
  ctx.body = result;
});

router.post('/batch', authMiddleware, async (ctx) => {
  const { ids, action, data } = ctx.request.body;
  const userId = ctx.state.user.id;
  const userRole = ctx.state.user.role;

  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    ctx.body = { success: false, message: '请选择要批量处理的单据' };
    return;
  }

  if (!action) {
    ctx.body = { success: false, message: '请指定批量操作类型' };
    return;
  }

  if (action === 'submit' && userRole !== ROLES.REGISTRAR) {
    ctx.status = 403;
    ctx.body = { success: false, message: '越权：只有旁站记录登记员可以执行批量提交' };
    return;
  }
  if (['pass', 'return', 'missing', 'overdue', 'conflict'].includes(action) && userRole !== ROLES.SUPERVISOR) {
    ctx.status = 403;
    ctx.body = { success: false, message: '越权：只有旁站记录审核主管可以执行批量审核' };
    return;
  }
  if (['sync'].includes(action) && userRole !== ROLES.REVIEWER) {
    ctx.status = 403;
    ctx.body = { success: false, message: '越权：只有工程监理公司复核负责人可以执行批量归档' };
    return;
  }

  const result = await SideRecordService.batchProcess(ids, action, data || {}, userId, userRole);
  ctx.body = result;
});

router.post('/:id/notes', async (ctx) => {
  const userId = ctx.state.user.id;
  const { content } = ctx.request.body;
  if (!content) {
    ctx.body = { success: false, message: '备注内容不能为空' };
    return;
  }
  const result = SideRecordService.addAuditNote(ctx.params.id, content, userId);
  ctx.body = result;
});

router.get('/statistics/summary', async (ctx) => {
  const userId = ctx.state.user.id;
  const userRole = ctx.state.user.role;
  const stats = SideRecordService.getStatistics(userId, userRole);
  ctx.body = { success: true, data: stats };
});

router.get('/warning/list', async (ctx) => {
  const userId = ctx.state.user.id;
  const userRole = ctx.state.user.role;
  const list = SideRecordService.getWarningList(userId, userRole);
  ctx.body = { success: true, data: list };
});

module.exports = router;
