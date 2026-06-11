const API_BASE = '/api';

let authHeader = '';

export function setAuthCredentials(username, password) {
  authHeader = 'Basic ' + btoa(username + ':' + password);
}

export function clearAuthCredentials() {
  authHeader = '';
}

async function request(url, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(authHeader && { 'Authorization': authHeader }),
    ...options.headers,
  };

  const response = await fetch(API_BASE + url, {
    ...options,
    headers,
  });

  const data = await response.json();

  if (!response.ok) {
    throw data;
  }

  return data;
}

export const api = {
  login: (username, password) => {
    return request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
  },

  getCurrentUser: () => request('/auth/me'),

  getApplications: (filters = {}) => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value) params.append(key, value);
    });
    const query = params.toString();
    return request(`/applications${query ? '?' + query : ''}`);
  },

  getApplication: (id) => request(`/applications/${id}`),

  createApplication: (data) => {
    return request('/applications', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  processApplication: (data) => {
    return request('/applications/process', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  batchProcess: (items) => {
    return request('/applications/batch-process', {
      method: 'POST',
      body: JSON.stringify({ items }),
    });
  },

  getWarningStats: () => request('/warning/stats'),

  uploadAttachment: (data) => {
    return request('/applications/attachments', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  getExceptionLogs: (applicationId) => {
    return request(`/applications/${applicationId}/exceptions`);
  },
};
