export const STATUS = {
  PENDING_REVIEW: 'pending_review',
  REVIEW_PASSED: 'review_passed',
  SYNCED: 'synced',
  RETURNED: 'returned',
  OVERDUE: 'overdue',
  MATERIAL_MISSING: 'material_missing',
  STATUS_CONFLICT: 'status_conflict'
};

export const STATUS_NAMES = {
  [STATUS.PENDING_REVIEW]: '待审核',
  [STATUS.REVIEW_PASSED]: '审核通过',
  [STATUS.SYNCED]: '已同步',
  [STATUS.RETURNED]: '退回补正',
  [STATUS.OVERDUE]: '逾期',
  [STATUS.MATERIAL_MISSING]: '缺料',
  [STATUS.STATUS_CONFLICT]: '状态冲突'
};

export const ROLES = {
  REGISTRAR: 'registrar',
  SUPERVISOR: 'supervisor',
  REVIEWER: 'reviewer'
};

export const ROLE_NAMES = {
  [ROLES.REGISTRAR]: '旁站记录登记员（监理员）',
  [ROLES.SUPERVISOR]: '旁站记录审核主管（专业监理工程师）',
  [ROLES.REVIEWER]: '工程监理公司复核负责人（总监代表）'
};

export const ROLE_SHORT_NAMES = {
  [ROLES.REGISTRAR]: '监理员',
  [ROLES.SUPERVISOR]: '专业监理',
  [ROLES.REVIEWER]: '总监代表'
};

export const WARNING_GROUPS = {
  NORMAL: 'normal',
  APPROACHING: 'approaching',
  OVERDUE: 'overdue'
};

export const WARNING_GROUP_NAMES = {
  [WARNING_GROUPS.NORMAL]: '正常',
  [WARNING_GROUPS.APPROACHING]: '临期',
  [WARNING_GROUPS.OVERDUE]: '逾期'
};

export const MODULES = {
  REGISTRATION: 'registration',
  VERIFICATION: 'verification',
  ARCHIVING: 'archiving',
  LEDGER: 'ledger',
  WARNING: 'warning'
};

export const MODULE_NAMES = {
  [MODULES.REGISTRATION]: '旁站记录单登记',
  [MODULES.VERIFICATION]: '过程核验',
  [MODULES.ARCHIVING]: '复核归档',
  [MODULES.LEDGER]: '旁站记录台账',
  [MODULES.WARNING]: '到期预警'
};

export const DEMO_ACCOUNTS = [
  { username: 'jianliyuan', password: '123456', role: ROLES.REGISTRAR, name: '张监理' },
  { username: 'zhuanyejianli', password: '123456', role: ROLES.SUPERVISOR, name: '李工（专业监理）' },
  { username: 'zongjiandaibiao', password: '123456', role: ROLES.REVIEWER, name: '王总监代表' }
];
