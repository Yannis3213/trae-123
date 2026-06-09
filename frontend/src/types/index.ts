export type Role = 'doctor' | 'consultant' | 'dean';

export type PlanStatus =
  | 'pending_confirm'
  | 'confirmed'
  | 'exception'
  | 'pending_review'
  | 'reviewed'
  | 'archived';

export type DueStatus = 'normal' | 'approaching' | 'overdue';

export type AbnormalCategory = 'material' | 'permission' | 'timeline' | 'status';

export const RoleLabel: Record<Role, string> = {
  doctor: '口腔医生',
  consultant: '前台顾问',
  dean: '门店院长',
};

export const PlanStatusLabel: Record<PlanStatus, string> = {
  pending_confirm: '待确认',
  confirmed: '已确认',
  exception: '异常',
  pending_review: '待复查',
  reviewed: '已复查',
  archived: '已归档',
};

export const DueStatusLabel: Record<DueStatus, string> = {
  normal: '正常',
  approaching: '临期',
  overdue: '逾期',
};

export const AbnormalCategoryLabel: Record<AbnormalCategory, string> = {
  material: '材料异常',
  permission: '权限异常',
  timeline: '时限异常',
  status: '状态异常',
};

export interface User {
  id: string | number;
  username: string;
  name: string;
  role: Role;
  token: string;
}

export interface Patient {
  id: string | number;
  name: string;
  idCard: string;
  phone: string;
}

export interface Attachment {
  id: string | number;
  name?: string;
  filename?: string;
  url: string;
  uploadedAt: string;
  [key: string]: any;
}

export interface AbnormalReason {
  category: AbnormalCategory;
  reason: string;
  description?: string;
  resolved?: boolean;
  createdAt?: string;
}

export interface ProcessHistory {
  id: string | number;
  operator: string;
  action: string;
  fromStatus: PlanStatus | null;
  toStatus: PlanStatus;
  remark: string;
  evidence?: string;
  createdAt: string;
}

export interface AuditNote {
  id: string | number;
  author: string;
  note: string;
  createdAt: string;
}

export interface PatientProfile {
  patient: Patient;
  attachments: Attachment[];
}

export interface TreatmentPlan {
  content: string;
  attachments: Attachment[];
}

export interface FollowUpReminder {
  followUpDate: string;
  content: string;
  followUpContent?: string;
  complete?: boolean;
  attachments: Attachment[];
}

export interface TreatmentPlanItem {
  id: string | number;
  planNo: string;
  patientName: string;
  patientPhone: string;
  phone?: string;
  status: PlanStatus;
  currentHandler: string;
  createdAt: string;
  deadline: string;
  dueStatus: DueStatus;
  version: number;
}

export interface TreatmentPlanDetail extends TreatmentPlanItem {
  patient: Patient;
  patientProfile: PatientProfile;
  treatmentPlan: TreatmentPlan;
  followUpReminder: FollowUpReminder;
  abnormalReasons: AbnormalReason[];
  processHistory: ProcessHistory[];
  auditNotes: AuditNote[];
  currentHandlerUser?: { name: string };
  followUpDate?: string;
  followUpContent?: string;
}

export interface LoginRequest {
  role: Role;
  username: string;
  password: string;
}

export interface ApiResponse<T = unknown> {
  code: number;
  message: string;
  data: T;
}

export type ProcessAction = 'confirm' | 'mark_exception' | 'resolve_exception' | 'submit_review' | 'review' | 'archive';

export interface AttachmentInput {
  type: 'patient' | 'plan' | 'reminder';
  filename: string;
  url: string;
}

export interface ExceptionCauseInput {
  type: AbnormalCategory;
  description: string;
}

export interface ProcessRequest {
  planId: string | number;
  version: number;
  action: ProcessAction;
  remark: string;
  evidence?: string;
  attachments?: AttachmentInput[];
  exceptionCause?: ExceptionCauseInput;
  materialsComplete?: boolean;
  planComplete?: boolean;
  reminderComplete?: boolean;
}

export interface BatchProcessRequest {
  items: Array<{
    id: string | number;
    version: number;
    action: ProcessAction;
    remark?: string;
    evidence?: string;
    attachments?: AttachmentInput[];
    exceptionCause?: ExceptionCauseInput;
    materialsComplete?: boolean;
    planComplete?: boolean;
    reminderComplete?: boolean;
  }>;
}

export interface BatchProcessResult {
  planId: string;
  planNo: string;
  success: boolean;
  message: string;
}

export interface CorrectionRequest {
  planId: string | number;
  module: 'patient_profile' | 'treatment_plan' | 'follow_up_reminder' | 'patient' | 'plan' | 'reminder';
  version: number;
  data?: Record<string, unknown>;
  attachments?: AttachmentInput[];
  evidence?: string;
}

export interface StatisticsData {
  statusCounts: Record<PlanStatus, number>;
  dueStatusCounts: Record<DueStatus, number>;
  total?: number;
  deadlineWarning?: {
    normal: any[];
    approaching: any[];
    overdue: any[];
  };
}

export interface ListQueryParams {
  status?: PlanStatus;
  deadlineWarning?: DueStatus;
  search?: string;
}
