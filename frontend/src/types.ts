export interface User {
  id: number;
  username: string;
  role: 'document_clerk' | 'construction_manager' | 'project_manager';
  name: string;
}

export interface Entry {
  id: number;
  title: string;
  subcontractor_name: string;
  status: 'pending_review' | 'approved' | 'returned' | 'synced';
  priority: 'high' | 'medium' | 'low';
  category: 'subcontractor_entry' | 'qualification_review' | 'safety_briefing';
  responsible_person: string;
  current_handler: string | null;
  current_handler_role: string | null;
  deadline: string;
  version: number;
  exception_tags: string;
  created_by: number;
  created_by_name: string;
  created_at: string;
  updated_at: string;
  overdue_group: 'normal' | 'near_due' | 'overdue';
}

export interface Attachment {
  id: number;
  entry_id: number;
  filename: string;
  file_type: string;
  file_size: number;
  description: string;
  uploaded_by: number;
  uploaded_by_name: string;
  created_at: string;
}

export interface ProcessingRecord {
  id: number;
  entry_id: number;
  handler_role: string;
  handler_name: string;
  action: string;
  result: string;
  return_reason: string;
  created_at: string;
}

export interface AuditNote {
  id: number;
  entry_id: number;
  note_type: string;
  content: string;
  created_by: number;
  created_by_name: string;
  created_at: string;
}

export interface ExceptionLog {
  id: number;
  entry_id: number;
  entry_title: string;
  exception_type: string;
  description: string;
  detected_at: string;
  resolved: boolean;
}

export interface EntryDetail {
  entry: Entry;
  attachments: Attachment[];
  records: ProcessingRecord[];
  notes: AuditNote[];
  exceptions: ExceptionLog[];
}

export interface BatchResult {
  entry_id: number;
  success: boolean;
  reason: string;
}

export interface BatchProcessEntry {
  id: number;
  version: number;
}

export interface Stats {
  by_status: Record<string, number>;
  by_priority: Record<string, number>;
  overdue_count: number;
  near_due_count: number;
  total_count: number;
}

export const STATUS_LABELS: Record<string, string> = {
  pending_review: '待审核',
  approved: '审核通过',
  returned: '已退回',
  synced: '已同步',
};

export const PRIORITY_LABELS: Record<string, string> = {
  high: '高',
  medium: '中',
  low: '低',
};

export const CATEGORY_LABELS: Record<string, string> = {
  subcontractor_entry: '分包进场',
  qualification_review: '资质审核',
  safety_briefing: '安全交底',
};

export const ROLE_LABELS: Record<string, string> = {
  document_clerk: '资料员',
  construction_manager: '施工负责人',
  project_manager: '项目经理',
};

export const EXCEPTION_TYPE_LABELS: Record<string, string> = {
  missing_materials: '资料缺失',
  status_conflict: '状态冲突',
  unauthorized_advance: '越权推进',
  overdue: '超期未处理',
};

export const OVERDUE_GROUP_LABELS: Record<string, string> = {
  normal: '正常',
  near_due: '临期',
  overdue: '逾期',
};
