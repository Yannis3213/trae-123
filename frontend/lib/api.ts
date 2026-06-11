export const API_BASE_URL = 'http://localhost:8002';

export interface User {
  username: string;
  real_name: string;
  role: string;
  branch: string;
}

export interface Application {
  id: number;
  application_no: string;
  customer_name: string;
  id_card_no?: string;
  phone?: string;
  address?: string;
  account_type: string;
  amount: number;
  status: string;
  current_handler: string | null;
  current_role: string | null;
  customer_manager: string;
  branch: string;
  version: number;
  due_date: string;
  due_status: string;
  created_at: string;
  updated_at: string;
}

export interface ProcessingRecord {
  id: number;
  action: string;
  from_status: string | null;
  to_status: string | null;
  operator: string;
  operator_role: string;
  remark: string | null;
  evidence_required: string | null;
  evidence_provided: string | null;
  version_before: number | null;
  version_after: number | null;
  created_at: string;
}

export interface ExceptionReason {
  id: number;
  reason_type: string;
  description: string;
  reported_by: string;
  reported_by_role: string;
  is_resolved: number;
  resolved_by: string | null;
  resolved_at: string | null;
  created_at: string;
}

export interface AuditNote {
  id: number;
  note: string;
  noted_by: string;
  noted_by_role: string;
  created_at: string;
}

export interface Attachment {
  id: number;
  application_id: number;
  file_name: string;
  file_type: string;
  uploaded_by: string;
  uploaded_at: string;
}

export interface ApplicationDetailResponse {
  application: Application;
  attachments: Attachment[];
  processing_records: ProcessingRecord[];
  exception_reasons: ExceptionReason[];
  audit_notes: AuditNote[];
}

export interface BatchResultItem {
  application_id: number;
  application_no: string;
  success: boolean;
  message: string;
  error_code: number | null;
  version: number;
  new_version: number | null;
  new_status: string | null;
  new_role: string | null;
}

export interface BatchProcessResponse {
  total: number;
  success_count: number;
  fail_count: number;
  results: BatchResultItem[];
}

export interface Stats {
  total: number;
  pending: number;
  normal: number;
  approaching: number;
  overdue: number;
  exception: number;
  completed: number;
}

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('token');
}

export function setToken(token: string) {
  if (typeof window !== 'undefined') {
    localStorage.setItem('token', token);
  }
}

export function clearAuth() {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  }
}

export function saveUser(user: User) {
  if (typeof window !== 'undefined') {
    localStorage.setItem('user', JSON.stringify(user));
  }
}

export function getUser(): User | null {
  if (typeof window === 'undefined') return null;
  const u = localStorage.getItem('user');
  return u ? JSON.parse(u) : null;
}

async function apiRequest<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.detail || `请求失败: ${res.status}`);
  }
  return data as T;
}

export async function login(username: string, password: string) {
  const res = await apiRequest<{
    access_token: string;
    token_type: string;
    user: User;
  }>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
  return res;
}

export async function fetchMe(): Promise<User> {
  return apiRequest<User>('/api/auth/me');
}

export async function fetchApplications(params: Record<string, string> = {}): Promise<{ items: Application[]; total: number }> {
  const qs = new URLSearchParams(params).toString();
  return apiRequest<{ items: Application[]; total: number }>(
    `/api/applications${qs ? '?' + qs : ''}`
  );
}

export async function fetchApplicationDetail(id: number): Promise<ApplicationDetailResponse> {
  return apiRequest<ApplicationDetailResponse>(`/api/applications/${id}`);
}

export async function fetchStats(): Promise<Stats> {
  return apiRequest<Stats>('/api/applications/stats');
}

export async function processApplication(
  id: number,
  action: string,
  version: number,
  remark?: string,
  evidence?: string,
  exceptionType?: string,
  exceptionReason?: string
): Promise<ApplicationDetailResponse> {
  try {
    return await apiRequest<ApplicationDetailResponse>(`/api/applications/${id}/process`, {
      method: 'POST',
      body: JSON.stringify({
        action,
        version,
        remark,
        evidence,
        exception_type: exceptionType,
        exception_reason: exceptionReason,
      }),
    });
  } catch (err) {
    throw err;
  }
}

export function parseErrorMessage(error: any): { code: string; message: string; needRefresh: boolean; whoFix?: string } {
  const msg = error?.message || '操作失败';
  let code = 'E000';
  let needRefresh = false;
  let whoFix: string | undefined;

  const codeMatch = msg.match(/^(E\d+):/);
  if (codeMatch) {
    code = codeMatch[1];
  }

  if (msg.includes('版本冲突') || msg.includes('并发冲突')) {
    needRefresh = true;
  }

  if (msg.includes('客户经理') && !msg.includes('阶段越权')) {
    whoFix = '客户经理';
  } else if (msg.includes('运营主管')) {
    whoFix = '运营主管';
  } else if (msg.includes('支行行长')) {
    whoFix = '支行行长';
  }

  return { code, message: msg, needRefresh, whoFix };
}

export function formatDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export function getDaysLeft(dueDate: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dueDate);
  return Math.floor((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

export function getResponsiblePerson(app: Application): string {
  if (app.status === '异常回传') {
    return `${app.customer_manager}（客户经理）`;
  }
  if (app.current_handler) {
    return `${app.current_handler}（${app.current_role || ''}）`;
  }
  if (app.status === '待签收' && app.current_role) {
    return `待${app.current_role}签收`;
  }
  if (app.status === '签收完成') {
    return '流程已完成';
  }
  return '-';
}

export async function batchProcess(
  action: string,
  items: { application_id: number; version: number }[],
  remark?: string,
  evidence?: string
): Promise<BatchProcessResponse> {
  return apiRequest<BatchProcessResponse>('/api/applications/batch', {
    method: 'POST',
    body: JSON.stringify({ action, items, remark, evidence }),
  });
}

export async function addAuditNote(id: number, note: string): Promise<{ audit_notes: AuditNote[] }> {
  return apiRequest<{ audit_notes: AuditNote[] }>(`/api/applications/${id}/audit-note`, {
    method: 'POST',
    body: JSON.stringify({ note }),
  });
}

export const STATUS_COLORS: Record<string, string> = {
  '待签收': 'bg-blue-100 text-blue-800',
  '异常回传': 'bg-red-100 text-red-800',
  '签收完成': 'bg-green-100 text-green-800',
};

export const DUE_STATUS_COLORS: Record<string, string> = {
  '正常': 'bg-green-100 text-green-800',
  '临期': 'bg-yellow-100 text-yellow-800',
  '逾期': 'bg-red-100 text-red-800',
};

export const ROLE_LABELS: Record<string, string> = {
  '客户经理': '客户经理',
  '运营主管': '运营主管',
  '支行行长': '支行行长',
};
