export const API_BASE = '/api';
export const BACKEND_PORT = 8004;
export const FRONTEND_PORT = 3004;

export interface User {
  id: string;
  username: string;
  name: string;
  role: string;
  roleName: string;
  store_id?: string;
  area_id?: string;
  token?: string;
}

export interface PrescriptionOrder {
  id: string;
  order_no: string;
  patient_name: string;
  patient_id_card?: string;
  store_id: string;
  store_name: string;
  area_id: string;
  area_name: string;
  drugs_count: number;
  total_amount: number;
  status: string;
  statusName: string;
  handler_role?: string;
  handler_id?: string;
  handler_name?: string;
  version: number;
  created_by: string;
  created_by_name: string;
  created_at: string;
  updated_at: string;
  due_at: string;
  abnormal_reason?: string;
  abnormal_type?: string;
  correction_note?: string;
  warningLevel: string;
  warningName: string;
  isMine: boolean;
}

export interface Attachment {
  id: string;
  order_id: string;
  file_name: string;
  file_type: string;
  file_url: string;
  evidence_type: string;
  uploaded_by: string;
  uploaded_by_name: string;
  uploaded_at: string;
}

export interface ProcessingRecord {
  id: string;
  order_id: string;
  order_version: number;
  from_status?: string;
  from_status_name?: string;
  to_status: string;
  to_status_name: string;
  handler_id: string;
  handler_name: string;
  handler_role: string;
  handler_role_name: string;
  note?: string;
  created_at: string;
}

export interface AuditNote {
  id: string;
  order_id: string;
  order_version: number;
  operator_id: string;
  operator_name: string;
  operator_role: string;
  operator_role_name: string;
  action: string;
  content?: string;
  created_at: string;
}

export interface AbnormalReason {
  id: string;
  order_id: string;
  abnormal_type: string;
  abnormal_type_name: string;
  description: string;
  responsible_person?: string;
  reported_by: string;
  reported_by_name: string;
  reported_at: string;
  resolved: boolean;
  resolved_by?: string;
  resolved_at?: string;
}

export interface OrderDetail extends PrescriptionOrder {
  attachments: Attachment[];
  records: ProcessingRecord[];
  audits: AuditNote[];
  abnormals: AbnormalReason[];
}

export interface BatchResult {
  id: string;
  order_no?: string;
  success: boolean;
  error_code?: string;
  message: string;
  new_version?: number;
}

export interface DictItem {
  value: string;
  label: string;
  key: string;
}

export interface ApiResponse<T> {
  code: number;
  message?: string;
  data?: T;
  error_code?: string;
  current_status?: string;
  current_status_name?: string;
  current_version?: number;
  missing?: string[];
}

let currentUserId: string | null = null;

export function setCurrentUserId(id: string | null) {
  currentUserId = id;
  if (id) {
    localStorage.setItem('pharmacy_user_id', id);
  } else {
    localStorage.removeItem('pharmacy_user_id');
  }
}

export function getCurrentUserId(): string | null {
  if (!currentUserId) {
    currentUserId = localStorage.getItem('pharmacy_user_id');
  }
  return currentUserId;
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const url = path.startsWith('http') ? path : API_BASE + path;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {})
  };
  const uid = getCurrentUserId();
  if (uid) headers['X-User-Id'] = uid;

  try {
    const resp = await fetch(url, { ...options, headers });
    const text = await resp.text();
    let data: ApiResponse<T>;
    try {
      data = text ? JSON.parse(text) : { code: resp.status, message: '空响应' };
    } catch {
      data = { code: resp.status, message: text || '响应解析失败' };
    }
    if (!resp.ok && data.code === undefined) {
      data.code = resp.status;
    }
    return data;
  } catch (err) {
    return { code: 500, message: (err as Error).message || '网络错误' };
  }
}

export const api = {
  login: (username: string) =>
    request<User>('/auth/login', { method: 'POST', body: JSON.stringify({ username }) }),
  me: () => request<User>('/auth/me'),
  users: () => request<User[]>('/auth/users'),
  listOrders: (params?: Record<string, any>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return request<PrescriptionOrder[]>(`/orders${qs}`);
  },
  getStatistics: () => request<{
    byStatus: { status: string; statusName: string; count: number }[];
    byWarning: { level: string; levelName: string; count: number; responsibles: string[] }[];
    myPending: number;
    total: number;
  }>('/orders/statistics'),
  getOrder: (id: string) => request<OrderDetail>(`/orders/${id}`),
  createOrder: (payload: any) =>
    request<PrescriptionOrder>('/orders', { method: 'POST', body: JSON.stringify(payload) }),
  updateStatus: (id: string, payload: any) =>
    request<PrescriptionOrder>(`/orders/${id}/status`, { method: 'POST', body: JSON.stringify(payload) }),
  batchProcess: (payload: any) =>
    request<{ total: number; success: number; failed: number; results: BatchResult[] }>(
      '/orders/batch',
      { method: 'POST', body: JSON.stringify(payload) }
    ),
  uploadAttachment: (orderId: string, payload: any) =>
    request<Attachment>(`/orders/${orderId}/attachments`, { method: 'POST', body: JSON.stringify(payload) }),
  listAudit: (params?: Record<string, any>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return request<AuditNote[]>(`/audit${qs}`);
  },
  listAbnormal: (params?: Record<string, any>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return request<AbnormalReason[]>(`/audit/abnormal${qs}`);
  },
  getDict: () => request<{
    roles: DictItem[];
    statuses: DictItem[];
    abnormalTypes: DictItem[];
    warningLevels: DictItem[];
    transitions: Record<string, string[]>;
  }>('/dict')
};
