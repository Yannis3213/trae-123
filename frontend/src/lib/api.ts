const API_BASE = "http://localhost:8005/api";

export async function apiRequest(path: string, options: RequestInit = {}): Promise<any> {
  const token = localStorage.getItem("token");

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((options.headers as Record<string, string>) || {}),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const error = new Error(data.message || "请求失败");
    (error as any).detail = data.detail || "";
    (error as any).code = data.code || res.status;
    (error as any).status = res.status;
    throw error;
  }

  return data;
}

export const api = {
  login: (username: string, password: string) =>
    apiRequest("/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    }),

  getMe: () => apiRequest("/auth/me"),

  getMeta: () => apiRequest("/meta"),

  listOrders: (params: Record<string, string> = {}) => {
    const search = new URLSearchParams(params).toString();
    return apiRequest(`/orders/?${search}`);
  },

  getOrder: (id: string) => apiRequest(`/orders/${id}`),

  createOrder: (data: { candidate_name: string; position: string; department: string; due_date?: string }) =>
    apiRequest("/orders/", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  addAttachment: (orderId: string, data: { node: string; type: string; name: string; url?: string }) =>
    apiRequest(`/orders/${orderId}/attachments`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  processOrder: (id: string, action: string, remark: string, version: number) =>
    apiRequest(`/orders/${id}/process`, {
      method: "POST",
      body: JSON.stringify({ action, remark, version }),
    }),

  batchProcess: (orderIds: string[], action: string, remark: string) =>
    apiRequest("/orders/batch", {
      method: "POST",
      body: JSON.stringify({ order_ids: orderIds, action, remark }),
    }),

  addAuditNote: (id: string, statusLabel: string, content: string) =>
    apiRequest(`/orders/${id}/audit-notes`, {
      method: "POST",
      body: JSON.stringify({ status_label: statusLabel, content }),
    }),
};
