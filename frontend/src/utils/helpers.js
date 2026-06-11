import dayjs from 'dayjs'
import {
  WARNING_LEVELS,
  ORDER_STATUS_KEYS,
  MODULE_STATUS_KEYS,
  ROLE_KEYS,
  MODULE_TYPE_KEYS,
  ROLE_LABELS,
  ROLE_COLORS,
  MODULE_STATUS_LABELS,
  MODULE_STATUS_COLORS
} from './constants.js'

export function getWarningLevel(deadline) {
  if (!deadline) return WARNING_LEVELS.NORMAL
  const now = dayjs()
  const due = dayjs(deadline)
  const diffDays = due.diff(now, 'day')
  if (diffDays < 0) return WARNING_LEVELS.OVERDUE
  if (diffDays <= 3) return WARNING_LEVELS.WARNING
  return WARNING_LEVELS.NORMAL
}

export function getWarningLevelFromDays(daysLeft) {
  if (daysLeft === null || daysLeft === undefined) return WARNING_LEVELS.NORMAL
  if (daysLeft < 0) return WARNING_LEVELS.OVERDUE
  if (daysLeft <= 3) return WARNING_LEVELS.WARNING
  return WARNING_LEVELS.NORMAL
}

export function formatDate(date, format = 'YYYY-MM-DD HH:mm:ss') {
  if (!date) return '-'
  return dayjs(date).format(format)
}

export function formatDateSimple(date) {
  return formatDate(date, 'YYYY-MM-DD')
}

export function truncateText(text, maxLength = 50) {
  if (!text) return '-'
  if (text.length <= maxLength) return text
  return text.slice(0, maxLength) + '...'
}

export function getFileSize(size) {
  if (!size) return '-'
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(2)} KB`
  return `${(size / 1024 / 1024).toFixed(2)} MB`
}

export function hasAction(allowedActions, action) {
  if (!allowedActions || !Array.isArray(allowedActions)) return false
  return allowedActions.includes(action)
}

export function getRoleDisplay(role) {
  return ROLE_LABELS[role] || role
}

export function getModuleStatusLabel(status) {
  return MODULE_STATUS_LABELS[status] || status || '未开始'
}

export function getModuleStatusColor(status) {
  return MODULE_STATUS_COLORS[status] || 'default'
}

export function canSubmitModule(allowedActions, moduleType) {
  if (!allowedActions) return false
  const typeLower = moduleType ? moduleType.toLowerCase() : ''
  const actionMap = {
    requirement: 'requirement_submit',
    schedule: 'schedule_submit',
    delivery: 'delivery_submit'
  }
  return allowedActions.includes(actionMap[typeLower])
}

export function canAuditModule(allowedActions, moduleType) {
  if (!allowedActions) return false
  const typeLower = moduleType ? moduleType.toLowerCase() : ''
  const approveMap = {
    requirement: 'requirement_audit',
    schedule: 'schedule_audit',
    delivery: 'delivery_audit'
  }
  return allowedActions.includes(approveMap[typeLower])
}

export function canReview(allowedActions) {
  if (!allowedActions) return false
  return allowedActions.includes('review')
}

export function canArchive(allowedActions) {
  if (!allowedActions) return false
  return allowedActions.includes('archive')
}

export function canAdvance(allowedActions) {
  if (!allowedActions) return false
  return allowedActions.includes('advance')
}

export function generateOrderNo() {
  const now = dayjs()
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0')
  return `XQJF${now.format('YYYYMMDD')}${random}`
}

export function formatUser(user) {
  if (!user) return '-'
  if (typeof user === 'string') return user
  const username = user.username || user.user_name || '-'
  const roleDisplay = user.role_display || user.roleDisplay || getRoleDisplay(user.role)
  if (!username || username === '-') return '-'
  return roleDisplay ? `${username} (${roleDisplay})` : username
}

export function getUserRoleColor(role) {
  if (!role) return 'default'
  return ROLE_COLORS[role] || 'default'
}

export function canCorrectModule(allowedActions, moduleType) {
  if (!allowedActions) return false
  const typeLower = moduleType ? moduleType.toLowerCase() : ''
  const actionMap = {
    requirement: 'requirement_correct',
    schedule: 'schedule_correct',
    delivery: 'delivery_correct'
  }
  return allowedActions.includes(actionMap[typeLower])
}
