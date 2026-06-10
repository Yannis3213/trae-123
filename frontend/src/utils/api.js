const getBaseHeaders = () => {
  const userStr = localStorage.getItem('repair_user')
  const headers = {}
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

const getJsonHeaders = () => ({ ...getBaseHeaders(), 'Content-Type': 'application/json' })

const handleResponse = async (res) => {
  const text = await res.text()
  let data = {}
  try {
    data = text ? JSON.parse(text) : {}
  } catch (e) {
    data = { detail: text }
  }
  if (!res.ok) {
    const err = new Error(data.detail || `请求失败 (${res.status})`)
    err.errorCode = data.error_code
    err.orderNo = data.order_no
    err.data = data
    throw err
  }
  return data
}

export const api = {
  get: async (url) => {
    const res = await fetch(url, { headers: getJsonHeaders() })
    return handleResponse(res)
  },
  post: async (url, body) => {
    const res = await fetch(url, {
      method: 'POST',
      headers: getJsonHeaders(),
      body: JSON.stringify(body || {}),
    })
    return handleResponse(res)
  },
  put: async (url, body) => {
    const res = await fetch(url, {
      method: 'PUT',
      headers: getJsonHeaders(),
      body: JSON.stringify(body || {}),
    })
    return handleResponse(res)
  },
  delete: async (url) => {
    const res = await fetch(url, {
      method: 'DELETE',
      headers: getJsonHeaders(),
    })
    return handleResponse(res)
  },
  upload: async (url, fileListOrFormData) => {
    let body
    if (fileListOrFormData instanceof FormData) {
      body = fileListOrFormData
    } else {
      body = new FormData()
      fileListOrFormData.forEach(f => body.append('file', f))
    }
    const res = await fetch(url, {
      method: 'POST',
      headers: getBaseHeaders(),
      body,
    })
    return handleResponse(res)
  },
}
