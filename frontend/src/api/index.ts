import axios from 'axios';
import type {
  User,
  CrossBorderOrder,
  ListOrdersResponse,
  OrderDetailResponse,
  BatchProcessResponse,
  Statistics,
  AuditNote,
  OrderAttachment,
} from '../types';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
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
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export interface LoginResponse {
  token: string;
  user: User;
}

export const authApi = {
  login: (username: string, password: string) =>
    api.post<LoginResponse>('/auth/login', { username, password }).then((r) => r.data),
  me: () => api.get<User>('/auth/me').then((r) => r.data),
  listUsers: () => api.get<User[]>('/users').then((r) => r.data),
};

export interface SubmitOrderRequest {
  stage: CrossBorderOrder['current_stage'];
  data: string;
  audit_note?: string;
  version: number;
  attachment_ids?: string[];
}

export interface BatchProcessReq {
  action: string;
  stage: CrossBorderOrder['current_stage'];
  order_ids: string[];
  data?: Record<string, string>;
  audit_notes?: Record<string, string>;
  versions: Record<string, number>;
}

export const orderApi = {
  list: (params?: {
    group?: string;
    stage?: string;
    status?: string;
    warning?: string;
    search?: string;
  }) => api.get<ListOrdersResponse>('/orders', { params }).then((r) => r.data),

  get: (id: string) =>
    api.get<OrderDetailResponse>(`/orders/${id}`).then((r) => r.data),

  action: (id: string, action: string, data: SubmitOrderRequest) =>
    api.post(`/orders/${id}/action/${action}`, data).then((r) => r.data),

  batch: (data: BatchProcessReq) =>
    api.post<BatchProcessResponse>('/orders/batch', data).then((r) => r.data),

  addAuditNote: (id: string, stage: CrossBorderOrder['current_stage'], content: string) =>
    api.post<AuditNote>(`/orders/${id}/audit-notes`, { stage, content }).then((r) => r.data),

  uploadAttachment: (
    id: string,
    data: { stage: CrossBorderOrder['current_stage']; file_name: string; file_type: string; file_url: string }
  ) => api.post<OrderAttachment>(`/orders/${id}/attachments`, data).then((r) => r.data),

  statistics: () => api.get<Statistics>('/orders/statistics').then((r) => r.data),
};

export default api;
