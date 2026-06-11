export const TASK_STATUS = {
  PENDING_ASSIGN: 'pending_assign',
  ASSIGNED: 'assigned',
  PROCESSING: 'processing',
  TRANSFERRED: 'transferred',
  FOLLOWED_UP: 'followed_up',
  ARCHIVED: 'archived',
  RETURNED_FOR_CORRECTION: 'returned_for_correction',
} as const;

export type TaskStatus = (typeof TASK_STATUS)[keyof typeof TASK_STATUS];

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  [TASK_STATUS.PENDING_ASSIGN]: '待分派',
  [TASK_STATUS.ASSIGNED]: '已分派',
  [TASK_STATUS.PROCESSING]: '处理中',
  [TASK_STATUS.TRANSFERRED]: '已转办',
  [TASK_STATUS.FOLLOWED_UP]: '已回访',
  [TASK_STATUS.ARCHIVED]: '已归档',
  [TASK_STATUS.RETURNED_FOR_CORRECTION]: '退回补正',
};

export const USER_ROLES = {
  AGRICULTURAL_TECHNICIAN: 'agricultural_technician',
  COOPERATIVE_DIRECTOR: 'cooperative_director',
  FIELD_MANAGER: 'field_manager',
} as const;

export type UserRole = (typeof USER_ROLES)[keyof typeof USER_ROLES];

export const USER_ROLE_LABELS: Record<UserRole, string> = {
  [USER_ROLES.AGRICULTURAL_TECHNICIAN]: '农技员',
  [USER_ROLES.COOPERATIVE_DIRECTOR]: '合作社主任',
  [USER_ROLES.FIELD_MANAGER]: '田间管理员',
};

export const STATUS_FLOW: Record<TaskStatus, TaskStatus[]> = {
  [TASK_STATUS.PENDING_ASSIGN]: [TASK_STATUS.ASSIGNED, TASK_STATUS.RETURNED_FOR_CORRECTION],
  [TASK_STATUS.ASSIGNED]: [TASK_STATUS.PROCESSING, TASK_STATUS.RETURNED_FOR_CORRECTION],
  [TASK_STATUS.PROCESSING]: [TASK_STATUS.TRANSFERRED, TASK_STATUS.RETURNED_FOR_CORRECTION],
  [TASK_STATUS.TRANSFERRED]: [TASK_STATUS.FOLLOWED_UP, TASK_STATUS.RETURNED_FOR_CORRECTION],
  [TASK_STATUS.FOLLOWED_UP]: [TASK_STATUS.ARCHIVED, TASK_STATUS.RETURNED_FOR_CORRECTION],
  [TASK_STATUS.ARCHIVED]: [],
  [TASK_STATUS.RETURNED_FOR_CORRECTION]: [TASK_STATUS.PENDING_ASSIGN, TASK_STATUS.ASSIGNED],
};

export const FIELD_RECORD_TYPES = {
  SOWING: 'sowing',
  FERTILIZING: 'fertilizing',
  PEST_CONTROL: 'pest_control',
  HARVESTING: 'harvesting',
  INSPECTION: 'inspection',
  OTHER: 'other',
} as const;

export const FIELD_RECORD_TYPE_LABELS: Record<string, string> = {
  [FIELD_RECORD_TYPES.SOWING]: '播种',
  [FIELD_RECORD_TYPES.FERTILIZING]: '施肥',
  [FIELD_RECORD_TYPES.PEST_CONTROL]: '病虫害防治',
  [FIELD_RECORD_TYPES.HARVESTING]: '收获',
  [FIELD_RECORD_TYPES.INSPECTION]: '巡检',
  [FIELD_RECORD_TYPES.OTHER]: '其他',
};

export const OVERDUE_STATUS = {
  NORMAL: 'normal',
  NEAR_EXPIRY: 'near_expiry',
  OVERDUE: 'overdue',
} as const;

export const OVERDUE_STATUS_LABELS: Record<string, string> = {
  [OVERDUE_STATUS.NORMAL]: '正常',
  [OVERDUE_STATUS.NEAR_EXPIRY]: '临期',
  [OVERDUE_STATUS.OVERDUE]: '逾期',
};
