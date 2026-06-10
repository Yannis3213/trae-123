export type Role = 'lease_clerk' | 'maintenance_coordinator' | 'store_manager';
export type ApplicationStatus = 'pending_verification' | 'verification_failed' | 'verification_complete';
export type SubModuleStatus = 'pending' | 'complete' | 'failed';
export type ExpiryStatus = 'normal' | 'expiring_soon' | 'overdue';

export interface Application {
  id: string;
  application_no: string;
  tenant_name: string;
  tenant_phone: string;
  room_number: string;
  building_name: string;
  lease_start_date: string;
  lease_end_date: string;
  monthly_rent: number;
  deposit: number;
  status: ApplicationStatus;
  current_handler_id: string;
  current_handler_name: string;
  current_handler_role: Role;
  version: number;
  tenant_signing_status: SubModuleStatus;
  room_confirmation_status: SubModuleStatus;
  move_in_handover_status: SubModuleStatus;
  expiry_status: ExpiryStatus;
  overdue_days: number;
  exception_reason: string;
  created_at: string;
  updated_at: string;
  attachments?: Attachment[];
  processing_records?: ProcessingRecord[];
}

export interface Attachment {
  id: string;
  application_id: string;
  file_name: string;
  file_type: string;
  file_path: string;
  uploaded_by: string;
  upload_role: string;
  created_at: string;
}

export interface ProcessingRecord {
  id: string;
  application_id: string;
  handler_id: string;
  handler_name: string;
  handler_role: Role;
  action: string;
  from_status: string;
  to_status: string;
  remark: string;
  exception_reason: string;
  created_at: string;
}

export interface AuditLog {
  id: string;
  application_id: string;
  operator_id: string;
  operator_name: string;
  operator_role: Role;
  action: string;
  before_status: string;
  after_status: string;
  detail: string;
  failure_reason: string;
  created_at: string;
}

export interface BatchResult {
  application_id: string;
  application_no: string;
  success: boolean;
  reason: string;
}

export interface Statistics {
  total: number;
  pending_verification: number;
  verification_failed: number;
  verification_complete: number;
  overdue_count: number;
  expiring_soon_count: number;
  normal_count: number;
}

export interface PaginatedResponse<T> {
  list: T[];
  total: number;
  page: number;
  page_size: number;
}

export interface ApiResponse<T> {
  code: number;
  data: T;
  message?: string;
}
