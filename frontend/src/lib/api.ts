import type {
	ApiResponse,
	Inspection,
	InspectionDetail,
	CreateInspectionRequest,
	ProcessRequest,
	BatchProcessRequest,
	BatchResult,
	AuditRecord,
	Attachment,
	Stats,
	Pagination,
	OverdueItem
} from './types';

const baseUrl = 'http://localhost:8002';

async function request<T>(path: string, options?: RequestInit): Promise<ApiResponse<T>> {
	const res = await fetch(`${baseUrl}${path}`, {
		headers: { 'Content-Type': 'application/json' },
		...options
	});
	if (!res.ok) {
		try {
			const body = await res.json();
			throw new Error(body.message || res.statusText);
		} catch {
			throw new Error(res.statusText || '请求失败');
		}
	}
	return res.json();
}

export async function fetchInspections(params: {
	status?: string;
	pond_id?: string;
	date_from?: string;
	date_to?: string;
	role?: string;
	overdue_type?: string;
	page?: number;
	page_size?: number;
}): Promise<ApiResponse<{ items: Inspection[]; pagination: Pagination }>> {
	const sp = new URLSearchParams();
	Object.entries(params).forEach(([k, v]) => {
		if (v !== undefined && v !== '') sp.set(k, String(v));
	});
	return request(`/api/inspections?${sp.toString()}`);
}

export async function fetchInspectionDetail(id: string): Promise<ApiResponse<InspectionDetail>> {
	return request(`/api/inspections/${id}`);
}

export async function createInspection(data: CreateInspectionRequest): Promise<ApiResponse<Inspection>> {
	return request('/api/inspections', {
		method: 'POST',
		body: JSON.stringify(data)
	});
}

export async function processInspection(id: string, data: ProcessRequest): Promise<ApiResponse<Inspection>> {
	return request(`/api/inspections/${id}/process`, {
		method: 'PUT',
		body: JSON.stringify(data)
	});
}

export async function batchProcess(data: BatchProcessRequest): Promise<ApiResponse<BatchResult[]>> {
	return request('/api/inspections/batch-process', {
		method: 'POST',
		body: JSON.stringify(data)
	});
}

export async function fetchAuditTrail(id: string): Promise<ApiResponse<AuditRecord[]>> {
	return request(`/api/inspections/${id}/audit-trail`);
}

export async function uploadAttachment(id: string, filename: string, fileType: string, fileSize: number, uploadedBy: string): Promise<ApiResponse<Attachment>> {
	return request(`/api/inspections/${id}/attachments`, {
		method: 'POST',
		body: JSON.stringify({ filename, file_type: fileType, file_size: fileSize, uploaded_by: uploadedBy })
	});
}

export async function fetchStats(role?: string): Promise<ApiResponse<Stats>> {
	const sp = role ? `?role=${role}` : '';
	return request(`/api/stats${sp}`);
}

export async function fetchOverdueQueue(params?: {
	role?: string;
	overdue_type?: string;
}): Promise<ApiResponse<OverdueItem[]>> {
	const sp = new URLSearchParams();
	if (params) {
		Object.entries(params).forEach(([k, v]) => {
			if (v !== undefined && v !== '') sp.set(k, String(v));
		});
	}
	const qs = sp.toString();
	return request(`/api/overdue-queue${qs ? '?' + qs : ''}`);
}
