export const BACKEND_PORT = 8106;
export const FRONTEND_PORT = 3106;
export const API_BASE = '/api';

export type UserRole = 'registrar' | 'auditor' | 'reviewer';

export interface UserInfo {
  id: string;
  username: string;
  role: UserRole;
  display_name: string;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  user: UserInfo;
}

export type TopicStatus =
  | 'pending_dispatch'
  | 'processing'
  | 'returned'
  | 'closed'
  | 'archived';

export const TOPIC_STATUS_LABEL: Record<TopicStatus, string> = {
  pending_dispatch: '待派发',
  processing: '处理中',
  returned: '退回补正',
  closed: '已关闭',
  archived: '已归档',
};

export const TOPIC_STATUS_COLOR: Record<TopicStatus, string> = {
  pending_dispatch: '#ff9800',
  processing: '#2196f3',
  returned: '#f44336',
  closed: '#9e9e9e',
  archived: '#607d8b',
};

export interface Topic {
  id: string;
  title: string;
  description: string;
  source: string;
  priority: string;
  category: string;
  status: TopicStatus;
  applicant_id?: string | null;
  applicant_name: string;
  current_handler_id?: string | null;
  current_handler_name?: string | null;
  interview_deadline?: string | null;
  submission_deadline?: string | null;
  created_at: string;
  updated_at: string;
  version: number;
  warning_level?: 'normal' | 'warning' | 'overdue';
  is_overdue?: boolean;
}

export type AttachmentType = '选题申报' | '采访安排' | '稿件提交' | '补充证据';

export interface Attachment {
  id: string;
  topic_id: string;
  attachment_type: AttachmentType;
  file_name: string;
  file_url: string;
  description: string;
  uploaded_by: string;
  uploaded_by_name: string;
  uploaded_at: string;
}

export interface ProcessRecord {
  id: string;
  topic_id: string;
  action: string;
  from_status?: string | null;
  to_status?: string | null;
  handler_id: string;
  handler_name: string;
  handler_role: string;
  opinion: string;
  remark?: string | null;
  created_at: string;
  version_after: number;
}

export interface AuditLog {
  id: string;
  topic_id: string;
  user_id: string;
  user_name: string;
  user_role: string;
  action: string;
  detail: string;
  ip_address?: string | null;
  created_at: string;
}

export interface CreateTopicRequest {
  title: string;
  description: string;
  source: string;
  priority: string;
  category: string;
  interview_deadline?: string | null;
  submission_deadline?: string | null;
}

export interface UpdateTopicRequest {
  title?: string;
  description?: string;
  source?: string;
  priority?: string;
  category?: string;
  interview_deadline?: string | null;
  submission_deadline?: string | null;
  version: number;
}

export interface ProcessTopicRequest {
  action:
    | 'dispatch'
    | 'return'
    | 'progress'
    | 'submit_review'
    | 'close'
    | 'archive'
    | 'reopen';
  opinion: string;
  remark?: string | null;
  target_handler_id?: string | null;
  version: number;
  attachments?: AttachmentInput[];
}

export interface AttachmentInput {
  attachment_type: string;
  file_name: string;
  file_url: string;
  description: string;
}

export interface BatchProcessRequest {
  ids: string[];
  action: string;
  opinion: string;
  remark?: string | null;
  target_handler_id?: string | null;
  versions: Record<string, number>;
}

export interface BatchResultItem {
  id: string;
  title: string;
  success: boolean;
  error_code?: string | null;
  error_message?: string | null;
  new_status?: string | null;
}

export interface BatchProcessResponse {
  total: number;
  success_count: number;
  failed_count: number;
  results: BatchResultItem[];
}

export interface TopicListResponse {
  total: number;
  page: number;
  page_size: number;
  items: Topic[];
}

export interface TopicDetailResponse {
  topic: Topic;
  attachments: Attachment[];
  records: ProcessRecord[];
  audits: AuditLog[];
  warning_level: string;
  is_overdue: boolean;
  overdue_reason?: string | null;
}

export interface StatisticsResponse {
  by_status: Record<string, number>;
  warning: { normal: number; warning: number; overdue: number };
  my_pending: number;
}

export const ROLE_LABEL: Record<UserRole, string> = {
  registrar: '选题登记员（采编助理）',
  auditor: '选题审核主管（责任编辑）',
  reviewer: '复核负责人（总编室）',
};

export const ROLE_SHORT_LABEL: Record<UserRole, string> = {
  registrar: '采编助理',
  auditor: '责任编辑',
  reviewer: '总编室',
};

export const PRIORITY_OPTIONS = [
  { value: 'high', label: '高' },
  { value: 'medium', label: '中' },
  { value: 'low', label: '低' },
];

export const CATEGORY_OPTIONS = [
  '城市建设',
  '乡村振兴',
  '教育科技',
  '经济发展',
  '文化传承',
  '民生保障',
  '社会治理',
  '生态环境',
  '其他',
];

export const WARNING_LABEL: Record<string, { label: string; color: string }> = {
  normal: { label: '正常', color: '#4caf50' },
  warning: { label: '临期', color: '#ff9800' },
  overdue: { label: '逾期', color: '#f44336' },
};

export interface ApiError {
  code: string;
  message: string;
  detail?: string | null;
}

export const ACTION_LABELS: Record<string, string> = {
  dispatch: '派发',
  'dispatch_self': '派发（自领）',
  return: '退回补正',
  progress: '更新进度',
  submit_review: '提交复核',
  close: '关闭',
  archive: '归档',
  reopen: '重开',
};
