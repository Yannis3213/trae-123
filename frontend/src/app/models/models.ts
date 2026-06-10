export type UserRole = 'checkin_agent' | 'baggage_supervisor' | 'station_manager';
export type RecordStatus = 'draft' | 'pending_review' | 'approved' | 'synced' | 'returned';
export type AttachmentType = 'checkin_evidence' | 'baggage_evidence' | 'exception_evidence';
export type ProcessAction = 'submit' | 'approve' | 'reject' | 'return' | 'confirm_sync' | 'correct';
export type WarningType = 'normal' | 'approaching' | 'overdue';

export interface User {
  id: number;
  username: string;
  role: UserRole;
  name: string;
  created_at: string;
}

export interface CheckinRecord {
  id: number;
  flight_no: string;
  passenger_name: string;
  passenger_id: string;
  seat_no: string;
  checkin_time: string;
  status: RecordStatus;
  version: number;
  deadline: string;
  created_by: number;
  current_handler_role: UserRole;
  return_reason: string;
  created_at: string;
  updated_at: string;
}

export interface Attachment {
  id: number;
  record_id: number;
  type: AttachmentType;
  file_name: string;
  file_path: string;
  uploaded_by: number;
  created_at: string;
}

export interface ProcessingRecord {
  id: number;
  record_id: number;
  handler_id: number;
  handler_role: UserRole;
  action: ProcessAction;
  comment: string;
  created_at: string;
}

export interface AuditNote {
  id: number;
  record_id: number;
  handler_id: number;
  note: string;
  created_at: string;
}

export interface ExceptionReason {
  id: number;
  record_id: number;
  reason_type: string;
  description: string;
  created_by: number;
  created_at: string;
}

export interface RecordDetail extends CheckinRecord {
  attachments: Attachment[];
  processing_records: ProcessingRecord[];
  audit_notes: AuditNote[];
  exception_reasons: ExceptionReason[];
  creator_name: string;
}

export interface BatchProcessResult {
  record_id: number;
  success: boolean;
  message: string;
}

export interface Statistics {
  status_counts: Record<string, number>;
  role_counts: Record<string, number>;
  warning_counts: Record<string, number>;
}

export const STATUS_LABELS: Record<RecordStatus, string> = {
  draft: '草稿',
  pending_review: '待审核',
  approved: '审核通过',
  synced: '已同步',
  returned: '退回补正',
};

export const STATUS_COLORS: Record<RecordStatus, string> = {
  draft: '#95a5a6',
  pending_review: '#e67e22',
  approved: '#3498db',
  synced: '#27ae60',
  returned: '#e74c3c',
};

export const ROLE_LABELS: Record<UserRole, string> = {
  checkin_agent: '值机员',
  baggage_supervisor: '行李主管',
  station_manager: '站点经理',
};

export const ACTION_LABELS: Record<ProcessAction, string> = {
  submit: '提交审核',
  approve: '审核通过',
  reject: '驳回',
  return: '退回补正',
  confirm_sync: '确认同步',
  correct: '补正提交',
};

export const WARNING_LABELS: Record<WarningType, string> = {
  normal: '正常',
  approaching: '临期',
  overdue: '逾期',
};

export const WARNING_COLORS: Record<WarningType, string> = {
  normal: '#27ae60',
  approaching: '#f39c12',
  overdue: '#e74c3c',
};

export const ATTACHMENT_TYPE_LABELS: Record<AttachmentType, string> = {
  checkin_evidence: '旅客值机证据',
  baggage_evidence: '行李托运证据',
  exception_evidence: '异常交接证据',
};
