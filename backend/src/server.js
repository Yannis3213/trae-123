import Fastify from 'fastify';
import cors from '@fastify/cors';
import { BACKEND_PORT, CORS_WHITELIST } from './config.js';
import { initDb } from './db/init.js';
import userRoutes from './routes/users.js';
import orderRoutes from './routes/orders.js';
import attachmentRoutes from './routes/attachments.js';

const fastify = Fastify({ logger: true });

await fastify.register(cors, {
  origin: (origin, cb) => {
    if (!origin || CORS_WHITELIST.includes(origin) || origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:')) {
      cb(null, true);
    } else {
      cb(new Error(`CORS 不允许：${origin}，仅允许 ${CORS_WHITELIST.join(', ')}`), false);
    }
  },
  allowedHeaders: ['Content-Type', 'X-User-Id', 'Authorization'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  credentials: true,
});

fastify.get('/api/health', async () => {
  return { ok: true, service: 'hotel-order-system-backend', port: BACKEND_PORT, ts: new Date().toISOString() };
});

fastify.get('/api/config', async () => {
  return {
    ok: true,
    data: {
      frontend_port: parseInt(process.env.FRONTEND_PORT || '3000', 10),
      backend_port: BACKEND_PORT,
      cors_whitelist: CORS_WHITELIST,
    },
  };
});

await userRoutes(fastify);
await orderRoutes(fastify);
await attachmentRoutes(fastify);

fastify.setErrorHandler((error, request, reply) => {
  fastify.log.error(error);
  const code = error.code || error.statusCode || 500;
  const message = error.message || '未知错误';
  reply.code(typeof code === 'number' ? code : 500).send({
    ok: false, code: typeof code === 'string' ? code : `ERR_${code}`, message,
  });
});

async function start() {
  try {
    initDb();
    await fastify.listen({ port: BACKEND_PORT, host: '0.0.0.0' });
    console.log(`\n=============================================`);
    console.log(`  酒店集团-月底集中处理住客订单系统 后端服务`);
    console.log(`  端口: ${BACKEND_PORT}`);
    console.log(`  健康检查: http://localhost:${BACKEND_PORT}/api/health`);
    console.log(`  CORS 白名单: ${CORS_WHITELIST.join(', ')}`);
    console.log(`=============================================\n`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

if (process.argv[1]?.includes('server.js')) {
  start();
}

export default fastify;
