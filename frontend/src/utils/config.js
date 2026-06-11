export const API_BASE_URL = '/api';

export const ROLES = {
  REGISTRAR: 'registrar',
  AUDITOR: 'auditor',
  REVIEWER: 'reviewer'
};

export const ROLE_LABELS = {
  registrar: '招商线索登记员',
  auditor: '招商线索审核主管',
  reviewer: '园区招商中心复核负责人'
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

export const STATUS_COLORS = {
  draft: '#909399',
  pending_submit: '#E6A23C',
  pending_audit: '#409EFF',
  returned: '#F56C6C',
  resubmitted: '#E6A23C',
  pending_review: '#909399',
  approved: '#67C23A',
  rejected: '#F56C6C',
  archived: '#909399'
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

export const PRIORITY_COLORS = {
  high: '#F56C6C',
  medium: '#E6A23C',
  low: '#67C23A'
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
  overdue: '逾期',
  status_conflict: '状态冲突',
  version_conflict: '版本冲突'
};

export const ABNORMAL_COLORS = {
  missing_material: '#F56C6C',
  overdue: '#F56C6C',
  status_conflict: '#E6A23C',
  version_conflict: '#E6A23C'
};

export const EXPIRY_STATUS = {
  NORMAL: 'normal',
  URGENT: 'urgent',
  OVERDUE: 'overdue'
};

export const EXPIRY_LABELS = {
  normal: '正常',
  urgent: '临期',
  overdue: '逾期'
};

export const EXPIRY_COLORS = {
  normal: '#67C23A',
  urgent: '#E6A23C',
  overdue: '#F56C6C'
};

export const ATTACHMENT_TYPE_LABELS = {
  enterprise_info: '企业资料',
  visit_record: '拜访记录',
  signing_contract: '签约合同'
};
