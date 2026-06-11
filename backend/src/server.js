import Fastify from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import { initDatabase } from './db.js';
import { authMiddleware } from './middleware.js';
import launchPlansRoutes from './routes/launch-plans.js';

const PORT = 8003;
const HOST = '0.0.0.0';

const fastify = Fastify({
  logger: {
    level: 'info',
    transport: process.env.NODE_ENV !== 'production'
      ? {
          target: 'pino-pretty',
          options: { translateTime: 'HH:MM:ss Z', ignore: 'pid,hostname' },
        }
      : undefined,
  },
});

await fastify.register(cors, {
  origin: [
    'http://localhost:3003',
    'http://127.0.0.1:3003',
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'X-User-Name',
    'X-User-Role',
    'Authorization',
  ],
  credentials: true,
});

await fastify.register(multipart, {
  limits: {
    fieldNameSize: 100,
    fieldSize: 1024 * 1024 * 50,
    fields: 10,
    fileSize: 1024 * 1024 * 50,
    files: 5,
    headerPairs: 2000,
  },
});

fastify.addHook('onRequest', authMiddleware);

fastify.get('/', async (req, reply) => {
  return {
    name: 'SaaS客户成功团队-月底集中处理上线计划单系统',
    version: '1.0.0',
    status: 'running',
    port: PORT,
    api: {
      list: 'GET /api/launch-plans',
      stats: 'GET /api/launch-plans/stats',
      detail: 'GET /api/launch-plans/:id',
      create: 'POST /api/launch-plans',
      update: 'PUT /api/launch-plans/:id',
      submit: 'POST /api/launch-plans/:id/submit',
      reject: 'POST /api/launch-plans/:id/reject',
      archive: 'POST /api/launch-plans/:id/archive',
      batch: 'POST /api/launch-plans/batch-advance',
    },
  };
});

fastify.register(launchPlansRoutes);

initDatabase();

try {
  await fastify.listen({ port: PORT, host: HOST });
  console.log(`\n🚀 后端服务启动成功`);
  console.log(`📍 监听地址: http://${HOST}:${PORT}`);
  console.log(`📡 API 基础: http://localhost:${PORT}/api`);
  console.log(`👤 模拟用户通过 HTTP Header 切换: X-User-Name, X-User-Role`);
  console.log(`\n`);
} catch (err) {
  fastify.log.error(err);
  process.exit(1);
}
