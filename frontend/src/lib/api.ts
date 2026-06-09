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
  exc_type?: string;
  curr_version?: number;
  prev_version?: number;
  client_version?: number;
  server_version?: number;
  new_version?: number;
  prev_status?: string;
  new_status?: string;
  prev_handler?: string;
  new_handler?: string;
}

export interface ProcessResponse {
  success: boolean;
  error?: string;
  exc_type?: string;
  curr_version?: number;
  prev_version?: number;
  client_version?: number;
  server_version?: number;
  new_version?: number;
  prev_status?: string;
  new_status?: string;
  prev_handler?: string;
  new_handler?: string;
  next_handler?: string;
  application_id?: string;
  student_name?: string;
  message?: string;
  version_mismatch?: boolean;
  version_warning?: string;
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

  const data = await res.json().catch(() => ({ error: `请求失败 (${res.status})` }));

  if (!res.ok) {
    return data as T;
  }

  return data as T;
}

export const api = {
  async login(username: string, password: string) {
    const res = await request<{ token: string; user: User }>('/api/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    if (res && res.token) {
      setToken(res.token);
      setUser(res.user);
    }
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

  async getApplication(id: string, clientVersion?: number) {
    const qs = clientVersion ? `?client_version=${clientVersion}` : '';
    return request<{
      application: StudentApplication;
      attachments: Attachment[];
      records: ProcessingRecord[];
      notes: AuditNote[];
      exceptions: ExceptionRecord[];
      evidence_summary: EvidenceSummary;
      current_role: string;
      server_version?: number;
      server_status?: string;
      server_handler?: string;
      client_version?: number;
      version_mismatch?: boolean;
      version_warning?: string;
      error?: string;
    }>(`/api/applications/${id}${qs}`);
  },

  async processApplication(id: string, action: string, remark: string, version: number) {
    return request<ProcessResponse>(`/api/applications/${id}/process`, {
      method: 'POST',
      body: JSON.stringify({ action, remark, version }),
    });
  },

  async batchProcess(ids: string[], action: string, remark: string, versions?: Record<string, number>) {
    return request<{
      results: BatchResult[];
      total: number;
      success_count: number;
      fail_count: number;
    }>('/api/applications/batch', {
      method: 'POST',
      body: JSON.stringify({ ids, action, remark, versions }),
    });
  },

  async addNote(id: string, content: string, version?: number) {
    return request<{
      success: boolean;
      message: string;
      curr_version?: number;
      server_status?: string;
      note_version?: number;
      exc_type?: string;
      client_version?: number;
      error?: string;
    }>(`/api/applications/${id}/notes`, {
      method: 'POST',
      body: JSON.stringify({ content, version }),
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
