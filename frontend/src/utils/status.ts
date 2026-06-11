import type { ApplicationStatus, ProcessAction, UserRole, StatusGroup } from '../types';

export const STATUS_LABELS: Record<ApplicationStatus, string> = {
  pending_review: '待审核',
  verifying: '待复核',
  confirming: '待确认',
  exception: '异常',
  completed: '已完成',
  rejected: '已拒绝',
  returned: '已退回',
};

export const ACTION_LABELS: Record<ProcessAction, string> = {
  submit: '提交',
  review: '审核',
  verify: '复核',
  confirm: '付款确认',
  return: '退回',
  reject: '拒绝',
  exception: '标记异常',
  rectify: '补正重提',
};

export const STATUS_GROUPS: Record<StatusGroup, ApplicationStatus[]> = {
  pending: ['pending_review', 'verifying', 'confirming'],
  exception: ['exception'],
  completed: ['completed', 'rejected', 'returned'],
  all: ['pending_review', 'verifying', 'confirming', 'exception', 'completed', 'rejected', 'returned'],
};

export const GROUP_LABELS: Record<StatusGroup, string> = {
  pending: '待确认',
  exception: '异常',
  completed: '已复查',
  all: '全部',
};

export const REASON_CODE_LABELS: Record<string, string> = {
  missing_evidence: '附件缺失',
  timeout: '超时未处理',
  state_conflict: '状态冲突',
  returned_rectify: '退回需补正',
  risky_amount: '金额风险',
};

interface StatusTransition {
  from: Array<ApplicationStatus | null>;
  to: ApplicationStatus;
  allowedRoles: UserRole[] | '*';
}

export const STATUS_TRANSITIONS: Record<ProcessAction, StatusTransition> = {
  submit: {
    from: [null, 'returned'],
    to: 'pending_review',
    allowedRoles: ['reimbursement_clerk'],
  },
  review: {
    from: ['pending_review'],
    to: 'verifying',
    allowedRoles: ['expense_accountant'],
  },
  verify: {
    from: ['verifying'],
    to: 'confirming',
    allowedRoles: ['finance_manager'],
  },
  confirm: {
    from: ['confirming'],
    to: 'completed',
    allowedRoles: ['expense_accountant'],
  },
  return: {
    from: ['pending_review', 'verifying', 'confirming', 'exception'],
    to: 'returned',
    allowedRoles: '*',
  },
  reject: {
    from: ['pending_review', 'verifying', 'confirming', 'exception', 'returned'],
    to: 'rejected',
    allowedRoles: '*',
  },
  exception: {
    from: ['pending_review', 'verifying', 'confirming'],
    to: 'exception',
    allowedRoles: '*',
  },
  rectify: {
    from: ['returned', 'exception'],
    to: 'pending_review',
    allowedRoles: ['reimbursement_clerk'],
  },
};

export function getAllowedActions(
  currentStatus: ApplicationStatus | null,
  userRole: UserRole
): ProcessAction[] {
  const actions: ProcessAction[] = [];

  for (const [action, transition] of Object.entries(STATUS_TRANSITIONS) as [
    ProcessAction,
    StatusTransition
  ][]) {
    if (!transition.from.includes(currentStatus)) {
      continue;
    }

    if (transition.allowedRoles === '*' || transition.allowedRoles.includes(userRole)) {
      actions.push(action);
    }
  }

  return actions;
}

export function getNextStatus(
  currentStatus: ApplicationStatus | null,
  action: ProcessAction
): ApplicationStatus | null {
  const transition = STATUS_TRANSITIONS[action];
  if (!transition) return null;
  if (!transition.from.includes(currentStatus)) return null;
  return transition.to;
}

export function getStatusGroup(status: ApplicationStatus): StatusGroup {
  for (const [group, statuses] of Object.entries(STATUS_GROUPS) as [
    StatusGroup,
    ApplicationStatus[]
  ][]) {
    if (group === 'all') continue;
    if (statuses.includes(status)) {
      return group;
    }
  }
  return 'all';
}

export function getStatusClass(status: ApplicationStatus): string {
  return `status-${status}`;
}

export function getActionButtonClass(action: ProcessAction): string {
  if (['submit', 'review', 'verify', 'confirm', 'rectify'].includes(action)) return 'btn btn-success';
  if (action === 'return') return 'btn btn-warning';
  if (['reject', 'exception'].includes(action)) return 'btn btn-danger';
  return 'btn btn-primary';
}
