export interface User {
	id: number;
	username: string;
	role: string;
	display_name: string;
}

export interface Application {
	id: number;
	order_no: string;
	product_name: string;
	product_count: number;
	expected_date: string;
	appointment_time: string;
	temperature_zone: string;
	status: string;
	current_step: string;
	creator_id: number;
	handler_id: number;
	version: number;
	correction_note: string;
	created_at: string;
	updated_at: string;
	creator_name?: string;
	handler_name?: string;
	expiry_group?: string;
}

export interface ProcessingRecord {
	id: number;
	application_id: number;
	operator_id: number;
	operator_name?: string;
	action: string;
	from_status: string;
	to_status: string;
	remark: string;
	created_at: string;
}

export interface AuditNote {
	id: number;
	application_id: number;
	operator_id: number;
	operator_name?: string;
	content: string;
	created_at: string;
}

export interface ExceptionReason {
	id: number;
	application_id: number;
	operator_id: number;
	operator_name?: string;
	reason_type: string;
	description: string;
	created_at: string;
}

export interface Attachment {
	id: number;
	application_id: number;
	file_name: string;
	file_type: string;
	uploaded_by: number;
	uploaded_by_name?: string;
	created_at: string;
}

export interface BatchResultItem {
	id: number;
	order_no: string;
	success: boolean;
	reason: string;
	error_code?: string;
}

export interface APIError {
	code: string;
	message: string;
}

export const STATUS_LABELS: Record<string, string> = {
	draft: '草稿',
	pending_temp: '待温控分配',
	pending_correction: '待补正',
	under_review: '复核中',
	completed: '办结'
};

export const STEP_LABELS: Record<string, string> = {
	appointment: '入库预约',
	allocation: '温区分配',
	confirmation: '上架确认'
};

export const TEMP_ZONE_LABELS: Record<string, string> = {
	frozen: '冷冻区',
	chilled: '冷藏区',
	constant: '恒温区'
};

export const ROLE_LABELS: Record<string, string> = {
	warehouse_clerk: '仓管员',
	temp_supervisor: '温控主管',
	warehouse_manager: '仓储经理'
};

export const EXPIRY_LABELS: Record<string, string> = {
	normal: '正常',
	near_expiry: '临期',
	overdue: '逾期'
};

export const STATUS_COLORS: Record<string, string> = {
	draft: '#9e9e9e',
	pending_temp: '#2196f3',
	pending_correction: '#ff9800',
	under_review: '#9c27b0',
	completed: '#4caf50'
};

export const EXPIRY_COLORS: Record<string, string> = {
	normal: '#4caf50',
	near_expiry: '#ff9800',
	overdue: '#f44336'
};
