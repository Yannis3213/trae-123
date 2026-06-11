export interface User {
  username: string;
  name: string;
  role: string;
  roleName: string;
}

export interface LoanApplication {
  id: number;
  application_no: string;
  applicant_name: string;
  id_card: string;
  phone: string;
  amount: number;
  purpose: string;
  term_months: number;
  status: string;
  statusName: string;
  current_node: string;
  nodeName: string;
  current_handler: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  version: number;
  verification_due_date: string;
  due_date: string;
  remark: string;
  dueStatus: string;
  attachments?: Attachment[];
  records?: ProcessingRecord[];
  auditNotes?: AuditNote[];
  exceptions?: ExceptionReason[];
  evidenceSummary?: any;
}

export interface Attachment {
  id: number;
  loan_application_id: number;
  attach_type: string;
  attach_name: string;
  file_path: string | null;
  is_required: number;
  node: string;
  uploaded_by: string;
  uploaded_at: string;
}

export interface ProcessingRecord {
  id: number;
  loan_application_id: number;
  action: string;
  from_status: string | null;
  to_status: string;
  handler: string;
  handler_role: string;
  node: string;
  remark: string | null;
  created_at: string;
}

export interface AuditNote {
  id: number;
  loan_application_id: number;
  note: string;
  created_by: string;
  created_at: string;
}

export interface ExceptionReason {
  id: number;
  loan_application_id: number;
  exception_type: string;
  reason: string;
  detail: string | null;
  detected_by: string;
  detected_at: string;
  resolved_at: string | null;
  resolution: string | null;
}

export interface BatchResult {
  total: number;
  successCount: number;
  failCount: number;
  results: BatchItem[];
}

export interface BatchItem {
  id: number;
  success: boolean;
  status?: string;
  reason?: string;
}

export interface Stats {
  byStatus: { [key: string]: number };
  byDue: { normal: number; approaching: number; overdue: number };
  total: number;
}
