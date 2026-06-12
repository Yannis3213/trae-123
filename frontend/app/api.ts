export const API_BASE =
  (typeof __API_BASE__ !== 'undefined' ? __API_BASE__ : 'http://localhost:8106') as string

export interface LoginRequest {
  username: string
  password: string
}

export interface User {
  id: number
  username: string
  full_name: string
  role: string
  role_name: string
  department?: string
  token?: string
}

export interface Attachment {
  id: number
  file_name: string
  file_type?: string
  file_size?: number
  category: string
  category_label?: string
  request_stage_label?: string
  is_required: boolean
  uploaded_by?: User
  uploaded_at: string
}

export interface AttachmentCreate {
  file_name: string
  file_type?: string
  file_size?: number
  category: string
  is_required?: boolean
  file_path: string
}

export interface ProcessingRecord {
  id: number
  project_id: number
  action: string
  action_name: string
  from_status?: string
  to_status?: string
  from_stage?: string
  to_stage?: string
  operator?: User
  operator_role?: string
  operator_role_label?: string
  remark?: string
  evidence_checked?: string
  processed_at: string
  version_at_action?: number
}

export interface AuditNote {
  id: number
  project_id: number
  note_type: string
  note_type_label?: string
  note_content: string
  created_by?: User
  created_at: string
}

export interface RejectReason {
  id: number
  note_content: string
  created_at: string
  created_by?: User
}

export interface ExceptionRecordItem {
  id: number
  project_id: number
  exception_type: string
  exception_type_label?: string
  exception_code?: string
  exception_message: string
  responsible_role?: string
  responsible_role_label?: string
  responsible_user?: User
  created_at: string
  resolved: boolean
  resolved_at?: string
  resolution?: string
}

export interface SupplementInfo {
  is_supplement_needed: boolean
  missing_items: string[]
  reject_reasons: RejectReason[]
  current_stage: string
  current_stage_label: string
}

export interface TrainingProjectSimple {
  id: number
  project_no: string
  project_name: string
  client_company: string
  contact_person?: string
  training_type?: string
  training_count: number
  status: string
  status_name: string
  current_handler_role?: string
  current_handler?: User
  deadline?: string
  stage: string
  stage_name: string
  version: number
  created_by?: User
  created_at: string
  updated_at: string
  deadline_status?: string
  overdue_days?: number
}

export interface TrainingProjectBase {
  project_name: string
  client_company: string
  contact_person?: string
  contact_phone?: string
  training_type?: string
  training_count: number
  expected_start_date?: string
  expected_end_date?: string
  demand_description?: string
  plan_content?: string
  quotation_amount: number
  contract_no?: string
  contract_date?: string
  deadline?: string
  stage: string
}

export interface TrainingProjectCreate extends Omit<TrainingProjectBase, 'stage' | 'training_count' | 'quotation_amount'> {
  stage?: string
  training_count?: number
  quotation_amount?: number
}

export interface TrainingProjectUpdate extends TrainingProjectCreate {
  version: number
}

export interface TrainingProjectDetail extends TrainingProjectSimple {
  demand_description?: string
  plan_content?: string
  quotation_amount: number
  contract_no?: string
  contract_date?: string
  expected_start_date?: string
  expected_end_date?: string
  contact_phone?: string
  attachments: Attachment[]
  processing_records: ProcessingRecord[]
  audit_notes: AuditNote[]
  exceptions: ExceptionRecordItem[]
  allowed_actions: string[]
  supplement: SupplementInfo
}

export interface DashboardStats {
  total_count: number
  draft_count: number
  pending_audit_count: number
  audit_passed_count: number
  pending_review_count: number
  synced_count: number
  normal_deadline_count: number
  near_deadline_count: number
  overdue_count: number
  stage_demand_count: number
  stage_plan_count: number
  stage_contract_count: number
  role_counts: Record<string, number>
}

export interface ProcessActionRequest {
  action: string
  remark?: string
  version: number
  target_stage?: string
  required_attachments?: number[]
}

export interface BatchActionRequest {
  ids: number[]
  action: string
  remark?: string
  versions?: Record<number, number>
}

export interface BatchResultItem {
  id: number
  project_no?: string
  success: boolean
  message: string
  new_status?: string
}

export interface BatchActionResponse {
  total: number
  success_count: number
  fail_count: number
  results: BatchResultItem[]
}

export interface ProjectListResponse {
  total: number
  page: number
  page_size: number
  items: TrainingProjectSimple[]
  stats?: {
    normal_deadline: number
    near_deadline: number
    overdue: number
  }
}

const TOKEN_KEY = 'tp_auth_token'
const USER_KEY = 'tp_auth_user'

export function setAuth(token: string, user: User) {
  localStorage.setItem(TOKEN_KEY, token)
  localStorage.setItem(USER_KEY, JSON.stringify(user))
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function getUser(): User | null {
  const raw = localStorage.getItem(USER_KEY)
  return raw ? (JSON.parse(raw) as User) : null
}

export function clearAuth() {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
}

async function request<T>(
  path: string,
  opts: RequestInit = {},
  needAuth = true,
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(opts.headers as Record<string, string>),
  }
  if (needAuth) {
    const token = getToken()
    if (token) headers['Authorization'] = `Bearer ${token}`
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...opts,
    headers,
  })

  const text = await res.text()
  let data: unknown = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = text
  }

  if (!res.ok) {
    const err = data as { detail?: string; message?: string } | null
    const msg = err?.detail || err?.message || `HTTP ${res.status}`
    throw new Error(typeof msg === 'string' ? msg : JSON.stringify(msg))
  }
  return data as T
}

export const api = {
  login: (data: LoginRequest) => request<User>('/api/auth/login', { method: 'POST', body: JSON.stringify(data) }, false),
  logout: () => request<{ ok: boolean }>('/api/auth/logout', { method: 'POST' }, false),
  me: () => request<User>('/api/auth/me'),
  users: () => request<User[]>('/api/auth/users'),
  dashboard: () => request<DashboardStats>('/api/projects/dashboard'),
  listProjects: (params: Record<string, string | number | boolean | undefined> = {}) => {
    const qs = new URLSearchParams(
      Object.entries(params)
        .filter(([, v]) => v !== undefined && v !== null && v !== '')
        .map(([k, v]) => [k, String(v)]),
    ).toString()
    return request<ProjectListResponse>(`/api/projects${qs ? '?' + qs : ''}`)
  },
  getProject: (id: number) => request<TrainingProjectDetail>(`/api/projects/${id}`),
  createProject: (data: TrainingProjectCreate) =>
    request<TrainingProjectDetail>('/api/projects', { method: 'POST', body: JSON.stringify(data) }),
  updateProject: (id: number, data: TrainingProjectUpdate) =>
    request<TrainingProjectDetail>(`/api/projects/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  doAction: (id: number, data: ProcessActionRequest) =>
    request<TrainingProjectDetail>(`/api/projects/${id}/action`, { method: 'POST', body: JSON.stringify(data) }),
  batchAction: (data: BatchActionRequest) =>
    request<BatchActionResponse>('/api/projects/batch/action', { method: 'POST', body: JSON.stringify(data) }),
  deleteProject: (id: number) => request<{ ok: boolean }>(`/api/projects/${id}`, { method: 'DELETE' }),
  addAttachment: (id: number, data: AttachmentCreate) =>
    request<Attachment>(`/api/projects/${id}/attachments`, { method: 'POST', body: JSON.stringify(data) }),
  deleteAttachment: (pid: number, aid: number) =>
    request<{ ok: boolean }>(`/api/projects/${pid}/attachments/${aid}`, { method: 'DELETE' }),
}

export const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-800 border-gray-300',
  pending_audit: 'bg-yellow-50 text-yellow-800 border-yellow-300',
  audit_rejected: 'bg-orange-50 text-orange-800 border-orange-300',
  audit_passed: 'bg-blue-50 text-blue-800 border-blue-300',
  pending_review: 'bg-indigo-50 text-indigo-800 border-indigo-300',
  review_rejected: 'bg-pink-50 text-pink-800 border-pink-300',
  synced: 'bg-green-50 text-green-800 border-green-300',
  archived: 'bg-slate-100 text-slate-700 border-slate-300',
}

export const DEADLINE_COLORS: Record<string, string> = {
  normal: 'bg-emerald-50 text-emerald-700 border-emerald-300',
  near: 'bg-amber-50 text-amber-800 border-amber-300',
  overdue: 'bg-red-50 text-red-800 border-red-300',
}

export const STAGE_COLORS: Record<string, string> = {
  demand: 'bg-sky-50 text-sky-800 border-sky-300',
  plan: 'bg-purple-50 text-purple-800 border-purple-300',
  contract: 'bg-teal-50 text-teal-800 border-teal-300',
}

export const ACTION_LABELS: Record<string, string> = {
  submit: '提交审核',
  audit_pass: '审核通过',
  audit_reject: '退回补正',
  review_pass: '复核通过并同步',
  review_reject: '复核退回',
  supplement: '补正提交',
  advance_stage: '推进至下一阶段',
  archive: '归档',
}
