const API_BASE = '/api'

let currentUser = localStorage.getItem('currentUser') || 'zhangsan'

export function setCurrentUser(userId) {
  currentUser = userId
  localStorage.setItem('currentUser', userId)
}

export function getCurrentUser() {
  return currentUser
}

async function request(url, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    'X-Current-User': currentUser,
    ...options.headers
  }

  try {
    const response = await fetch(`${API_BASE}${url}`, {
      ...options,
      headers
    })

    const data = await response.json()

    if (!response.ok) {
      const error = new Error(data.error || data.message || `请求失败: ${response.status}`)
      error.code = data.code
      error.data = data
      throw error
    }

    return data
  } catch (error) {
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      throw new Error('无法连接到后端服务，请确保后端服务已启动（端口 8001）')
    }
    throw error
  }
}

export const api = {
  getUserInfo() {
    return request('/user', { method: 'GET' })
  },

  getOrders(params = {}) {
    const query = new URLSearchParams(params).toString()
    return request(`/orders${query ? '?' + query : ''}`, { method: 'GET' })
  },

  getOrderDetail(orderId) {
    return request(`/orders/${orderId}`, { method: 'GET' })
  },

  createOrder(orderData) {
    return request('/orders', {
      method: 'POST',
      body: JSON.stringify(orderData)
    })
  },

  resubmitOrder(orderId, data) {
    return request(`/orders/${orderId}/resubmit`, {
      method: 'POST',
      body: JSON.stringify(data)
    })
  },

  batchProcess(processData) {
    return request('/orders/batch', {
      method: 'POST',
      body: JSON.stringify(processData)
    })
  },

  getStatistics() {
    return request('/statistics', { method: 'GET' })
  }
}
