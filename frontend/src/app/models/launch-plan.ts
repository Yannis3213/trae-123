export interface LaunchPlan {
  id: string;
  plan_no: string;
  customer_name: string;
  project_name: string;
  priority: 'urgent' | 'high' | 'medium' | 'low';
  priority_name: string;
  deadline: string;
  status: 'draft' | 'pending_review' | 'archived';
  status_name: string;
  owner: string;
  current_handler: string;
  launch_target: string;
  config_checklist: string;
  acceptance_notes: string;
  result: string;
  reject_reason: string;
  version: number;
  created_by: string;
  created_at: string;
  updated_at: string;
  deadline_warning: 'normal' | 'urgent' | 'overdue';
  current_handler_role: string;
}

export interface Attachment {
  id: string;
  launch_plan_id: string;
  file_name: string;
  file_path: string;
  file_size: number;
  uploaded_by: string;
  uploaded_at: string;
}

export interface ProcessRecord {
  id: string;
  launch_plan_id: string;
  action: string;
  from_status: string;
  from_status_name: string;
  to_status: string;
  to_status_name: string;
  operator: string;
  operator_role: string;
  operator_role_name: string;
  comment: string;
  evidence: string;
  created_at: string;
}

export interface AuditNote {
  id: string;
  launch_plan_id: string;
  note: string;
  author: string;
  author_role: string;
  author_role_name: string;
  created_at: string;
}

export interface ExceptionLog {
  id: string;
  launch_plan_id: string;
  type: string;
  detail: string;
  operator: string;
  created_at: string;
}

export interface User {
  name: string;
  role: string;
  role_name: string;
}

export interface Stats {
  total: number;
  draft: number;
  pending_review: number;
  archived: number;
  overdue: number;
  urgent: number;
  normal: number;
}

export interface BatchResult {
  total: number;
  success: number;
  failed: number;
  items: BatchResultItem[];
}

export interface BatchResultItem {
  id: string;
  plan_no?: string;
  customer_name?: string;
  success: boolean;
  reason: string;
}

export interface ListResponse<T> {
  total: number;
  items: T[];
}

export interface DetailResponse {
  plan: LaunchPlan;
  attachments: Attachment[];
  process_records: ProcessRecord[];
  audit_notes: AuditNote[];
  exception_logs: ExceptionLog[];
}
