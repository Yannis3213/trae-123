import type { APIResponse, User, RepairOrder, OrderDetail, Statistics, BatchResult, ProcessRecord, AuditNote, ExceptionReason, Attachment } from './types'

async function request<T>(url: string, options?: RequestInit): Promise<APIResponse<T>> {
  const token = localStorage.getItem('token')
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }
  const res = await fetch(url, {
    ...options,
    headers: {
      ...headers,
      ...(options?.headers as Record<string, string> || {})
    }
  })
  const data = await res.json()
  return data as APIResponse<T>
}

export async function login(username: string, password: string) {
  return request<{ token: string; user: User }>('/api/login', {
    method: 'POST',
    body: JSON.stringify({ username, password })
  })
}

export async function getMe() {
  return request<User>('/api/users/me')
}

export interface OrderListParams {
  status?: string
  expiry_group?: string
  page?: number
  page_size?: number
}

export async function getOrders(params: OrderListParams = {}) {
  const qs = new URLSearchParams()
  if (params.status) qs.set('status', params.status)
  if (params.expiry_group) qs.set('expiry_group', params.expiry_group)
  if (params.page) qs.set('page', String(params.page))
  if (params.page_size) qs.set('page_size', String(params.page_size))
  const query = qs.toString()
  const url = query ? `/api/orders?${query}` : '/api/orders'
  return request<{ list: RepairOrder[]; total: number; page: number; page_size: number; status_counts: Record<string, number> }>(url)
}

export async function getOrder(id: number) {
  return request<OrderDetail>(`/api/orders/${id}`)
}

export async function createOrder(data: Partial<RepairOrder>) {
  return request<RepairOrder>('/api/orders', {
    method: 'POST',
    body: JSON.stringify(data)
  })
}

export async function updateStatus(id: number, data: { status: string; remark?: string; version: number; attachments?: { file_name: string; category: string }[] }) {
  return request<OrderDetail>(`/api/orders/${id}/status`, {
    method: 'PUT',
    body: JSON.stringify(data)
  })
}

export async function batchUpdate(data: { order_ids: number[]; status: string; remark?: string }) {
  return request<BatchResult[]>('/api/orders/batch', {
    method: 'POST',
    body: JSON.stringify(data)
  })
}

export async function getAuditTrail(id: number) {
  return request<(ProcessRecord | AuditNote | ExceptionReason)[]>(`/api/orders/${id}/audit-trail`)
}

export async function addAttachment(orderId: number, data: { file_name: string; category: string }) {
  return request<Attachment>(`/api/orders/${orderId}/attachments`, {
    method: 'POST',
    body: JSON.stringify(data)
  })
}

export async function addAuditNote(orderId: number, note: string) {
  return request<AuditNote>(`/api/orders/${orderId}/audit-notes`, {
    method: 'POST',
    body: JSON.stringify({ note })
  })
}

export async function addExceptionReason(orderId: number, data: { reason_type: string; description: string }) {
  return request<ExceptionReason>(`/api/orders/${orderId}/exception-reasons`, {
    method: 'POST',
    body: JSON.stringify(data)
  })
}

export async function getStatistics() {
  return request<Statistics>('/api/statistics')
}
