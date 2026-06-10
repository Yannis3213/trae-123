import { useAuth } from './useAuth'

const API_BASE = 'http://localhost:8005/api'

export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  code?: string
  missing?: string[]
}

export function useApi() {
  const { currentRole, currentUserName } = useAuth()

  const headers = computed(() => ({
    'Content-Type': 'application/json',
    'X-User-Role': currentRole.value,
    'X-User-Name': currentUserName.value
  }))

  async function request<T = any>(
    url: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    try {
      const response = await fetch(`${API_BASE}${url}`, {
        ...options,
        headers: {
          ...headers.value,
          ...(options.headers || {})
        }
      })

      const data = await response.json()

      if (!response.ok) {
        return {
          success: false,
          error: data.error || `请求失败 (${response.status})`,
          code: data.code || 'HTTP_ERROR',
          missing: data.missing
        }
      }

      return data
    } catch (error: any) {
      return {
        success: false,
        error: error.message || '网络错误',
        code: 'NETWORK_ERROR'
      }
    }
  }

  function get<T = any>(url: string): Promise<ApiResponse<T>> {
    return request<T>(url, { method: 'GET' })
  }

  function post<T = any>(url: string, body?: any): Promise<ApiResponse<T>> {
    return request<T>(url, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined
    })
  }

  return {
    get,
    post,
    request,
    API_BASE
  }
}
