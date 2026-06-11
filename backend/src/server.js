require('dotenv').config();

const fastify = require('fastify')({ logger: true });
const cors = require('@fastify/cors');

const { authenticate, requireRole } = require('./middleware/auth');

fastify.register(cors, {
  origin: 'http://localhost:3107',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  credentials: true
});

fastify.decorate('authenticate', authenticate);
fastify.decorate('requireRole', requireRole);

fastify.get('/health', async (request, reply) => {
  return { status: 'ok', timestamp: new Date().toISOString() };
});

fastify.register(require('./routes/auth'));
fastify.register(require('./routes/forms'));
fastify.register(require('./routes/batch'));
fastify.register(require('./routes/alerts'));

const start = async () => {
  try {
    await fastify.listen({ port: 8107, host: '0.0.0.0' });
    console.log('Server is running on port 8107');
    console.log('CORS allowed origin: http://localhost:3107');
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
