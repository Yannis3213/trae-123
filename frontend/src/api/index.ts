import axios from 'axios';

const API_BASE = 'http://localhost:8109';

const instance = axios.create({
  baseURL: API_BASE,
  timeout: 30000,
});

instance.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

instance.interceptors.response.use(
  (resp) => resp,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.clear();
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export interface ApiResp<T> {
  success: boolean;
  message: string;
  data?: T;
}

export interface UserInfo {
  id: string;
  username: string;
  name: string;
  role: string;
  role_display: string;
}

export interface InboundOrder {
  id: string;
  order_no: string;
  supplier_name: string;
  material_name: string;
  quantity: number;
  status: string;
  status_display: string;
  version: number;
  current_handler_role: string;
  current_handler_id?: string;
  current_handler_name?: string;
  deadline?: string;
  created_at: string;
  updated_at: string;
  appointment_evidence?: string;
  appointment_complete: boolean;
  inspection_evidence?: string;
  inspection_complete: boolean;
  registration_evidence?: string;
  registration_complete: boolean;
  last_opinion?: string;
  last_attachment_id?: string;
  last_audit_note?: string;
  urgency?: { label: string; key: string };
  exception_count?: number;
  exception_latest?: string;
}

export interface Attachment {
  id: string;
  order_id: string;
  filename: string;
  uploaded_by: string;
  uploaded_at: string;
  uploader_role: string;
  module: string;
}

export interface ProcessingRecord {
  id: string;
  order_id: string;
  handler_id: string;
  handler_name: string;
  handler_role: string;
  action: string;
  opinion: string;
  from_status: string;
  to_status: string;
  processed_at: string;
  attachment_id?: string;
}

export interface AuditNote {
  id: string;
  order_id: string;
  note: string;
  created_by: string;
  created_at: string;
  creator_role: string;
}

export interface ExceptionReason {
  id: string;
  order_id: string;
  reason: string;
  module: string;
  created_by: string;
  created_at: string;
}

export interface ProcessOrderRequest {
  order_id: string;
  version: number;
  action: string;
  opinion: string;
  audit_note?: string;
  attachment_id?: string;
  appointment_evidence?: string;
  inspection_evidence?: string;
  registration_evidence?: string;
  exception_reason?: string;
  exception_module?: string;
}

export interface BatchResultItem {
  order_id: string;
  order_no: string;
  success: boolean;
  message: string;
  new_status?: string;
  new_status_display?: string;
  new_version?: number;
  current_handler_role?: string;
  current_handler_name?: string;
  last_opinion?: string;
  exception_count?: number;
  exception_latest?: string;
}

export const api = {
  login: (username: string, password: string) =>
    instance.post<ApiResp<{ token: string; user: UserInfo }>>('/api/login', { username, password }),

  listOrders: (status?: string, urgency?: string) =>
    instance.get<ApiResp<any>>('/api/orders', { params: { status, urgency } }),

  getOrder: (id: string) =>
    instance.get<ApiResp<any>>(`/api/orders/${id}`),

  processOrder: (req: ProcessOrderRequest) =>
    instance.post<ApiResp<any>>('/api/orders/process', req),

  batchProcess: (orders: ProcessOrderRequest[]) =>
    instance.post<ApiResp<BatchResultItem[]>>('/api/orders/batch', { orders }),

  uploadAttachment: (orderId: string, filename: string, module: string) =>
    instance.post<ApiResp<Attachment>>(`/api/orders/${orderId}/upload`, { filename, module }),
};

export const ROLE_LABEL: Record<string, string> = {
  warehouse_keeper: '库管员',
  warehouse_supervisor: '仓储主管',
  operations_manager: '运营经理',
};

export const STATUS_LABEL: Record<string, string> = {
  pending_confirmation: '待确认',
  exception: '异常',
  rechecked: '已复查',
};

export const MODULE_LABEL: Record<string, string> = {
  appointment: '入库预约',
  inspection: '质检上架',
  registration: '入库单登记',
  general: '综合',
};
