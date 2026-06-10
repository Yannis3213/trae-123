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
  current_handler: string | null;
  version: number;
  is_overdue: boolean;
  deadline: string | null;
  exception_reason: string | null;
  correction_note: string | null;
  route_quote_evidence: boolean | null;
  registration_confirm_evidence: boolean | null;
  tour_audit_evidence: boolean | null;
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
  created_at: string;
}

export interface DashboardStats {
  draft_count: number;
  pending_audit_count: number;
  pending_correction_count: number;
  pending_review_count: number;
  archived_count: number;
  overdue_count: number;
  warning_count: number;
  normal_count: number;
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
  success: boolean;
  message: string;
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
