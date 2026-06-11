const Router = require('koa-router');
const { success, error } = require('../utils/response');
const authMiddleware = require('../middleware/auth');
const roleMiddleware = require('../middleware/role');
const { validate } = require('../middleware/validation');
const applicationService = require('../services/applicationService');

const router = new Router({ prefix: '/api/applications' });

router.get('/',
  authMiddleware(),
  roleMiddleware(['reimbursement_clerk', 'expense_accountant', 'finance_manager']),
  validate({
    status: { type: 'string' }
  }, 'query'),
  async (ctx) => {
    const { status } = ctx.query;
    const user = ctx.state.user;
    const result = applicationService.getApplicationsByRole(
      user.id,
      user.role,
      status || null
    );
    success(ctx, result);
  }
);

router.get('/allowed-actions',
  authMiddleware(),
  roleMiddleware(['reimbursement_clerk', 'expense_accountant', 'finance_manager']),
  async (ctx) => {
    const idsStr = ctx.query.ids;
    if (!idsStr) {
      error(ctx, '请提供ids参数', 400);
      return;
    }
    const ids = String(idsStr).split(',').map(Number).filter(n => !isNaN(n) && n > 0);
    if (ids.length === 0) {
      error(ctx, 'ids参数无效', 400);
      return;
    }
    const user = ctx.state.user;
    const actions = applicationService.getAllowedActionsBatch(ids, user);
    success(ctx, actions);
  }
);

router.get('/:id',
  authMiddleware(),
  roleMiddleware(['reimbursement_clerk', 'expense_accountant', 'finance_manager']),
  async (ctx) => {
    const id = Number(ctx.params.id);
    if (!id || isNaN(id)) {
      error(ctx, '无效的申请单ID', 400);
      return;
    }
    const detail = applicationService.getApplicationDetail(id, ctx.state.user);
    if (!detail) {
      error(ctx, '申请单不存在', 404);
      return;
    }
    success(ctx, detail);
  }
);

router.post('/:id/process',
  authMiddleware(),
  roleMiddleware(['reimbursement_clerk', 'expense_accountant', 'finance_manager']),
  validate({
    action: {
      required: true,
      type: 'string',
      enum: ['submit', 'review', 'verify', 'confirm', 'return', 'reject', 'exception', 'rectify']
    },
    comment: { type: 'string', maxLength: 1000 },
    version: { type: 'number' },
    reason_code: {
      type: 'string',
      enum: ['missing_evidence', 'timeout', 'state_conflict', 'returned_rectify', 'risky_amount']
    },
    reason_detail: { type: 'string', maxLength: 1000 },
    handler_id: { type: 'number' },
    evidence_snapshot: { type: 'object' },
    payment_evidence: { type: 'string', maxLength: 500 },
    overdue_note: { type: 'string', maxLength: 1000 }
  }),
  async (ctx) => {
    const id = Number(ctx.params.id);
    if (!id || isNaN(id)) {
      error(ctx, '无效的申请单ID', 400);
      return;
    }
    const user = ctx.state.user;
    const payload = ctx.request.body;
    const result = applicationService.processApplication(id, user, payload);
    if (!result.success) {
      error(ctx, result.message, 2001);
      return;
    }
    success(ctx, result.detail, result.message);
  }
);

router.post('/batch-process',
  authMiddleware(),
  roleMiddleware(['reimbursement_clerk', 'expense_accountant', 'finance_manager']),
  validate({
    items: { required: true, type: 'array' }
  }),
  async (ctx) => {
    const { items } = ctx.request.body;
    if (!Array.isArray(items) || items.length === 0) {
      error(ctx, '批量处理项不能为空', 400);
      return;
    }
    const user = ctx.state.user;
    const result = applicationService.batchProcess(items, user);
    success(ctx, result, `批量处理完成：成功${result.success_count}条，失败${result.fail_count}条`);
  }
);

module.exports = router;
