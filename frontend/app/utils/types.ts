export type UserRole =
  | "duty_officer"
  | "maintenance_engineer"
  | "operations_manager";

export interface CurrentUser {
  user_id: string;
  role: UserRole;
  name: string;
  token: string;
}

export const ROLE_LABELS: Record<UserRole, string> = {
  duty_officer: "站点值班员",
  maintenance_engineer: "运维工程师",
  operations_manager: "运营经理",
};

export type InspectionStatus =
  | "pending_submit"
  | "pending_process"
  | "pending_review"
  | "completed"
  | "returned"
  | "resubmitted";

export const STATUS_LABELS: Record<InspectionStatus, string> = {
  pending_submit: "待提交",
  pending_process: "待处理",
  pending_review: "待复核",
  completed: "已完成",
  returned: "已退回",
  resubmitted: "重新提交",
};

export type ExpiryStatus = "normal" | "approaching" | "overdue";

export const EXPIRY_LABELS: Record<ExpiryStatus, string> = {
  normal: "正常",
  approaching: "临期",
  overdue: "逾期",
};

export const EXCEPTION_TYPE_LABELS: Record<string, string> = {
  material: "材料问题",
  permission: "权限问题",
  deadline: "时限问题",
  status: "状态问题",
};

export interface Attachment {
  id: string;
  inspection_id: string;
  file_name: string;
  file_path: string;
  uploaded_by: string;
  uploaded_by_name?: string | null;
  created_at: string;
}

export interface PreviousOpinion {
  operator_name?: string | null;
  operator_role?: string | null;
  opinion?: string | null;
  attachments: Attachment[];
  created_at?: string | null;
}

export interface ChargingPileInspection {
  id: string;
  pile_code: string;
  inspection_items?: string | null;
  result?: string | null;
  inspection_id?: string | null;
  created_by: string;
  created_at: string;
}

export interface FaultReport {
  id: string;
  equipment_code: string;
  description: string;
  severity: string;
  inspection_id?: string | null;
  created_by: string;
  created_at: string;
}

export interface ProcessingRecord {
  id: string;
  inspection_id: string;
  operator_id: string;
  operator_role: string;
  operator_name?: string | null;
  from_status: string;
  to_status: string;
  opinion?: string | null;
  version: number;
  created_at: string;
}

export interface AuditRemark {
  id: string;
  inspection_id: string;
  processing_record_id?: string | null;
  operator_id: string;
  operator_name?: string | null;
  from_status: string;
  to_status: string;
  remark?: string | null;
  created_at: string;
}

export interface CorrectionRecord {
  id: string;
  inspection_id: string;
  corrector_id: string;
  corrector_name?: string | null;
  reason: string;
  field: string;
  old_value?: string | null;
  new_value?: string | null;
  created_at: string;
}

export interface ExceptionReason {
  id: string;
  inspection_id: string;
  type: "material" | "permission" | "deadline" | "status";
  description: string;
  created_at: string;
}

export interface InspectionListItem {
  id: string;
  title: string;
  description?: string | null;
  status: InspectionStatus;
  creator_id: string;
  creator_name?: string | null;
  processor_id?: string | null;
  processor_name?: string | null;
  reviewer_id?: string | null;
  reviewer_name?: string | null;
  version: number;
  deadline: string;
  created_at: string;
  updated_at: string;
}

export interface Inspection {
  id: string;
  title: string;
  description?: string | null;
  status: InspectionStatus;
  creator_id: string;
  creator_name?: string | null;
  processor_id?: string | null;
  processor_name?: string | null;
  reviewer_id?: string | null;
  reviewer_name?: string | null;
  version: number;
  deadline: string;
  created_at: string;
  updated_at: string;
}

export interface InspectionDetail extends Inspection {
  previous_opinion?: PreviousOpinion | null;
  attachments: Attachment[];
  charging_pile_inspections: ChargingPileInspection[];
  fault_reports: FaultReport[];
  processing_records: ProcessingRecord[];
  audit_remarks: AuditRemark[];
  correction_records: CorrectionRecord[];
  exception_reasons: ExceptionReason[];
}

export interface InspectionCreate {
  title: string;
  description?: string | null;
  deadline: string;
  charging_pile_inspection_ids: string[];
  fault_report_ids: string[];
}

export interface InspectionSubmit {
  version: number;
}

export interface InspectionProcess {
  opinion: string;
  version: number;
}

export interface InspectionReview {
  opinion: string;
  action: "approve" | "reject";
  version: number;
}

export interface InspectionReturn {
  reason: string;
  version: number;
}

export interface InspectionCorrect {
  reason: string;
  field: string;
  new_value: string;
  version: number;
}

export interface BatchResult {
  inspection_id: string;
  success: boolean;
  reason?: string | null;
}

export interface BatchProcessRequest {
  inspection_ids: string[];
  action: "process" | "advance";
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

export interface InspectionStats {
  total: number;
  pending_submit: number;
  pending_process: number;
  pending_review: number;
  completed: number;
  returned: number;
  resubmitted: number;
}
