export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  role: "dispatcher" | "supervisor" | "manager";
  username: string;
}

export interface NannyProfile {
  name: string;
  id_card: string;
  phone: string;
  service_type: string;
  work_experience: string;
}

export interface QualificationReview {
  health_cert: string;
  health_cert_expiry: string;
  training_cert: string;
  training_cert_expiry: string;
  background_check: string;
  background_check_result: string;
}

export interface OnDutyConfirmation {
  on_duty_date: string;
  service_area: string;
  contract_no: string;
  confirmation_status: string;
}

export interface AuditOrder {
  id: string;
  order_no: string;
  status: "pending" | "processing" | "reviewing" | "correction_needed" | "completed" | "withdrawn";
  expiry_date: string;
  creator_id: string;
  creator_name: string;
  current_handler_id: string | null;
  current_handler_name: string | null;
  version: number;
  nanny_profile: NannyProfile | null;
  qualification_review: QualificationReview | null;
  on_duty_confirmation: OnDutyConfirmation | null;
  audit_logs?: AuditLog[];
  created_at: string;
  updated_at: string;
}

export interface ProcessRequest {
  action: "advance" | "return_correction" | "review_pass" | "review_reject" | "complete";
  comment: string;
  exception_reason: string | null;
  nanny_profile: NannyProfile | null;
  qualification_review: QualificationReview | null;
  on_duty_confirmation: OnDutyConfirmation | null;
  version: number;
}

export interface ProcessResponse {
  success: boolean;
  error_code: string | null;
  error_message: string | null;
  audit_order: AuditOrder | null;
}

export interface BatchProcessRequest {
  action: "advance" | "return_correction" | "review_pass" | "complete";
  audit_ids: string[];
  comment: string;
  exception_reason: string | null;
}

export interface BatchProcessItemResult {
  audit_id: string;
  order_no: string;
  success: boolean;
  error_code: string | null;
  error_message: string | null;
}

export interface BatchProcessResponse {
  total: number;
  success_count: number;
  fail_count: number;
  results: BatchProcessItemResult[];
}

export interface AuditListQuery {
  status?: string;
  expiry_status?: "normal" | "expiring_soon" | "overdue";
  role_queue?: "dispatcher" | "supervisor" | "manager";
  page?: number;
  page_size?: number;
}

export interface AuditListResponse {
  total: number;
  items: AuditOrder[];
  page: number;
  page_size: number;
}

export interface AuditLog {
  id: string;
  audit_id: string;
  operator_id: string;
  operator_name: string;
  operator_role: string;
  action: string;
  from_status: string | null;
  to_status: string;
  comment: string;
  exception_reason: string | null;
  created_at: string;
}

export interface DashboardStats {
  pending_count: number;
  processing_count: number;
  reviewing_count: number;
  correction_needed_count: number;
  completed_count: number;
  overdue_count: number;
  expiring_soon_count: number;
}

export interface CreateAuditRequest {
  nanny_profile: NannyProfile;
  expiry_date: string;
}

const BASE_URL = "http://localhost:8101/api";

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("token");
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> || {}),
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error_message || body.message || `HTTP ${res.status}`);
  }
  return res.json();
}

export const api = {
  login: (data: LoginRequest) => request<LoginResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify(data),
  }),

  getAudits: (query: AuditListQuery = {}) => {
    const params = new URLSearchParams();
    if (query.status) params.set("status", query.status);
    if (query.expiry_status) params.set("expiry_status", query.expiry_status);
    if (query.role_queue) params.set("role_queue", query.role_queue);
    if (query.page) params.set("page", String(query.page));
    if (query.page_size) params.set("page_size", String(query.page_size));
    const qs = params.toString();
    return request<AuditListResponse>(`/audits${qs ? "?" + qs : ""}`);
  },

  createAudit: (data: CreateAuditRequest) => request<AuditOrder>("/audits", {
    method: "POST",
    body: JSON.stringify(data),
  }),

  getAudit: (id: string) => request<AuditOrder>(`/audits/${id}`),

  getAuditLogs: (id: string) => request<AuditLog[]>(`/audits/${id}/logs`),

  processAudit: (id: string, data: ProcessRequest) => request<ProcessResponse>(`/audits/${id}/process`, {
    method: "POST",
    body: JSON.stringify(data),
  }),

  withdrawAudit: (id: string) => request<ProcessResponse>(`/audits/${id}/withdraw`, {
    method: "POST",
  }),

  batchProcess: (data: BatchProcessRequest) => request<BatchProcessResponse>("/audits/batch", {
    method: "POST",
    body: JSON.stringify(data),
  }),

  getExpiryList: () => request<{normal: AuditOrder[], expiring_soon: AuditOrder[], overdue: AuditOrder[]}>("/audits/expiry"),

  getDashboardStats: () => request<DashboardStats>("/dashboard/stats"),
};
