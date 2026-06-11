const BACKEND_PORT = 3001;
const FRONTEND_PORT = 5173;
const JWT_SECRET = 'side-record-supervision-secret-key-2024';
const JWT_EXPIRES_IN = '24h';

const ROLES = {
  REGISTRAR: 'registrar',
  SUPERVISOR: 'supervisor',
  REVIEWER: 'reviewer'
};

const ROLE_NAMES = {
  [ROLES.REGISTRAR]: '旁站记录登记员（监理员）',
  [ROLES.SUPERVISOR]: '旁站记录审核主管（专业监理工程师）',
  [ROLES.REVIEWER]: '工程监理公司复核负责人（总监代表）'
};

const STATUS = {
  PENDING_REVIEW: 'pending_review',
  REVIEW_PASSED: 'review_passed',
  SYNCED: 'synced',
  RETURNED: 'returned',
  OVERDUE: 'overdue',
  MATERIAL_MISSING: 'material_missing',
  STATUS_CONFLICT: 'status_conflict'
};

const STATUS_NAMES = {
  [STATUS.PENDING_REVIEW]: '待审核',
  [STATUS.REVIEW_PASSED]: '审核通过',
  [STATUS.SYNCED]: '已同步',
  [STATUS.RETURNED]: '退回补正',
  [STATUS.OVERDUE]: '逾期',
  [STATUS.MATERIAL_MISSING]: '缺料',
  [STATUS.STATUS_CONFLICT]: '状态冲突'
};

const WARNING_GROUPS = {
  NORMAL: 'normal',
  APPROACHING: 'approaching',
  OVERDUE: 'overdue'
};

const WARNING_DAYS = {
  APPROACHING: 3
};

const REQUIRED_EVIDENCE_FIELDS = [
  'sitePhoto',
  'inspectionRecord',
  'signatures'
];

const MODULES = {
  REGISTRATION: 'registration',
  VERIFICATION: 'verification',
  ARCHIVING: 'archiving',
  LEDGER: 'ledger',
  WARNING: 'warning'
};

module.exports = {
  BACKEND_PORT,
  FRONTEND_PORT,
  JWT_SECRET,
  JWT_EXPIRES_IN,
  ROLES,
  ROLE_NAMES,
  STATUS,
  STATUS_NAMES,
  WARNING_GROUPS,
  WARNING_DAYS,
  REQUIRED_EVIDENCE_FIELDS,
  MODULES
};
