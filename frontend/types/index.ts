export interface User {
  id: string
  username: string
  role: 'registrar' | 'supervisor' | 'director'
  display_name: string
  token: string
}

export type PlanStatus = '待派发' | '处理中' | '已关闭'
export type WarningLevel = '正常' | '临期' | '逾期'

export interface CarePlan {
  id: string
  plan_no: string
  elder_name: string
  elder_id_card: string
  room_no: string
  admission_date: string
  status: PlanStatus
  current_handler: string
  responsible_person: string
  deadline: string
  version: number
  assessment_done: boolean
  assessment_note: string | null
  plan_done: boolean
  plan_note: string | null
  family_confirmed: boolean
  family_note: string | null
  created_at: string
  updated_at: string
  warning_level: WarningLevel | null
}

export interface Attachment {
  id: string
  care_plan_id: string
  file_name: string
  file_type: string
  uploaded_by: string
  uploaded_at: string
}

export interface ProcessingRecord {
  id: string
  care_plan_id: string
  action: string
  operator: string
  operator_role: string
  prev_status: string
  new_status: string
  remark: string | null
  created_at: string
}

export interface AuditNote {
  id: string
  care_plan_id: string
  operator: string
  operator_role: string
  action: string
  prev_status: string
  new_status: string
  success: boolean
  failure_reason: string | null
  remark: string | null
  created_at: string
}

export interface ExceptionReason {
  id: string
  care_plan_id: string
  exception_type: string
  description: string
  operator: string
  resolved: boolean
  created_at: string
  resolved_at: string | null
}

export interface ApiResponse<T> {
  success: boolean
  message: string
  data: T | null
}

export interface BatchResult {
  plan_id: string
  plan_no: string
  elder_name?: string
  success: boolean
  message: string
}

export interface Stats {
  total: number
  pending: number
  in_progress: number
  closed: number
  warning_normal: number
  warning_approaching: number
  warning_overdue: number
}

export interface CreatePlanRequest {
  elder_name: string
  elder_id_card: string
  room_no: string
  admission_date: string
  deadline: string
}

export interface UpdatePlanRequest {
  assessment_done?: boolean
  assessment_note?: string
  plan_done?: boolean
  plan_note?: string
  family_confirmed?: boolean
  family_note?: string
  remark?: string
  version: number
}

export interface ActionRequest {
  remark?: string
  version: number
}

export interface ReturnRequest {
  remark: string
  version: number
}

export interface BatchRequest {
  plan_ids: string[]
  action: string
  remark?: string
}

export const ROLE_ACCOUNTS: Record<string, { username: string; token: string; display_name: string }> = {
  registrar: { username: 'registrar', token: 'token-registrar-001', display_name: '李登记' },
  supervisor: { username: 'supervisor', token: 'token-supervisor-002', display_name: '王主管' },
  director: { username: 'director', token: 'token-director-003', display_name: '张主任' },
}

export const ROLE_LABELS: Record<string, string> = {
  registrar: '护理计划登记员',
  supervisor: '护理计划审核主管',
  director: '养老护理院复核负责人',
}
