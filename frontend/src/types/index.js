export const ROLES = {
  TRIAGE_NURSE: 'triage_nurse',
  GENERAL_DOCTOR: 'general_doctor',
  MEDICAL_DIRECTOR: 'medical_director'
}

export const ROLE_NAMES = {
  [ROLES.TRIAGE_NURSE]: '导诊护士',
  [ROLES.GENERAL_DOCTOR]: '全科医生',
  [ROLES.MEDICAL_DIRECTOR]: '医务科主任'
}

export const STATUS = {
  DRAFT: 'draft',
  PENDING_SUBMIT: 'pending_submit',
  RETURNED: 'returned',
  RESUBMITTED: 'resubmitted',
  DOCTOR_PROCESSING: 'doctor_processing',
  DIRECTOR_REVIEW: 'director_review',
  COMPLETED: 'completed',
  ARCHIVED: 'archived'
}

export const STATUS_NAMES = {
  [STATUS.DRAFT]: '草稿',
  [STATUS.PENDING_SUBMIT]: '待提交',
  [STATUS.RETURNED]: '已退回',
  [STATUS.RESUBMITTED]: '重新提交',
  [STATUS.DOCTOR_PROCESSING]: '医生处理中',
  [STATUS.DIRECTOR_REVIEW]: '主任审核中',
  [STATUS.COMPLETED]: '已完成',
  [STATUS.ARCHIVED]: '已归档'
}

export const STATUS_COLORS = {
  [STATUS.DRAFT]: 'info',
  [STATUS.PENDING_SUBMIT]: 'warning',
  [STATUS.RETURNED]: 'danger',
  [STATUS.RESUBMITTED]: 'warning',
  [STATUS.DOCTOR_PROCESSING]: 'primary',
  [STATUS.DIRECTOR_REVIEW]: 'primary',
  [STATUS.COMPLETED]: 'success',
  [STATUS.ARCHIVED]: 'info'
}

export const OVERDUE_LEVELS = {
  NORMAL: 'normal',
  WARNING: 'warning',
  OVERDUE: 'overdue'
}

export const OVERDUE_NAMES = {
  [OVERDUE_LEVELS.NORMAL]: '正常',
  [OVERDUE_LEVELS.WARNING]: '临期',
  [OVERDUE_LEVELS.OVERDUE]: '逾期'
}

export const OVERDUE_COLORS = {
  [OVERDUE_LEVELS.NORMAL]: 'success',
  [OVERDUE_LEVELS.WARNING]: 'warning',
  [OVERDUE_LEVELS.OVERDUE]: 'danger'
}

export const EVIDENCE_TYPES = {
  followup_form: '随访单',
  vital_signs: '生命体征',
  medication_record: '用药记录',
  treatment_plan: '治疗方案'
}
