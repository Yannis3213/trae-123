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

export const ROLE_CONFIG = {
  [ROLES.REGISTRAR]: {
    module: MODULES.REGISTRATION,
    moduleName: MODULE_NAMES[MODULES.REGISTRATION],
    visibleStatuses: [STATUS.PENDING_REVIEW, STATUS.RETURNED, STATUS.MATERIAL_MISSING],
    operableStatuses: [STATUS.PENDING_REVIEW, STATUS.RETURNED, STATUS.MATERIAL_MISSING],
    filterFn: (record, user) => record.registrarId === user?.id,
    batchActions: [{ value: 'submit', label: '批量提交/补正' }],
    allowedActions: ['submit']
  },
  [ROLES.SUPERVISOR]: {
    module: MODULES.VERIFICATION,
    moduleName: MODULE_NAMES[MODULES.VERIFICATION],
    visibleStatuses: [STATUS.PENDING_REVIEW, STATUS.MATERIAL_MISSING, STATUS.OVERDUE, STATUS.STATUS_CONFLICT],
    operableStatuses: [STATUS.PENDING_REVIEW, STATUS.MATERIAL_MISSING, STATUS.OVERDUE, STATUS.STATUS_CONFLICT],
    filterFn: (record, user) => !record.currentHandlerId || record.currentHandlerId === user?.id,
    batchActions: [
      { value: 'pass', label: '批量审核通过' },
      { value: 'return', label: '批量退回补正' },
      { value: 'missing', label: '批量缺料退回' },
      { value: 'overdue', label: '批量标记逾期' }
    ],
    allowedActions: ['pass', 'return', 'missing', 'overdue', 'conflict']
  },
  [ROLES.REVIEWER]: {
    module: MODULES.ARCHIVING,
    moduleName: MODULE_NAMES[MODULES.ARCHIVING],
    visibleStatuses: [STATUS.REVIEW_PASSED, STATUS.OVERDUE, STATUS.SYNCED],
    operableStatuses: [STATUS.REVIEW_PASSED, STATUS.OVERDUE],
    filterFn: (record, user) => true,
    batchActions: [
      { value: 'sync', label: '批量同步归档' },
      { value: 'return', label: '批量退回补正' }
    ],
    allowedActions: ['sync', 'return', 'missing', 'overdue']
  }
};

export const ABNORMAL_ACTIONS = ['return', 'missing', 'overdue', 'conflict'];
