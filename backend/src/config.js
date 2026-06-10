const path = require('path');

const PORT = 8005;
const FRONTEND_PORT = 3005;

const CORS_ORIGINS = [
  `http://localhost:${FRONTEND_PORT}`,
  `http://127.0.0.1:${FRONTEND_PORT}`
];

const DB_PATH = path.join(__dirname, '..', 'data', 'workorders.db');

const ROLES = {
  PLANNER: 'planner',
  WORKSHOP_DIRECTOR: 'workshop_director',
  FACTORY_MANAGER: 'factory_manager'
};

const ROLE_NAMES = {
  [ROLES.PLANNER]: '生产计划员',
  [ROLES.WORKSHOP_DIRECTOR]: '车间主任',
  [ROLES.FACTORY_MANAGER]: '厂务经理'
};

const STATUS = {
  PENDING_CORRECTION: 'pending_correction',
  UNDER_REVIEW: 'under_review',
  COMPLETED: 'completed'
};

const STATUS_NAMES = {
  [STATUS.PENDING_CORRECTION]: '待补正',
  [STATUS.UNDER_REVIEW]: '复核中',
  [STATUS.COMPLETED]: '办结'
};

const WARNING_THRESHOLD_DAYS = 3;

module.exports = {
  PORT,
  FRONTEND_PORT,
  CORS_ORIGINS,
  DB_PATH,
  ROLES,
  ROLE_NAMES,
  STATUS,
  STATUS_NAMES,
  WARNING_THRESHOLD_DAYS
};
