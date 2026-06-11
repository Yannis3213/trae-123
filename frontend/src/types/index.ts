export type Role = 'dispatcher' | 'police_officer' | 'reviewer';

export type CaseStatus = 'pending_correction' | 'under_review' | 'completed';

export type ProcessingStage = 'registration' | 'dispatch' | 'review';

export type ExpiryStatus = 'normal' | 'nearing_expiry' | 'overdue';

export interface User {
  id: string;
  username: string;
  real_name: string;
  role: Role;
  created_at: string;
  updated_at: string;
}

export interface Case {
  id: string;
  case_number: string;
  title: string;
  description: string;
  case_type: string;
  location: string;
  reporter_name: string;
  reporter_phone: string;
  status: CaseStatus;
  current_stage: ProcessingStage;
  current_handler_id?: string;
  current_handler_name?: string;
  registration_materials_complete: boolean;
  dispatch_timeline_met: boolean;
  followup_evidence_complete: boolean;
  deadline: string;
  version: number;
  created_by: string;
  created_by_name: string;
  created_at: string;
  updated_at: string;
  completed_at?: string;
}

export interface Attachment {
  id: string;
  case_id: string;
  file_name: string;
  file_type: string;
  file_size: number;
  category: string;
  uploaded_by: string;
  uploaded_by_name: string;
  uploaded_at: string;
}

export interface ProcessingRecord {
  id: string;
  case_id: string;
  stage: ProcessingStage;
  action: string;
  from_status?: CaseStatus;
  to_status: CaseStatus;
  handler_id: string;
  handler_name: string;
  handler_role: Role;
  remarks: string;
  created_at: string;
}

export interface AuditNote {
  id: string;
  case_id: string;
  note: string;
  anomaly_reason?: string;
  noted_by: string;
  noted_by_name: string;
  noted_at: string;
}

export interface CaseWithDetail extends Case {
  expiry_status: ExpiryStatus;
  attachments: Attachment[];
  processing_records: ProcessingRecord[];
  audit_notes: AuditNote[];
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
}

export interface BatchProcessResult {
  case_id: string;
  case_number: string;
  success: boolean;
  message: string;
  error_details?: string[];
}

export interface StatisticsResponse {
  total_cases: number;
  pending_correction: number;
  under_review: number;
  completed: number;
  normal: number;
  nearing_expiry: number;
  overdue: number;
  by_stage_registration: number;
  by_stage_dispatch: number;
  by_stage_review: number;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  user: User;
}

export interface UpdateStatusRequest {
  case_id: string;
  to_status: CaseStatus;
  remarks: string;
  version: number;
  registration_materials_complete?: boolean;
  dispatch_timeline_met?: boolean;
  followup_evidence_complete?: boolean;
}

export interface CreateCaseRequest {
  title: string;
  description: string;
  case_type: string;
  location: string;
  reporter_name: string;
  reporter_phone: string;
  deadline: string;
}

export interface AddAttachmentRequest {
  case_id: string;
  file_name: string;
  file_type: string;
  file_size: number;
  category: string;
}

export interface AddAuditNoteRequest {
  case_id: string;
  note: string;
  anomaly_reason?: string;
}

export interface BatchProcessRequest {
  case_ids: string[];
  to_status: CaseStatus;
  remarks: string;
  version_map: Record<string, number>;
}

export const ROLE_DISPLAY: Record<Role, string> = {
  dispatcher: '警情处置登记员',
  police_officer: '警情处置审核主管',
  reviewer: '派出所复核负责人',
};

export const STATUS_DISPLAY: Record<CaseStatus, string> = {
  pending_correction: '待补正',
  under_review: '复核中',
  completed: '办结',
};

export const STAGE_DISPLAY: Record<ProcessingStage, string> = {
  registration: '警情登记',
  dispatch: '处置派警',
  review: '复核归档',
};

export const EXPIRY_DISPLAY: Record<ExpiryStatus, string> = {
  normal: '正常',
  nearing_expiry: '临期',
  overdue: '逾期',
};

export const STATUS_COLOR: Record<CaseStatus, string> = {
  pending_correction: 'orange',
  under_review: 'blue',
  completed: 'green',
};

export const EXPIRY_COLOR: Record<ExpiryStatus, string> = {
  normal: 'green',
  nearing_expiry: 'orange',
  overdue: 'red',
};
