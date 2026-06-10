import { get } from 'svelte/store';
import { userStore } from './stores';
import type { APIError } from './types';

const API_BASE = 'http://localhost:8004';

function getAuthHeaders(): Record<string, string> {
	const currentUser = get(userStore);
	if (!currentUser) return {};
	return {
		'X-User-ID': currentUser.id.toString(),
		'X-Role': currentUser.role
	};
}

async function apiCall<T>(path: string, options?: RequestInit): Promise<T> {
	const headers: Record<string, string> = {
		'Content-Type': 'application/json',
		...getAuthHeaders()
	};
	const res = await fetch(`${API_BASE}${path}`, {
		...options,
		headers: {
			...headers,
			...(options?.headers as Record<string, string> || {})
		}
	});
	if (!res.ok) {
		let err: APIError;
		try {
			err = await res.json();
		} catch {
			err = { code: 'UNKNOWN', message: `请求失败 (${res.status})` };
		}
		throw err;
	}
	return res.json();
}

export async function login(username: string, password: string) {
	const res = await apiCall<{ user: import('./types').User }>('/api/auth/login', {
		method: 'POST',
		body: JSON.stringify({ username, password })
	});
	return res.user;
}

export async function getCurrentUser() {
	const res = await apiCall<{ user: import('./types').User }>('/api/auth/me');
	return res.user;
}

export async function switchRole(role: string) {
	const res = await apiCall<{ user: import('./types').User }>('/api/auth/switch-role', {
		method: 'POST',
		body: JSON.stringify({ role })
	});
	return res.user;
}

export async function listApplications(params?: { status?: string; role?: string; expiry_group?: string; search?: string }) {
	const query = new URLSearchParams();
	if (params?.status) query.set('status', params.status);
	if (params?.role) query.set('role', params.role);
	if (params?.expiry_group) query.set('expiry_group', params.expiry_group);
	if (params?.search) query.set('search', params.search);
	const qs = query.toString();
	const res = await apiCall<{ applications: import('./types').Application[] }>(`/api/applications${qs ? '?' + qs : ''}`);
	return res.applications || [];
}

export async function createApplication(data: Partial<import('./types').Application>) {
	const res = await apiCall<{ application: import('./types').Application }>('/api/applications', {
		method: 'POST',
		body: JSON.stringify(data)
	});
	return res.application;
}

export async function getApplication(id: number) {
	const res = await apiCall<{ application: import('./types').Application }>(`/api/applications/${id}`);
	return res.application;
}

export async function updateApplication(id: number, data: Partial<import('./types').Application>) {
	const res = await apiCall<{ application: import('./types').Application }>(`/api/applications/${id}`, {
		method: 'PUT',
		body: JSON.stringify(data)
	});
	return res.application;
}

export async function submitApplication(id: number, version: number) {
	const res = await apiCall<{ application: import('./types').Application }>(`/api/applications/${id}/submit`, {
		method: 'POST',
		body: JSON.stringify({ version })
	});
	return res.application;
}

export async function allocateApplication(id: number, version: number, temperature_zone: string) {
	const res = await apiCall<{ application: import('./types').Application }>(`/api/applications/${id}/allocate`, {
		method: 'POST',
		body: JSON.stringify({ version, temperature_zone })
	});
	return res.application;
}

export async function confirmApplication(id: number, version: number) {
	const res = await apiCall<{ application: import('./types').Application }>(`/api/applications/${id}/confirm`, {
		method: 'POST',
		body: JSON.stringify({ version })
	});
	return res.application;
}

export async function returnApplication(id: number, version: number, correction_note: string) {
	const res = await apiCall<{ application: import('./types').Application }>(`/api/applications/${id}/return`, {
		method: 'POST',
		body: JSON.stringify({ version, correction_note })
	});
	return res.application;
}

export async function correctApplication(id: number, version: number) {
	const res = await apiCall<{ application: import('./types').Application }>(`/api/applications/${id}/correct`, {
		method: 'POST',
		body: JSON.stringify({ version })
	});
	return res.application;
}

export async function getRecords(id: number) {
	const res = await apiCall<{ records: import('./types').ProcessingRecord[] }>(`/api/applications/${id}/records`);
	return res.records || [];
}

export async function getAuditNotes(id: number) {
	const res = await apiCall<{ audit_notes: import('./types').AuditNote[] }>(`/api/applications/${id}/audit-notes`);
	return res.audit_notes || [];
}

export async function addAuditNote(id: number, content: string) {
	const res = await apiCall<{ audit_note: import('./types').AuditNote }>(`/api/applications/${id}/audit-notes`, {
		method: 'POST',
		body: JSON.stringify({ content })
	});
	return res.audit_note;
}

export async function getExceptions(id: number) {
	const res = await apiCall<{ exceptions: import('./types').ExceptionReason[] }>(`/api/applications/${id}/exceptions`);
	return res.exceptions || [];
}

export async function getAttachments(id: number) {
	const res = await apiCall<{ attachments: import('./types').Attachment[] }>(`/api/applications/${id}/attachments`);
	return res.attachments || [];
}

export async function addAttachment(id: number, file_name: string, file_type: string) {
	const res = await apiCall<{ attachment: import('./types').Attachment }>(`/api/applications/${id}/attachments`, {
		method: 'POST',
		body: JSON.stringify({ file_name, file_type })
	});
	return res.attachment;
}

export async function batchProcess(ids: number[], action: string, remark?: string, temperature_zone?: string) {
	const body: Record<string, any> = { ids, action };
	if (remark) body.remark = remark;
	if (temperature_zone) body.temperature_zone = temperature_zone;
	return apiCall<{ results: import('./types').BatchResultItem[] }>('/api/batch/process', {
		method: 'POST',
		body: JSON.stringify(body)
	});
}

export async function batchAdvanceOverdue(ids: number[]) {
	return apiCall<{ results: import('./types').BatchResultItem[] }>('/api/batch/advance-overdue', {
		method: 'POST',
		body: JSON.stringify({ ids })
	});
}

export async function getStatsSummary() {
	return apiCall<{
		by_status: Record<string, number>;
		by_expiry_group: Record<string, number>;
		total: number;
	}>('/api/stats/summary');
}

export async function getExpiryWarnings() {
	return apiCall<Record<string, any>>('/api/stats/expiry-warnings');
}
