export interface User {
  id: number;
  username: string;
  role: string;
  name: string;
  role_name: string;
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface ConstantsResponse {
  roles: { items: ConstantOption[] };
  queues: { items: ConstantOption[] };
  statuses: { items: ConstantOption[] };
  warning_levels: { items: ConstantOption[] };
  stat_groups: { items: ConstantOption[] };
}

export interface ConstantOption {
  value: string;
  label: string;
}

export interface Application {
  id: number;
  application_no: string;
  company_name: string;
  contact_person: string;
  contact_phone: string;
  contact_email?: string;
  exhibition_type: string;
  booth_area?: number;
  booth_preference?: string;
  status: string;
  status_name: string;
  queue: string;
  queue_name: string;
  current_handler?: string;
  version: number;
  is_overdue: boolean;
  warning_level: string;
  warning_level_name: string;
  deadline?: string;
  submitted_at: string;
  last_updated_at: string;
  created_by: string;
  booth_confirmation_evidence?: string;
  sync_status: string;
}

export interface ProcessingRecord {
  id: number;
  application_id: number;
  action: string;
  from_status?: string;
  to_status?: string;
  handler: string;
  handler_name: string;
  handler_role: string;
  role_name: string;
  comment?: string;
  correction_reason?: string;
  reject_reason?: string;
  evidence_required?: string;
  previous_handler?: string;
  version?: number;
  created_at: string;
}

export interface Attachment {
  id: number;
  application_id: number;
  file_name: string;
  file_path: string;
  file_type?: string;
  file_size?: number;
  uploaded_by: string;
  uploaded_at: string;
}

export interface AuditNote {
  id: number;
  application_id: number;
  note: string;
  created_by: string;
  created_at: string;
}

export interface ApplicationDetailResponse {
  application: Application;
  processing_records: ProcessingRecord[];
  attachments: Attachment[];
  audit_notes: AuditNote[];
}

export interface ApplicationListResponse {
  items: Application[];
  total: number;
  page: number;
  page_size: number;
}

export interface ActionRequest {
  application_id: number;
  action: string;
  comment?: string;
  correction_reason?: string;
  reject_reason?: string;
  evidence_required?: string;
  booth_confirmation_evidence?: string;
  version: number;
}

export interface BatchActionRequest {
  action: string;
  application_ids: number[];
  comment?: string;
  correction_reason?: string;
  reject_reason?: string;
  evidence_required?: string;
  booth_confirmation_evidence?: string;
}

export interface BatchResultItem {
  application_id: number;
  application_no?: string;
  success: boolean;
  error_code?: string;
  error_message?: string;
}

export interface BatchActionResponse {
  batch_no: string;
  total_count: number;
  success_count: number;
  fail_count: number;
  results: BatchResultItem[];
}

export interface StatisticsResponse {
  pending: number;
  passed: number;
  synced: number;
  total: number;
  by_queue: Record<string, number>;
  by_warning: Record<string, number>;
}

export type WarningLevel = "normal" | "approaching" | "overdue";
export type ApplicationStatus =
  | "draft"
  | "pending_submit"
  | "pending_audit"
  | "pending_review"
  | "pending_booth_confirm"
  | "correction_required"
  | "rejected"
  | "audit_passed"
  | "booth_confirmed"
  | "archived"
  | "synced";

export type Role = "registrar" | "audit_supervisor" | "review_leader";
