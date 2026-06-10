export type UserRole = "duty_officer" | "maintenance_engineer" | "operations_manager";

export interface User {
  id: string;
  name: string;
  role: UserRole;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  user_id: string;
  role: UserRole;
  name: string;
  token: string;
}

export type InspectionStatus =
  | "pending_submit"
  | "pending_process"
  | "pending_review"
  | "completed"
  | "returned"
  | "resubmitted";

export interface Inspection {
  id: string;
  title: string;
  description: string | null;
  status: InspectionStatus;
  creator_id: string;
  processor_id: string | null;
  reviewer_id: string | null;
  version: number;
  deadline: string;
  created_at: string;
  updated_at: string;
  charging_pile_inspections: ChargingPileInspection[];
  fault_reports: FaultReport[];
  processing_records: ProcessingRecord[];
  audit_remarks: AuditRemark[];
  correction_records: CorrectionRecord[];
  exception_reasons: ExceptionReason[];
}

export interface InspectionListItem {
  id: string;
  title: string;
  description: string | null;
  status: InspectionStatus;
  creator_id: string;
  processor_id: string | null;
  reviewer_id: string | null;
  version: number;
  deadline: string;
  created_at: string;
  updated_at: string;
}

export interface InspectionStats {
  total: number;
  pending_submit: number;
  pending_process: number;
  pending_review: number;
  completed: number;
  returned: number;
  resubmitted: number;
}

export interface InspectionCreate {
  title: string;
  description?: string | null;
  deadline: string;
  charging_pile_inspection_ids: string[];
  fault_report_ids: string[];
}

export interface ChargingPileInspection {
  id: string;
  pile_code: string;
  inspection_items: string | null;
  result: string | null;
  inspection_id: string | null;
  created_by: string;
  created_at: string;
}

export interface ChargingPileInspectionCreate {
  pile_code: string;
  inspection_items?: string | null;
  result?: string | null;
}

export interface FaultReport {
  id: string;
  equipment_code: string;
  description: string;
  severity: string;
  inspection_id: string | null;
  created_by: string;
  created_at: string;
}

export interface FaultReportCreate {
  equipment_code: string;
  description: string;
  severity: string;
}

export interface ProcessingRecord {
  id: string;
  inspection_id: string;
  operator_id: string;
  operator_role: string;
  from_status: string;
  to_status: string;
  opinion: string | null;
  version: number;
  created_at: string;
}

export interface AuditRemark {
  id: string;
  inspection_id: string;
  processing_record_id: string | null;
  operator_id: string;
  from_status: string;
  to_status: string;
  remark: string | null;
  created_at: string;
}

export interface CorrectionRecord {
  id: string;
  inspection_id: string;
  corrector_id: string;
  reason: string;
  field: string;
  old_value: string | null;
  new_value: string | null;
  created_at: string;
}

export interface ExceptionReason {
  id: string;
  inspection_id: string;
  type: string;
  description: string;
  created_at: string;
}

export interface Attachment {
  id: string;
  inspection_id: string;
  file_name: string;
  file_path: string;
  uploaded_by: string;
  created_at: string;
}

export interface BatchResult {
  inspection_id: string;
  success: boolean;
  reason: string | null;
}

export interface BatchProcessRequest {
  inspection_ids: string[];
  action: string;
  opinion?: string | null;
}

export interface AuditTrailResponse {
  processing_records: ProcessingRecord[];
  audit_remarks: AuditRemark[];
  correction_records: CorrectionRecord[];
  exception_reasons: ExceptionReason[];
}

export interface ExpiryQueueResponse {
  normal: InspectionListItem[];
  approaching: InspectionListItem[];
  overdue: InspectionListItem[];
}

export interface PreviousOpinion {
  operator_id: string;
  operator_role: string;
  opinion: string | null;
  created_at: string;
  from_status: string;
  to_status: string;
}

export const STATUS_LABELS: Record<InspectionStatus, string> = {
  pending_submit: "待提交",
  pending_process: "待处理",
  pending_review: "待复核",
  completed: "已完成",
  returned: "已退回",
  resubmitted: "重新提交",
};

export const ROLE_LABELS: Record<UserRole, string> = {
  duty_officer: "站点值班员",
  maintenance_engineer: "运维工程师",
  operations_manager: "运营经理",
};
