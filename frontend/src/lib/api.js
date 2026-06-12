import axios from 'axios';

export const API_BASE = 'http://localhost:8109/api';

const api = axios.create({
  baseURL: API_BASE,
  timeout: 15000
});

api.interceptors.request.use((config) => {
  const auth = localStorage.getItem('pet_hospital_auth');
  if (auth) {
    const user = JSON.parse(auth);
    config.headers['X-User-Id'] = user.id;
    config.headers['X-Role'] = user.role;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res.data,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('pet_hospital_auth');
      if (!window.location.pathname.includes('/login')) {
        window.location.href = '/login';
      }
    }
    const data = err.response?.data;
    return Promise.reject(data || { success: false, message: err.message });
  }
);

export const authApi = {
  login: (data) => api.post('/auth/login', data),
  me: () => api.get('/auth/me'),
  getUsers: () => api.get('/auth/users'),
  getDoctors: () => api.get('/auth/doctors')
};

export const visitsApi = {
  list: (params = {}) => api.get('/visits', { params }),
  get: (id) => api.get(`/visits/${id}`),
  create: (data) => api.post('/visits', data),
  update: (id, data) => api.put(`/visits/${id}`, data),
  transition: (id, data) => api.post(`/visits/${id}/transition`, data),
  batch: (data) => api.post('/visits/batch', data),
  overdueBatch: (data) => api.post('/visits/overdue-batch', data),
  getAllowedActions: (id) => api.get(`/visits/${id}/allowed-actions`)
};

export const attachmentsApi = {
  upload: (formData) => api.post('/attachments', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  download: (id) => `${API_BASE}/attachments/${id}`,
  remove: (id) => api.delete(`/attachments/${id}`)
};

export const recordsApi = {
  list: (params = {}) => api.get('/records', { params }),
  addNote: (orderId, comment) => api.post(`/records/${orderId}`, { comment })
};

export const auditApi = {
  list: (orderId) => api.get(`/audit/${orderId}`),
  add: (orderId, content) => api.post(`/audit/${orderId}`, { content }),
  remove: (id) => api.delete(`/audit/${id}`)
};

export const statsApi = {
  get: () => api.get('/stats')
};

export default api;
