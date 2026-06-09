const API_URL = (typeof window !== 'undefined' && (window as any).API_URL) || 'http://localhost:8002';

export interface User {
  id: string;
  username: string;
  name: string;
  role: 'registrar' | 'auditor' | 'reviewer';
}

export interface StudentApplication {
  id: string;
  student_name: string;
  id_card: string;
  phone: string;
  program: string;
  status: '待分派' | '已转办' | '已回访';
  current_handler: string;
  current_handler_name: string;
  current_handler_role: string;
  next_handler: string;
  next_handler_name: string;
  next_handler_role: string;
  assignment_deadline: string;
  audit_deadline: string;
  review_deadline: string;
  created_at: string;
  updated_at: string;
  version: number;
  urgency: 'normal' | 'warning' | 'overdue';
  responsible_person: string;
  responsible_person_name: string;
  materials_complete: boolean;
  class_assigned: boolean;
  payment_confirmed: boolean;
}

export interface Attachment {
  id: string;
  application_id: string;
  type: string;
  name: string;
  uploaded_by: string;
  uploaded_at: string;
  verified: boolean;
}

export interface ProcessingRecord {
  id: string;
  application_id: string;
  action: string;
  handler_id: string;
  handler_name: string;
  handler_role: string;
  previous_status: string;
  new_status: string;
  previous_handler: string;
  new_handler: string;
  remark: string;
  created_at: string;
  version: number;
  is_correction: boolean;
}

export interface AuditNote {
  id: string;
  application_id: string;
  user_id: string;
  user_name: string;
  content: string;
  created_at: string;
}

export interface ExceptionRecord {
  id: string;
  application_id: string;
  type: string;
  reason: string;
  triggered_by: string;
  triggered_by_name: string;
  triggered_at: string;
  resolved: boolean;
  resolved_at: string;
  resolution_note: string;
}

export interface EvidenceSummary {
  materials_count: number;
  materials_ok: boolean;
  class_ok: boolean;
  payment_ok: boolean;
  all_complete: boolean;
}

export interface BatchResult {
  application_id: string;
  student_name: string;
  success: boolean;
  reason: string;
}

function getToken(): string {
  return localStorage.getItem('token') || '';
}

function setToken(token: string) {
  localStorage.setItem('token', token);
}

function clearAuth() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
}

function getUser(): User | null {
  const raw = localStorage.getItem('user');
  return raw ? JSON.parse(raw) : null;
}

function setUser(user: User) {
  localStorage.setItem('user', JSON.stringify(user));
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };
  const token = getToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const error = (data as any).error || `请求失败 (${res.status})`;
    throw new Error(error);
  }

  return data as T;
}

export const api = {
  async login(username: string, password: string) {
    const res = await request<{ token: string; user: User }>('/api/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    setToken(res.token);
    setUser(res.user);
    return res;
  },

  logout() {
    clearAuth();
  },

  isAuthenticated(): boolean {
    return !!getToken();
  },

  getCurrentUser(): User | null {
    return getUser();
  },

  switchRole: null as unknown as (user: User) => void,

  async me() {
    return request<User>('/api/me');
  },

  async listUsers() {
    return request<User[]>('/api/users');
  },

  async listApplications(params?: { status?: string; urgency?: string }) {
    const qs = new URLSearchParams();
    if (params?.status) qs.set('status', params.status);
    if (params?.urgency) qs.set('urgency', params.urgency);
    const q = qs.toString();
    return request<StudentApplication[]>(`/api/applications${q ? '?' + q : ''}`);
  },

  async getApplication(id: string) {
    return request<{
      application: StudentApplication;
      attachments: Attachment[];
      records: ProcessingRecord[];
      notes: AuditNote[];
      exceptions: ExceptionRecord[];
      evidence_summary: EvidenceSummary;
      current_role: string;
    }>(`/api/applications/${id}`);
  },

  async processApplication(id: string, action: string, remark: string, version: number) {
    return request<{
      success: boolean;
      new_status: string;
      new_handler: string;
      next_handler: string;
      message: string;
      error?: string;
    }>(`/api/applications/${id}/process`, {
      method: 'POST',
      body: JSON.stringify({ action, remark, version }),
    });
  },

  async batchProcess(ids: string[], action: string, remark: string) {
    return request<{
      results: BatchResult[];
      total: number;
      success_count: number;
      fail_count: number;
    }>('/api/applications/batch', {
      method: 'POST',
      body: JSON.stringify({ ids, action, remark }),
    });
  },

  async addNote(id: string, content: string) {
    return request<{ success: boolean; message: string }>(`/api/applications/${id}/notes`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    });
  },

  async getStatistics() {
    return request<{
      total: number;
      pending: number;
      transferred: number;
      visited: number;
      urgency: { normal: number; warning: number; overdue: number };
    }>('/api/statistics');
  },
};

api.switchRole = (user: User) => {
  setUser(user);
};
