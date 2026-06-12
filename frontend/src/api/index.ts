import type {
  ApiResponse,
  AppointmentsResponse,
  AppointmentDetail,
  UserInfo,
  ProcessAppointmentRequest,
  BatchProcessRequest,
  BatchProcessResponse,
} from '../types';

const BASE = '/api';

async function request<T>(url: string, options?: RequestInit): Promise<ApiResponse<T>> {
  const resp = await fetch(`${BASE}${url}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options?.headers || {}),
    },
  });
  const data = await resp.json();
  return data as ApiResponse<T>;
}

export const api = {
  getCurrentUser: () => request<UserInfo>('/user/current'),
  switchRole: (role: string, username: string) =>
    request<UserInfo>('/user/switch', {
      method: 'POST',
      body: JSON.stringify({ role, username }),
    }),
  listAppointments: (status?: string) =>
    request<AppointmentsResponse>(`/appointments${status ? `?status=${status}` : ''}`),
  getAppointment: (id: string) =>
    request<AppointmentDetail>(`/appointments/${id}`),
  processAppointment: (id: string, body: ProcessAppointmentRequest) =>
    request<AppointmentDetail>(`/appointments/${id}/process`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  batchProcess: (body: BatchProcessRequest) =>
    request<BatchProcessResponse>('/appointments/batch', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
};
