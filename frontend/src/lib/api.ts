import { API_BASE_URL } from '../types';

function getToken(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('token') || '';
}

interface FetchOptions extends RequestInit {
  skipAuth?: boolean;
}

export async function apiFetch<T = any>(
  path: string,
  options: FetchOptions = {}
): Promise<T> {
  const { skipAuth, headers, ...rest } = options;
  const finalHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(headers as Record<string, string>),
  };
  if (!skipAuth) {
    const token = getToken();
    if (token) {
      finalHeaders['Authorization'] = `Bearer ${token}`;
    }
  }

  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...rest,
    headers: finalHeaders,
  });

  const text = await res.text();
  let data: any;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { message: text };
  }

  if (!res.ok) {
    const err = new Error(data?.error || data?.message || `请求失败 (${res.status})`);
    (err as any).status = res.status;
    (err as any).data = data;
    throw err;
  }
  return data as T;
}

export const api = {
  login: (username: string, password: string) =>
    apiFetch('/auth/login', {
      skipAuth: true,
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),
  getMe: () => apiFetch('/auth/me'),
  listConsultations: (params: Record<string, any> = {}) => {
    const qs = new URLSearchParams(params as any).toString();
    return apiFetch(`/consultations${qs ? '?' + qs : ''}`);
  },
  getConsultation: (id: string) => apiFetch(`/consultations/${id}`),
  createConsultation: (body: any) =>
    apiFetch('/consultations', { method: 'POST', body: JSON.stringify(body) }),
  updateConsultation: (id: string, body: any, version: number) =>
    apiFetch(`/consultations/${id}?version=${version}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),
  processAction: (id: string, body: any) =>
    apiFetch(`/consultations/${id}/process`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  batchProcess: (body: any) =>
    apiFetch('/consultations/batch', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  addNote: (id: string, note: string) =>
    apiFetch(`/consultations/${id}/notes`, {
      method: 'POST',
      body: JSON.stringify({ note }),
    }),
  addAttachment: (id: string, body: any) =>
    apiFetch(`/consultations/${id}/attachments`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  getStatistics: () => apiFetch('/statistics'),
  getLedger: (params: Record<string, any> = {}) => {
    const qs = new URLSearchParams(params as any).toString();
    return apiFetch(`/ledger${qs ? '?' + qs : ''}`);
  },
  getWarnings: (params: Record<string, any> = {}) => {
    const qs = new URLSearchParams(params as any).toString();
    return apiFetch(`/warnings${qs ? '?' + qs : ''}`);
  },
};

export const statusLabels: Record<string, string> = {
  pending: '待确认',
  abnormal: '异常',
  rechecked: '已复查',
  archived: '已归档',
};

export const stageLabels: Record<string, string> = {
  registration: '登记阶段',
  verification: '核验阶段',
  review: '复核阶段',
};

export const roleLabels: Record<string, string> = {
  registrar: '会诊申请登记员',
  auditor: '会诊申请审核主管',
  reviewer: '三甲医院医务部复核负责人',
};

export const urgencyLabels: Record<string, string> = {
  normal: '正常',
  warning: '临期',
  overdue: '逾期',
};

export function formatDateTime(s?: string): string {
  if (!s) return '-';
  const d = new Date(s);
  if (isNaN(d.getTime())) return s;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
