const API_BASE = "http://localhost:8005/api";

export async function apiRequest(path, options = {}) {
  const token = localStorage.getItem("token");

  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
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
    error.detail = data.detail || "";
    error.code = data.code || res.status;
    error.status = res.status;
    throw error;
  }

  return data;
}

export const api = {
  login: (username, password) =>
    apiRequest("/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    }),

  getMe: () => apiRequest("/auth/me"),

  getMeta: () => apiRequest("/meta"),

  listOrders: (params = {}) => {
    const search = new URLSearchParams(params).toString();
    return apiRequest(`/orders/?${search}`);
  },

  getOrder: (id) => apiRequest(`/orders/${id}`),

  processOrder: (id, action, remark, version) =>
    apiRequest(`/orders/${id}/process`, {
      method: "POST",
      body: JSON.stringify({ action, remark, version }),
    }),

  batchProcess: (orderIds, action, remark) =>
    apiRequest("/orders/batch", {
      method: "POST",
      body: JSON.stringify({ order_ids: orderIds, action, remark }),
    }),

  addAuditNote: (id, statusLabel, content) =>
    apiRequest(`/orders/${id}/audit-notes`, {
      method: "POST",
      body: JSON.stringify({ status_label: statusLabel, content }),
    }),
};
