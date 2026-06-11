import axios from 'axios'

const api = axios.create({
  baseURL: 'http://localhost:8002/api',
  timeout: 30000
})

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error)
)

api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

export const authApi = {
  login: (data) => api.post('/login', data),
  me: () => api.get('/me')
}

export const orderApi = {
  list: (params) => api.get('/orders', { params }),
  detail: (id) => api.get(`/orders/${id}`),
  create: (data) => api.post('/orders', data),
  submitRequirement: (id, data) => api.post(`/orders/${id}/requirement/submit`, data),
  auditRequirement: (id, data) => api.post(`/orders/${id}/requirement/audit`, data),
  submitSchedule: (id, data) => api.post(`/orders/${id}/schedule/submit`, data),
  auditSchedule: (id, data) => api.post(`/orders/${id}/schedule/audit`, data),
  submitDelivery: (id, data) => api.post(`/orders/${id}/delivery/submit`, data),
  auditDelivery: (id, data) => api.post(`/orders/${id}/delivery/audit`, data),
  review: (id, data) => api.post(`/orders/${id}/review`, data),
  archive: (id) => api.post(`/orders/${id}/archive`),
  batchProcess: (data) => api.post('/orders/batch-process', data),
  getAllowedActions: (id) => api.get(`/orders/${id}/allowed-actions`)
}

export const statisticsApi = {
  getOverview: () => api.get('/statistics'),
  getDeadlineWarnings: () => api.get('/deadline-warnings')
}

export const userApi = {
  list: (params) => api.get('/users', { params })
}

export default api
