import axios from 'axios'

const BACKEND_PORT = Number(import.meta.env.VITE_BACKEND_PORT || 5000)
const FRONTEND_PORT = Number(import.meta.env.VITE_FRONTEND_PORT || 5173)

const isProxyAvailable = !!(import.meta.env.DEV)

const api = axios.create({
  baseURL: isProxyAvailable
    ? '/api'
    : `http://localhost:${BACKEND_PORT}/api`,
  timeout: 15000
})

api.CONSTANTS = { BACKEND_PORT, FRONTEND_PORT }

api.interceptors.request.use((config) => {
  const role = localStorage.getItem('user_role') || 'dispatcher'
  const name = localStorage.getItem('user_name') || '现场调度-小王'
  config.headers['X-User-Role'] = role
  config.headers['X-User-Name'] = name
  return config
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const code = error.response?.data?.code
    if (code === 'VERSION_CONFLICT') {
      console.warn('[版本冲突] 当前页面数据已过期，请刷新后重试')
    }
    if (code === 'STATUS_CONFLICT') {
      console.warn('[状态冲突]', error.response?.data?.error)
    }
    console.error('API Error:', error.response?.data || error.message)
    return Promise.reject(error)
  }
)

export default api
export { BACKEND_PORT, FRONTEND_PORT }
