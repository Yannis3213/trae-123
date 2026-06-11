const BACKEND_PORT = process.env.NEXT_PUBLIC_BACKEND_PORT || '8101';
const BASE_URL = `http://localhost:${BACKEND_PORT}`;

interface ApiResult<T = unknown> {
  success: boolean;
  data: T;
  message: string;
  total: number;
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<ApiResult<T>> {
  try {
    const isFormData = options.body instanceof FormData;
    const headers: Record<string, string> = isFormData
      ? {}
      : { 'Content-Type': 'application/json' };
    const res = await fetch(`${BASE_URL}${path}`, {
      ...options,
      headers,
    });
    const json = await res.json();
    return {
      success: res.ok && json.code === 0,
      data: json.data ?? json,
      message: json.message ?? '',
      total: json.total ?? 0,
    };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : '网络请求失败';
    return { success: false, data: null as T, message: msg, total: 0 };
  }
}

export const api = {
  fetchUsers: () =>
    request<unknown[]>('/api/users'),

  fetchOrders: (params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return request<{ items: unknown[]; total: number }>(`/api/repairs${qs}`);
  },

  fetchOrderDetail: (id: string) =>
    request<unknown>(`/api/repairs/${id}`),

  createOrder: (data: Record<string, unknown>) =>
    request<unknown>('/api/repairs', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  createAndSubmitOrder: (data: Record<string, unknown>) =>
    request<unknown>('/api/repairs', {
      method: 'POST',
      body: JSON.stringify({ ...data, submit_now: true }),
    }),

  updateOrder: (id: string, data: Record<string, unknown>) =>
    request<unknown>(`/api/repairs/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  submitOrder: (id: string, handlerId: string, handlerRole: string, version: number) =>
    request<unknown>(`/api/repairs/${id}/submit`, {
      method: 'POST',
      body: JSON.stringify({ handler_id: handlerId, handler_role: handlerRole, version }),
    }),

  processOrder: (id: string, handlerId: string, handlerRole: string, version: number) =>
    request<unknown>(`/api/repairs/${id}/process`, {
      method: 'POST',
      body: JSON.stringify({ handler_id: handlerId, handler_role: handlerRole, version }),
    }),

  verifyOrder: (id: string, handlerId: string, handlerRole: string, version: number) =>
    request<unknown>(`/api/repairs/${id}/verify`, {
      method: 'POST',
      body: JSON.stringify({ handler_id: handlerId, handler_role: handlerRole, version }),
    }),

  reviewOrder: (id: string, handlerId: string, handlerRole: string, version: number) =>
    request<unknown>(`/api/repairs/${id}/review`, {
      method: 'POST',
      body: JSON.stringify({ handler_id: handlerId, handler_role: handlerRole, version }),
    }),

  archiveOrder: (id: string, handlerId: string, handlerRole: string, version: number) =>
    request<unknown>(`/api/repairs/${id}/archive`, {
      method: 'POST',
      body: JSON.stringify({ handler_id: handlerId, handler_role: handlerRole, version }),
    }),

  returnOrder: (id: string, handlerId: string, handlerRole: string, version: number, returnReason: string, returnOpinion: string) =>
    request<unknown>(`/api/repairs/${id}/return`, {
      method: 'POST',
      body: JSON.stringify({
        handler_id: handlerId,
        handler_role: handlerRole,
        version,
        return_reason: returnReason,
        return_opinion: returnOpinion,
      }),
    }),

  resubmitOrder: (id: string, handlerId: string, handlerRole: string, version: number, correctionReason: string) =>
    request<unknown>(`/api/repairs/${id}/resubmit`, {
      method: 'POST',
      body: JSON.stringify({
        handler_id: handlerId,
        handler_role: handlerRole,
        version,
        correction_reason: correctionReason,
      }),
    }),

  batchAdvance: (items: Array<{ id: string; handler_id: string; handler_role: string; version: number }>) =>
    request<unknown[]>('/api/repairs/batch/advance', {
      method: 'POST',
      body: JSON.stringify({ items }),
    }),

  batchReturn: (items: Array<{ id: string; handler_id: string; handler_role: string; version: number; return_reason: string; return_opinion: string }>) =>
    request<unknown[]>('/api/repairs/batch/return', {
      method: 'POST',
      body: JSON.stringify({ items }),
    }),

  fetchWarnings: () =>
    request<{ normal: unknown[]; approaching: unknown[]; overdue: unknown[] }>('/api/repairs/warnings'),

  fetchLedger: (params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return request<{ items: unknown[]; total: number }>(`/api/ledger${qs}`);
  },

  uploadAttachment: (repairId: string, file: File, uploadedBy: string) => {
    const formData = new FormData();
    formData.append('repair_id', repairId);
    formData.append('file', file);
    formData.append('uploaded_by', uploadedBy);
    return request<unknown>('/api/attachments', {
      method: 'POST',
      body: formData,
    });
  },

  downloadAttachment: (id: string) =>
    `${BASE_URL}/api/attachments/${id}`,

  fetchRecords: (id: string) =>
    request<unknown[]>(`/api/repairs/${id}/records`),

  fetchExceptions: (id: string) =>
    request<unknown[]>(`/api/repairs/${id}/exceptions`),
};
