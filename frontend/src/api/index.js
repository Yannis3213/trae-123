const API_BASE = '/api'

function getHeaders() {
  const user = JSON.parse(localStorage.getItem('currentUser') || '{}')
  return {
    'Content-Type': 'application/json',
    'X-User-ID': user.id || '',
    'X-User-Role': user.role || '',
    'X-User-Name': user.name || ''
  }
}

async function request(url, options = {}) {
  const res = await fetch(`${API_BASE}${url}`, {
    ...options,
    headers: {
      ...getHeaders(),
      ...options.headers
    }
  })
  let data = {}
  try {
    data = await res.json()
  } catch (e) {}
  if (!res.ok) {
    const msg = data?.message || `请求失败 (${res.status})`
    const err = new Error(msg)
    err.detail = data?.detail || null
    err.status = res.status
    throw err
  }
  return data
}

export const api = {
  getCurrentUser: () => request('/user/current'),
  getStats: () => request('/stats'),

  listHazards: (params = {}) => {
    const qs = new URLSearchParams(params).toString()
    return request(`/hazards/${qs ? '?' + qs : ''}`)
  },

  getHazard: (id) => request(`/hazards/${id}`),

  createHazard: (data) => request('/hazards/', {
    method: 'POST',
    body: JSON.stringify(data)
  }),

  processHazard: (id, data) => request(`/hazards/${id}/process`, {
    method: 'POST',
    body: JSON.stringify(data)
  }),

  batchProcess: (data) => request('/hazards/batch', {
    method: 'POST',
    body: JSON.stringify(data)
  }),

  addAuditNote: (id, content) => request(`/hazards/${id}/audit`, {
    method: 'POST',
    body: JSON.stringify({ content })
  }),

  addAbnormalReason: (id, reason, category) => request(`/hazards/${id}/abnormal`, {
    method: 'POST',
    body: JSON.stringify({ reason, category })
  }),

  addAttachment: (id, fileData) => request(`/hazards/${id}/attachments`, {
    method: 'POST',
    body: JSON.stringify(fileData)
  }),

  deleteAttachment: (id) => request(`/hazards/attachments/${id}`, {
    method: 'DELETE'
  })
}
