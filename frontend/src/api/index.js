import axios from 'axios'

const BACKEND_PORT = 5000
const api = axios.create({
  baseURL: `http://localhost:${BACKEND_PORT}/api`,
  timeout: 10000
})

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
    console.error('API Error:', error.response?.data || error.message)
    return Promise.reject(error)
  }
)

export default api
