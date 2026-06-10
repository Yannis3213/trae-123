export type Role = 'ops_specialist' | 'warehouse_manager' | 'shop_owner';
export type OrderStage = 'listing' | 'inventory' | 'fulfillment';
export type OrderStatus = 'pending' | 'submitted' | 'returned' | 'approved' | 'completed';
export type WarningLevel = 'normal' | 'near_due' | 'overdue';

export interface User {
  id: string;
  username: string;
  name: string;
  role: Role;
  created_at: string;
  updated_at: string;
}

export interface CrossBorderOrder {
  id: string;
  order_no: string;
  shop_name: string;
  product_name: string;
  sku: string;
  quantity: number;
  amount: number;
  country: string;
  current_stage: OrderStage;
  current_status: OrderStatus;
  is_resubmitted: boolean;
  resubmit_count: number;
  current_handler_id: string;
  current_handler?: User;
  version: number;
  listing_due_at?: string;
  inventory_due_at?: string;
  fulfillment_due_at?: string;
  listing_data?: string;
  inventory_data?: string;
  fulfillment_data?: string;
  created_by_id: string;
  created_by?: User;
  created_at: string;
  updated_at: string;
}

export interface OrderWithWarning extends CrossBorderOrder {
  warning_level: WarningLevel;
  warning_text: string;
  attachment_count: number;
  stage_attach_count: number;
}

export interface OrderAttachment {
  id: string;
  order_id: string;
  stage: OrderStage;
  file_name: string;
  file_type: string;
  file_url: string;
  uploaded_by_id: string;
  uploaded_by?: User;
  created_at: string;
}

export interface ProcessingRecord {
  id: string;
  order_id: string;
  stage: OrderStage;
  action: string;
  from_status: OrderStatus;
  to_status: OrderStatus;
  operator_id: string;
  operator?: User;
  note?: string;
  attachment_ids?: string;
  is_exception: boolean;
  exception_reason?: string;
  client_ip?: string;
  created_at: string;
}

export interface AuditNote {
  id: string;
  order_id: string;
  stage: OrderStage;
  content: string;
  author_id: string;
  author?: User;
  created_at: string;
  updated_at: string;
}

export interface ExceptionLog {
  id: string;
  order_id: string;
  stage: OrderStage;
  exception_type: string;
  reason: string;
  operator_id: string;
  operator?: User;
  corrected_action?: string;
  is_resolved: boolean;
  created_at: string;
  resolved_at?: string;
}

export interface OrderStats {
  pending: number;
  returned: number;
  resubmitted: number;
}

export interface ListOrdersResponse {
  orders: OrderWithWarning[];
  stats: OrderStats;
}

export interface OrderDetailResponse {
  order: CrossBorderOrder;
  warning_level: WarningLevel;
  warning_text: string;
  attachments: OrderAttachment[];
  records: ProcessingRecord[];
  audit_notes: AuditNote[];
  exceptions: ExceptionLog[];
}

export interface BatchResultItem {
  order_id: string;
  order_no: string;
  success: boolean;
  message: string;
}

export interface BatchProcessResponse {
  success: boolean;
  total: number;
  success_count: number;
  failed_count: number;
  results: BatchResultItem[];
}

export interface Statistics {
  total: number;
  pending: number;
  submitted: number;
  returned: number;
  resubmitted: number;
  completed: number;
  listing_count: number;
  inventory_count: number;
  fulfillment_count: number;
  overdue_count: number;
  near_due_count: number;
}

declare const API_BASE_URL: string;
declare const FRONTEND_PORT: number;
declare const BACKEND_PORT: number;
