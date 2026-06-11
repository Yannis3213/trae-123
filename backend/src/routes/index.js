const Router = require('koa-router');
const authRouter = require('./auth');
const applicationsRouter = require('./applications');

const router = new Router();

router.get('/health', async (ctx) => {
  ctx.body = {
    code: 0,
    data: {
      status: 'ok',
      timestamp: new Date().toISOString()
    },
    message: '服务正常运行'
  };
});

router.use(authRouter.routes(), authRouter.allowedMethods());
router.use(applicationsRouter.routes(), applicationsRouter.allowedMethods());

module.exports = router;
