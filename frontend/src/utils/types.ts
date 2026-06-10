export type UserRole = 'inspector' | 'engineer' | 'manager' | 'admin';

export interface User {
  id: number;
  username: string;
  role: UserRole;
  name: string;
  region?: string;
}

export interface Station {
  id: number;
  code: string;
  name: string;
  region: string;
  capacity_mw: number;
}

export type OrderStatus = 'pending_dispatch' | 'in_progress' | 'returned' | 'reviewing' | 'closed' | 'cancelled';
export type Priority = 'low' | 'medium' | 'high' | 'urgent';
export type OverdueLevel = 'normal' | 'near' | 'overdue';

export interface PatrolOrder {
  id: number;
  order_no: string;
  station_id: number;
  station_name?: string;
  status: OrderStatus;
  priority: Priority;
  inspector_id?: number;
  inspector_name?: string;
  engineer_id?: number;
  engineer_name?: string;
  manager_id?: number;
  manager_name?: string;
  current_handler: string;
  current_handler_name?: string;
  patrol_date: string;
  due_date: string;
  patrol_content?: string;
  weather?: string;
  temperature?: string;
  patrol_evidence?: string[];
  defect_count: number;
  previous_opinion?: string;
  previous_attachment?: string;
  audit_remark?: string;
  anomaly_reason?: string;
  is_overdue: number;
  overdue_level: OverdueLevel;
  created_at: string;
  updated_at: string;
}

export type DefectSeverity = 'minor' | 'major' | 'critical';
export type DefectStatus = 'reported' | 'in_progress' | 'resolved' | 'verified' | 'rejected';

export interface DefectReport {
  id: number;
  patrol_order_id: number;
  defect_no: string;
  location: string;
  description: string;
  severity: DefectSeverity;
  category: string;
  reported_at: string;
  deadline?: string;
  status: DefectStatus;
  reporter_id?: number;
  reporter_name?: string;
  assignee_id?: number;
  assignee_name?: string;
  evidence?: string[];
  anomaly_reason?: string;
}

export type AcceptanceResult = 'pass' | 'fail' | 'pending';

export interface AcceptanceRecord {
  id: number;
  defect_id: number;
  patrol_order_id: number;
  result: AcceptanceResult;
  evidence?: string[];
  remark?: string;
  acceptor_id?: number;
  acceptor_name?: string;
  accepted_at: string;
  anomaly_reason?: string;
}

export interface Attachment {
  id: number;
  patrol_order_id?: number;
  defect_id?: number;
  file_name: string;
  file_path: string;
  file_size: number;
  file_type: string;
  uploaded_by?: number;
  uploaded_by_name?: string;
  created_at: string;
}

export interface AuditTrail {
  id: number;
  patrol_order_id: number;
  action: string;
  from_status?: string;
  to_status?: string;
  actor_id: number;
  actor_role: string;
  actor_name?: string;
  remark?: string;
  anomaly_reason?: string;
  evidence?: string[];
  previous_opinion?: string;
  previous_attachment?: string;
  created_at: string;
}

export interface ProcessRecord {
  id: number;
  patrol_order_id: number;
  step_order: number;
  step_name: string;
  handler_id?: number;
  handler_name?: string;
  handler_role?: string;
  status: string;
  opinion?: string;
  evidence?: string[];
  started_at?: string;
  finished_at?: string;
  anomaly_reason?: string;
  correction_note?: string;
}

export interface BatchResultItem {
  order_no: string;
  success: boolean;
  message?: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export const ROLE_USERS: Record<UserRole, User[]> = {
  inspector: [
    { id: 2, username: 'inspector01', role: 'inspector', name: '张伟-巡检员', region: '华北区' },
    { id: 3, username: 'inspector02', role: 'inspector', name: '李娜-巡检员', region: '华东区' },
  ],
  engineer: [
    { id: 4, username: 'engineer01', role: 'engineer', name: '王强-运维工程师', region: '华北区' },
    { id: 5, username: 'engineer02', role: 'engineer', name: '赵敏-运维工程师', region: '华东区' },
  ],
  manager: [
    { id: 6, username: 'manager01', role: 'manager', name: '陈刚-区域负责人', region: '华北区' },
    { id: 7, username: 'manager02', role: 'manager', name: '刘洋-区域负责人', region: '华东区' },
  ],
  admin: [
    { id: 1, username: 'admin', role: 'admin', name: '系统管理员', region: '总部' },
    { id: 8, username: 'admin02', role: 'admin', name: '高级管理员', region: '总部' },
  ],
};

export const ROLE_LABELS: Record<UserRole, string> = {
  inspector: '巡检员',
  engineer: '工程师',
  manager: '区域负责人',
  admin: '管理员',
};

export const STATUS_LABELS: Record<OrderStatus, string> = {
  pending_dispatch: '待派发',
  in_progress: '处理中',
  returned: '已退回',
  reviewing: '复核中',
  closed: '已关闭',
  cancelled: '已取消',
};

export const STATUS_COLORS: Record<OrderStatus, string> = {
  pending_dispatch: 'bg-gray-100 text-gray-800',
  in_progress: 'bg-blue-100 text-blue-800',
  returned: 'bg-orange-100 text-orange-800',
  reviewing: 'bg-purple-100 text-purple-800',
  closed: 'bg-green-100 text-green-800',
  cancelled: 'bg-gray-100 text-gray-500',
};

export const OVERDUE_LABELS: Record<OverdueLevel, string> = {
  normal: '正常',
  near: '临期',
  overdue: '逾期',
};

export const OVERDUE_COLORS: Record<OverdueLevel, string> = {
  normal: 'text-green-600',
  near: 'text-yellow-600',
  overdue: 'text-red-600',
};

export const OVERDUE_BG_COLORS: Record<OverdueLevel, string> = {
  normal: 'bg-green-50',
  near: 'bg-yellow-50',
  overdue: 'bg-red-50',
};

export const PRIORITY_LABELS: Record<Priority, string> = {
  low: '低',
  medium: '中',
  high: '高',
  urgent: '紧急',
};

export const PRIORITY_COLORS: Record<Priority, string> = {
  low: 'bg-gray-100 text-gray-700',
  medium: 'bg-blue-100 text-blue-700',
  high: 'bg-orange-100 text-orange-700',
  urgent: 'bg-red-100 text-red-700',
};
