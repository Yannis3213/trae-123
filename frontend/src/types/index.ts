export type Status =
  | 'pending_submit'
  | 'pending_process'
  | 'processing'
  | 'pending_verify'
  | 'pending_review'
  | 'pending_archive'
  | 'archived'
  | 'returned'
  | 'resubmitted';

export type Role = 'enterprise_service' | 'engineering_supervisor' | 'park_manager';

export interface User {
  id: string;
  name: string;
  role: Role;
}

export interface Attachment {
  id: string;
  repair_id: string;
  file_name: string;
  file_path: string;
  file_size: number;
  uploaded_by: string;
  uploaded_at: string;
}

export interface AuditNote {
  id: string;
  repair_id: string;
  note_type: string;
  content: string;
  created_by: string;
  created_by_role: string;
  created_at: string;
}

export interface ExceptionReason {
  id: string;
  repair_id: string;
  exception_type: string;
  reason: string;
  detail: string;
  resolved: number;
  created_at: string;
  resolved_at: string | null;
}

export interface ProcessingRecord {
  id: string;
  repair_id: string;
  action: string;
  handler_id: string;
  handler_name: string;
  handler_role: string;
  from_status: string;
  to_status: string;
  opinion: string | null;
  created_at: string;
}

export interface RepairOrder {
  id: string;
  order_no: string;
  title: string;
  description: string;
  enterprise_name: string;
  contact_person: string;
  contact_phone: string;
  category: string;
  urgency: string;
  status: Status;
  current_handler_role: Role | '';
  current_handler_id: string;
  current_handler_name: string;
  created_by: string;
  created_by_role: Role;
  version: number;
  deadline: string;
  return_reason: string | null;
  return_opinion: string | null;
  correction_reason: string | null;
  last_handler_id: string | null;
  last_handler_result: string | null;
  created_at: string;
  updated_at: string;
  attachments?: Attachment[];
  processing_records?: ProcessingRecord[];
  audit_notes?: AuditNote[];
  exception_reasons?: ExceptionReason[];
  dispatch_status?: string;
  confirmation_status?: string;
  attachment_count?: number;
  processing_record_count?: number;
  category_label?: string;
}

export interface BatchResult {
  id: string;
  success: boolean;
  message: string;
}

export interface WarningGroup {
  normal: RepairOrder[];
  approaching: RepairOrder[];
  overdue: RepairOrder[];
}

export interface LedgerItem extends RepairOrder {
  attachment_count?: number;
  processing_record_count?: number;
}

export const STATUS_LABELS: Record<Status, string> = {
  pending_submit: '待提交',
  pending_process: '待受理',
  processing: '处理中',
  pending_verify: '待核验',
  pending_review: '待复核',
  pending_archive: '待归档',
  archived: '已归档',
  returned: '已退回',
  resubmitted: '已重新提交',
};

export const ROLE_LABELS: Record<Role, string> = {
  enterprise_service: '企业客服',
  engineering_supervisor: '工程主管',
  park_manager: '园区经理',
};

export const STATUS_COLORS: Record<Status, string> = {
  pending_submit: 'bg-gray-100 text-gray-700',
  pending_process: 'bg-blue-100 text-blue-700',
  processing: 'bg-blue-100 text-blue-700',
  pending_verify: 'bg-yellow-100 text-yellow-700',
  pending_review: 'bg-orange-100 text-orange-700',
  pending_archive: 'bg-purple-100 text-purple-700',
  archived: 'bg-green-100 text-green-700',
  returned: 'bg-red-100 text-red-700',
  resubmitted: 'bg-blue-100 text-blue-700',
};

export const CATEGORIES: Record<string, string> = {
  electrical: '电气',
  plumbing: '管道',
  hvac: '空调',
  elevator: '电梯',
  fire: '消防',
  decoration: '装修',
  other: '其他',
};

export const CATEGORY_OPTIONS = Object.entries(CATEGORIES).map(([value, label]) => ({ value, label }));

export const PRESET_USERS: User[] = [
  { id: 'u1', name: '企业客服张三', role: 'enterprise_service' },
  { id: 'u2', name: '工程主管李四', role: 'engineering_supervisor' },
  { id: 'u3', name: '园区经理王五', role: 'park_manager' },
];
