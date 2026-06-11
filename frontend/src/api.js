import axios from 'axios'

export const API_BASE = '/api'

const ROLE_STORAGE_KEY = 'insurance_user_role'
const USER_STORAGE_KEY = 'insurance_user_info'

const defaultUserByRole = {
  customer_manager: { id: 'cm_01', name: '客户经理-王' },
  underwriter: { id: 'underwriter_01', name: '核保专员-李' },
  business_owner: { id: 'bo_01', name: '业务负责人-陈' },
}

export function getCurrentRole() {
  return localStorage.getItem(ROLE_STORAGE_KEY) || 'customer_manager'
}

export function setCurrentRole(role) {
  localStorage.setItem(ROLE_STORAGE_KEY, role)
  const user = defaultUserByRole[role]
  if (user) {
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user))
  }
}

export function getCurrentUser() {
  const raw = localStorage.getItem(USER_STORAGE_KEY)
  if (raw) {
    try { return JSON.parse(raw) } catch {}
  }
  const role = getCurrentRole()
  return defaultUserByRole[role] || { id: 'default', name: '默认用户' }
}

export const http = axios.create({
  baseURL: API_BASE,
  timeout: 15000,
})

http.interceptors.request.use((config) => {
  const role = getCurrentRole()
  const user = getCurrentUser()
  config.headers = config.headers || {}
  config.headers['X-Role'] = role
  config.headers['X-User-Id'] = user.id
  config.headers['X-User-Name'] = user.name
  return config
})

http.interceptors.response.use(
  (resp) => {
    if (resp.data && resp.data.error) {
      return Promise.reject({ response: { data: resp.data } })
    }
    return resp.data && 'data' in resp.data ? resp.data.data : resp.data
  },
  (err) => {
    const info = err?.response?.data?.error || { message: err.message || '请求失败' }
    return Promise.reject(info)
  }
)

export const ROLES = [
  { value: 'customer_manager', label: '客户经理' },
  { value: 'underwriter', label: '核保专员' },
  { value: 'business_owner', label: '业务负责人' },
]

export const ROLE_LABEL = {
  customer_manager: '客户经理',
  underwriter: '核保专员',
  business_owner: '业务负责人',
}

export const STATUS_LIST = ['待审核', '待补正', '审核通过', '已同步', '已归档', '审核退回']

export const STATUS_COLOR = {
  '待审核': '#faad14',
  '待补正': '#fa8c16',
  '审核通过': '#52c41a',
  '已同步': '#1677ff',
  '已归档': '#8c8c8c',
  '审核退回': '#ff4d4f',
}

export const WARNING_LABEL = {
  normal: '正常',
  approaching: '临期',
  overdue: '逾期',
}

export const WARNING_COLOR = {
  normal: '#52c41a',
  approaching: '#faad14',
  overdue: '#ff4d4f',
}

export const ACTION_LABEL = {
  submit: '提交',
  approve: '审核通过',
  reject: '退回',
  supplement: '补正资料',
  resubmit: '重新提交',
  sync: '同步出单',
  archive: '归档',
}

export const INSURANCE_TYPES = ['重疾险', '寿险', '意外险', '医疗险', '车险', '财险']

export const EVIDENCE_CATEGORIES = [
  { value: 'application_form', label: '投保单' },
  { value: 'id_card', label: '身份证明' },
  { value: 'income', label: '收入证明' },
  { value: 'health', label: '健康报告' },
  { value: 'policy_confirm', label: '出单确认单' },
]

export const REQUIRED_EVIDENCE_BY_ACTION = {
  approve: ['application_form', 'id_card', 'income'],
  sync: ['policy_confirm'],
}

export const EVIDENCE_CATEGORY_LABEL = {
  application_form: '投保单',
  id_card: '身份证明',
  income: '收入证明',
  health: '健康报告',
  policy_confirm: '出单确认单',
}
