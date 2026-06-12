import { signal, computed } from '@preact/signals-core'
import { api, setRole, getRole } from './api.js'

export const currentUser = signal(null)
export const currentRole = signal(getRole())
export const currentModule = signal('application')
export const applications = signal([])
export const pagination = signal({ page: 1, pageSize: 10, total: 0 })
export const filters = signal({ keyword: '', status: '', warning: '' })
export const selectedIds = signal(new Set())
export const stats = signal(null)
export const loading = signal(false)
export const error = signal(null)
export const batchResults = signal(null)

export const roleName = computed(() => {
  const names = {
    registrar: '商标申请登记员',
    agent: '商标申请审核主管',
    director: '知识产权代理所复核负责人',
  }
  return names[currentRole.value] || ''
})

export const moduleName = computed(() => {
  const names = {
    application: '商标申请',
    correction: '材料补正',
    notification: '递交通知',
  }
  return names[currentModule.value] || ''
})

export async function initUser() {
  try {
    const user = await api.getMe()
    currentUser.value = user
  } catch (e) {
    console.error('Failed to get user:', e)
  }
}

export async function switchRole(role) {
  try {
    const result = await api.switchRole(role)
    setRole(role)
    currentRole.value = role
    currentUser.value = {
      id: role,
      name: role === 'registrar' ? '李登记' : role === 'agent' ? '王代理' : '张所长',
      role: role,
      role_name: result.role_name,
    }
    selectedIds.value = new Set()
    batchResults.value = null
    await loadApplications()
    await loadStats()
    return true
  } catch (e) {
    error.value = e.message
    return false
  }
}

export async function loadApplications() {
  loading.value = true
  error.value = null
  try {
    const params = {
      page: pagination.value.page,
      page_size: pagination.value.pageSize,
      keyword: filters.value.keyword,
      status: filters.value.status,
      warning: filters.value.warning,
      module: currentModule.value,
    }
    let result
    if (currentModule.value === 'correction') {
      result = await api.getCorrections(params)
    } else if (currentModule.value === 'notification') {
      result = await api.getNotifications(params)
    } else {
      result = await api.getApplications(params)
    }
    applications.value = result.list
    pagination.value = {
      page: result.page,
      pageSize: result.page_size,
      total: result.total,
    }
  } catch (e) {
    error.value = e.message
    applications.value = []
  } finally {
    loading.value = false
  }
}

export async function loadStats() {
  try {
    const data = await api.getStats()
    stats.value = data
  } catch (e) {
    console.error('Failed to load stats:', e)
  }
}

export function toggleSelect(id) {
  const newSet = new Set(selectedIds.value)
  if (newSet.has(id)) {
    newSet.delete(id)
  } else {
    newSet.add(id)
  }
  selectedIds.value = newSet
}

export function selectAll() {
  if (selectedIds.value.size === applications.value.length) {
    selectedIds.value = new Set()
  } else {
    selectedIds.value = new Set(applications.value.map(a => a.id))
  }
}

export function setFilter(key, value) {
  filters.value = { ...filters.value, [key]: value }
  pagination.value = { ...pagination.value, page: 1 }
}

export function setPage(page) {
  pagination.value = { ...pagination.value, page }
}

export function setModule(module) {
  currentModule.value = module
  selectedIds.value = new Set()
  batchResults.value = null
  pagination.value = { ...pagination.value, page: 1 }
  loadApplications()
}

export async function batchProcess(action, opinion = '') {
  loading.value = true
  error.value = null
  try {
    const result = await api.batchProcess({
      ids: Array.from(selectedIds.value),
      action,
      opinion,
    })
    batchResults.value = result
    selectedIds.value = new Set()
    await loadApplications()
    await loadStats()
    return result
  } catch (e) {
    error.value = e.message
    throw e
  } finally {
    loading.value = false
  }
}

export async function batchAdvanceOverdue() {
  loading.value = true
  error.value = null
  try {
    const result = await api.batchAdvanceOverdue({
      ids: Array.from(selectedIds.value),
    })
    batchResults.value = result
    selectedIds.value = new Set()
    await loadApplications()
    await loadStats()
    return result
  } catch (e) {
    error.value = e.message
    throw e
  } finally {
    loading.value = false
  }
}

export function clearBatchResults() {
  batchResults.value = null
}
