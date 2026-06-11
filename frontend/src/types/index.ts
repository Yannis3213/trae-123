export enum OrderStatus {
  PENDING_REVIEW = 'pending_review',
  PENDING_CORRECTION = 'pending_correction',
  UNDER_REVIEW = 'under_review',
  UNDER_APPROVAL = 'under_approval',
  COMPLETED = 'completed',
  OVERDUE = 'overdue',
}

export enum UserRole {
  REGISTRAR = 'registrar',
  REVIEWER = 'reviewer',
  APPROVER = 'approver',
}

export enum WarningLevel {
  NORMAL = 'normal',
  APPROACHING = 'approaching',
  OVERDUE = 'overdue',
}

export interface User {
  id: string;
  name: string;
  role: string;
  displayName: string;
}

export interface VenueOrder {
  id: string;
  orderNo: string;
  venueName: string;
  courtName: string;
  reservationDate: string;
  timeSlot: string;
  applicantName: string;
  applicantPhone: string;
  status: string;
  version: number;
  correctReason: string | null;
  returnOpinion: string | null;
  exceptionReason: string | null;
  paymentVerification: string | null;
  admissionConfirmation: string | null;
  responsibleNode: string | null;
  auditRemark: string | null;
  paymentAmount: number | null;
  paymentMethod: string | null;
  paymentStatus: string | null;
  admissionStatus: string | null;
  currentHandler: string;
  currentHandlerRole: string;
  deadline: string;
  warningLevel: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  processingRecords: ProcessingRecord[];
  attachments: Attachment[];
  auditLogs: AuditLog[];
}

export interface ProcessingRecord {
  id: string;
  orderId: string;
  action: string;
  operator: string;
  operatorRole: string;
  opinion: string | null;
  paymentVerification: string | null;
  admissionConfirmation: string | null;
  paymentAmount: number | null;
  paymentMethod: string | null;
  paymentStatus: string | null;
  admissionStatus: string | null;
  correctReason: string | null;
  returnOpinion: string | null;
  exceptionReason: string | null;
  responsibleNode: string | null;
  auditRemark: string | null;
  createdAt: string;
}

export interface Attachment {
  id: string;
  orderId: string;
  fileName: string;
  filePath: string;
  uploadedBy: string;
  uploadedAt: string;
}

export interface AuditLog {
  id: string;
  orderId: string;
  action: string;
  operator: string;
  operatorRole: string;
  detail: string | null;
  createdAt: string;
}

export interface BatchResult {
  orderId: string;
  orderNo: string;
  success: boolean;
  version?: number | null;
  reason?: string;
  paymentStatus?: string | null;
  admissionStatus?: string | null;
  exceptionReason?: string | null;
  responsibleNode?: string | null;
  paymentVerification?: string | null;
  admissionConfirmation?: string | null;
  paymentAmount?: number | null;
  paymentMethod?: string | null;
  auditRemark?: string | null;
  returnOpinion?: string | null;
  correctReason?: string | null;
}

export const ORDER_STATUS_LABELS: Record<string, string> = {
  pending_review: '待审核',
  pending_correction: '待补正',
  under_review: '审核中',
  under_approval: '复核中',
  completed: '办结',
  overdue: '逾期',
};

export const WARNING_LEVEL_LABELS: Record<string, string> = {
  normal: '正常',
  approaching: '临期',
  overdue: '逾期',
};

export const USER_ROLE_LABELS: Record<string, string> = {
  registrar: '场地登记员',
  reviewer: '审核主管',
  approver: '复核负责人',
};
