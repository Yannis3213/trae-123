export type DeadlineStatus = 'normal' | 'approaching' | 'overdue';
export type AppointmentStatus = 'draft' | 'pending_review' | 'archived';
export type UserRole = 'beautician' | 'consultant' | 'store_manager';

export interface CardEvidenceSummary {
  has_customer_appointment: boolean;
  has_project_confirmation: boolean;
  has_service_followup: boolean;
  customer_appointment_count: number;
  project_confirmation_count: number;
  service_followup_count: number;
}

export interface AppointmentListItem {
  id: string;
  order_no: string;
  customer_name: string;
  service_item: string;
  status: AppointmentStatus;
  status_label: string;
  current_handler: string;
  current_handler_role: string;
  deadline: string;
  deadline_status: DeadlineStatus;
  exception_type?: string | null;
  exception_type_label?: string | null;
  beautician: string;
  consultant: string;
  version: number;
  evidence_summary: CardEvidenceSummary;
}

export interface Attachment {
  id: string;
  appointment_id: string;
  evidence_type: string;
  file_name: string;
  file_url: string;
  uploaded_by: string;
  uploaded_at: string;
}

export interface AuditTrail {
  id: string;
  appointment_id: string;
  action: string;
  action_label: string;
  from_status?: string | null;
  to_status?: string | null;
  from_version?: number | null;
  to_version?: number | null;
  operator: string;
  operator_role: string;
  operator_role_label: string;
  remark?: string | null;
  created_at: string;
}

export interface ProcessingRecord {
  id: string;
  appointment_id: string;
  action: string;
  handler: string;
  handler_role: string;
  detail?: string | null;
  exception_reason?: string | null;
  correction_note?: string | null;
  from_version?: number | null;
  to_version?: number | null;
  batch_fail_reason?: string | null;
  audit_remark?: string | null;
  created_at: string;
}

export interface EvidenceSummary {
  customer_appointment: Attachment[];
  project_confirmation: Attachment[];
  service_followup: Attachment[];
}

export interface Appointment {
  id: string;
  order_no: string;
  customer_name: string;
  customer_phone: string;
  service_item: string;
  beautician: string;
  consultant: string;
  store_manager: string;
  status: AppointmentStatus;
  current_handler: string;
  current_handler_role: string;
  appointment_time: string;
  deadline: string;
  exception_type?: string | null;
  exception_reason?: string | null;
  correction_note?: string | null;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface AppointmentDetail {
  appointment: Appointment;
  attachments: Attachment[];
  audit_trails: AuditTrail[];
  processing_records: ProcessingRecord[];
  evidence_summary: EvidenceSummary;
  deadline_status: DeadlineStatus;
  status_label: string;
  exception_type_label?: string | null;
}

export interface AppointmentStats {
  total: number;
  normal_count: number;
  approaching_count: number;
  overdue_count: number;
  draft_count: number;
  pending_review_count: number;
  archived_count: number;
}

export interface AppointmentsResponse {
  normal: AppointmentListItem[];
  approaching: AppointmentListItem[];
  overdue: AppointmentListItem[];
  stats: AppointmentStats;
}

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data?: T | null;
}

export interface UserInfo {
  role: UserRole;
  role_label: string;
  username: string;
}

export interface ProcessAppointmentRequest {
  action: string;
  remark?: string | null;
  exception_type?: string | null;
  exception_reason?: string | null;
  correction_note?: string | null;
  version: number;
  evidence_required: string[];
  attachments: AttachmentInput[];
}

export interface AttachmentInput {
  evidence_type: string;
  file_name: string;
  file_url: string;
}

export interface BatchProcessRequest {
  appointment_ids: string[];
  action: string;
  remark?: string | null;
  version_map?: Record<string, number>;
  exception_type?: string | null;
  exception_reason?: string | null;
  correction_note?: string | null;
  attachments?: AttachmentInput[];
}

export interface BatchResultItem {
  appointment_id: string;
  order_no: string;
  success: boolean;
  message: string;
}

export interface BatchProcessResponse {
  total: number;
  success_count: number;
  fail_count: number;
  results: BatchResultItem[];
}
