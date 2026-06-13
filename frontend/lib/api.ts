const API_BASE = '/api';

function getHeaders(): HeadersInit {
  const userId = typeof window !== 'undefined' ? localStorage.getItem('userId') || 'clerk01' : 'clerk01';
  return {
    'Content-Type': 'application/json',
    'X-User-ID': userId,
  };
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      ...getHeaders(),
      ...options.headers,
    },
  });

  if (!res.ok) {
    const text = await res.text();
    let errorMessage = `请求失败 (${res.status})`;
    try {
      const data = JSON.parse(text);
      errorMessage = data.error || errorMessage;
    } catch {
      // ignore
    }
    throw new Error(errorMessage);
  }

  return res.json();
}

export const api = {
  health: () => request<{ status: string; time: string }>('/health'),

  getCurrentUser: () => request<User>('/users/me'),

  listUsers: (role?: string) => 
    request<User[]>(`/users${role ? `?role=${role}` : ''}`),

  getStats: () => request<Stats>('/stats'),

  listOrders: (params?: {
    status?: string;
    store?: string;
    keyword?: string;
    only_my?: boolean;
  }) => {
    const query = new URLSearchParams();
    if (params?.status) query.set('status', params.status);
    if (params?.store) query.set('store', params.store);
    if (params?.keyword) query.set('keyword', params.keyword);
    if (params?.only_my) query.set('only_my', 'true');
    return request<OrderListItem[]>(`/orders/?${query.toString()}`);
  },

  getOrderDetail: (id: string) => 
    request<OrderDetail>(`/orders/${id}`),

  createOrder: (data: {
    store_name: string;
    product_name: string;
    batch_no: string;
    expiry_date: string;
    quantity: number;
    due_date: string;
    pharmacist_id: string;
    remark?: string;
  }) => 
    request<{ id: string; order_no: string; status: OrderStatus }>('/orders/', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  processOrder: (id: string, data: {
    version: number;
    action: string;
    remark?: string;
    evidence_type?: string;
    file_name?: string;
    exception_reason?: string;
  }) => 
    request<{
      success: boolean;
      new_status: OrderStatus;
      new_version: number;
      new_handler: string;
      action: string;
    }>(`/orders/${id}/process`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  addAuditNote: (id: string, content: string) =>
    request<{ id: string; content: string; author: string; created_at: string }>(
      `/orders/${id}/audit-notes`,
      {
        method: 'POST',
        body: JSON.stringify({ content }),
      }
    ),

  uploadAttachment: (id: string, data: {
    evidence_type: string;
    file_name: string;
    remark?: string;
  }) =>
    request<{
      id: string;
      evidence_type: EvidenceType;
      file_name: string;
      uploaded_by: string;
      uploaded_at: string;
    }>(`/orders/${id}/attachments`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  batchProcess: (data: {
    order_ids: string[];
    versions?: number[];
    action: string;
    remark?: string;
    exception_reason?: string;
  }) =>
    request<BatchResult[]>('/batch-process', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};

import type {
  User,
  NearExpiryOrder,
  OrderListItem,
  OrderDetail,
  OrderStatus,
  EvidenceType,
  BatchResult,
  Stats,
} from './types';
