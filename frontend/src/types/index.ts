export type UserRole = 'reimbursement_clerk' | 'expense_accountant' | 'finance_manager';

export type ApplicationStatus =
  | 'pending_review'
  | 'verifying'
  | 'confirming'
  | 'exception'
  | 'completed'
  | 'rejected'
  | 'returned';

export type ProcessAction =
  | 'submit'
  | 'review'
  | 'verify'
  | 'confirm'
  | 'return'
  | 'reject'
  | 'exception'
  | 'rectify';

export type WarningLevel = 'normal' | 'near' | 'overdue';

export type StatusGroup = 'pending' | 'exception' | 'completed' | 'all';

export interface User {
  id: number;
  username: string;
  real_name: string;
  role: UserRole;
}

export interface Attachment {
  id: number;
  application_id: number;
  file_name: string;
  file_type: string;
  file_url: string;
  uploader_id: number;
  uploaded_at: string;
  evidence_type?: string;
}

export interface ProcessRecord {
  id: number;
  application_id: number;
  operator_id: number;
  operator_name: string;
  operator_role: UserRole;
  from_status?: ApplicationStatus | null;
  to_status?: ApplicationStatus;
  action: ProcessAction;
  comment?: string;
  evidence_snapshot?: any;
  version: number;
  created_at: string;
}

export interface ExceptionReason {
  id: number;
  application_id: number;
  process_record_id?: number;
  reason_code: string;
  reason_detail: string;
  handler_id?: number;
  handler_name?: string;
  resolved: boolean;
  resolved_at?: string;
  rectify_note?: string;
}

export interface AuditNote {
  id: number;
  application_id: number;
  note: string;
  operator_id: number;
  operator_name: string;
  created_at: string;
}

export interface Application {
  id: number;
  application_no: string;
  applicant_id: number;
  applicant_name: string;
  title: string;
  amount: number;
  type: string;
  status: ApplicationStatus;
  current_handler?: number;
  current_handler_role?: UserRole;
  handler_name?: string;
  due_date: string;
  version: number;
  created_at: string;
  updated_at: string;
  is_overdue: boolean;
  payment_evidence?: string;
  attachment_count?: number;
  unresolved_exception_count?: number;
  exception_summary?: string;
  allowed_actions?: ProcessAction[];
  attachments: Attachment[];
  process_records: ProcessRecord[];
  exceptions: ExceptionReason[];
  audit_notes: AuditNote[];
}

export interface ApplicationListParams {
  status?: ApplicationStatus;
  status_group?: StatusGroup;
  keyword?: string;
  page?: number;
  page_size?: number;
}

export interface StatisticsData {
  total: number;
  pending_review: number;
  verifying: number;
  confirming: number;
  exception: number;
  completed: number;
  rejected: number;
  returned: number;
  overdue: number;
  has_exception: number;
  pending_count: number;
  exception_count: number;
  completed_count: number;
}

export interface ApplicationListResponse {
  list: Application[];
  statistics: StatisticsData;
}

export interface ProcessPayload {
  action: ProcessAction;
  comment?: string;
  version?: number;
  reason_code?: string;
  reason_detail?: string;
  handler_id?: number;
  payment_evidence?: string;
  overdue_note?: string;
  evidence_snapshot?: any;
}

export interface BatchProcessItem {
  id: number;
  action: ProcessAction;
  comment?: string;
  version?: number;
  reason_code?: string;
  reason_detail?: string;
  payment_evidence?: string;
  overdue_note?: string;
}

export interface BatchProcessPayload {
  items: BatchProcessItem[];
}

export interface BatchResultItem {
  id: number;
  application_no: string;
  success: boolean;
  message: string;
  action: ProcessAction;
  to_status?: ApplicationStatus;
  new_version?: number;
  exception_summary?: string;
  rectify_note?: string;
}

export interface BatchProcessResponse {
  total: number;
  success_count: number;
  fail_count: number;
  results: BatchResultItem[];
}

export interface LoginPayload {
  username: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  user: User;
}

export interface AllowedActionsResponse {
  ids: number[];
  allowed_actions: ProcessAction[];
}

export type ReasonCode =
  | 'missing_evidence'
  | 'timeout'
  | 'state_conflict'
  | 'returned_rectify'
  | 'risky_amount';
