module.exports = {
  PORT: 8002,
  JWT_SECRET: 'reimbursement-system-secret-key-2024',
  JWT_EXPIRES_IN: '24h',
  CORS: {
    origin: function (ctx) {
      const whitelist = ['http://localhost:3002'];
      if (whitelist.includes(ctx.request.header.origin)) {
        return ctx.request.header.origin;
      }
      return false;
    },
    exposeHeaders: ['WWW-Authenticate', 'Server-Authorization'],
    maxAge: 5,
    credentials: true,
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization', 'Accept', 'X-Requested-With']
  }
};
