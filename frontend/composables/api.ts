export const useApi = () => {
  const config = useRuntimeConfig()
  const { currentRole, currentUserName } = useUserStore()

  const getHeaders = () => {
    return {
      'Content-Type': 'application/json',
      'X-User-Role': currentRole.value || 'clerk',
      'X-User-Name': encodeURIComponent(currentUserName.value || 'TestUser')
    }
  }

  const apiGet = async <T = any>(url: string, params?: Record<string, any>): Promise<T> => {
    const query = params ? new URLSearchParams(
      Object.fromEntries(Object.entries(params).filter(([_, v]) => v !== null && v !== undefined && v !== ''))
    ).toString() : ''
    const fullUrl = `${config.public.apiBase}${url}${query ? '?' + query : ''}`
    const res = await $fetch<T>(fullUrl, {
      method: 'GET',
      headers: getHeaders()
    })
    return res as T
  }

  const apiPost = async <T = any>(url: string, body?: any): Promise<T> => {
    const res = await $fetch<T>(`${config.public.apiBase}${url}`, {
      method: 'POST',
      headers: getHeaders(),
      body: body ? JSON.stringify(body) : undefined
    })
    return res as T
  }

  const apiPut = async <T = any>(url: string, body?: any): Promise<T> => {
    const res = await $fetch<T>(`${config.public.apiBase}${url}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: body ? JSON.stringify(body) : undefined
    })
    return res as T
  }

  const apiDelete = async <T = any>(url: string, body?: any): Promise<T> => {
    const res = await $fetch<T>(`${config.public.apiBase}${url}`, {
      method: 'DELETE',
      headers: getHeaders(),
      body: body ? JSON.stringify(body) : undefined
    })
    return res as T
  }

  const apiUpload = async <T = any>(url: string, file: File, extraParams?: Record<string, any>): Promise<T> => {
    const formData = new FormData()
    formData.append('file', file)
    if (extraParams) {
      Object.entries(extraParams).forEach(([k, v]) => {
        if (v !== undefined && v !== null) formData.append(k, String(v))
      })
    }
    const headers = {
      'X-User-Role': currentRole.value || 'clerk',
      'X-User-Name': encodeURIComponent(currentUserName.value || 'TestUser')
    }
    const res = await $fetch<T>(`${config.public.apiBase}${url}`, {
      method: 'POST',
      headers,
      body: formData
    })
    return res as T
  }

  return {
    apiGet,
    apiPost,
    apiPut,
    apiDelete,
    apiUpload
  }
}
