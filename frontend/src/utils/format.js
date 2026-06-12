export function statusLabel(status) {
  const labels = {
    pending_assign: '待分派',
    transferred: '已转办',
    visited: '已回访',
    correction: '待补正',
    returned: '已退回',
    archived: '已归档',
  }
  return labels[status] || status
}

export function warningLabel(status) {
  const labels = {
    normal: '正常',
    approaching: '临期',
    overdue: '逾期',
  }
  return labels[status] || status
}

export function moduleLabel(module) {
  const labels = {
    application: '商标申请',
    correction: '材料补正',
    notification: '递交通知',
  }
  return labels[module] || module
}

export function actionLabel(action) {
  const labels = {
    create: '创建',
    assign: '分派',
    transfer: '转办',
    visit: '回访',
    correct: '补正',
    return: '退回',
    review: '复核',
    archive: '归档',
    submit_correction: '提交补正',
    submit_notification: '提交通知',
    upload_evidence: '上传证据',
    update: '更新',
    batch_assign: '批量分派',
    batch_visit: '批量回访',
    batch_review: '批量复核',
    batch_correct: '批量补正',
    batch_advance: '批量推进',
  }
  return labels[action] || action
}

export function formatDate(dateStr) {
  if (!dateStr) return '-'
  const date = new Date(dateStr)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function formatDateTime(dateStr) {
  if (!dateStr) return '-'
  const date = new Date(dateStr)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  const seconds = String(date.getSeconds()).padStart(2, '0')
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`
}

export function daysRemaining(dueDateStr) {
  if (!dueDateStr) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const due = new Date(dueDateStr)
  due.setHours(0, 0, 0, 0)
  const diff = Math.ceil((due - today) / (1000 * 60 * 60 * 24))
  return diff
}
