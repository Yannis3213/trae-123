export type ExpiryStatus = "normal" | "approaching" | "overdue";

export type PlanStatus =
  | "draft"
  | "pending_review"
  | "reviewing"
  | "pending_approval"
  | "approving"
  | "archived"
  | "returned";

export type Role = "dispatcher" | "route_supervisor" | "ops_center";

export type AuditAction =
  | "created"
  | "submitted"
  | "reviewing"
  | "approved"
  | "rejected"
  | "corrected"
  | "archived";

export type NoteType = "pending_sign" | "exception_return" | "sign_complete";

export type AttachmentCategory = "vehicle_schedule" | "driver_checkin" | "dispatch_confirm" | "other";

export interface ExceptionReason {
  id: string;
  planId: string;
  recordId?: string;
  reasonCode: string;
  reasonDetail: string;
  responsibleRole: Role;
  responsibleUserId: string;
  action: string;
  status: string;
  createdAt: string;
}

export interface DispatchPlan {
  id: string;
  planNumber: string;
  routeName: string;
  planDate: string;
  vehicleId: string;
  driverId: string;
  status: PlanStatus;
  expiryStatus?: ExpiryStatus;
  dueDate: string;
  version: number;
  createdBy: string;
  currentHandler: string;
  currentRole: Role;
  notes: string;
  createdAt: string;
  updatedAt: string;
  attachments?: Attachment[];
  processingRecords?: ProcessingRecord[];
  auditNotes?: AuditNote[];
  exceptionReasons?: ExceptionReason[];
}

export interface Attachment {
  id: string;
  planId: string;
  fileType: AttachmentCategory;
  fileName: string;
  uploadedBy: string;
  uploadedAt: string;
}

export interface ProcessingRecord {
  id: string;
  planId: string;
  action: AuditAction;
  handlerId: string;
  handlerRole: Role;
  comment: string | null;
  version: number;
  createdAt: string;
}

export interface AuditNote {
  id: string;
  planId: string;
  noteType: NoteType;
  content: string;
  createdBy: string;
  createdAt: string;
}

export interface User {
  id: string;
  username: string;
  password: string;
  displayName: string;
  role: Role;
}
