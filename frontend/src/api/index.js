import { authHeaders } from '../stores/auth.js'

const BASE = '/api'

async function request(path, options = {}) {
  const res = await fetch(BASE + path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(),
      ...(options.headers || {}),
    },
  })
  let data = null
  const text = await res.text()
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = { message: text }
  }
  if (!res.ok) {
    const msg = data?.message || `请求失败 (${res.status})`
    throw new Error(msg)
  }
  return data
}

export const api = {
  login(username, password) {
    return request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    })
  },
  listUsers() {
    return request('/users')
  },
  listTickets(params = {}) {
    const qs = new URLSearchParams()
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') qs.append(k, v)
    })
    return request(`/tickets?${qs.toString()}`)
  },
  getTicketStatistics() {
    return request('/tickets/statistics')
  },
  createTicket(data) {
    return request('/tickets', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },
  getTicket(id) {
    return request(`/tickets/${id}`)
  },
  processTicket(id, data) {
    return request(`/tickets/${id}/process`, {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },
  batchProcess(data) {
    return request('/tickets/batch-process', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },
  addAttachment(ticketId, data) {
    return request(`/tickets/${ticketId}/attachments`, {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },
  addAuditRemark(ticketId, content) {
    return request(`/tickets/${ticketId}/audit-remarks`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    })
  },
  addExceptionReason(ticketId, reason_type, description) {
    return request(`/tickets/${ticketId}/exception-reasons`, {
      method: 'POST',
      body: JSON.stringify({ reason_type, description }),
    })
  },
}
