export interface SamplingTask {
  id: string;
  task_name: string;
  order_no: string;
  style_no: string | null;
  priority: string;
  status: string;
  current_handler: string;
  responsible_person: string;
  deadline: string;
  sample_confirmation_status: string | null;
  mass_production_evidence: string | null;
  has_mass_production_evidence: boolean;
  version: number;
  created_at: string;
  updated_at: string;
  created_by: string;
  last_updated_by: string;
  is_overdue: boolean;
  overdue_reason: string | null;
  return_reason: string | null;
  abnormal_tags: string | null;
}

export interface ProcessingRecord {
  id: string;
  task_id: string;
  action: string;
  from_status: string | null;
  to_status: string | null;
  operator_role: string;
  operator_name: string;
  handler_before: string | null;
  handler_after: string | null;
  opinion: string | null;
  result: string | null;
  created_at: string;
  version: number;
}

export interface AuditNote {
  id: string;
  task_id: string;
  note_content: string;
  operator_role: string;
  operator_name: string;
  created_at: string;
}

export interface AbnormalReason {
  id: string;
  task_id: string;
  reason_type: string;
  description: string;
  operator_role: string;
  operator_name: string;
  created_at: string;
}

export interface Attachment {
  id: string;
  task_id: string;
  file_name: string;
  file_type: string;
  file_size: number;
  file_url: string;
  uploaded_by: string;
  uploaded_at: string;
  evidence_type: string | null;
}

export interface TaskListResponse {
  tasks: SamplingTask[];
  total: number;
  page: number;
  page_size: number;
}

export interface TaskDetailResponse {
  task: SamplingTask;
  processing_records: ProcessingRecord[];
  audit_notes: AuditNote[];
  attachments: Attachment[];
  abnormal_reasons: AbnormalReason[];
}

export interface BatchResultItem {
  task_id: string;
  task_name?: string;
  success: boolean;
  message: string;
}

export interface ApiResponse<T> {
  code: number;
  message: string;
  data: T;
}

export type UserRole = 'sampling_registrar' | 'sampling_supervisor' | 'factory_reviewer';

export const ROLE_LABELS: Record<UserRole, string> = {
  sampling_registrar: '打样登记员',
  sampling_supervisor: '打样审核主管',
  factory_reviewer: '服装加工厂复核负责人',
};

export const STATUS_LABELS: Record<string, string> = {
  pending_assignment: '待分派',
  assigned: '已分派',
  pending_review: '待审核',
  reviewed: '已审核',
  pending_verification: '待复核',
  verified: '已复核',
  archived: '已归档',
  returned: '已退回',
  overdue: '已逾期',
  rectified: '已补正',
  transferred: '已转办',
  visited: '已回访',
};

export const STATUS_COLORS: Record<string, string> = {
  pending_assignment: '#faad14',
  assigned: '#1890ff',
  pending_review: '#722ed1',
  reviewed: '#13c2c2',
  pending_verification: '#eb2f96',
  verified: '#52c41a',
  archived: '#8c8c8c',
  returned: '#f5222d',
  overdue: '#ff4d4f',
  rectified: '#fa8c16',
  transferred: '#fa8c16',
  visited: '#2f54eb',
};

export const PRIORITY_LABELS: Record<string, string> = {
  high: '高',
  normal: '中',
  low: '低',
};

export const PRIORITY_COLORS: Record<string, string> = {
  high: '#f5222d',
  normal: '#faad14',
  low: '#52c41a',
};

export const OVERDUE_STATUS = {
  NORMAL: 'normal',
  WARNING: 'warning',
  OVERDUE: 'overdue',
};

export const OVERDUE_LABELS: Record<string, string> = {
  normal: '正常',
  warning: '临期',
  overdue: '逾期',
};

export const OVERDUE_COLORS: Record<string, string> = {
  normal: '#52c41a',
  warning: '#faad14',
  overdue: '#f5222d',
};
