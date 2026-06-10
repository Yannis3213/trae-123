import type { User, Entry, EntryDetail, Stats, BatchResult, ExceptionLog, Attachment, AuditNote } from './types';

const BASE = '/api';

function getToken(): string | null {
  return localStorage.getItem('auth_token');
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };
  if (token) {
    headers['X-Auth-Token'] = token;
  }

  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers,
  });

  if (res.status === 401) {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_user');
    window.location.href = '/';
    throw new Error('未登录');
  }

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || '请求失败');
  }
  return data as T;
}

export async function login(username: string, password: string): Promise<{ token: string; user: User }> {
  const data = await request<{ token: string; user: User }>('/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
  localStorage.setItem('auth_token', data.token);
  localStorage.setItem('auth_user', JSON.stringify(data.user));
  return data;
}

export async function logout(): Promise<void> {
  try {
    await request('/logout', { method: 'POST' });
  } finally {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_user');
  }
}

export async function getMe(): Promise<User> {
  const data = await request<User>('/me');
  return data;
}

export async function listEntries(params: Record<string, string> = {}): Promise<{ entries: Entry[]; total: number }> {
  const qs = new URLSearchParams(params).toString();
  const path = qs ? `/entries?${qs}` : '/entries';
  return request(path);
}

export async function getEntry(id: number): Promise<EntryDetail> {
  return request(`/entries/${id}`);
}

export async function createEntry(data: {
  title: string;
  subcontractor_name: string;
  priority: string;
  category: string;
  responsible_person: string;
  deadline: string;
}): Promise<{ id: number; message: string }> {
  return request('/entries', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function processEntry(id: number, data: {
  action: string;
  result?: string;
  return_reason?: string;
  version: number;
}): Promise<{ message: string }> {
  return request(`/entries/${id}/process`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function batchProcess(data: {
  entry_ids: number[];
  action: string;
  result?: string;
}): Promise<{ results: BatchResult[] }> {
  return request('/entries/batch-process', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function getStats(): Promise<Stats> {
  return request('/entries/stats');
}

export async function listAttachments(entryId: number): Promise<{ attachments: Attachment[] }> {
  return request(`/entries/${entryId}/attachments`);
}

export async function createAttachment(entryId: number, data: {
  filename: string;
  file_type: string;
  file_size: number;
  description: string;
}): Promise<{ id: number; message: string }> {
  return request(`/entries/${entryId}/attachments`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function getAuditTrail(entryId: number): Promise<{ records: ProcessingRecord[]; notes: AuditNote[] }> {
  return request(`/entries/${entryId}/audit-trail`);
}

export async function createAuditNote(entryId: number, data: {
  note_type: string;
  content: string;
}): Promise<{ id: number; message: string }> {
  return request(`/entries/${entryId}/audit-notes`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function listExceptions(params: Record<string, string> = {}): Promise<{ exceptions: ExceptionLog[] }> {
  const qs = new URLSearchParams(params).toString();
  const path = qs ? `/exceptions?${qs}` : '/exceptions';
  return request(path);
}

export async function resolveException(id: number): Promise<{ message: string }> {
  return request(`/exceptions/${id}/resolve`, { method: 'PUT' });
}

export async function listUsers(): Promise<{ users: User[] }> {
  return request('/users');
}
