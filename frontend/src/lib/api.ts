import type { SafetyOrder, OrderStats, CreateOrderData, ActionData, BatchActionData, BatchResult, FetchOrdersParams } from './types';

const BASE = 'http://localhost:8004';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || body.detail || body.message || `请求失败: ${res.status}`);
  }
  return res.json();
}

export async function fetchOrders(params?: FetchOrdersParams): Promise<SafetyOrder[]> {
  const query = new URLSearchParams();
  if (params?.status) query.set('status', params.status);
  if (params?.expiry_status) query.set('expiry_status', params.expiry_status);
  if (params?.handler) query.set('handler', params.handler);
  if (params?.keyword) query.set('keyword', params.keyword);
  const qs = query.toString();
  return request<SafetyOrder[]>(`/api/orders${qs ? '?' + qs : ''}`);
}

export async function fetchOrder(id: string): Promise<SafetyOrder> {
  return request<SafetyOrder>(`/api/orders/${id}`);
}

export async function createOrder(data: CreateOrderData): Promise<SafetyOrder> {
  return request<SafetyOrder>('/api/orders', {
    method: 'POST',
    body: JSON.stringify(data)
  });
}

export async function submitAction(id: string, data: ActionData): Promise<SafetyOrder> {
  return request<SafetyOrder>(`/api/orders/${id}/action`, {
    method: 'POST',
    body: JSON.stringify(data)
  });
}

export async function batchAction(data: BatchActionData): Promise<BatchResult> {
  return request<BatchResult>('/api/orders/batch', {
    method: 'POST',
    body: JSON.stringify(data)
  });
}

export async function fetchStats(): Promise<OrderStats> {
  return request<OrderStats>('/api/orders/stats');
}
