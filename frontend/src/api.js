const API_BASE = 'http://localhost:8002';

export async function request(path, options = {}) {
  const url = `${API_BASE}${path}`;
  const token = localStorage.getItem('token');

  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const config = {
    ...options,
    headers,
  };

  try {
    const response = await fetch(url, config);
    const contentType = response.headers.get('content-type');

    if (response.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.dispatchEvent(new CustomEvent('auth-logout'));
      throw new Error('登录已过期，请重新登录');
    }

    if (contentType && contentType.includes('application/json')) {
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || data.error || `请求失败 (${response.status})`);
      }
      return data;
    } else {
      return response;
    }
  } catch (error) {
    if (error.message === 'Failed to fetch') {
      throw new Error('无法连接到服务器，请检查后端服务是否启动');
    }
    throw error;
  }
}

export const api = {
  login: (username, password) =>
    request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),

  getCurrentUser: () => request('/api/auth/me'),

  getApplications: (params = {}) => {
    const searchParams = new URLSearchParams(params);
    return request(`/api/applications/?${searchParams.toString()}`);
  },

  getApplicationDetail: (id) => request(`/api/applications/${id}`),

  createApplication: (data) =>
    request('/api/applications/', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateApplicationStatus: (id, data) =>
    request(`/api/applications/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  batchProcess: (data) =>
    request('/api/applications/batch/process', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getBatches: (params = {}) => {
    const searchParams = new URLSearchParams(params);
    return request(`/api/applications/batch/list?${searchParams.toString()}`);
  },

  getBatchDetail: (batchNo) =>
    request(`/api/applications/batch/${encodeURIComponent(batchNo)}`),

  getWarningStats: () => request('/api/applications/stats/warning'),

  getAuditLogs: (id) => request(`/api/applications/${id}/audit-logs`),

  addRemark: (id, remark) =>
    request(`/api/applications/${id}/remarks`, {
      method: 'POST',
      body: JSON.stringify({ remark }),
    }),

  exportCSV: (params = {}) => {
    const searchParams = new URLSearchParams(params);
    const token = localStorage.getItem('token');
    return fetch(`${API_BASE}/api/applications/export/csv?${searchParams.toString()}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
  },
};
