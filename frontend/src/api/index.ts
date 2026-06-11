import type { User, VenueOrder, AuditLog, BatchResult, Attachment } from '@/types';

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: '请求失败' }));
    throw new Error(err.message || `HTTP ${res.status}`);
  }
  return res.json();
}

export async function switchRole(userId: string): Promise<User> {
  const data = await request<{ success: boolean; data: User }>('/api/auth/switch-role', {
    method: 'POST',
    body: JSON.stringify({ userId }),
  });
  return data.data;
}

export async function getCurrentRole(): Promise<User | null> {
  const data = await request<{ success: boolean; data: User | null }>('/api/auth/current-role');
  return data.data;
}

export async function getOrders(filters?: { status?: string; warningLevel?: string; role?: string }): Promise<VenueOrder[]> {
  const params = new URLSearchParams();
  if (filters?.status) params.set('status', filters.status);
  if (filters?.warningLevel) params.set('warningLevel', filters.warningLevel);
  if (filters?.role) params.set('role', filters.role);
  const qs = params.toString();
  return request<VenueOrder[]>(`/api/orders${qs ? '?' + qs : ''}`);
}

export async function getOrder(id: string): Promise<VenueOrder> {
  return request<VenueOrder>(`/api/orders/${id}`);
}

interface EvidenceFields {
  paymentAmount?: number | null;
  paymentMethod?: string | null;
  paymentStatus?: string | null;
  paymentVerification?: string | null;
  admissionStatus?: string | null;
  admissionConfirmation?: string | null;
  exceptionReason?: string | null;
  responsibleNode?: string | null;
  auditRemark?: string | null;
  correctReason?: string | null;
  returnOpinion?: string | null;
}

export async function createOrder(data: Partial<VenueOrder> & EvidenceFields): Promise<VenueOrder> {
  return request<VenueOrder>('/api/orders', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function correctOrder(id: string, data: { version: number; correctReason: string; venueName?: string; courtName?: string; reservationDate?: string; timeSlot?: string; applicantName?: string; applicantPhone?: string; deadline?: string } & EvidenceFields): Promise<VenueOrder> {
  return request<VenueOrder>(`/api/orders/${id}/correct`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function reviewOrder(id: string, data: { version: number; action: string; opinion: string } & EvidenceFields): Promise<VenueOrder> {
  return request<VenueOrder>(`/api/orders/${id}/review`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function approveOrder(id: string, data: { version: number; action: string; opinion: string } & EvidenceFields): Promise<VenueOrder> {
  return request<VenueOrder>(`/api/orders/${id}/approve`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function returnOrder(id: string, data: { version: number; returnOpinion: string } & EvidenceFields): Promise<VenueOrder> {
  return request<VenueOrder>(`/api/orders/${id}/return`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function batchReview(data: { orderIds: string[]; action: string; opinion: string; ordersWithVersions?: { id: string; version: number }[] } & EvidenceFields): Promise<BatchResult[]> {
  return request<BatchResult[]>('/api/orders/batch-review', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function batchApprove(data: { orderIds: string[]; action: string; opinion: string; ordersWithVersions?: { id: string; version: number }[] } & EvidenceFields): Promise<BatchResult[]> {
  return request<BatchResult[]>('/api/orders/batch-approve', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function getWarnings(): Promise<{ normal: VenueOrder[]; approaching: VenueOrder[]; overdue: VenueOrder[] }> {
  return request('/api/orders/warnings');
}

export async function getAuditLogs(filters?: { orderId?: string; operator?: string }): Promise<AuditLog[]> {
  const params = new URLSearchParams();
  if (filters?.orderId) params.set('orderId', filters.orderId);
  if (filters?.operator) params.set('operator', filters.operator);
  const qs = params.toString();
  return request<AuditLog[]>(`/api/audit-logs${qs ? '?' + qs : ''}`);
}

export async function uploadAttachment(orderId: string, file: File): Promise<{ success: boolean; data: Attachment }> {
  const formData = new FormData();
  formData.append('orderId', orderId);
  formData.append('file', file);
  const res = await fetch('/api/attachments', {
    method: 'POST',
    body: formData,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: '上传失败' }));
    throw new Error(err.message || `HTTP ${res.status}`);
  }
  return res.json();
}

export function downloadAttachmentUrl(id: string): string {
  return `/api/attachments/${id}`;
}
