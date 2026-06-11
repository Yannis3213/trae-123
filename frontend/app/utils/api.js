const BASE_URL = '/api';

function getToken() {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('token');
}

export function setToken(token) {
  localStorage.setItem('token', token);
}

export function clearToken() {
  localStorage.removeItem('token');
  localStorage.removeItem('currentUser');
}

export function setCurrentUser(user) {
  localStorage.setItem('currentUser', JSON.stringify(user));
}

export function getCurrentUser() {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem('currentUser');
  return raw ? JSON.parse(raw) : null;
}

async function request(url, options = {}) {
  const token = getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${BASE_URL}${url}`, {
    ...options,
    headers
  });

  const data = await res.json().catch(() => ({}));
  return data;
}

export const api = {
  auth: {
    login: (username, password) =>
      request('/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) }),
    me: () => request('/auth/me'),
    users: () => request('/auth/users')
  },

  sideRecords: {
    list: (filters = {}) => {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== '') params.append(k, v);
      });
      const qs = params.toString();
      return request(`/side-records${qs ? `?${qs}` : ''}`);
    },
    detail: (id) => request(`/side-records/${id}`),
    create: (data) =>
      request('/side-records', { method: 'POST', body: JSON.stringify(data) }),
    submit: (id, data) =>
      request(`/side-records/${id}/submit`, { method: 'POST', body: JSON.stringify(data) }),
    review: (id, data) =>
      request(`/side-records/${id}/review`, { method: 'POST', body: JSON.stringify(data) }),
    archive: (id, data) =>
      request(`/side-records/${id}/archive`, { method: 'POST', body: JSON.stringify(data) }),
    batch: (ids, action, data = {}, versions = {}) => {
      const payload = { ids, action, data: { ...data, versions } };
      return request('/side-records/batch', { method: 'POST', body: JSON.stringify(payload) });
    },
    addNote: (id, content) =>
      request(`/side-records/${id}/notes`, { method: 'POST', body: JSON.stringify({ content }) }),
    statistics: () => request('/side-records/statistics/summary'),
    warnings: () => request('/side-records/warning/list')
  }
};
