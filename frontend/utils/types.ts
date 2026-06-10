export type UserRole = "registrar" | "supervisor" | "reviewer";

export type PurchaseStatus = "pending_dispatch" | "processing" | "closed";

export type PriorityLevel = "low" | "medium" | "high" | "urgent";

export type WarningLevel = "normal" | "approaching" | "overdue";

export type AuditNoteType =
  | "系统记录"
  | "人工备注"
  | "补充说明"
  | "逾期预警"
  | "异常标记"
  | "退回补正"
  | "状态冲突"
  | "版本冲突"
  | "证据缺失"
  | "批量处理";

export interface User {
  id: number;
  username: string;
  full_name: string;
  role: UserRole;
  store: string | null;
  is_active: boolean;
  created_at: string;
}

export interface Token {
  access_token: string;
  token_type: string;
  user: User;
}

export interface Attachment {
  id: number;
  filename: string;
  file_type: string | null;
  category: string | null;
  uploader_id: number | null;
  uploaded_at: string;
  description: string | null;
}

export interface ProcessingRecord {
  id: number;
  order_id: number;
  action: string;
  from_status: string | null;
  to_status: string | null;
  handler_id: number | null;
  handler_name: string | null;
  handler_role: string | null;
  result: string | null;
  comment: string | null;
  exception_reason: string | null;
  exception_type: string | null;
  evidence_checked: string | null;
  timestamp: string;
}

export interface AuditNote {
  id: number;
  order_id: number;
  note: string;
  note_type: AuditNoteType | null;
  author_id: number | null;
  author_name: string | null;
  author_role: string | null;
  created_at: string;
}

export interface FreshPurchaseOrder {
  id: number;
  order_no: string;
  title: string;
  supplier_name: string;
  store: string;
  category: string | null;
  amount: string | null;
  priority: PriorityLevel;
  status: PurchaseStatus;
  warning_level: WarningLevel;
  deadline: string;
  creator_id: number;
  current_handler_id: number | null;
  creator: User | null;
  current_handler: User | null;
  supplier_quotation: string | null;
  purchase_order_content: string | null;
  arrival_verification: string | null;
  has_quotation_evidence: boolean;
  has_purchase_evidence: boolean;
  has_arrival_evidence: boolean;
  is_overdue: boolean;
  has_exception: boolean;
  exception_reason: string | null;
  reject_reason: string | null;
  exception_types: string[];
  version: number;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
  attachments: Attachment[];
  processing_records: ProcessingRecord[];
  audit_notes: AuditNote[];
}

export interface PurchaseOrderListResponse {
  total: number;
  items: FreshPurchaseOrder[];
  warning_counts: Record<string, number>;
}

export interface PurchaseOrderStats {
  total: number;
  pending_dispatch: number;
  processing: number;
  closed: number;
  overdue: number;
  exception: number;
  approaching_deadline: number;
}

export interface StatusTransitionRequest {
  target_status: PurchaseStatus;
  comment: string | null;
  audit_note: string | null;
  expected_version: number;
  action: string;
}

export interface BatchActionRequest {
  order_ids: number[];
  target_status: PurchaseStatus | null;
  comment: string | null;
  action: string;
  expected_versions: Record<string, number> | null;
}

export interface BatchActionResult {
  order_id: number;
  order_no: string;
  success: boolean;
  message: string;
  current_status: PurchaseStatus | null;
  exception_type: string | null;
}

export const EXCEPTION_TYPE_LABELS: Record<string, string> = {
  version_conflict: "版本冲突",
  already_closed: "单据已关闭",
  role_denied: "角色权限不足",
  handler_mismatch: "当前处理人不匹配",
  missing_quotation_evidence: "缺少供应商报价材料证据",
  missing_quotation_content: "供应商报价内容不完整",
  missing_purchase_evidence: "缺少采购下单证据",
  missing_arrival_evidence: "缺少到货验收证据",
  missing_purchase_content: "采购下单内容不完整",
  missing_arrival_content: "到货验收内容不完整",
  deadline_overdue: "已超过截止时间",
  state_conflict: "状态冲突",
};

export const EXCEPTION_TYPE_COLORS: Record<string, string> = {
  version_conflict: "#be123c",
  already_closed: "#6b7280",
  role_denied: "#ea580c",
  handler_mismatch: "#ea580c",
  missing_quotation_evidence: "#b91c1c",
  missing_quotation_content: "#b91c1c",
  missing_purchase_evidence: "#b91c1c",
  missing_arrival_evidence: "#b91c1c",
  missing_purchase_content: "#b91c1c",
  missing_arrival_content: "#b91c1c",
  deadline_overdue: "#dc2626",
  state_conflict: "#be123c",
};

export const STATUS_LABELS: Record<PurchaseStatus, string> = {
  pending_dispatch: "待派发",
  processing: "处理中",
  closed: "已关闭",
};

export const STATUS_COLORS: Record<PurchaseStatus, string> = {
  pending_dispatch: "#f59e0b",
  processing: "#3b82f6",
  closed: "#10b981",
};

export const PRIORITY_LABELS: Record<PriorityLevel, string> = {
  low: "低",
  medium: "中",
  high: "高",
  urgent: "紧急",
};

export const PRIORITY_COLORS: Record<PriorityLevel, string> = {
  low: "#6b7280",
  medium: "#3b82f6",
  high: "#f97316",
  urgent: "#ef4444",
};

export const WARNING_LABELS: Record<WarningLevel, string> = {
  normal: "正常",
  approaching: "临期",
  overdue: "逾期",
};

export const WARNING_COLORS: Record<WarningLevel, string> = {
  normal: "#10b981",
  approaching: "#f59e0b",
  overdue: "#ef4444",
};

export const ROLE_LABELS: Record<UserRole, string> = {
  registrar: "生鲜采购登记员",
  supervisor: "生鲜采购审核主管",
  reviewer: "生鲜超市复核负责人",
};

export const AUDIT_NOTE_TYPES: AuditNoteType[] = [
  "系统记录",
  "人工备注",
  "补充说明",
  "逾期预警",
  "异常标记",
  "退回补正",
  "状态冲突",
  "版本冲突",
  "证据缺失",
  "批量处理",
];

export const AUDIT_NOTE_TYPE_COLORS: Record<AuditNoteType, string> = {
  "系统记录": "#6b7280",
  "人工备注": "#4338ca",
  "补充说明": "#0891b2",
  "逾期预警": "#dc2626",
  "异常标记": "#ea580c",
  "退回补正": "#b45309",
  "状态冲突": "#be123c",
  "版本冲突": "#be123c",
  "证据缺失": "#b91c1c",
  "批量处理": "#7c3aed",
};
