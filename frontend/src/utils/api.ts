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
  (response) => {
    if (!response.data.success) {
      return Promise.reject(new Error(response.data.message || '请求失败'));
    }
    return response.data.data;
  },
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
};

export const caseApi = {
  getList: (params?: any) => api.get('/cases', { params }),
  getDetail: (id: number) => api.get(`/cases/${id}`),
  create: (data: any) => api.post('/cases', data),
  update: (id: number, data: any) => api.put(`/cases/${id}`, data),
  remove: (id: number) => api.delete(`/cases/${id}`),
  action: (id: number, data: any) => api.post(`/cases/${id}/action`, data),
  getRecords: (id: number) => api.get(`/cases/${id}/records`),
  getAuditNotes: (id: number) => api.get(`/cases/${id}/audit-notes`),
  getExceptionReasons: (id: number) => api.get(`/cases/${id}/exceptions`),
};

export const registrationApi = {
  get: (caseId: number) => api.get(`/cases/${caseId}/registration`),
  save: (caseId: number, data: any) => api.put(`/cases/${caseId}/registration`, data),
  verify: (caseId: number) => api.post(`/cases/${caseId}/registration/verify`),
};

export const assignmentApi = {
  get: (caseId: number) => api.get(`/cases/${caseId}/assignment`),
  save: (caseId: number, data: any) => api.put(`/cases/${caseId}/assignment`, data),
  verify: (caseId: number) => api.post(`/cases/${caseId}/assignment/verify`),
};

export const followupApi = {
  get: (caseId: number) => api.get(`/cases/${caseId}/followup`),
  save: (caseId: number, data: any) => api.put(`/cases/${caseId}/followup`, data),
  verify: (caseId: number) => api.post(`/cases/${caseId}/followup/verify`),
};

export const batchApi = {
  process: (data: any) => api.post('/cases/batch', data),
};

export const statisticsApi = {
  getStats: () => api.get('/statistics'),
};

export const userApi = {
  getList: (params?: any) => api.get('/users', { params }),
};
