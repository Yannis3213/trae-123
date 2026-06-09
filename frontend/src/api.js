const API_BASE = 'http://localhost:8003';

export function getToken() {
  return localStorage.getItem('mc_token');
}

export function setToken(token) {
  localStorage.setItem('mc_token', token);
}

export function clearToken() {
  localStorage.removeItem('mc_token');
}

export function getUser() {
  const u = localStorage.getItem('mc_user');
  return u ? JSON.parse(u) : null;
}

export function setUser(user) {
  localStorage.setItem('mc_user', JSON.stringify(user));
}

export function clearUser() {
  localStorage.removeItem('mc_user');
}

async function request(path, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };
  const token = getToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers
  });

  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch (e) {
    data = { error: text };
  }

  if (!res.ok) {
    const error = new Error(data?.error || `请求失败 (${res.status})`);
    error.status = res.status;
    error.data = data;
    throw error;
  }

  return data;
}

export const api = {
  login: (username, password) => request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password })
  }),
  me: () => request('/api/auth/me'),

  getRecords: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/api/records${qs ? `?${qs}` : ''}`);
  },
  getRecord: (id) => request(`/api/records/${id}`),
  createRecord: (data) => request('/api/records', {
    method: 'POST',
    body: JSON.stringify(data)
  }),
  handleRecord: (id, data) => request(`/api/records/${id}/handle`, {
    method: 'POST',
    body: JSON.stringify(data)
  }),
  batchHandle: (data) => request('/api/records/batch', {
    method: 'POST',
    body: JSON.stringify(data)
  }),

  getChildren: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/api/children${qs ? `?${qs}` : ''}`);
  },
  getStats: () => request('/api/stats/summary'),
  getConstants: () => request('/api/constants')
};

export default api;
