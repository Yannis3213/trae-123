'use client';

import type {
  ApiResult, User, OrderListResult, OrderDetailResult,
  BatchResultItem, OrderActionResult, OrderSummary,
} from './types';
import { dispatchOrderChanged } from './useRefresh';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '';

let currentUserId = typeof window !== 'undefined' ? localStorage.getItem('hotel_user_id') || 'u_registrar' : 'u_registrar';

export function setCurrentUserId(id: string) {
  currentUserId = id;
  if (typeof window !== 'undefined') localStorage.setItem('hotel_user_id', id);
}

export function getCurrentUserId() {
  return currentUserId;
}

async function request<T = unknown>(
  method: string,
  path: string,
  body?: unknown,
  query?: Record<string, string | string[] | number | undefined>,
): Promise<ApiResult<T>> {
  const url = new URL(path.startsWith('/') ? `${API_BASE}${path}` : `${API_BASE}/${path}`, typeof window !== 'undefined' ? window.location.origin : 'http://localhost');
  if (query) {
    Object.entries(query).forEach(([k, v]) => {
      if (v === undefined) return;
      if (Array.isArray(v)) {
        v.forEach(x => url.searchParams.append(k, String(x)));
      } else {
        url.searchParams.set(k, String(v));
      }
    });
  }
  const res = await fetch(url.toString(), {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-User-Id': currentUserId,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  try {
    const data = await res.json();
    if (!res.ok && !data.ok) {
      return { ok: false, code: data.code || `HTTP_${res.status}`, message: data.message || `HTTP ${res.status}` };
    }
    return data as ApiResult<T>;
  } catch (err) {
    return { ok: false, code: 'FETCH_ERROR', message: String(err) };
  }
}

function requestWithDispatch<T extends { refresh_queue?: boolean }>(
  method: string,
  path: string,
  body?: unknown,
  query?: Record<string, string | string[] | number | undefined>,
): Promise<ApiResult<T>> {
  return request<T>(method, path, body, query).then(res => {
    if (res.ok && res.data?.refresh_queue) {
      dispatchOrderChanged();
    }
    return res;
  });
}

export const api = {
  health: () => request<{ service: string }>('GET', '/api/health'),

  listUsers: () => request<User[]>('GET', '/api/users/list'),
  login: (username: string, password: string) =>
    request<User>('POST', '/api/users/login', { username, password }),
  me: () => request<User>('GET', '/api/users/me'),

  listOrders: (q?: {
    status?: string | string[];
    keyword?: string;
    urgency?: string;
    handler_scope?: 'mine' | 'all';
    order_type?: string;
    page?: number;
    page_size?: number;
  }) => request<OrderListResult>('GET', '/api/orders', undefined, q as Record<string, any>),

  getOrderDetail: (id: string) => request<OrderDetailResult>('GET', `/api/orders/${id}`),

  createOrder: (body: {
    order_no: string; guest_name: string; room_no?: string;
    check_in_date: string; check_out_date?: string;
    amount: number; order_type?: string; deadline_hours?: number;
    evidence_types?: string[]; remark?: string; note_content?: string;
  }) => requestWithDispatch<OrderActionResult>('POST', '/api/orders', body),

  orderAction: (
    id: string,
    action: 'transfer' | 'review' | 'archive' | 'return' | 'correct',
    body: {
      target_handler_id?: string;
      target_handler_role?: string;
      version: number;
      evidence_types?: string[];
      remark?: string;
      note_content?: string;
      exception_code?: string;
      exception_label?: string;
      exception_desc?: string;
      exception_severity?: 'low' | 'medium' | 'high';
      page_status?: string;
    },
  ) => requestWithDispatch<OrderActionResult>(
    'POST',
    `/api/orders/${id}/${action}`,
    body,
  ),

  batchPushOverdue: (order_ids: string[]) =>
    requestWithDispatch<{ results: BatchResultItem[]; total: number; success_count: number; refresh_queue: boolean }>(
      'POST',
      '/api/orders/batch/push-overdue',
      { order_ids },
    ),

  listAttachments: (id: string) => request<[]>('GET', `/api/orders/${id}/attachments`),
  addAttachment: (id: string, body: { file_name: string; file_type?: string; evidence_type: string; version?: number; remark?: string }) =>
    requestWithDispatch<{ attachment: any; order_summary: OrderSummary; message: string; refresh_queue: boolean }>(
      'POST', `/api/orders/${id}/attachments`, body,
    ),

  listRecords: (id: string) => request<[]>('GET', `/api/orders/${id}/records`),
  listExceptions: (id: string) => request<[]>('GET', `/api/orders/${id}/exceptions`),
  resolveException: (id: string, eid: string) =>
    requestWithDispatch<{ order_summary: OrderSummary; message: string; refresh_queue: boolean }>(
      'POST', `/api/orders/${id}/exceptions/${eid}/resolve`,
    ),
  listNotes: (id: string) => request<[]>('GET', `/api/orders/${id}/notes`),
  addNote: (id: string, body: { note_type?: string; content: string }) =>
    requestWithDispatch<{ id: string; order_summary: OrderSummary; message: string; refresh_queue: boolean }>(
      'POST', `/api/orders/${id}/notes`, body,
    ),
};
