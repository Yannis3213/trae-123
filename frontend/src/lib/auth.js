const AUTH_KEY = 'pet_hospital_auth';

export const ROLE_LABELS = {
  nurse: '前台护士',
  doctor: '兽医师',
  director: '院长'
};

export const STATUS_LABELS = {
  pending_assign: '待分派',
  assigned: '已分派',
  processing: '处理中',
  transferred: '已转办',
  returned_for_correction: '退回补正',
  reprocessing: '补正中',
  follow_up_scheduled: '待回访',
  followed_up: '已回访',
  reviewing: '复核中',
  archived: '已归档'
};

export const PRIORITY_LABELS = {
  urgent: '紧急',
  high: '高',
  normal: '普通',
  low: '低'
};

export const EXCEPTION_LABELS = {
  material: '材料问题',
  permission: '权限问题',
  timeline: '时限问题',
  status: '状态问题'
};

export const CATEGORY_LABELS = {
  pet_profile: '宠物建档',
  appointment: '预约就诊',
  diagnosis: '诊断记录',
  treatment: '治疗方案',
  follow_up: '诊后回访',
  other: '其他'
};

export const getUser = () => {
  try {
    const raw = localStorage.getItem(AUTH_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

export const setUser = (user) => {
  localStorage.setItem(AUTH_KEY, JSON.stringify(user));
};

export const clearUser = () => {
  localStorage.removeItem(AUTH_KEY);
};

export const hasRole = (...roles) => {
  const user = getUser();
  return user && roles.includes(user.role);
};

export const formatDate = (d) => {
  if (!d) return '';
  const t = new Date(d);
  if (isNaN(t.getTime())) return String(d);
  const pad = (n) => String(n).padStart(2, '0');
  return `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())} ${pad(t.getHours())}:${pad(t.getMinutes())}`;
};

export const getDeadlineStatus = (deadline) => {
  if (!deadline) return { status: 'normal', label: '正常', color: '#16a34a' };
  const now = new Date();
  const dl = new Date(deadline);
  const diffHours = (dl - now) / (1000 * 60 * 60);
  if (diffHours < 0) return { status: 'overdue', label: '逾期', color: '#dc2626' };
  if (diffHours <= 24) return { status: 'approaching', label: '临期', color: '#f59e0b' };
  return { status: 'normal', label: '正常', color: '#16a34a' };
};

export const priorityStyle = (p) => {
  const map = {
    urgent: { bg: '#fef2f2', color: '#dc2626', label: '紧急' },
    high: { bg: '#fff7ed', color: '#ea580c', label: '高' },
    normal: { bg: '#eff6ff', color: '#2563eb', label: '普通' },
    low: { bg: '#f0fdf4', color: '#16a34a', label: '低' }
  };
  return map[p] || map.normal;
};

export const statusStyle = (s) => {
  const map = {
    pending_assign: { bg: '#fef3c7', color: '#92400e' },
    assigned: { bg: '#dbeafe', color: '#1e40af' },
    processing: { bg: '#cffafe', color: '#155e75' },
    transferred: { bg: '#e0e7ff', color: '#3730a3' },
    returned_for_correction: { bg: '#fee2e2', color: '#991b1b' },
    reprocessing: { bg: '#fed7aa', color: '#9a3412' },
    follow_up_scheduled: { bg: '#fce7f3', color: '#9d174d' },
    followed_up: { bg: '#dcfce7', color: '#166534' },
    reviewing: { bg: '#f3e8ff', color: '#6b21a8' },
    archived: { bg: '#f1f5f9', color: '#475569' }
  };
  return map[s] || { bg: '#f1f5f9', color: '#475569' };
};
