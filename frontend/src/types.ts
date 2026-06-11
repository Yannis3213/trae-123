export interface User {
  id: number
  username: string
  name: string
  role: string
}

export interface RepairOrder {
  id: number
  order_no: string
  title: string
  description: string
  status: string
  priority: string
  customer_id: number
  technician_id: number | null
  manager_id: number | null
  deadline: string
  version: number
  exception_type: string | null
  created_at: string
  updated_at: string
}

export interface Attachment {
  id: number
  order_id: number
  file_name: string
  category: string
  uploaded_by: number
  upload_role: string
  created_at: string
}

export interface ProcessRecord {
  id: number
  order_id: number
  action: string
  from_status: string
  to_status: string
  operator_id: number
  operator_role: string
  remark: string
  created_at: string
}

export interface AuditNote {
  id: number
  order_id: number
  note: string
  author_id: number
  author_role: string
  created_at: string
}

export interface ExceptionReason {
  id: number
  order_id: number
  reason_type: string
  description: string
  created_by: number
  created_at: string
}

export interface OrderDetailResponse {
  order: RepairOrder
  attachments: Attachment[]
  process_records: ProcessRecord[]
  audit_notes: AuditNote[]
  exception_reasons: ExceptionReason[]
  expiry_status: string
}

export type OrderDetail = RepairOrder & {
  attachments: Attachment[]
  process_records: ProcessRecord[]
  audit_notes: AuditNote[]
  exception_reasons: ExceptionReason[]
  expiry_status: string
}

export interface Statistics {
  status_counts: Record<string, number>
  expiry_counts: { normal: number; approaching: number; overdue: number }
  total: number
}

export interface BatchResult {
  order_id: number
  order_no: string
  success: boolean
  message: string
  from_status: string
  to_status: string
}

export interface APIResponse<T> {
  code: number
  message: string
  data: T
}
