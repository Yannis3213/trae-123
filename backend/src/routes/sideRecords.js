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

router.post('/batch', async (ctx) => {
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
