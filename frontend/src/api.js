const API_BASE = '/api'

let currentRole = 'registrar'

export function setRole(role) {
  currentRole = role
}

export function getRole() {
  return currentRole
}

async function request(path, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    'X-User-Role': currentRole,
    ...options.headers,
  }

  if (options.version !== undefined) {
    headers['X-If-Match'] = String(options.version)
  }

  const response = await fetch(API_BASE + path, {
    ...options,
    headers,
  })

  const data = await response.json()

  if (!response.ok) {
    const error = new Error(data.message || '请求失败')
    error.code = data.code
    error.status = response.status
    throw error
  }

  return data.data
}

export const api = {
  getRoles: () => request('/roles'),
  getMe: () => request('/me'),
  switchRole: (role) => request('/switch-role', {
    method: 'POST',
    body: JSON.stringify({ role }),
  }),

  getApplications: (params = {}) => {
    const query = new URLSearchParams()
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== '') query.append(k, v)
    })
    return request(`/applications?${query.toString()}`)
  },

  getApplication: (id) => request(`/applications/${id}`),

  createApplication: (data) => request('/applications', {
    method: 'POST',
    body: JSON.stringify(data),
  }),

  updateApplication: (id, data) => request(`/applications/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
    version: data.version,
  }),

  assignApplication: (id, data) => request(`/applications/${id}/assign`, {
    method: 'POST',
    body: JSON.stringify(data),
    version: data.version,
  }),

  transferApplication: (id, data) => request(`/applications/${id}/transfer`, {
    method: 'POST',
    body: JSON.stringify(data),
    version: data.version,
  }),

  visitApplication: (id, data) => request(`/applications/${id}/visit`, {
    method: 'POST',
    body: JSON.stringify(data),
    version: data.version,
  }),

  correctApplication: (id, data) => request(`/applications/${id}/correct`, {
    method: 'POST',
    body: JSON.stringify(data),
    version: data.version,
  }),

  returnApplication: (id, data) => request(`/applications/${id}/return`, {
    method: 'POST',
    body: JSON.stringify(data),
    version: data.version,
  }),

  reviewApplication: (id, data) => request(`/applications/${id}/review`, {
    method: 'POST',
    body: JSON.stringify(data),
    version: data.version,
  }),

  getAuditTrail: (id) => request(`/applications/${id}/audit`),

  uploadEvidence: (id, data) => request(`/applications/${id}/evidence`, {
    method: 'POST',
    body: JSON.stringify(data),
  }),

  getStats: () => request('/applications/stats'),

  getCorrections: (params = {}) => {
    const query = new URLSearchParams()
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== '') query.append(k, v)
    })
    return request(`/corrections?${query.toString()}`)
  },

  submitCorrection: (id, data) => request(`/corrections/${id}/submit`, {
    method: 'POST',
    body: JSON.stringify(data),
    version: data.version,
  }),

  getNotifications: (params = {}) => {
    const query = new URLSearchParams()
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== '') query.append(k, v)
    })
    return request(`/notifications?${query.toString()}`)
  },

  submitNotification: (id, data) => request(`/notifications/${id}/submit`, {
    method: 'POST',
    body: JSON.stringify(data),
    version: data.version,
  }),

  batchProcess: (data) => request('/batch/process', {
    method: 'POST',
    body: JSON.stringify(data),
  }),

  batchAdvanceOverdue: (data) => request('/batch/advance', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
}
