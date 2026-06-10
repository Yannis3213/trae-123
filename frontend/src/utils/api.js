const getHeaders = () => {
  const userStr = localStorage.getItem('repair_user')
  const headers = { 'Content-Type': 'application/json' }
  if (userStr) {
    try {
      const user = JSON.parse(userStr)
      headers['X-User-Role'] = user.role
      headers['X-User-Name'] = user.username
      headers['X-User-Real-Name'] = user.name
    } catch (e) {}
  }
  return headers
}

const handleResponse = async (res) => {
  const text = await res.text()
  let data = {}
  try {
    data = text ? JSON.parse(text) : {}
  } catch (e) {
    data = { detail: text }
  }
  if (!res.ok) {
    throw new Error(data.detail || `请求失败 (${res.status})`)
  }
  return data
}

export const api = {
  get: async (url) => {
    const res = await fetch(url, { headers: getHeaders() })
    return handleResponse(res)
  },
  post: async (url, body) => {
    const res = await fetch(url, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(body || {}),
    })
    return handleResponse(res)
  },
  put: async (url, body) => {
    const res = await fetch(url, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(body || {}),
    })
    return handleResponse(res)
  },
  delete: async (url) => {
    const res = await fetch(url, {
      method: 'DELETE',
      headers: getHeaders(),
    })
    return handleResponse(res)
  },
}
