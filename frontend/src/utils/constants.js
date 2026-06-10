export const Role = {
  REGISTRAR: 'registrar',
  SUPERVISOR: 'supervisor',
  REVIEWER: 'reviewer',
}

export const RoleNames = {
  [Role.REGISTRAR]: '报修登记员',
  [Role.SUPERVISOR]: '报修审核主管',
  [Role.REVIEWER]: '物业服务中心复核负责人',
}

export const RoleResponsibility = {
  [Role.REGISTRAR]: '客服管家（初始队列）',
  [Role.SUPERVISOR]: '维修主管（处理中段）',
  [Role.REVIEWER]: '项目经理（最终意见）',
}

export const OrderStatus = {
  PENDING_DISPATCH: 'pending_dispatch',
  DISPATCHED: 'dispatched',
  IN_PROGRESS: 'in_progress',
  TRANSFERRED: 'transferred',
  RETURNED_FOR_CORRECTION: 'returned_for_correction',
  CORRECTED: 'corrected',
  COMPLETED: 'completed',
  VISITED: 'visited',
  REVIEWING: 'reviewing',
  ARCHIVED: 'archived',
}

export const StatusNames = {
  [OrderStatus.PENDING_DISPATCH]: '待分派',
  [OrderStatus.DISPATCHED]: '已派单',
  [OrderStatus.IN_PROGRESS]: '处理中',
  [OrderStatus.TRANSFERRED]: '已转办',
  [OrderStatus.RETURNED_FOR_CORRECTION]: '退回补正',
  [OrderStatus.CORRECTED]: '已补正',
  [OrderStatus.COMPLETED]: '已完成',
  [OrderStatus.VISITED]: '已回访',
  [OrderStatus.REVIEWING]: '复核中',
  [OrderStatus.ARCHIVED]: '已归档',
}

export const StatusColors = {
  [OrderStatus.PENDING_DISPATCH]: '#f59e0b',
  [OrderStatus.DISPATCHED]: '#3b82f6',
  [OrderStatus.IN_PROGRESS]: '#8b5cf6',
  [OrderStatus.TRANSFERRED]: '#06b6d4',
  [OrderStatus.RETURNED_FOR_CORRECTION]: '#ef4444',
  [OrderStatus.CORRECTED]: '#10b981',
  [OrderStatus.COMPLETED]: '#22c55e',
  [OrderStatus.VISITED]: '#14b8a6',
  [OrderStatus.REVIEWING]: '#6366f1',
  [OrderStatus.ARCHIVED]: '#6b7280',
}

export const StatusListGroups = {
  '待分派': [OrderStatus.PENDING_DISPATCH, OrderStatus.RETURNED_FOR_CORRECTION],
  '已转办': [OrderStatus.DISPATCHED, OrderStatus.IN_PROGRESS, OrderStatus.TRANSFERRED, OrderStatus.CORRECTED],
  '已回访': [OrderStatus.COMPLETED, OrderStatus.VISITED, OrderStatus.REVIEWING, OrderStatus.ARCHIVED],
}

export const SourceModule = {
  OWNER_REPORT: 'owner_report',
  DISPATCH: 'dispatch',
  REGISTRATION: 'registration',
}

export const SourceModuleNames = {
  [SourceModule.OWNER_REPORT]: '业主报修',
  [SourceModule.DISPATCH]: '维修派单',
  [SourceModule.REGISTRATION]: '报修工单登记',
}

export const Action = {
  CREATE: 'create',
  DISPATCH: 'dispatch',
  START_PROCESS: 'start_process',
  TRANSFER: 'transfer',
  COMPLETE: 'complete',
  RETURN_FOR_CORRECTION: 'return_for_correction',
  CORRECT: 'correct',
  VISIT: 'visit',
  SUBMIT_REVIEW: 'submit_review',
  REVIEW_APPROVE: 'review_approve',
  REVIEW_REJECT: 'review_reject',
  ARCHIVE: 'archive',
  BATCH_PROCESS: 'batch_process',
  UPLOAD_ATTACHMENT: 'upload_attachment',
}

export const ActionNames = {
  [Action.CREATE]: '创建工单',
  [Action.DISPATCH]: '派单',
  [Action.START_PROCESS]: '开始处理',
  [Action.TRANSFER]: '转办',
  [Action.COMPLETE]: '完成维修',
  [Action.RETURN_FOR_CORRECTION]: '退回补正',
  [Action.CORRECT]: '补正',
  [Action.VISIT]: '回访确认',
  [Action.SUBMIT_REVIEW]: '提交复核',
  [Action.REVIEW_APPROVE]: '复核通过',
  [Action.REVIEW_REJECT]: '复核驳回',
  [Action.ARCHIVE]: '归档',
  [Action.UPLOAD_ATTACHMENT]: '上传附件',
}

export const ErrorCodeLabels = {
  duplicate_submit: '重复提交',
  version_conflict: '版本冲突',
  attachment_blocked: '附件拦截',
  role_violation: '越权操作',
  status_conflict: '状态冲突',
  invalid_transition: '非法流转',
  missing_evidence: '缺证据',
  missing_owner_info: '缺业主信息',
  missing_address: '缺地址',
  missing_description: '缺描述',
  overdue: '已超期',
  not_found: '工单不存在',
  unknown: '未知错误',
}

export const ErrorCodeColors = {
  duplicate_submit: '#f59e0b',
  version_conflict: '#ef4444',
  attachment_blocked: '#dc2626',
  role_violation: '#b91c1c',
  status_conflict: '#dc2626',
  invalid_transition: '#9333ea',
  missing_evidence: '#ea580c',
}

export const RoleAllowedActions = {
  [Role.REGISTRAR]: [Action.CREATE, Action.CORRECT, Action.DISPATCH, Action.SUBMIT_REVIEW],
  [Role.SUPERVISOR]: [Action.START_PROCESS, Action.TRANSFER, Action.RETURN_FOR_CORRECTION, Action.COMPLETE, Action.VISIT],
  [Role.REVIEWER]: [Action.REVIEW_APPROVE, Action.REVIEW_REJECT, Action.ARCHIVE],
}

export const PriorityNames = {
  urgent: '紧急',
  high: '高',
  normal: '普通',
  low: '低',
}

export const PriorityColors = {
  urgent: '#dc2626',
  high: '#ea580c',
  normal: '#2563eb',
  low: '#6b7280',
}
