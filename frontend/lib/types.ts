export type Role = 'shop_clerk' | 'pharmacist' | 'area_manager';

export type OrderStatus = 'pending_dispatch' | 'processing' | 'closed' | 'returned';

export type EvidenceType = 'inspection' | 'transfer' | 'removal';

export interface User {
  id: string;
  username: string;
  name: string;
  role: Role;
  store: string;
}

export interface NearExpiryOrder {
  id: string;
  order_no: string;
  store_name: string;
  product_name: string;
  batch_no: string;
  expiry_date: string;
  quantity: number;
  status: OrderStatus;
  current_handler: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  version: number;
  due_date: string;
  closed_at?: string | null;
}

export interface OrderListItem extends NearExpiryOrder {
  has_inspection: boolean;
  has_transfer: boolean;
  has_removal: boolean;
  missing_evidences: EvidenceType[];
  evidence_complete: boolean;
  is_overdue: boolean;
  is_near_due: boolean;
}

export interface Attachment {
  id: string;
  order_id: string;
  evidence_type: EvidenceType;
  file_name: string;
  uploaded_by: string;
  uploaded_at: string;
  remark: string;
}

export interface ProcessingRecord {
  id: string;
  order_id: string;
  action: string;
  from_status: OrderStatus;
  to_status: OrderStatus;
  operator: string;
  operator_role: Role;
  remark: string;
  created_at: string;
}

export interface AuditNote {
  id: string;
  order_id: string;
  content: string;
  author: string;
  created_at: string;
}

export interface ExceptionReason {
  id: string;
  order_id: string;
  reason: string;
  exception_type: string;
  reported_by: string;
  created_at: string;
  resolved: boolean;
}

export interface OrderDetail extends NearExpiryOrder {
  attachments: Attachment[];
  processing_records: ProcessingRecord[];
  audit_notes: AuditNote[];
  exception_reasons: ExceptionReason[];
  missing_evidences: EvidenceType[];
  is_overdue: boolean;
  is_near_due: boolean;
}

export interface BatchResult {
  order_id: string;
  order_no: string;
  success: boolean;
  message: string;
  new_version: number;
}

export interface Stats {
  total: number;
  pending_dispatch: number;
  processing: number;
  closed: number;
  returned: number;
  my_pending: number;
  overdue: number;
  near_due: number;
  normal: number;
}

export const statusLabels: Record<OrderStatus, string> = {
  pending_dispatch: '待派发',
  processing: '处理中',
  closed: '已关闭',
  returned: '已退回',
};

export const statusColors: Record<OrderStatus, string> = {
  pending_dispatch: 'bg-amber-100 text-amber-800',
  processing: 'bg-blue-100 text-blue-800',
  closed: 'bg-gray-100 text-gray-800',
  returned: 'bg-red-100 text-red-800',
};

export const roleLabels: Record<Role, string> = {
  shop_clerk: '门店店员',
  pharmacist: '执业药师',
  area_manager: '区域经理',
};

export const evidenceTypeLabels: Record<EvidenceType, string> = {
  inspection: '近效期巡检',
  transfer: '调拨申请',
  removal: '下架确认',
};
