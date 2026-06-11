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

export const STATUS_BUTTONS = [
  { status: 'pending_submit' as const, label: '提交', action: 'submit', type: 'primary' as const },
  { status: 'returned' as const, label: '重新提交', action: 'resubmit', type: 'primary' as const },
  { status: 'draft' as const, label: '提交', action: 'submit', type: 'primary' as const },
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
