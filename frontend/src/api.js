import { API_BASE } from './utils.js';

function getToken() {
  return localStorage.getItem('care_token') || '';
}

export function setAuth(token, user) {
  localStorage.setItem('care_token', token || '');
  localStorage.setItem('care_user', user ? JSON.stringify(user) : '');
}

export function clearAuth() {
  localStorage.removeItem('care_token');
  localStorage.removeItem('care_user');
}

export function getAuthUser() {
  try {
    const s = localStorage.getItem('care_user');
    return s ? JSON.parse(s) : null;
  } catch {
    return null;
  }
}

async function request(path, { method = 'GET', body, headers = {} } = {}) {
  const token = getToken();
  const h = {
    'Content-Type': 'application/json',
    ...headers,
  };
  if (token) h['X-Auth-Token'] = token;
  const opts = { method, headers: h };
  if (body !== undefined) opts.body = JSON.stringify(body);
  const resp = await fetch(`${API_BASE}${path}`, opts);
  let data;
  try {
    data = await resp.json();
  } catch {
    data = { detail: `HTTP ${resp.status}` };
  }
  if (!resp.ok) {
    const msg = data.detail || data.message || `请求失败(${resp.status})`;
    const err = new Error(msg);
    err.data = data;
    err.status = resp.status;
    throw err;
  }
  return data;
}

export const api = {
  login: (username, password) => request('/api/auth/login', { method: 'POST', body: { username, password } }),
  me: () => request('/api/auth/me'),
  listUsers: () => request('/api/users'),
  stats: () => request('/api/stats'),
  warnings: (type = 'all') => request(`/api/warnings?warning_type=${type}`),

  listRecords: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/api/care-records${qs ? '?' + qs : ''}`);
  },
  getRecord: (id) => request(`/api/care-records/${id}`),
  createRecord: (body) => request('/api/care-records', { method: 'POST', body }),
  updateRecord: (id, body) => request(`/api/care-records/${id}`, { method: 'PUT', body }),
  submitRecord: (id, body) => request(`/api/care-records/${id}/submit`, { method: 'POST', body }),
  correctRecord: (id, body) => request(`/api/care-records/${id}/correct`, { method: 'POST', body }),
  auditRecord: (id, body) => request(`/api/care-records/${id}/audit`, { method: 'POST', body }),
  reviewRecord: (id, body) => request(`/api/care-records/${id}/review`, { method: 'POST', body }),
  batch: (body) => request('/api/care-records/batch', { method: 'POST', body }),
  advanceOverdue: (id) => request(`/api/care-records/${id}/advance-overdue`, { method: 'POST' }),
};
