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

export const REQUIRED_EVIDENCE = {
  [STATUS.PENDING_SUBMIT]: ['followup_form'],
  [STATUS.DOCTOR_PROCESSING]: ['followup_form', 'vital_signs'],
  [STATUS.DIRECTOR_REVIEW]: ['followup_form', 'vital_signs', 'medication_record'],
  [STATUS.COMPLETED]: ['followup_form', 'vital_signs', 'medication_record', 'treatment_plan']
}

export const ROLE_STATUS_TRANSITIONS = {
  [ROLES.TRIAGE_NURSE]: [STATUS.DRAFT, STATUS.PENDING_SUBMIT, STATUS.RESUBMITTED],
  [ROLES.GENERAL_DOCTOR]: [STATUS.PENDING_SUBMIT, STATUS.RESUBMITTED, STATUS.DOCTOR_PROCESSING, STATUS.RETURNED],
  [ROLES.MEDICAL_DIRECTOR]: [STATUS.DOCTOR_PROCESSING, STATUS.DIRECTOR_REVIEW, STATUS.COMPLETED, STATUS.RETURNED, STATUS.ARCHIVED]
}

export const WARNING_THRESHOLD_DAYS = 3
export const OVERDUE_THRESHOLD_DAYS = 0
