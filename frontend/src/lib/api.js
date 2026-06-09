const API_BASE = '/api';

async function request(path, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };
  const userId = localStorage.getItem('userId');
  if (userId) headers['X-User-Id'] = userId;
  const res = await fetch(API_BASE + path, { ...options, headers });
  if (!res.ok) {
    let msg = '请求失败';
    try {
      const data = await res.json();
      if (data.detail) msg = data.detail;
    } catch (_) {}
    throw new Error(msg);
  }
  const ct = res.headers.get('content-type') || '';
  if (ct.includes('application/json')) return res.json();
  return res.text();
}

export const api = {
  listUsers: () => request('/users'),
  login: (username) => request('/login', { method: 'POST', body: JSON.stringify({ username }) }),
  listAppointments: (params = {}) => {
    const qs = Object.entries(params)
      .filter(([, v]) => v !== undefined && v !== null && v !== '')
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
      .join('&');
    return request('/appointments' + (qs ? `?${qs}` : ''));
  },
  getStats: () => request('/appointments/stats'),
  getAppointment: (id) => request(`/appointments/${id}`),
  createAppointment: (payload) => request('/appointments', { method: 'POST', body: JSON.stringify(payload) }),
  updateAppointment: (id, payload) => request(`/appointments/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  submitAppointment: (id, payload) => request(`/appointments/${id}/submit`, { method: 'POST', body: JSON.stringify(payload) }),
  processAppointment: (id, payload) => request(`/appointments/${id}/process`, { method: 'POST', body: JSON.stringify(payload) }),
  reviewAppointment: (id, payload) => request(`/appointments/${id}/review`, { method: 'POST', body: JSON.stringify(payload) }),
  returnAppointment: (id, payload) => request(`/appointments/${id}/return`, { method: 'POST', body: JSON.stringify(payload) }),
  batchAction: (payload) => request('/appointments/batch', { method: 'POST', body: JSON.stringify(payload) }),
  updateAppointment: (id, payload) => request(`/appointments/${id}`, { method: 'PUT', body: JSON.stringify(payload) })
};

export const STATUS_LABELS = {
  DRAFT: '草稿',
  PENDING: '待复核',
  ARCHIVED: '已归档',
  RETURNED: '退回补正'
};

export const ROLE_LABELS = {
  TA: '实验助教',
  ADMIN: '实验室管理员',
  DEAN: '学院负责人'
};

export const PRIORITY_LABELS = {
  LOW: '低',
  NORMAL: '中',
  HIGH: '高',
  URGENT: '紧急'
};

export const EXCEPTION_LABELS = {
  MATERIAL: '材料问题',
  PERMISSION: '权限问题',
  TIMELIMIT: '时限问题',
  STATUS: '状态问题'
};

export const WARNING_LABELS = {
  normal: '正常',
  warning: '临期',
  overdue: '逾期'
};

export function formatDate(d) {
  if (!d) return '';
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return d;
  const pad = (n) => String(n).padStart(2, '0');
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())} ${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
}

export function formatShortDate(d) {
  if (!d) return '';
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return d;
  const pad = (n) => String(n).padStart(2, '0');
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
}
