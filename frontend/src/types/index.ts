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

export interface DeadlineInfo {
  status: "normal" | "approaching" | "overdue";
  text: string;
  total_seconds: number;
  color: string;
}

export interface EvidenceItem {
  name: string;
  required: boolean;
  has_evidence: boolean;
  category: string;
}

export interface PendingCorrectionAction {
  reason: string;
  evidence_required?: string;
  deadline_hours?: number;
  returned_by?: string;
  returned_by_name?: string;
  returned_at?: string;
}

export interface OverdueException {
  id: number;
  application_id: number;
  application_no?: string;
  deadline: string;
  overdue_since: string;
  overdue_days: number;
  overdue_hours: number;
  responsible_person?: string;
  responsible_person_name?: string;
  responsible_person_role?: string;
  status_at_overdue?: string;
  queue_at_overdue?: string;
  correction_action_required?: string;
  handling_status: string;
  handled_by?: string;
  handled_at?: string;
  handling_result?: string;
  created_at: string;
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
  current_handler_name?: string;
  responsible_person?: string;
  responsible_person_name?: string;
  version: number;
  is_overdue: boolean;
  warning_level: string;
  warning_level_name: string;
  deadline?: string;
  deadline_info?: DeadlineInfo;
  evidence_checklist?: EvidenceItem[];
  pending_correction_actions?: PendingCorrectionAction[];
  last_error_code?: string;
  last_error_message?: string;
  overdue_exception?: OverdueException;
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
  action_name?: string;
  from_status?: string;
  from_status_name?: string;
  to_status?: string;
  to_status_name?: string;
  handler: string;
  handler_name: string;
  handler_role: string;
  role_name: string;
  comment?: string;
  correction_reason?: string;
  reject_reason?: string;
  evidence_required?: string;
  previous_handler?: string;
  previous_handler_name?: string;
  previous_handler_role?: string;
  previous_handler_role_name?: string;
  previous_result?: string;
  booth_confirmation_evidence?: string;
  correction_action?: string;
  error_code?: string;
  error_message?: string;
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
  correction_suggestion?: string;
  evidence_required?: string;
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
  by_responsible?: Record<string, number>;
  overdue_total?: number;
  approaching_total?: number;
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
