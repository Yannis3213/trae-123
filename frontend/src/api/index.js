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
  const data = await res.json().catch(() => ({}))
  if (!res.ok && !data.success) {
    throw new Error(data.message || `请求失败 (${res.status})`)
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
  })
}
