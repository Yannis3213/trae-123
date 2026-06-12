const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./database');
const { errorHandler } = require('./middleware/errorHandler');

const PORT = 8109;
const FRONTEND_URL = 'http://localhost:3109';

const app = express();

app.use(cors({
  origin: [FRONTEND_URL, 'http://127.0.0.1:3109'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Role', 'X-User-Id']
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use((req, res, next) => {
  req.db = db;
  next();
});

app.use('/api/auth', require('./routes/auth'));
app.use('/api/visits', require('./routes/visits'));
app.use('/api/attachments', require('./routes/attachments'));
app.use('/api/records', require('./routes/records'));
app.use('/api/audit', require('./routes/audit'));
app.use('/api/stats', require('./routes/stats'));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', port: PORT, frontend: FRONTEND_URL });
});

app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`🚀 宠物医院后端服务启动成功`);
  console.log(`📡 监听端口: ${PORT}`);
  console.log(`🌐 前端地址: ${FRONTEND_URL}`);
  console.log(`🗄️  数据库: ${path.join(__dirname, 'data', 'hospital.db')}`);
});
