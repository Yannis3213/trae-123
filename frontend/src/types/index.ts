export type Role =
  | 'registration_clerk'
  | 'circulation_librarian'
  | 'cataloging_librarian'
  | 'audit_supervisor'
  | 'library_director';

export type BorrowStatus =
  | 'pending_assignment'
  | 'transferred'
  | 'revisited'
  | 'returned_for_correction'
  | 'reviewed_archived'
  | 'overdue';

export type OverdueLevel = 'normal' | 'approaching' | 'overdue';

export interface RoleInfo {
  role: Role;
  name: string;
  description: string;
}

export interface Reader {
  id: string;
  name: string;
  card_number: string;
  department: string;
  phone: string;
  created_at: string;
}

export interface BorrowRecord {
  id: string;
  reader_id: string;
  reader_name: string;
  reader_card_number: string;
  book_title: string;
  book_isbn: string;
  borrow_date: string;
  due_date: string;
  return_date: string | null;
  status: BorrowStatus;
  current_handler: string | null;
  current_handler_role: Role | null;
  version: number;
  created_by: string;
  created_by_role: Role;
  created_at: string;
  updated_at: string;
  overdue_level: OverdueLevel;
  node_timeout: boolean;
  timeout_responsible: string | null;
  missing_materials: string[];
}

export interface ProcessRecord {
  id: string;
  borrow_record_id: string;
  from_status: BorrowStatus;
  to_status: BorrowStatus;
  action: string;
  operator: string;
  operator_role: Role;
  remark: string | null;
  evidence_required: string[];
  evidence_provided: string[];
  created_at: string;
}

export interface AuditNote {
  id: string;
  borrow_record_id: string;
  status_snapshot: BorrowStatus;
  note: string;
  operator: string;
  operator_role: Role;
  exception_type: string | null;
  exception_detail: string | null;
  created_at: string;
}

export interface Statistics {
  total_count: number;
  pending_assignment: number;
  transferred: number;
  revisited: number;
  returned_for_correction: number;
  reviewed_archived: number;
  overdue: number;
  normal: number;
  approaching: number;
  overdue_count: number;
  node_timeout_count: number;
}

export interface ProcessRequest {
  action: string;
  target_status: BorrowStatus;
  operator: string;
  operator_role: Role;
  remark?: string;
  evidence: string[];
  version: number;
  assign_to?: string;
  assign_to_role?: Role;
  correction_items?: string[];
}

export interface BatchProcessRequest {
  record_ids: string[];
  action: string;
  target_status: BorrowStatus;
  operator: string;
  operator_role: Role;
  remark?: string;
  evidence: string[];
  versions: Record<string, number>;
}

export interface BatchProcessResultItem {
  record_id: string;
  success: boolean;
  message: string;
  from_status: BorrowStatus | null;
  to_status: BorrowStatus | null;
}

export interface BatchProcessResponse {
  total: number;
  success_count: number;
  failure_count: number;
  results: BatchProcessResultItem[];
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export const ROLE_DISPLAY: Record<Role, string> = {
  registration_clerk: '借阅登记员',
  circulation_librarian: '流通馆员',
  cataloging_librarian: '采编馆员',
  audit_supervisor: '借阅审核主管',
  library_director: '馆长',
};

export const ROLE_OPERATORS: Record<Role, string> = {
  registration_clerk: '登记员小李',
  circulation_librarian: '流通馆员小王',
  cataloging_librarian: '采编馆员小张',
  audit_supervisor: '审核主管张主管',
  library_director: '刘馆长',
};

export const STATUS_DISPLAY: Record<BorrowStatus, string> = {
  pending_assignment: '待分派',
  transferred: '已转办',
  revisited: '已回访',
  returned_for_correction: '退回补正',
  reviewed_archived: '复核归档',
  overdue: '已逾期',
};

export const OVERDUE_DISPLAY: Record<OverdueLevel, string> = {
  normal: '正常',
  approaching: '临期',
  overdue: '逾期',
};

export const STATUS_COLOR: Record<BorrowStatus, string> = {
  pending_assignment: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  transferred: 'bg-blue-100 text-blue-800 border-blue-300',
  revisited: 'bg-purple-100 text-purple-800 border-purple-300',
  returned_for_correction: 'bg-orange-100 text-orange-800 border-orange-300',
  reviewed_archived: 'bg-green-100 text-green-800 border-green-300',
  overdue: 'bg-red-100 text-red-800 border-red-300',
};

export const OVERDUE_COLOR: Record<OverdueLevel, string> = {
  normal: 'bg-emerald-100 text-emerald-700',
  approaching: 'bg-amber-100 text-amber-700',
  overdue: 'bg-red-100 text-red-700',
};
