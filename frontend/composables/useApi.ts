import type { UseFetchOptions } from 'nuxt/app'
import { defu } from 'defu'

function getAuthHeaders() {
  const authStore = useAuthStore()
  return {
    'x-user-id': authStore.user?.id || '',
    'x-user-name': authStore.user?.name || '',
    'x-user-role': authStore.currentRole || '',
  }
}

function handleError(error: any) {
  const message = error?.data?.message || error?.message || '请求失败，请稍后重试'
  useToast().add({
    title: '操作失败',
    description: message,
    color: 'red',
  })
  throw error
}

export function useApi<T>(url: string, options: UseFetchOptions<T> = {}) {
  const config = useRuntimeConfig()

  const defaults: UseFetchOptions<T> = {
    baseURL: config.public.apiBase,
    key: url,
    headers: getAuthHeaders(),
    onResponseError: (ctx) => {
      handleError(ctx.error)
    },
  }

  const params = defu(options, defaults)

  return useFetch(url, params)
}

export async function useApiFetch<T>(url: string, options: any = {}): Promise<T> {
  const config = useRuntimeConfig()

  try {
    return await $fetch<T>(url, {
      baseURL: config.public.apiBase,
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
        ...options?.headers,
      },
    })
  } catch (error: any) {
    handleError(error)
  }
}
