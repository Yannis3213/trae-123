export interface Role {
  code: string
  name: string
}

export interface OrderListItem {
  id: number
  order_no: string
  customer_name: string
  product_name: string
  amount: number
  status: string
  status_display: string
  stage: string
  stage_display: string
  priority: string
  priority_display: string
  responsible_person: string
  current_handler: string
  create_time: string
  update_time: string
  due_time: string | null
  is_exception: boolean
  exception_tags: string[]
  warning_level: string
  warning_level_display: string
}

export interface AttachmentInfo {
  id: number
  file_name: string
  file_path: string
  file_type: string
  file_size: number
  uploaded_by: string
  uploaded_by_role: string
  upload_time: string
  description: string
  stage: string
}

export interface ProcessingRecordInfo {
  id: number
  action: string
  action_display: string
  operator: string
  operator_role: string
  operate_time: string
  from_status: string
  to_status: string
  from_stage: string
  to_stage: string
  comment: string
  evidence_required: boolean
  evidence_provided: boolean
  version_before: number
  version_after: number
}

export interface AuditNoteInfo {
  id: number
  note: string
  noted_by: string
  noted_by_role: string
  note_time: string
}

export interface ExceptionReasonInfo {
  id: number
  reason_type: string
  reason_detail: string
  corrective_action: string
  recorded_by: string
  recorded_by_role: string
  record_time: string
  resolved: boolean
  resolve_time: string | null
}

export interface OrderDetail extends OrderListItem {
  quantity: number
  country: string
  inquiry_content: string
  quote_content: string
  order_content: string
  quote_confirmed: boolean
  order_signed: boolean
  version: number
  result: string
  return_reason: string
  can_process: boolean
  attachments: AttachmentInfo[]
  processing_records: ProcessingRecordInfo[]
  audit_notes: AuditNoteInfo[]
  exception_reasons: ExceptionReasonInfo[]
}

export interface OrderListResponse {
  total: number
  items: OrderListItem[]
  stats: Record<string, any>
}

export interface BatchProcessResult {
  order_id: number
  order_no: string
  success: boolean
  error_code: string
  error_message: string
  new_status: string
  new_stage: string
  new_version: number
}

export interface BatchProcessResponse {
  total: number
  success_count: number
  failed_count: number
  results: BatchProcessResult[]
}
