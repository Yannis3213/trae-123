import axios from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8107';

const api = axios.create({
  baseURL: '/api',
  timeout: 30000,
});

api.interceptors.request.use(
  (config) => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    if (error.response?.status === 401) {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error.response?.data || error);
  }
);

export const authApi = {
  login: (data) => api.post('/auth/login', data),
  getCurrentUser: () => api.get('/auth/me'),
  getUsers: () => api.get('/auth/users'),
};

export const formsApi = {
  getList: (params) => api.get('/forms', { params }),
  getDetail: (id) => api.get(`/forms/${id}`),
  create: (data) => api.post('/forms', data),
  operation: (id, data) => api.post(`/forms/${id}/operation`, data),
  getConstants: () => api.get('/forms/constants'),
  getStatistics: () => api.get('/forms/statistics'),
  addAuditNote: (id, data) => api.post(`/forms/${id}/audit-notes`, data),
};

export const batchApi = {
  process: (data) => api.post('/batch/process', data),
  promoteOverdue: (data) => api.post('/batch/promote-overdue', data),
  getResults: (batchNo) => api.get(`/batch/results/${batchNo}`),
};

export const alertsApi = {
  getDeadlineAlerts: (params) => api.get('/alerts/deadline', { params }),
  getExceptions: (params) => api.get('/alerts/exceptions', { params }),
  getStatistics: () => api.get('/alerts/statistics'),
};

export default api;
