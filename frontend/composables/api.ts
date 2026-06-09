import type {
  CarePlan, Attachment, ProcessingRecord, AuditNote, ExceptionReason,
  ApiResponse, BatchResult, Stats, CreatePlanRequest, UpdatePlanRequest,
  ActionRequest, ReturnRequest, BatchRequest,
} from '~/types'

const BASE_URL = 'http://localhost:8004'

function getToken(): string {
  const auth = useAuthStore()
  return auth.token
}

function headers(): Record<string, string> {
  return {
    'Authorization': `Bearer ${getToken()}`,
    'Content-Type': 'application/json',
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: { ...headers(), ...(options.headers || {}) },
  })
  if (!res.ok) {
    let msg = `请求失败：${res.status}`
    try {
      const body = await res.json()
      if (body && body.message) msg = body.message
    } catch {
      // ignore
    }
    return { success: false, message: msg, data: null }
  }
  return await res.json()
}

export const api = {
  async getMe() {
    return request<any>('/api/auth/me')
  },

  async listPlans(query?: { status?: string; warning?: string; keyword?: string }) {
    const q = new URLSearchParams()
    if (query?.status) q.set('status', query.status)
    if (query?.warning) q.set('warning', query.warning)
    if (query?.keyword) q.set('keyword', query.keyword)
    const qs = q.toString()
    return request<CarePlan[]>(`/api/care-plans${qs ? '?' + qs : ''}`)
  },

  async getPlan(id: string) {
    return request<CarePlan>(`/api/care-plans/${id}`)
  },

  async getAttachments(id: string) {
    return request<Attachment[]>(`/api/care-plans/${id}/attachments`)
  },

  async getRecords(id: string) {
    return request<ProcessingRecord[]>(`/api/care-plans/${id}/records`)
  },

  async getAudit(id: string) {
    return request<AuditNote[]>(`/api/care-plans/${id}/audit`)
  },

  async getExceptions(id: string) {
    return request<ExceptionReason[]>(`/api/care-plans/${id}/exceptions`)
  },

  async getStats() {
    return request<Stats>('/api/stats')
  },

  async createPlan(req: CreatePlanRequest) {
    return request<CarePlan>('/api/care-plans', { method: 'POST', body: JSON.stringify(req) })
  },

  async updatePlan(id: string, req: UpdatePlanRequest) {
    return request<CarePlan>(`/api/care-plans/${id}`, { method: 'PUT', body: JSON.stringify(req) })
  },

  async dispatchPlan(id: string, req: ActionRequest) {
    return request<CarePlan>(`/api/care-plans/${id}/dispatch`, { method: 'POST', body: JSON.stringify(req) })
  },

  async submitPlan(id: string, req: ActionRequest) {
    return request<CarePlan>(`/api/care-plans/${id}/submit`, { method: 'POST', body: JSON.stringify(req) })
  },

  async reviewPlan(id: string, req: ActionRequest) {
    return request<CarePlan>(`/api/care-plans/${id}/review`, { method: 'POST', body: JSON.stringify(req) })
  },

  async returnPlan(id: string, req: ReturnRequest) {
    return request<CarePlan>(`/api/care-plans/${id}/return`, { method: 'POST', body: JSON.stringify(req) })
  },

  async batchAction(req: BatchRequest) {
    return request<BatchResult[]>('/api/care-plans/batch', { method: 'POST', body: JSON.stringify(req) })
  },

  async exportPlans(query?: { status?: string; warning?: string; keyword?: string }) {
    const q = new URLSearchParams()
    if (query?.status) q.set('status', query.status)
    if (query?.warning) q.set('warning', query.warning)
    if (query?.keyword) q.set('keyword', query.keyword)
    const qs = q.toString()
    const res = await fetch(`${BASE_URL}/api/export${qs ? '?' + qs : ''}`, {
      headers: headers(),
    })
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `护理计划单导出_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  },
}
