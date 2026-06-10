import { useAuthStore } from '../store/useAuthStore';

const BASE_URL = 'http://localhost:8002/api';

function getHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  const user = useAuthStore.getState().currentUser;
  if (user) {
    headers['X-User-Id'] = user.id;
    headers['X-Role'] = user.role;
  }
  return headers;
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      ...getHeaders(),
      ...options?.headers,
    },
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: '请求失败' }));
    throw new Error(error.error || `HTTP ${res.status}`);
  }
  const json = await res.json();
  return json.data as T;
}

export async function login(username: string, password: string) {
  return request<{ id: string; username: string; role: string; displayName: string }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
}

export async function getMe() {
  return request<{ id: string; username: string; role: string; displayName: string }>('/auth/me');
}

export async function getPlans(params?: Record<string, string>) {
  const query = params ? '?' + new URLSearchParams(params).toString() : '';
  return request<{ plans: any[]; total: number }>(`/plans${query}`);
}

export async function getPlanDetail(id: string) {
  return request<any>(`/plans/${id}`);
}

export async function createPlan(data: {
  planNumber: string;
  routeName: string;
  planDate: string;
  vehicleId: string;
  driverId: string;
  dueDate: string;
  notes?: string;
}) {
  return request<any>('/plans', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function advancePlan(id: string, data: { action: string; comment?: string; version: number }) {
  return request<any>(`/plans/${id}/advance`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function correctPlan(id: string, data: { comment: string; version: number }) {
  return request<any>(`/plans/${id}/correct`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function rejectPlan(id: string, data: { reason: string; version: number }) {
  return request<any>(`/plans/${id}/reject`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function batchAdvance(data: { planIds: string[]; action: string; comment?: string; versions: Record<string, number>; actions?: Record<string, string> }) {
  return request<{ planId: string; success: boolean; reason?: string }[]>('/plans/batch-advance', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function getExpiryStats(params?: { role?: string; status?: string; handler?: string }) {
  const query = params && Object.keys(params).length > 0 ? '?' + new URLSearchParams(params as Record<string, string>).toString() : '';
  return request<{ normal: number; approaching: number; overdue: number }>(`/stats/expiry${query}`);
}

export async function getQueueStats(params?: { role?: string; status?: string; handler?: string }) {
  const query = params && Object.keys(params).length > 0 ? '?' + new URLSearchParams(params as Record<string, string>).toString() : '';
  return request<any>(`/stats/queue${query}`);
}

export async function getEvidenceSummary(params?: { role?: string; status?: string; handler?: string }) {
  const query = params && Object.keys(params).length > 0 ? '?' + new URLSearchParams(params as Record<string, string>).toString() : '';
  return request<{ vehicleSchedule: number; driverCheckin: number; dispatchConfirm: number }>(`/evidence/summary${query}`);
}

export async function uploadAttachment(planId: string, data: { fileType: 'vehicle_schedule' | 'driver_checkin' | 'dispatch_confirm' | 'other'; fileName: string }) {
  return request<any>(`/plans/${planId}/attachments`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}
