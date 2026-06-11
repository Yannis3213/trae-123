import type { CaseStatus, CasePriority, UserRole } from '../../types';

export const STATUS_MAP: Record<CaseStatus, string> = {
  draft: '草稿',
  pending_submit: '待提交',
  submitted: '已提交',
  returned: '已退回',
  resubmitted: '重新提交',
  reviewing: '审核中',
  assigned: '已分派',
  followup: '回访中',
  completed: '已完成',
  archived: '已归档',
};

export const STATUS_COLOR_MAP: Record<CaseStatus, string> = {
  draft: 'default',
  pending_submit: 'default',
  submitted: 'blue',
  returned: 'red',
  resubmitted: 'orange',
  reviewing: 'cyan',
  assigned: 'geekblue',
  followup: 'purple',
  completed: 'green',
  archived: 'gray',
};

export const PRIORITY_MAP: Record<CasePriority, string> = {
  low: '低',
  normal: '普通',
  high: '高',
  urgent: '紧急',
};

export const PRIORITY_COLOR_MAP: Record<CasePriority, string> = {
  low: 'green',
  normal: 'blue',
  high: 'orange',
  urgent: 'red',
};

export const ROLE_MAP: Record<UserRole, string> = {
  registrar: '立案员',
  supervisor: '主管',
  reviewer: '审核员',
  director: '主任',
  assistant: '律师助理',
  lawyer: '律师',
};

export const WARNING_MAP: Record<string, string> = {
  normal: '正常',
  approaching: '即将到期',
  overdue: '已逾期',
};

export const WARNING_COLOR_MAP: Record<string, string> = {
  normal: 'green',
  approaching: 'orange',
  overdue: 'red',
};

export const QUEUE_MAP: Record<string, string> = {
  registration: '立案队列',
  assignment: '分派队列',
  followup: '回访队列',
  review: '审核队列',
  archive: '归档队列',
};

export const ACTION_MAP: Record<string, string> = {
  create: '创建',
  update: '更新',
  submit: '提交',
  review: '审核',
  assign: '分派',
  start_followup: '开始回访',
  complete: '完成',
  archive: '归档',
  return: '退回',
  resubmit: '重新提交',
};

export const STATUS_BUTTONS: Array<{
  status: CaseStatus;
  label: string;
  action: string;
  type: 'primary' | 'default' | 'dashed' | 'danger';
  roles?: UserRole[];
}> = [
  { status: 'draft', label: '提交', action: 'submit', type: 'primary', roles: ['registrar', 'supervisor', 'director'] },
  { status: 'pending_submit', label: '提交', action: 'submit', type: 'primary', roles: ['registrar', 'supervisor', 'director'] },
  { status: 'returned', label: '重新提交', action: 'resubmit', type: 'primary', roles: ['registrar', 'supervisor', 'director'] },
  { status: 'submitted', label: '审核', action: 'review', type: 'primary', roles: ['reviewer', 'supervisor', 'director'] },
  { status: 'submitted', label: '退回', action: 'return', type: 'default', roles: ['reviewer', 'supervisor', 'director'] },
  { status: 'resubmitted', label: '审核', action: 'review', type: 'primary', roles: ['reviewer', 'supervisor', 'director'] },
  { status: 'reviewing', label: '分派', action: 'assign', type: 'primary', roles: ['supervisor', 'director'] },
  { status: 'reviewing', label: '退回', action: 'return', type: 'default', roles: ['reviewer', 'supervisor', 'director'] },
  { status: 'assigned', label: '开始回访', action: 'start_followup', type: 'primary', roles: ['assistant', 'lawyer', 'supervisor', 'director'] },
  { status: 'followup', label: '完成', action: 'complete', type: 'primary', roles: ['assistant', 'lawyer', 'supervisor', 'director'] },
  { status: 'completed', label: '归档', action: 'archive', type: 'primary', roles: ['supervisor', 'director'] },
];

export const QUEUE_ROLE_MAPPING: Record<string, string[]> = {
  registration: ['registrar', 'supervisor', 'director'],
  assignment: ['supervisor', 'director'],
  followup: ['assistant', 'lawyer', 'supervisor', 'director'],
  review: ['reviewer', 'director'],
  archive: ['reviewer', 'director'],
};

export const STATUS_QUEUE_MAPPING: Record<string, string> = {
  draft: 'registration',
  pending_submit: 'registration',
  returned: 'registration',
  resubmitted: 'registration',
  submitted: 'assignment',
  reviewing: 'assignment',
  assigned: 'followup',
  followup: 'followup',
  completed: 'review',
  archived: 'archive',
};
