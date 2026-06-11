export const PORT = 8109;
export const JWT_SECRET = 'zhaoshang-clue-secret-key-2024';
export const TOKEN_EXPIRES_IN = '24h';
export const CORS_ORIGIN = 'http://localhost:3109';

export const ROLES = {
  REGISTRAR: 'registrar',
  AUDITOR: 'auditor',
  REVIEWER: 'reviewer'
};

export const STATUS = {
  DRAFT: 'draft',
  PENDING_SUBMIT: 'pending_submit',
  PENDING_AUDIT: 'pending_audit',
  RETURNED: 'returned',
  RESUBMITTED: 'resubmitted',
  PENDING_REVIEW: 'pending_review',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  ARCHIVED: 'archived'
};

export const STATUS_LABELS = {
  draft: '草稿',
  pending_submit: '待提交',
  pending_audit: '待审核',
  returned: '已退回',
  resubmitted: '重新提交',
  pending_review: '待复核',
  approved: '审核通过',
  rejected: '审核拒绝',
  archived: '已归档'
};

export const PRIORITY = {
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low'
};

export const PRIORITY_LABELS = {
  high: '高',
  medium: '中',
  low: '低'
};

export const CLUE_TYPE = {
  ENTERPRISE: 'enterprise',
  FOLLOW_UP: 'follow_up',
  SIGNING: 'signing'
};

export const CLUE_TYPE_LABELS = {
  enterprise: '企业线索',
  follow_up: '跟进拜访',
  signing: '签约确认'
};

export const ABNORMAL_TYPES = {
  MISSING_MATERIAL: 'missing_material',
  OVERDUE: 'overdue',
  STATUS_CONFLICT: 'status_conflict',
  VERSION_CONFLICT: 'version_conflict'
};

export const ABNORMAL_LABELS = {
  missing_material: '缺材料',
  overdue: '逾期未处理',
  status_conflict: '状态冲突',
  version_conflict: '版本冲突'
};

export const STATUS_TRANSITIONS = {
  [ROLES.REGISTRAR]: {
    [STATUS.DRAFT]: [STATUS.PENDING_SUBMIT],
    [STATUS.PENDING_SUBMIT]: [STATUS.PENDING_SUBMIT],
    [STATUS.RETURNED]: [STATUS.RESUBMITTED],
    [STATUS.RESUBMITTED]: [STATUS.RESUBMITTED]
  },
  [ROLES.AUDITOR]: {
    [STATUS.PENDING_SUBMIT]: [STATUS.PENDING_AUDIT, STATUS.RETURNED],
    [STATUS.PENDING_AUDIT]: [STATUS.PENDING_REVIEW, STATUS.RETURNED],
    [STATUS.RESUBMITTED]: [STATUS.PENDING_REVIEW, STATUS.RETURNED]
  },
  [ROLES.REVIEWER]: {
    [STATUS.PENDING_REVIEW]: [STATUS.APPROVED, STATUS.REJECTED],
    [STATUS.APPROVED]: [STATUS.ARCHIVED],
    [STATUS.REJECTED]: [STATUS.ARCHIVED]
  }
};

export const REQUIRED_ATTACHMENTS = {
  [STATUS.PENDING_AUDIT]: ['enterprise_info'],
  [STATUS.PENDING_REVIEW]: ['enterprise_info', 'visit_record'],
  [STATUS.APPROVED]: ['enterprise_info', 'visit_record', 'signing_contract']
};
