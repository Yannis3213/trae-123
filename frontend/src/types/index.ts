export type UserRole = 'registrar' | 'auditor' | 'reviewer';

export interface User {
  id: string;
  username: string;
  role: UserRole;
  display_name: string;
}

export type OrderStatus =
  | 'draft'
  | 'pending_audit'
  | 'pending_correction'
  | 'pending_review'
  | 'archived'
  | 'rejected';

export type EvidenceType = 'route_quote' | 'registration_confirm' | 'tour_audit';

export const EVIDENCE_LABELS: Record<EvidenceType, string> = {
  route_quote: '线路报价单',
  registration_confirm: '报名确认表',
  tour_audit: '出团审核表',
};

export const EVIDENCE_FIELD: Record<EvidenceType, 'route_quote_evidence' | 'registration_confirm_evidence' | 'tour_audit_evidence'> = {
  route_quote: 'route_quote_evidence',
  registration_confirm: 'registration_confirm_evidence',
  tour_audit: 'tour_audit_evidence',
};

export interface TourOrder {
  id: string;
  order_no: string;
  route_name: string;
  customer_name: string;
  customer_phone: string;
  traveler_count: number;
  departure_date: string;
  return_date: string;
  quoted_price: number;
  status: OrderStatus;
  current_handler_id: string | null;
  current_handler_name: string | null;
  version: number;
  is_overdue: boolean;
  deadline: string | null;
  exception_reason: string | null;
  correction_note: string | null;
  route_quote_evidence: boolean;
  registration_confirm_evidence: boolean;
  tour_audit_evidence: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface Attachment {
  id: string;
  order_id: string;
  file_name: string;
  file_type: string;
  file_size: number;
  evidence_type: string;
  uploaded_by: string;
  uploaded_by_name: string;
  created_at: string;
}

export interface ProcessingRecord {
  id: string;
  order_id: string;
  from_status: string | null;
  to_status: string;
  action: string;
  handler_id: string;
  handler_name: string;
  handler_role: string;
  note: string | null;
  exception_reason: string | null;
  created_at: string;
}

export interface AuditNote {
  id: string;
  order_id: string;
  content: string;
  created_by: string;
  created_by_name: string;
  created_at: string;
}

export interface DashboardStats {
  total_mine: number;
  to_audit: number;
  to_review: number;
  correction: number;
  archived: number;
  overdue: number;
  normal_queue: TourOrder[];
  overdue_queue: TourOrder[];
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  user: User;
}

export interface CreateOrderRequest {
  order_no?: string;
  route_name: string;
  customer_name: string;
  customer_phone: string;
  traveler_count: number;
  departure_date: string;
  return_date: string;
  quoted_price: number;
  deadline?: string | null;
  as_draft?: boolean;
  route_quote_evidence?: boolean;
  registration_confirm_evidence?: boolean;
  tour_audit_evidence?: boolean;
}

export interface UpdateOrderRequest {
  route_name?: string;
  customer_name?: string;
  customer_phone?: string;
  traveler_count?: number;
  departure_date?: string;
  return_date?: string;
  quoted_price?: number;
  deadline?: string | null;
  route_quote_evidence?: boolean;
  registration_confirm_evidence?: boolean;
  tour_audit_evidence?: boolean;
  version: number;
}

export interface ChangeStatusRequest {
  target_status: string;
  version: number;
  note?: string;
  exception_reason?: string;
  route_quote_evidence?: boolean;
  registration_confirm_evidence?: boolean;
  tour_audit_evidence?: boolean;
}

export interface BatchProcessRequest {
  order_ids: string[];
  target_status: string;
  note?: string;
  version_map?: Record<string, number>;
}

export interface BatchProcessResult {
  order_id: string;
  order_no: string;
  success: boolean;
  code: string;
  message: string;
  old_status?: OrderStatus | null;
  new_status?: OrderStatus | null;
  old_version?: number | null;
  new_version?: number | null;
  old_handler_name?: string | null;
  new_handler_name?: string | null;
  trace_saved?: boolean | null;
}

export const STATUS_LABELS: Record<OrderStatus, string> = {
  draft: '草稿',
  pending_audit: '待审核',
  pending_correction: '待补正',
  pending_review: '待复核',
  archived: '已归档',
  rejected: '已拒绝',
};

export const STATUS_BADGE: Record<OrderStatus, string> = {
  draft: 'badge-draft',
  pending_audit: 'badge-pending-audit',
  pending_correction: 'badge-pending-correction',
  pending_review: 'badge-pending-review',
  archived: 'badge-archived',
  rejected: 'badge-draft',
};

export const ROLE_LABELS: Record<UserRole, string> = {
  registrar: '旅游登记员',
  auditor: '旅游审核主管',
  reviewer: '旅行社复核负责人',
};

export const ROLE_VISIBLE_STATUSES: Record<UserRole, OrderStatus[]> = {
  registrar: ['draft', 'pending_correction'],
  auditor: ['pending_audit', 'pending_correction'],
  reviewer: ['pending_review', 'archived'],
};

export interface StatusAction {
  target: OrderStatus;
  label: string;
  disabled: boolean;
}
