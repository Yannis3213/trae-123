import type {
  Enrollment,
  EnrollmentDetail,
  EnrollmentListResponse,
  StatsResponse,
  BatchResultResponse,
  BatchAuditRequest,
  BatchReviewRequest,
} from '~/types'

export interface ListParams {
  status?: string
  expiry_status?: string
  store?: string
  keyword?: string
  my_todo?: boolean
  page?: number
  page_size?: number
}

export const useEnrollmentApi = () => {
  const config = useRuntimeConfig()
  const { getAuthHeaders } = useAuth()

  const baseUrl = config.public.apiBase

  const getList = async (params: ListParams = {}): Promise<EnrollmentListResponse> => {
    const query = new URLSearchParams()
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        query.append(key, String(value))
      }
    })
    const queryStr = query.toString()
    const url = queryStr ? `${baseUrl}/enrollments?${queryStr}` : `${baseUrl}/enrollments`

    return await $fetch<EnrollmentListResponse>(url, {
      headers: getAuthHeaders(),
    })
  }

  const getDetail = async (id: number): Promise<EnrollmentDetail> => {
    return await $fetch<EnrollmentDetail>(`${baseUrl}/enrollments/${id}`, {
      headers: getAuthHeaders(),
    })
  }

  const create = async (data: any): Promise<Enrollment> => {
    return await $fetch<Enrollment>(`${baseUrl}/enrollments`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: data,
    })
  }

  const audit = async (data: {
    enrollment_id: number
    passed: boolean
    comment?: string
    version: number
  }): Promise<Enrollment> => {
    return await $fetch<Enrollment>(`${baseUrl}/enrollments/audit`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: data,
    })
  }

  const review = async (data: {
    enrollment_id: number
    passed: boolean
    comment?: string
    version: number
  }): Promise<Enrollment> => {
    return await $fetch<Enrollment>(`${baseUrl}/enrollments/review`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: data,
    })
  }

  const correct = async (data: {
    enrollment_id: number
    comment: string
    update_data?: any
    version: number
  }): Promise<Enrollment> => {
    return await $fetch<Enrollment>(`${baseUrl}/enrollments/correct`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: data,
    })
  }

  const batchAudit = async (data: {
    ids: number[]
    passed: boolean
    comment?: string
  }): Promise<BatchResultResponse> => {
    return await $fetch<BatchResultResponse>(`${baseUrl}/enrollments/batch/audit`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: data,
    })
  }

  const batchReview = async (data: {
    ids: number[]
    passed: boolean
    comment?: string
  }): Promise<BatchResultResponse> => {
    return await $fetch<BatchResultResponse>(`${baseUrl}/enrollments/batch/review`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: data,
    })
  }

  const getStats = async (): Promise<StatsResponse> => {
    return await $fetch<StatsResponse>(`${baseUrl}/enrollments/stats/summary`, {
      headers: getAuthHeaders(),
    })
  }

  const checkExceptions = async (): Promise<any[]> => {
    return await $fetch<any[]>(`${baseUrl}/enrollments/check-exceptions`, {
      method: 'POST',
      headers: getAuthHeaders(),
    })
  }

  return {
    getList,
    getDetail,
    create,
    audit,
    review,
    correct,
    batchAudit,
    batchReview,
    getStats,
    checkExceptions,
  }
}
