export type UserRole = 'registrar' | 'supervisor' | 'reviewer' | 'director' | 'assistant' | 'lawyer';

export interface User {
  id: number;
  username: string;
  real_name: string;
  role: UserRole;
  department: string | null;
}

export interface LoginResponse {
  token: string;
  user: User;
}

export type CasePriority = 'low' | 'normal' | 'high' | 'urgent';
export type CaseStatus = 'draft' | 'pending_submit' | 'submitted' | 'returned' | 'resubmitted' | 'reviewing' | 'assigned' | 'followup' | 'completed' | 'archived';
export type CaseQueue = 'registration' | 'review' | 'assignment' | 'followup' | 'archive';
export type WarningStatus = 'normal' | 'approaching' | 'overdue';

export interface LegalCase {
  id: number;
  case_no: string;
  title: string;
  priority: CasePriority;
  status: CaseStatus;
  queue: CaseQueue;
  current_handler_id: number | null;
  current_handler_name?: string;
  deadline: string | null;
  version: number;
  created_by: number;
  created_by_name?: string;
  created_at: string;
  updated_at: string;
  warning_status?: WarningStatus;
}

export interface CaseRegistration {
  id: number;
  case_id: number;
  client_name: string | null;
  client_phone: string | null;
  client_id_card: string | null;
  consultation_type: string | null;
  consultation_content: string | null;
  evidence_provided: string | null;
  registration_remark: string | null;
  registered_by: number | null;
  registered_at: string | null;
  is_complete: number;
  created_at: string;
  updated_at: string;
}

export interface CaseAssignment {
  id: number;
  case_id: number;
  assistant_id: number | null;
  assistant_name?: string;
  lawyer_id: number | null;
  lawyer_name?: string;
  assignment_reason: string | null;
  assignment_remark: string | null;
  assigned_by: number | null;
  assigned_at: string | null;
  is_complete: number;
  created_at: string;
  updated_at: string;
}

export interface CaseFollowup {
  id: number;
  case_id: number;
  followup_result: string | null;
  client_satisfaction: string | null;
  followup_remark: string | null;
  followup_by: number | null;
  followup_at: string | null;
  is_complete: number;
  created_at: string;
  updated_at: string;
}

export interface CaseDetail extends LegalCase {
  registration: CaseRegistration | null;
  assignment: CaseAssignment | null;
  followup: CaseFollowup | null;
}

export interface Attachment {
  id: number;
  case_id: number;
  module: string;
  file_name: string;
  file_path: string;
  file_type: string | null;
  file_size: number | null;
  uploaded_by: number | null;
  created_at: string;
}

export interface ProcessingRecord {
  id: number;
  case_id: number;
  action: string;
  from_status: string | null;
  to_status: string | null;
  operator_id: number;
  operator_name?: string;
  remark: string | null;
  created_at: string;
}

export interface AuditNote {
  id: number;
  case_id: number;
  module: string | null;
  audit_type: string;
  content: string;
  operator_id: number | null;
  operator_name?: string;
  created_at: string;
}

export interface ExceptionReason {
  id: number;
  case_id: number;
  exception_type: string;
  reason: string;
  module: string | null;
  operator_id: number | null;
  operator_name?: string;
  created_at: string;
}

export interface CaseListRequest {
  page?: number;
  page_size?: number;
  handler_id?: number;
  priority?: CasePriority;
  status?: CaseStatus;
  deadline_from?: string;
  deadline_to?: string;
  keyword?: string;
  queue?: CaseQueue;
}

export interface CaseListResponse {
  list: LegalCase[];
  total: number;
  page: number;
  page_size: number;
}

export interface CaseActionRequest {
  action: string;
  remark?: string;
  version: number;
}

export interface BatchResult {
  case_id: number;
  case_no: string;
  success: boolean;
  message: string;
}

export interface BatchProcessRequest {
  case_ids: number[];
  action: string;
  remark?: string;
  versions: Record<number, number>;
}

export interface StatisticsData {
  total: number;
  draft: number;
  pending_submit: number;
  submitted: number;
  returned: number;
  reviewing: number;
  completed: number;
  normal: number;
  approaching: number;
  overdue: number;
}

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data?: T;
}
