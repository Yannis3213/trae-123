import type { User, UserRole } from '../../types';

const TOKEN_KEY = 'legal_service_token';
const USER_KEY = 'legal_service_user';

export const setToken = (token: string): void => {
  localStorage.setItem(TOKEN_KEY, token);
};

export const getToken = (): string | null => {
  return localStorage.getItem(TOKEN_KEY);
};

export const setUser = (user: User): void => {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
};

export const getUser = (): User | null => {
  const userStr = localStorage.getItem(USER_KEY);
  if (userStr) {
    try {
      return JSON.parse(userStr);
    } catch {
      return null;
    }
  }
  return null;
};

export const clearAuth = (): void => {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
};

export const isAuthenticated = (): boolean => {
  return !!getToken() && !!getUser();
};

export const getRoleMenuItems = (role: UserRole) => {
  const allItems = [
    { key: 'dashboard', label: '控制台', path: '/dashboard', icon: 'DashboardOutlined', roles: ['registrar', 'supervisor', 'reviewer', 'director', 'assistant', 'lawyer'] },
    { key: 'cases', label: '法律咨询单列表', path: '/cases', icon: 'FileTextOutlined', roles: ['registrar', 'supervisor', 'reviewer', 'director', 'assistant', 'lawyer'] },
    { key: 'queue-registration', label: '立案待办', path: '/queue/registration', icon: 'FormOutlined', roles: ['registrar', 'supervisor', 'director'] },
    { key: 'queue-assignment', label: '分案待办', path: '/queue/assignment', icon: 'UserSwitchOutlined', roles: ['supervisor', 'director'] },
    { key: 'queue-followup', label: '跟进待办', path: '/queue/followup', icon: 'PhoneOutlined', roles: ['assistant', 'lawyer', 'supervisor', 'director'] },
    { key: 'queue-review', label: '审核待办', path: '/queue/review', icon: 'AuditOutlined', roles: ['reviewer', 'director'] },
    { key: 'statistics', label: '统计分析', path: '/statistics', icon: 'BarChartOutlined', roles: ['supervisor', 'reviewer', 'director'] },
  ];

  return allItems.filter(item => item.roles.includes(role));
};

export const getRoleName = (role: UserRole): string => {
  const roleMap: Record<UserRole, string> = {
    registrar: '立案专员',
    supervisor: '案件主管',
    reviewer: '审核专员',
    director: '主任',
    assistant: '律师助理',
    lawyer: '主办律师',
  };
  return roleMap[role];
};

export const getStatusName = (status: string): string => {
  const statusMap: Record<string, string> = {
    draft: '草稿',
    pending_submit: '待提交',
    submitted: '已提交',
    returned: '已退回',
    resubmitted: '重新提交',
    reviewing: '审核中',
    assigned: '已分配',
    followup: '跟进中',
    completed: '已完成',
    archived: '已归档',
  };
  return statusMap[status] || status;
};

export const getPriorityName = (priority: string): string => {
  const priorityMap: Record<string, string> = {
    high: '高',
    normal: '中',
    low: '低',
  };
  return priorityMap[priority] || priority;
};

export const getQueueName = (queue: string): string => {
  const queueMap: Record<string, string> = {
    registration: '立案队列',
    assignment: '分案队列',
    followup: '跟进队列',
    review: '审核队列',
    archive: '归档队列',
  };
  return queueMap[queue] || queue;
};
