import dayjs from 'dayjs';
import db from './db.js';
import { v4 as uuidv4 } from 'uuid';

export const ROLES = {
  CS_MANAGER: 'cs_manager',
  DELIVERY_CONSULTANT: 'delivery_consultant',
  CS_LEAD: 'cs_lead',
};

export const ROLE_NAMES = {
  cs_manager: '客户成功经理',
  delivery_consultant: '交付顾问',
  cs_lead: '客户成功负责人',
};

export const STATUSES = {
  DRAFT: 'draft',
  PENDING_REVIEW: 'pending_review',
  ARCHIVED: 'archived',
};

export const STATUS_NAMES = {
  draft: '草稿',
  pending_review: '待复核',
  archived: '已归档',
};

export const PRIORITY_NAMES = {
  urgent: '紧急',
  high: '高',
  medium: '中',
  low: '低',
};

const SIMULATED_USERS = {
  '张三': { id: 'u-zhangsan', role: ROLES.CS_MANAGER },
  '李四': { id: 'u-lisi', role: ROLES.DELIVERY_CONSULTANT },
  '王五': { id: 'u-wangwu', role: ROLES.CS_MANAGER },
  '赵六': { id: 'u-zhaoliu', role: ROLES.DELIVERY_CONSULTANT },
  '王总': { id: 'u-wangzong', role: ROLES.CS_LEAD },
};

export function authMiddleware(req, reply, done) {
  const user = req.headers['x-user-name'] || '张三';
  const forcedRole = req.headers['x-user-role'];

  const userInfo = SIMULATED_USERS[user] || { id: 'u-default', role: ROLES.CS_MANAGER };

  req.user = {
    name: user,
    role: forcedRole || userInfo.role,
    id: userInfo.id,
  };

  done();
}

export function getDeadlineWarning(deadline, status) {
  if (status === STATUSES.ARCHIVED) return 'normal';
  const now = dayjs().startOf('day');
  const dl = dayjs(deadline).startOf('day');
  const diff = dl.diff(now, 'day');
  if (diff < 0) return 'overdue';
  if (diff <= 2) return 'urgent';
  return 'normal';
}

export function logException(launchPlanId, type, detail, operator = '') {
  db.prepare(`
    INSERT INTO exception_logs (id, launch_plan_id, type, detail, operator, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    uuidv4(),
    launchPlanId,
    type,
    detail,
    operator,
    dayjs().format('YYYY-MM-DD HH:mm:ss')
  );
}

export function checkRolePermission(user, requiredRoles) {
  return requiredRoles.includes(user.role);
}
