export type UserRole =
  | 'GROUPON_REGISTRAR'
  | 'AUDIT_SUPERVISOR'
  | 'REVIEW_LEADER'
  | 'LEADER_OPERATOR'
  | 'FULFILLMENT_SPECIALIST'
  | 'CITY_MANAGER'

export type OrderStatus = 'PENDING_ASSIGN' | 'PROCESSING' | 'CLOSED'

export type WarningStatus = 'normal' | 'approaching' | 'overdue'

export type ActionType =
  | 'CREATE'
  | 'SUBMIT'
  | 'ASSIGN'
  | 'RETURN'
  | 'REVIEW'
  | 'CLOSE'
  | 'CORRECT_MATERIALS'
  | 'CORRECT_EVIDENCE'
  | 'CORRECT_INFO'
  | 'ADD_ATTACHMENT'
  | 'ADD_AUDIT_NOTE'

export type EvidenceType = 'shelf' | 'order' | 'delivery'

export type ReasonType = 'overdue' | 'conflict' | 'material_missing' | 'other'

export interface User {
  id: string
  name: string
  role: UserRole
  avatar?: string
}

export interface Attachment {
  id: number
  orderId: number
  fileName: string
  fileType: string
  fileUrl: string
  uploadedBy: string
  uploadedAt: string
  evidenceType: EvidenceType
}

export interface ProcessingRecord {
  id: number
  orderId: number
  actionType: ActionType
  operator: string
  operatorRole: UserRole
  previousStatus?: OrderStatus
  newStatus?: OrderStatus
  previousHandler?: string
  newHandler?: string
  comment?: string
  createdAt: string
  version: number
}

export interface AuditNote {
  id: number
  orderId: number
  content: string
  author: string
  authorRole: UserRole
  createdAt: string
}

export interface ExceptionReason {
  id: number
  orderId: number
  reason: string
  reasonType: ReasonType
  operator: string
  createdAt: string
  resolved: boolean
}

export interface GroupOrder {
  id: number
  orderNo: string
  productName: string
  sku: string
  shelfDate: string
  grouponPrice: number
  quantity: number
  totalAmount: number
  orderStatus: OrderStatus
  currentHandler?: string
  currentRole?: UserRole
  deadline?: string
  version: number
  isOverdue: boolean
  overdueReason?: string
  isMaterialComplete: boolean
  shelfEvidence?: string
  orderEvidence?: string
  deliveryEvidence?: string
  createdBy: string
  createdAt: string
  updatedAt: string
  assignedAt?: string
  closedAt?: string
  warningStatus: WarningStatus
  attachments: Attachment[]
  processingRecords: ProcessingRecord[]
  auditNotes: AuditNote[]
  exceptionReasons: ExceptionReason[]
}

export interface QueryParams {
  orderStatus?: OrderStatus
  currentRole?: UserRole
  keyword?: string
  isOverdue?: boolean
  page?: number
  pageSize?: number
  sortBy?: string
  sortOrder?: 'ASC' | 'DESC'
}

export interface OrderListResponse {
  list: GroupOrder[]
  total: number
  page: number
  pageSize: number
}

export interface BatchProcessDto {
  ids: number[]
  action: string
  operator: string
  operatorRole: string
  comment?: string
}

export interface ReturnOrderDto {
  reason: string
  returnToRole: string
  operator: string
  operatorRole: string
  version: number
  comment: string
}

export interface AssignOrderDto {
  handler: string
  role: UserRole
  deadline?: string
  comment?: string
  version: number
}

export interface ProcessOrderDto {
  comment?: string
  version: number
  isMaterialComplete?: boolean
}

export interface ReviewOrderDto {
  passed: boolean
  comment: string
  version: number
  exceptionReasons?: { reason: string; reasonType: ReasonType }[]
}

export interface CorrectOrderDto {
  comment?: string
  version: number
  isMaterialComplete?: boolean
  shelfEvidence?: string
  orderEvidence?: string
  deliveryEvidence?: string
}

export interface AddNoteDto {
  content: string
}

export interface AddAttachmentDto {
  fileName: string
  fileType: string
  fileUrl: string
  evidenceType: EvidenceType
}

export interface CreateOrderDto {
  productName: string
  sku: string
  shelfDate: string
  grouponPrice: number
  quantity: number
}
