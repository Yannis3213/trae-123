export type RoleEnum = 'registration_clerk' | 'audit_supervisor' | 'review_lead'

export type StatusEnum = 'pending' | 'failed' | 'completed'

export type EvidenceTypeEnum = 'membership_form' | 'contract_confirmation' | 'card_benefits'

export type ExpiryStatusEnum = 'normal' | 'approaching' | 'overdue'

export type ActionTypeEnum =
  | 'create'
  | 'submit'
  | 'audit_pass'
  | 'audit_fail'
  | 'review_pass'
  | 'review_fail'
  | 'correct'
  | 'reassign'
  | 'note'

export type ExceptionTypeEnum =
  | 'missing_materials'
  | 'status_conflict'
  | 'unauthorized_advance'
  | 'overdue'

export interface User {
  id: number
  username: string
  full_name: string
  role: RoleEnum
  is_active: boolean
  created_at: string
}

export interface Attachment {
  id: number
  enrollment_id: number
  evidence_type: EvidenceTypeEnum
  file_name: string
  file_url: string
  uploaded_by_id: number
  uploaded_at: string
  is_valid: boolean
}

export interface AuditLog {
  id: number
  enrollment_id: number
  user_id: number
  action_type: ActionTypeEnum
  old_status: StatusEnum | null
  new_status: StatusEnum | null
  comment: string | null
  created_at: string
  user?: User
}

export interface ExceptionLog {
  id: number
  enrollment_id: number
  exception_type: ExceptionTypeEnum
  description: string
  detected_at: string
  detected_by: string | null
  resolved: boolean
  resolved_at: string | null
  resolution_note: string | null
}

export interface Enrollment {
  id: number
  member_name: string
  member_phone: string
  member_id_card: string | null
  membership_type: string
  card_level: string | null
  amount: number
  contract_no: string | null
  salesperson: string | null
  private_trainer: string | null
  store: string
  remark: string | null

  status: StatusEnum
  version: number

  created_by_id: number
  current_handler_id: number | null
  audit_by_id: number | null
  review_by_id: number | null

  created_at: string
  submitted_at: string | null
  audited_at: string | null
  reviewed_at: string | null
  due_at: string

  created_by?: User
  current_handler?: User
  audit_by?: User
  review_by?: User

  attachments: Attachment[]
  expiry_status?: ExpiryStatusEnum
  has_exception: boolean
  evidence_summary: Record<string, boolean>
}

export interface EnrollmentDetail extends Enrollment {
  audit_logs: AuditLog[]
  exceptions: ExceptionLog[]
  evidence_summary: Record<string, boolean>
}

export interface EnrollmentListResponse {
  total: number
  items: Enrollment[]
  page: number
  page_size: number
}

export interface BatchItemResult {
  id: number
  success: boolean
  message: string
  error_code?: string
  data?: Enrollment
}

export interface BatchResultResponse {
  total: number
  success_count: number
  fail_count: number
  results: BatchItemResult[]
}

export interface StatsResponse {
  total: number
  pending: number
  failed: number
  completed: number
  normal: number
  approaching: number
  overdue: number
  my_todo: number
}

export const ROLE_LABELS: Record<RoleEnum, string> = {
  registration_clerk: '会员入会登记员',
  audit_supervisor: '会员入会审核主管',
  review_lead: '社区健身房复核负责人',
}

export const STATUS_LABELS: Record<StatusEnum, string> = {
  pending: '待核验',
  failed: '核验失败',
  completed: '核验完成',
}

export const EVIDENCE_LABELS: Record<EvidenceTypeEnum, string> = {
  membership_form: '会员入会',
  contract_confirmation: '合同确认',
  card_benefits: '卡权益启用',
}

export const EXPIRY_LABELS: Record<ExpiryStatusEnum, string> = {
  normal: '正常',
  approaching: '临期',
  overdue: '逾期',
}

export const ACTION_LABELS: Record<ActionTypeEnum, string> = {
  create: '创建',
  submit: '提交',
  audit_pass: '审核通过',
  audit_fail: '审核退回',
  review_pass: '复核通过',
  review_fail: '复核退回',
  correct: '补正',
  reassign: '转派',
  note: '备注',
}

export const EXCEPTION_LABELS: Record<ExceptionTypeEnum, string> = {
  missing_materials: '资料缺失',
  status_conflict: '状态冲突',
  unauthorized_advance: '越权推进',
  overdue: '超期未处理',
}

export const ERROR_CODE_LABELS: Record<string, string> = {
  unauthorized_advance: '越权推进',
  status_conflict: '状态冲突',
  version_conflict: '版本冲突',
  missing_materials: '资料缺失',
  overdue: '逾期拦截',
  not_found: '不存在',
  business_error: '业务错误',
}
