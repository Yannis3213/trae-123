export type UserRole = 'registrar' | 'supervisor' | 'reviewer';

export interface User {
  id: string;
  username: string;
  role: UserRole;
  role_label: string;
  display_name: string;
}

export type OrderStatus = 'pending' | 'transferred' | 'reviewed' | 'archived';

export interface UrgencyInfo {
  level: 'none' | 'normal' | 'warning' | 'overdue';
  label: string;
  remainingMs: number;
  minutesLeft?: number;
  hoursLeft?: number;
  overdueDays?: number;
}

export interface Order {
  id: string;
  order_no: string;
  guest_name: string;
  room_no: string | null;
  check_in_date: string;
  check_out_date: string | null;
  amount: number;
  order_type: string;
  status: OrderStatus;
  status_label: string;
  current_handler: string | null;
  current_handler_name?: string;
  handler_name?: string;
  current_role: UserRole | null;
  current_role_label?: string;
  deadline: string | null;
  deadline_urgency: UrgencyInfo;
  version: number;
  created_by: string;
  created_by_name?: string;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
  evidence_types: string[];
  evidence_labels: string[];
}

export interface Attachment {
  id: string;
  order_id: string;
  file_name: string;
  file_type: string;
  evidence_type: string;
  evidence_type_label: string;
  uploaded_by: string;
  uploaded_by_name: string;
  uploaded_at: string;
}

export interface ProcessingRecord {
  id: string;
  order_id: string;
  action: string;
  action_label: string;
  from_status: string | null;
  to_status: string | null;
  operator_id: string;
  operator_name: string;
  operator_role: string;
  handler_before: string | null;
  handler_after: string | null;
  deadline_before: string | null;
  deadline_after: string | null;
  evidence_required: string;
  evidence_provided: string;
  remark: string | null;
  version_before: number;
  version_after: number;
  created_at: string;
}

export interface AuditNote {
  id: string;
  order_id: string;
  note_type: 'normal' | 'correction' | 'exception';
  content: string;
  created_by: string;
  created_by_name: string;
  created_at: string;
}

export interface ExceptionReason {
  id: string;
  order_id: string;
  reason_code: string;
  reason_label: string;
  description: string;
  severity: 'low' | 'medium' | 'high';
  reported_by: string;
  reported_by_name: string;
  resolved: number;
  resolved_by: string | null;
  resolved_by_name: string | null;
  resolved_at: string | null;
  created_at: string;
}

export interface OrderPermission {
  can_transfer: boolean;
  can_return: boolean;
  can_correct: boolean;
  can_review: boolean;
  can_archive: boolean;
  can_view_subordinates: boolean;
}

export interface OrderSummary {
  id: string;
  order_no: string;
  status: OrderStatus;
  status_label: string;
  version: number;
  current_handler: string | null;
  current_role: UserRole | null;
  current_role_label: string | null;
  deadline: string | null;
  updated_at: string;
}

export interface OrderActionResult {
  order?: Order;
  order_summary?: OrderSummary;
  message: string;
  refresh_queue: boolean;
}

export interface OrderDetailResult {
  order: Order;
  attachments: Attachment[];
  processing_records: ProcessingRecord[];
  audit_notes: AuditNote[];
  exceptions: ExceptionReason[];
  subordinate_records: ProcessingRecord[];
  permission: OrderPermission;
}

export interface OrderListResult {
  list: Order[];
  total: number;
  page: number;
  page_size: number;
  stats?: OrderStats;
}

export interface OrderStats {
  all: { pending: number; transferred: number; reviewed: number; archived: number };
  mine: { pending: number; transferred: number; reviewed: number; my_to_handle: number };
  urgency: { overdue: number; warning: number };
}

export interface BatchResultItem {
  order_id: string;
  order_no?: string;
  success: boolean;
  code?: string;
  message: string;
  missing?: string[];
  actual_evidence?: string[];
  current_handler?: string;
  current_role?: string;
  current_role_label?: string;
  current_urgency?: string;
  order_summary?: OrderSummary;
}

export interface ApiResult<T = unknown> {
  ok: boolean;
  code?: string;
  message?: string;
  data?: T;
  missing?: string[];
}
