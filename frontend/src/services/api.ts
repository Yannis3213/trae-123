import axios, { AxiosRequestConfig } from 'axios';
import {
  User,
  CaseWithDetail,
  PaginatedResponse,
  LoginRequest,
  LoginResponse,
  UpdateStatusRequest,
  BatchProcessRequest,
  BatchProcessResult,
  StatisticsResponse,
  AddAttachmentRequest,
  AddAuditNoteRequest,
  Attachment,
  AuditNote,
  ProcessingRecord,
  CreateCaseRequest,
  Case,
  CaseStatus,
  ProcessingStage,
  ExpiryStatus,
} from '../types';

const BASE_URL = '/api';

const api = axios.create({
  baseURL: BASE_URL,
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

export const authApi = {
  login: (data: LoginRequest) =>
    api.post<LoginResponse>('/auth/login', data).then((r) => r.data),
  getCurrentUser: () =>
    api.get<User>('/auth/me').then((r) => r.data),
};

export const caseApi = {
  listCases: (params: {
    status?: CaseStatus;
    stage?: ProcessingStage;
    expiry?: ExpiryStatus;
    keyword?: string;
    page?: number;
    page_size?: number;
  }) =>
    api
      .get<PaginatedResponse<CaseWithDetail>>('/cases', { params })
      .then((r) => r.data),

  getCaseDetail: (id: string) =>
    api.get<CaseWithDetail>(`/cases/${id}`).then((r) => r.data),

  createCase: (data: CreateCaseRequest) =>
    api.post<Case>('/cases', data).then((r) => r.data),

  updateStatus: (data: UpdateStatusRequest) =>
    api.put<CaseWithDetail>('/cases/status', data).then((r) => r.data),

  batchProcess: (data: BatchProcessRequest) =>
    api.post<BatchProcessResult[]>('/cases/batch', data).then((r) => r.data),

  addAttachment: (data: AddAttachmentRequest) =>
    api.post<Attachment>('/cases/attachments', data).then((r) => r.data),

  addAuditNote: (data: AddAuditNoteRequest) =>
    api.post<AuditNote>('/cases/notes', data).then((r) => r.data),

  getProcessingRecords: (caseId: string) =>
    api.get<ProcessingRecord[]>(`/cases/${caseId}/records`).then((r) => r.data),

  getExpiringCases: () =>
    api.get('/cases/expiring').then((r) => r.data),

  getStatistics: () =>
    api.get<StatisticsResponse>('/statistics').then((r) => r.data),
};

export default api;
