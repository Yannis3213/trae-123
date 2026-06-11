export type Role = 'pond_admin' | 'quality_engineer' | 'base_director';
export type Status = 'pending_review' | 'under_review' | 'approved' | 'pending_correction' | 'synced';
export type OverdueType = 'normal' | 'approaching' | 'overdue';
export type Action = 'submit' | 'approve' | 'reject' | 'correct' | 'confirm_sync';

export interface Inspection {
	id: string;
	pond_id: string;
	pond_name: string;
	inspector: string;
	inspector_role: string;
	status: Status;
	current_handler: string;
	current_handler_role: string;
	deadline: string;
	version: number;
	created_at: string;
	updated_at: string;
}

export interface InspectionDetail {
	inspection: Inspection;
	indicators: TestIndicator[];
	attachments: Attachment[];
	audit_trail: AuditRecord[];
	exception_reasons: ExceptionReason[];
	process_flow: ProcessNode[];
	overdue_type: OverdueType;
}

export interface TestIndicator {
	id: string;
	inspection_id: string;
	name: string;
	value: string;
	unit: string;
	standard: string;
	is_qualified: boolean;
}

export interface Attachment {
	id: string;
	inspection_id: string;
	filename: string;
	file_type: string;
	file_size: number;
	uploaded_by: string;
	uploaded_at: string;
}

export interface AuditRecord {
	id: string;
	inspection_id: string;
	action: string;
	operator: string;
	operator_role: string;
	comment: string | null;
	created_at: string;
}

export interface ExceptionReason {
	id: string;
	inspection_id: string;
	audit_record_id: string;
	reason: string;
	created_at: string;
}

export interface ProcessNode {
	step: number;
	title: string;
	role: string;
	operator: string | null;
	status: string;
	time: string | null;
}

export interface CreateInspectionRequest {
	pond_id: string;
	pond_name: string;
	inspector: string;
	inspector_role: string;
	deadline: string;
	indicators: { name: string; value: string; unit: string; standard: string; is_qualified: boolean }[];
	attachments: { filename: string; file_type: string; file_size: number }[];
}

export interface ProcessRequest {
	action: Action;
	operator: string;
	operator_role: string;
	comment?: string;
	exception_reason?: string;
	version: number;
	attachments?: { filename: string; file_type: string; file_size: number }[];
}

export interface BatchProcessRequest {
	action: Action;
	operator: string;
	operator_role: string;
	comment?: string;
	exception_reason?: string;
	items: { id: string; version: number }[];
}

export interface BatchResult {
	id: string;
	success: boolean;
	message?: string;
}

export interface ApiResponse<T> {
	code: number;
	message: string;
	data: T;
}

export interface Pagination {
	page: number;
	page_size: number;
	total: number;
	total_pages: number;
}

export interface Stats {
	total: number;
	pending_review: number;
	under_review: number;
	approved: number;
	pending_correction: number;
	synced: number;
	overdue: number;
	approaching: number;
}

export interface OverdueItem {
	inspection: Inspection;
	overdue_type: OverdueType;
}
