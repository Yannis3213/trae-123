const API_BASE = "http://localhost:8004/api";

interface ApiOptions {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
}

interface ApiResponse<T = unknown> {
  code: number;
  message: string;
  data: T;
}

function getToken(): string | null {
  if (typeof localStorage === "undefined") return null;
  return localStorage.getItem("token");
}

function getUser(): { username: string; role: string; name: string } | null {
  if (typeof localStorage === "undefined") return null;
  const userStr = localStorage.getItem("user");
  if (!userStr) return null;
  try {
    return JSON.parse(userStr);
  } catch {
    return null;
  }
}

export async function apiRequest<T = unknown>(
  path: string,
  options: ApiOptions = {}
): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...options.headers,
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${path}`, {
    method: options.method || "GET",
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const data = await response.json().catch(() => ({})) as ApiResponse<T>;

  if (!response.ok) {
    const message = data.message || `请求失败 (${response.status})`;
    throw new Error(message);
  }

  if (data.code !== 0) {
    throw new Error(data.message || "请求失败");
  }

  return data.data;
}

export const api = {
  login: (username: string, password: string) =>
    apiRequest<{ token: string; user: { username: string; role: string; name: string } }>("/auth/login", {
      method: "POST",
      body: { username, password },
    }),

  getCurrentUser: () =>
    apiRequest<{ username: string; role: string; name: string }>("/auth/current"),

  getOrders: (params: {
    status?: string;
    keyword?: string;
    page?: number;
    pageSize?: number;
  }) => {
    const searchParams = new URLSearchParams();
    if (params.status) searchParams.set("status", params.status);
    if (params.keyword) searchParams.set("keyword", params.keyword);
    if (params.page) searchParams.set("page", String(params.page));
    if (params.pageSize) searchParams.set("pageSize", String(params.pageSize));
    const query = searchParams.toString();
    return apiRequest<{
      list: LiveSelectionOrder[];
      total: number;
      page: number;
      pageSize: number;
    }>(`/orders?${query}`);
  },

  getOrder: (id: number) =>
    apiRequest<{
      order: LiveSelectionOrder;
      attachments: SelectionAttachment[];
      process_records: ProcessRecord[];
      audit_remarks: AuditRemark[];
    }>(`/orders/${id}`),

  createOrder: (data: Partial<LiveSelectionOrder>) =>
    apiRequest<LiveSelectionOrder>("/orders", {
      method: "POST",
      body: data,
    }),

  submitOrder: (id: number, version: number) =>
    apiRequest<LiveSelectionOrder>(`/orders/${id}/submit`, {
      method: "PUT",
      body: { version },
    }),

  auditOrder: (
    id: number,
    data: { pass: boolean; opinion: string; version: number }
  ) =>
    apiRequest<LiveSelectionOrder>(`/orders/${id}/audit`, {
      method: "PUT",
      body: data,
    }),

  reviewOrder: (id: number, opinion?: string, version?: number) =>
    apiRequest<LiveSelectionOrder>(`/orders/${id}/review`, {
      method: "PUT",
      body: { opinion, version },
    }),

  supplementOrder: (id: number, data: Partial<LiveSelectionOrder> & { version: number }) =>
    apiRequest<LiveSelectionOrder>(`/orders/${id}/supplement`, {
      method: "PUT",
      body: data,
    }),

  batchProcess: (data: {
    action: "audit_pass" | "review" | "overdue_push";
    order_ids: number[];
    opinion?: string;
  }) =>
    apiRequest<{ results: { order_id: number; success: boolean; message: string }[] }>(
      "/orders/batch-process",
      {
        method: "POST",
        body: data,
      }
    ),

  getAuditTrail: (id: number) =>
    apiRequest<AuditRemark[]>(`/orders/${id}/audit-trail`),

  getOverdueQueue: () =>
    apiRequest<{ groups: OverdueQueueItem[] }>("/overdue-queue").then(res => res.groups),

  batchOverduePush: (data: {
    items: {
      order_id: number;
      version: number;
      reason?: string;
    }[];
  }) =>
    apiRequest<{
      results: {
        order_id: number;
        success: boolean;
        message: string;
      }[];
    }>("/orders/batch-overdue-push", {
      method: "POST",
      body: data,
    }),

  processModule: (id: number, data: {
    module_type: "submission" | "sample" | "registration";
    version: number;
    evidence: string;
    opinion: string;
    audit_remark?: string;
    submit_next: boolean;
  }) =>
    apiRequest<void>(`/orders/${id}/process-module`, {
      method: "PUT",
      body: data,
    }),

  uploadAttachment: (id: number, data: {
    file_name: string;
    file_type: string;
    file_url: string;
    module_type: "submission" | "sample" | "registration";
  }) =>
    apiRequest<SelectionAttachment>(`/orders/${id}/attachments`, {
      method: "POST",
      body: data,
    }),
};

export interface LiveSelectionOrder {
  id: number;
  order_no: string;
  product_name: string;
  product_category: string;
  price: number;
  stock: number;
  status: string;
  current_handler: string;
  current_role: string;
  version: number;
  deadline: string;
  submission_evidence?: string;
  sample_evidence?: string;
  registration_evidence?: string;
  attachments?: SelectionAttachment[];
  process_records?: ProcessRecord[];
  audit_remarks?: AuditRemark[];
  created_at: string;
  updated_at: string;
  created_by: string;
  exception_reason?: string;
  is_overdue: boolean;
  overdue_reason?: string;
}

export interface SelectionAttachment {
  id: number;
  order_id: number;
  file_name: string;
  file_type: string;
  file_url: string;
  uploaded_by: string;
  uploaded_at: string;
  module_type: string;
}

export interface ProcessRecord {
  id: number;
  order_id: number;
  operator: string;
  operator_role: string;
  action: string;
  from_status: string;
  to_status: string;
  opinion?: string;
  version: number;
  created_at: string;
}

export interface AuditRemark {
  id: number;
  order_id: number;
  operator: string;
  operator_role: string;
  remark_type: string;
  content: string;
  created_at: string;
}

export interface OverdueQueueItem {
  handler: string;
  role: string;
  normal_count: number;
  warning_count: number;
  overdue_count: number;
  orders: LiveSelectionOrder[];
}

export { getToken, getUser };
