export type UserRole =
  | 'store_manager'
  | 'operations_supervisor'
  | 'headquarters_operations'
  | 'replenishment_registrar'
  | 'replenishment_auditor'
  | 'chain_review_lead';

export type ApplicationStatus =
  | 'draft'
  | 'pending_signature'
  | 'exception_returned'
  | 'signature_complete'
  | 'archived'
  | 'correction_pending';

export type Priority = 'low' | 'medium' | 'high' | 'urgent';

export interface User {
  id: string;
  username: string;
  display_name: string;
  role: UserRole;
  created_at: string;
}

export interface ReplenishmentApplication {
  id: string;
  application_no: string;
  store_id: string;
  store_name: string;
  title: string;
  description: string;
  status: ApplicationStatus;
  priority: Priority;
  responsible_person: string;
  current_handler: string;
  deadline: string;
  version: number;
  created_by: string;
  created_at: string;
  updated_at: string;
  exception_tags: string[];
  is_overdue: boolean;
  is_near_deadline: boolean;
}

export interface Attachment {
  id: string;
  application_id: string;
  file_name: string;
  file_type: string;
  uploaded_by: string;
  uploaded_at: string;
  is_evidence: boolean;
  file_content_base64?: string | null;
}

export interface ProcessingRecord {
  id: string;
  application_id: string;
  from_status: ApplicationStatus | null;
  to_status: ApplicationStatus;
  action: string;
  operator_id: string;
  operator_name: string;
  result: string | null;
  return_reason: string | null;
  processed_at: string;
}

export interface AuditNote {
  id: string;
  application_id: string;
  author_id: string;
  author_name: string;
  note: string;
  created_at: string;
}

export interface ExceptionLog {
  id: string;
  application_id: string;
  exception_type: string;
  description: string;
  operator_id: string | null;
  created_at: string;
}

export interface ApplicationDetail {
  application: ReplenishmentApplication;
  attachments: Attachment[];
  processing_records: ProcessingRecord[];
  audit_notes: AuditNote[];
  exception_logs: ExceptionLog[];
}

export interface ProcessRequest {
  application_id: string;
  action: string;
  result?: string | null;
  return_reason?: string | null;
  evidence_required?: string[];
  current_version: number;
}

export interface BatchProcessItem {
  application_id: string;
  action: string;
  result?: string | null;
  return_reason?: string | null;
  current_version: number;
}

export interface BatchProcessRequest {
  items: BatchProcessItem[];
}

export interface BatchResultItem {
  application_id: string;
  application_no: string;
  success: boolean;
  message: string;
}

export interface BatchProcessResponse {
  results: BatchResultItem[];
  total_success: number;
  total_failed: number;
}

export interface LoginRequest {
  username: string;
}

export interface LoginResponse {
  user: User;
  token: string;
}

export const ROLE_DISPLAY: Record<UserRole, string> = {
  store_manager: '店长',
  operations_supervisor: '营运督导',
  headquarters_operations: '总部运营',
  replenishment_registrar: '补货登记员',
  replenishment_auditor: '补货审核主管',
  chain_review_lead: '便利店连锁复核负责人',
};

export const STATUS_DISPLAY: Record<ApplicationStatus, string> = {
  draft: '草稿',
  pending_signature: '待签收',
  exception_returned: '异常回传',
  signature_complete: '签收完成',
  archived: '已归档',
  correction_pending: '待补正',
};

export const STATUS_COLOR: Record<ApplicationStatus, string> = {
  draft: '#6b7280',
  pending_signature: '#2563eb',
  exception_returned: '#dc2626',
  signature_complete: '#16a34a',
  archived: '#64748b',
  correction_pending: '#f59e0b',
};

export const PRIORITY_DISPLAY: Record<Priority, string> = {
  low: '低',
  medium: '中',
  high: '高',
  urgent: '紧急',
};

export const PRIORITY_COLOR: Record<Priority, string> = {
  low: '#6b7280',
  medium: '#3b82f6',
  high: '#f97316',
  urgent: '#dc2626',
};

export const ACTION_LABELS: Record<string, string> = {
  submit: '提交',
  sign: '签收',
  complete: '完成确认',
  return: '退回补正',
  correct: '补正提交',
  recheck: '复核通过',
  archive: '归档',
  '上传附件': '上传附件',
  创建: '创建',
};

export interface CreateApplicationRequest {
  store_id: string;
  store_name: string;
  title: string;
  description: string;
  priority: Priority;
  deadline: string;
}

export interface AttachmentUploadRequest {
  application_id: string;
  file_name: string;
  file_type: string;
  file_content_base64?: string;
}

export interface VisibleScope {
  can_create: boolean;
  can_process: boolean;
  can_view_all: boolean;
  allowed_actions: string[];
}
