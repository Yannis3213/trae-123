import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  timeout: 10000,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;

export const authApi = {
  login: (data: { username: string; password: string }) =>
    api.post('/auth/login', data),
  logout: () => api.post('/auth/logout'),
  getCurrentUser: () => api.get('/auth/me'),
  switchRole: (role: string) => api.post('/auth/switch-role', { role }),
};

export const caseApi = {
  getList: (params?: any) => api.get('/cases', { params }),
  getDetail: (id: number) => api.get(`/cases/${id}`),
  create: (data: any) => api.post('/cases', data),
  update: (id: number, data: any) => api.put(`/cases/${id}`, data),
  action: (id: number, data: any) => api.post(`/cases/${id}/action`, data),
  getRecords: (id: number) => api.get(`/cases/${id}/records`),
  getAuditNotes: (id: number) => api.get(`/cases/${id}/audit-notes`),
  getExceptionReasons: (id: number) => api.get(`/cases/${id}/exceptions`),
};

export const registrationApi = {
  get: (caseId: number) => api.get(`/registration/${caseId}`),
  save: (caseId: number, data: any) => api.put(`/registration/${caseId}`, data),
  verify: (caseId: number) => api.post(`/registration/${caseId}/verify`),
};

export const assignmentApi = {
  get: (caseId: number) => api.get(`/assignment/${caseId}`),
  save: (caseId: number, data: any) => api.put(`/assignment/${caseId}`, data),
  verify: (caseId: number) => api.post(`/assignment/${caseId}/verify`),
};

export const followupApi = {
  get: (caseId: number) => api.get(`/followup/${caseId}`),
  save: (caseId: number, data: any) => api.put(`/followup/${caseId}`, data),
  verify: (caseId: number) => api.post(`/followup/${caseId}/verify`),
};

export const batchApi = {
  process: (data: any) => api.post('/batch/process', data),
};

export const statisticsApi = {
  getStats: () => api.get('/statistics'),
  getDashboard: () => api.get('/statistics/dashboard'),
};

export const userApi = {
  getList: (params?: any) => api.get('/users', { params }),
};
