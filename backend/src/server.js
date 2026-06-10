const express = require('express');
const cors = require('cors');
const { PORT, CORS_ORIGINS } = require('./config');
const { initDatabase, seedData } = require('./db/init');
const apiRoutes = require('./routes/api');

const app = express();

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || CORS_ORIGINS.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  allowedHeaders: ['Content-Type', 'X-User-Role', 'X-User-Name']
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

app.use('/api', apiRoutes);

app.use((err, req, res, next) => {
  console.error('Error:', err.message);
  if (err.message === 'Not allowed by CORS') {
    return res.status(403).json({ success: false, error: 'CORS 不允许该来源', code: 'CORS_ERROR' });
  }
  res.status(500).json({ success: false, error: err.message || '服务器内部错误', code: 'INTERNAL_ERROR' });
});

initDatabase();
seedData();

app.listen(PORT, () => {
  console.log(`制造工厂-月底集中处理生产工单系统 后端服务已启动`);
  console.log(`端口: ${PORT}`);
  console.log(`API 地址: http://localhost:${PORT}/api`);
  console.log(`CORS 白名单: ${CORS_ORIGINS.join(', ')}`);
});

module.exports = app;
