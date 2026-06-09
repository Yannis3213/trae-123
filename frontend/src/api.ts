const BASE = '/api';

function getToken(): string | null {
  return localStorage.getItem('token');
}

export async function request<T = any>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string> || {}),
  };
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (
    !(options.body instanceof FormData) &&
    options.body &&
    !headers['Content-Type']
  ) {
    headers['Content-Type'] = 'application/json';
  }
  const res = await fetch(BASE + path, { ...options, headers });
  const data = await res.json().catch(() => ({ code: res.status, msg: '请求失败' }));
  return data as T;
}

export interface User {
  id: number;
  username: string;
  role: 'jiaowu' | 'banzhuren' | 'xiaozhang';
  name: string;
}

export interface ServiceOrder {
  id: number;
  order_no: string;
  student_name: string;
  student_id?: string;
  course_name: string;
  service_type: string;
  description?: string;
  status: '待分派' | '已转办' | '已回访';
  version: number;
  created_by: number;
  current_handler?: number;
  deadline?: string;
  completed_at?: string;
  created_at: string;
  updated_at: string;
  exception_reason?: string;
  is_exception: boolean;
  deadline_status: 'normal' | 'approaching' | 'overdue';
  created_by_name?: string;
  current_handler_name?: string;
  attachments?: Attachment[];
  processing_records?: ProcessingRecord[];
  audit_notes?: AuditNote[];
  correction_actions?: CorrectionAction[];
}

export interface Attachment {
  id: number;
  order_id: number;
  filename: string;
  file_type: string;
  evidence_type: string;
  uploaded_by: number;
  uploaded_at: string;
  uploaded_by_name?: string;
}

export interface ProcessingRecord {
  id: number;
  order_id: number;
  from_status?: string;
  to_status: string;
  action: string;
  operator_id: number;
  handler_id?: number;
  remark?: string;
  created_at: string;
  version: number;
  operator_name?: string;
  handler_name?: string;
}

export interface AuditNote {
  id: number;
  order_id: number;
  user_id: number;
  content: string;
  created_at: string;
  user_name?: string;
}

export interface CorrectionAction {
  id: number;
  order_id: number;
  action: string;
  reason?: string;
  operator_id: number;
  created_at: string;
  operator_name?: string;
}

export interface Stats {
  total: number;
  pending: number;
  transferred: number;
  reviewed: number;
  deadline_normal: number;
  deadline_approaching: number;
  deadline_overdue: number;
}

export const ROLE_LABEL: Record<User['role'], string> = {
  jiaowu: '教务老师',
  banzhuren: '班主任',
  xiaozhang: '校区校长',
};

export const DEADLINE_LABEL: Record<ServiceOrder['deadline_status'], string> = {
  normal: '正常',
  approaching: '临期',
  overdue: '逾期',
};
