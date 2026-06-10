export type Role = 'registrar' | 'supervisor' | 'manager';
export type WorkOrderStatus = 'draft' | 'pending_audit' | 'pending_review' | 'correction' | 'completed' | 'rejected';
export type WarningLevel = 'normal' | 'near_due' | 'overdue';

export interface User {
  id: number;
  username: string;
  name: string;
  role: Role;
  created_at: string;
}

export interface WorkOrder {
  id: number;
  order_no: string;
  appointment_clue: string;
  customer_name: string;
  phone: string;
  license_plate: string;
  car_model: string;
  mileage: number;
  fault_description: string;
  status: WorkOrderStatus;
  registrar_id: number;
  registrar_name: string;
  current_handler_id: number;
  current_handler_name: string;
  supervisor_id?: number;
  supervisor_name?: string;
  manager_id?: number;
  manager_name?: string;
  expected_complete_at: string;
  warning_level: WarningLevel;
  is_overdue: boolean;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface Attachment {
  id: number;
  work_order_id: number;
  file_name: string;
  file_type: string;
  file_size: number;
  file_path: string;
  uploaded_by: number;
  uploader: string;
  evidence_type: string;
  created_at: string;
}

export interface ProcessingLog {
  id: number;
  work_order_id: number;
  operator_id: number;
  operator: string;
  action: string;
  from_status: WorkOrderStatus;
  to_status: WorkOrderStatus;
  remark: string;
  created_at: string;
}

export interface AuditNote {
  id: number;
  work_order_id: number;
  operator_id: number;
  operator: string;
  note: string;
  created_at: string;
}

export interface WorkOrderDetail extends WorkOrder {
  attachments: Attachment[];
  processing_logs: ProcessingLog[];
  audit_notes: AuditNote[];
  exception_reason?: string;
}

export interface Statistics {
  total_count: number;
  pending_audit: number;
  pending_review: number;
  correction: number;
  completed: number;
  normal: number;
  near_due: number;
  overdue: number;
}

export interface BatchOperationRequest {
  ids: number[];
  action: string;
  audit_note?: string;
}

export interface BatchResultItem {
  id: number;
  success: boolean;
  message: string;
}

export interface BatchOperationResponse {
  total: number;
  success: number;
  failed: number;
  results: BatchResultItem[];
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  user: User;
}

export const STATUS_LABELS: Record<WorkOrderStatus, string> = {
  draft: '草稿',
  pending_audit: '待审核',
  pending_review: '复核中',
  correction: '待补正',
  completed: '办结',
  rejected: '已拒绝'
};

export const WARNING_LABELS: Record<WarningLevel, string> = {
  normal: '正常',
  near_due: '临期',
  overdue: '逾期'
};

export const WARNING_COLORS: Record<WarningLevel, string> = {
  normal: '#52c41a',
  near_due: '#faad14',
  overdue: '#ff4d4f'
};

export const ROLE_LABELS: Record<Role, string> = {
  registrar: '维修登记员',
  supervisor: '维修审核主管',
  manager: '复核负责人'
};

export const EVIDENCE_TYPES = [
  { value: 'registration_form', label: '工单登记表' },
  { value: 'vehicle_checklist', label: '车辆检测清单' },
  { value: 'inspection_report', label: '检测报告' },
  { value: 'repair_quote', label: '维修报价单' },
  { value: 'parts_confirmation', label: '配件确认单' },
  { value: 'final_inspection', label: '终检报告' },
  { value: 'delivery_note', label: '派修单' },
  { value: 'customer_confirmation', label: '客户确认单' }
];
