const API_BASE = "http://localhost:8005";

function getUserId(): string {
  if (typeof document === "undefined") return "zhangsan";
  const match = document.cookie.match(/current_user_id=([^;]+)/);
  return match ? match[1] : "zhangsan";
}

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const userId = getUserId();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-User-Id": userId,
    ...(options.headers as Record<string, string> || {}),
  };
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });
  if (!res.ok) {
    const body = await res.text();
    throw new ApiError(res.status, body);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export class ApiError extends Error {
  status: number;
  body: string;
  constructor(status: number, body: string) {
    super(`API Error ${status}: ${body}`);
    this.status = status;
    this.body = body;
  }
}

export interface User {
  id: number;
  username: string;
  display_name: string;
  role: string;
}

export interface CreativeRequestListItem {
  id: number;
  request_number: string;
  title: string;
  client_name: string;
  brand: string;
  campaign_name: string;
  brief_status: string;
  schedule_status: string;
  status: string;
  current_handler_role: string;
  current_handler_id: number;
  deadline: string;
  version: number;
  description: string;
  created_by: number;
  created_at: string;
  updated_at: string;
  deadline_warning: string;
  handler_name: string;
  creator_name: string;
}

export interface CreativeRequestDetail extends CreativeRequestListItem {
  attachments: Attachment[];
  processing_records: ProcessingRecord[];
  audit_notes: AuditNote[];
  exception_reasons: ExceptionReason[];
}

export interface Attachment {
  id: number;
  request_id: number;
  file_name: string;
  file_path: string;
  file_type: string;
  category: string;
  uploaded_by: number;
  uploaded_at: string;
}

export interface ProcessingRecord {
  id: number;
  request_id: number;
  handler_id: number;
  handler_role: string;
  action: string;
  opinion: string;
  from_status: string;
  to_status: string;
  created_at: string;
}

export interface AuditNote {
  id: number;
  request_id: number;
  author_id: number;
  content: string;
  note_type: string;
  created_at: string;
}

export interface ExceptionReason {
  id: number;
  request_id: number;
  reason_type: string;
  description: string;
  reported_by: number;
  resolved: boolean;
  resolved_at: string | null;
  created_at: string;
}

export interface BatchResult {
  results: Array<{ id: number; success: boolean; error: string | null; new_status: string | null }>;
}

export interface DashboardStats {
  total: number;
  draft: number;
  pending_submit: number;
  submitted: number;
  under_review: number;
  returned: number;
  resubmitted: number;
  reviewed: number;
  archived: number;
  overdue: number;
  approaching: number;
}

export interface CreateRequestPayload {
  title: string;
  client_name: string;
  brand: string;
  campaign_name: string;
  description: string;
  deadline: string | null;
  brief_status: string;
  schedule_status: string;
}

export async function login(username: string): Promise<User> {
  return apiFetch("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ username }),
  });
}

export async function getMe(): Promise<User> {
  return apiFetch("/api/auth/me");
}

export async function getRequests(params?: {
  status?: string;
  role?: string;
  keyword?: string;
  deadline_warning?: string;
}): Promise<CreativeRequestListItem[]> {
  const searchParams = new URLSearchParams();
  if (params?.status) searchParams.set("status", params.status);
  if (params?.role) searchParams.set("role", params.role);
  if (params?.keyword) searchParams.set("keyword", params.keyword);
  if (params?.deadline_warning) searchParams.set("deadline_warning", params.deadline_warning);
  const qs = searchParams.toString();
  return apiFetch(`/api/creative-requests${qs ? `?${qs}` : ""}`);
}

export async function getRequest(id: number): Promise<CreativeRequestDetail> {
  return apiFetch(`/api/creative-requests/${id}`);
}

export async function createRequest(data: CreateRequestPayload): Promise<CreativeRequestDetail> {
  return apiFetch("/api/creative-requests", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateRequest(id: number, data: Partial<CreateRequestPayload>): Promise<CreativeRequestDetail> {
  return apiFetch(`/api/creative-requests/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function submitRequest(id: number, data: { version: number }): Promise<CreativeRequestDetail> {
  return apiFetch(`/api/creative-requests/${id}/submit`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function reviewRequest(
  id: number,
  data: { action: string; opinion: string; version: number }
): Promise<CreativeRequestDetail> {
  return apiFetch(`/api/creative-requests/${id}/review`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function supplementRequest(
  id: number,
  data: { brief_status?: string; schedule_status?: string; description?: string; version: number }
): Promise<CreativeRequestDetail> {
  const body: Record<string, unknown> = { version: data.version };
  if (data.brief_status) body.brief_status = data.brief_status;
  if (data.schedule_status) body.schedule_status = data.schedule_status;
  if (data.description) body.description = data.description;
  return apiFetch(`/api/creative-requests/${id}/supplement`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function batchProcess(data: {
  items: Array<{ id: number; version: number; action: string; opinion: string }>;
}): Promise<BatchResult> {
  return apiFetch("/api/creative-requests/batch", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function getAttachments(requestId: number): Promise<Attachment[]> {
  return apiFetch(`/api/creative-requests/${requestId}/attachments`);
}

export async function uploadAttachment(
  requestId: number,
  data: { file_name: string; file_data: string; file_type: string; category: string }
): Promise<Attachment> {
  return apiFetch(`/api/creative-requests/${requestId}/attachments`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function deleteAttachment(attachmentId: number): Promise<{ deleted: boolean }> {
  return apiFetch(`/api/attachments/${attachmentId}`, {
    method: "DELETE",
  });
}

export async function getAuditTrail(requestId: number): Promise<{
  processing_records: ProcessingRecord[];
  audit_notes: AuditNote[];
  exception_reasons: ExceptionReason[];
}> {
  return apiFetch(`/api/creative-requests/${requestId}/audit-trail`);
}

export async function addAuditNote(
  requestId: number,
  data: { content: string; note_type: string }
): Promise<AuditNote> {
  return apiFetch(`/api/creative-requests/${requestId}/audit-notes`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function getStatistics(): Promise<DashboardStats> {
  return apiFetch("/api/statistics");
}
