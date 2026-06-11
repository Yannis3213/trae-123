export const ROLES = {
  FIRE_CLERK: 'fire_clerk',
  FIRE_SUPERVISOR: 'fire_supervisor',
  STATION_CHIEF: 'station_chief'
}

export const ROLE_NAMES = {
  [ROLES.FIRE_CLERK]: '消防文员',
  [ROLES.FIRE_SUPERVISOR]: '防火监督员',
  [ROLES.STATION_CHIEF]: '站点负责人'
}

export const STATUS = {
  DRAFT: 'draft',
  PENDING_ASSIGN: 'pending_assign',
  ASSIGNED: 'assigned',
  TRANSFERRED: 'transferred',
  RECTIFYING: 'rectifying',
  RECHECKING: 'rechecking',
  RETURNED: 'returned',
  REVISITED: 'revisited',
  CLOSED: 'closed',
  ARCHIVED: 'archived'
}

export const STATUS_NAMES = {
  [STATUS.DRAFT]: '草稿',
  [STATUS.PENDING_ASSIGN]: '待分派',
  [STATUS.ASSIGNED]: '已分派',
  [STATUS.TRANSFERRED]: '已转办',
  [STATUS.RECTIFYING]: '整改中',
  [STATUS.RECHECKING]: '复查中',
  [STATUS.RETURNED]: '已退回',
  [STATUS.REVISITED]: '已回访',
  [STATUS.CLOSED]: '已销项',
  [STATUS.ARCHIVED]: '已归档'
}

export const STATUS_COLORS = {
  [STATUS.DRAFT]: '#9ca3af',
  [STATUS.PENDING_ASSIGN]: '#f59e0b',
  [STATUS.ASSIGNED]: '#3b82f6',
  [STATUS.TRANSFERRED]: '#8b5cf6',
  [STATUS.RECTIFYING]: '#f97316',
  [STATUS.RECHECKING]: '#06b6d4',
  [STATUS.RETURNED]: '#ef4444',
  [STATUS.REVISITED]: '#10b981',
  [STATUS.CLOSED]: '#6b7280',
  [STATUS.ARCHIVED]: '#374151'
}

export const PRIORITY = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  URGENT: 'urgent'
}

export const PRIORITY_NAMES = {
  [PRIORITY.LOW]: '低',
  [PRIORITY.MEDIUM]: '中',
  [PRIORITY.HIGH]: '高',
  [PRIORITY.URGENT]: '紧急'
}

export const PRIORITY_COLORS = {
  [PRIORITY.LOW]: '#10b981',
  [PRIORITY.MEDIUM]: '#3b82f6',
  [PRIORITY.HIGH]: '#f97316',
  [PRIORITY.URGENT]: '#ef4444'
}

export const WARNING_LEVEL = {
  NORMAL: 'normal',
  NEAR_DUE: 'near_due',
  OVERDUE: 'overdue'
}

export const WARNING_NAMES = {
  [WARNING_LEVEL.NORMAL]: '正常',
  [WARNING_LEVEL.NEAR_DUE]: '临期',
  [WARNING_LEVEL.OVERDUE]: '逾期'
}

export const WARNING_COLORS = {
  [WARNING_LEVEL.NORMAL]: '#10b981',
  [WARNING_LEVEL.NEAR_DUE]: '#f59e0b',
  [WARNING_LEVEL.OVERDUE]: '#ef4444'
}
