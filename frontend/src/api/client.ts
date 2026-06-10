import axios from 'axios';
import type {
  LoginRequest,
  LoginResponse,
  User,
  ReplenishmentApplication,
  ApplicationDetail,
  ProcessRequest,
  BatchProcessRequest,
  BatchProcessResponse,
  AuditNote,
} from '../types';

const backendPort = (import.meta as any).env.VITE_BACKEND_PORT
  || import.meta.env.VITE_BACKEND_PORT
  || '8000';

export const API_BASE_URL = `http://localhost:${backendPort}`;

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('auth_token');
  if (token) {
    config.headers.Authorization = token;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('API Error:', error.response?.data || error.message);
    return Promise.reject(error);
  }
);

export const authApi = {
  login: (data: LoginRequest) =>
    api.post<LoginResponse>('/api/auth/login', data).then((r) => r.data),
  listUsers: () => api.get<User[]>('/api/auth/users').then((r) => r.data),
};

export const applicationApi = {
  list: (params: {
    status?: string;
    priority?: string;
    store_id?: string;
    responsible_person?: string;
    is_overdue?: boolean;
    keyword?: string;
    mine?: boolean;
  } = {}) =>
    api.get<ReplenishmentApplication[]>('/api/applications', { params }).then((r) => r.data),

  getDetail: (id: string) =>
    api.get<ApplicationDetail>(`/api/applications/${id}`).then((r) => r.data),

  process: (data: ProcessRequest) =>
    api.post<ReplenishmentApplication>('/api/applications/process', data).then((r) => r.data),

  batchProcess: (data: BatchProcessRequest) =>
    api.post<BatchProcessResponse>('/api/applications/batch', data).then((r) => r.data),

  addAuditNote: (id: string, note: string) =>
    api
      .post<AuditNote>(`/api/applications/${id}/audit-notes`, { note })
      .then((r) => r.data),
};
