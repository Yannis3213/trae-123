import { getCurrentUser } from './auth';
import type { ApiResponse } from './types';

const API_BASE = 'http://localhost:8001';

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const user = typeof window !== 'undefined' ? getCurrentUser() : { id: 1, role: 'admin' as const };

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-User-ID': String(user.id),
    'X-User-Role': user.role,
    ...(options.headers as Record<string, string> | undefined),
  };

  try {
    const response = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      let message = `HTTP ${response.status}`;
      try {
        const errData = await response.json();
        message = errData.message || errData.error || message;
      } catch {
        // ignore
      }
      return { success: false, error: message, message };
    }

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      const text = await response.text();
      return { success: true, data: text as unknown as T, message: 'OK' };
    }

    const raw = await response.json();
    if (raw && typeof raw === 'object' && 'success' in raw) {
      return raw as ApiResponse<T>;
    }
    return { success: true, data: raw as T, message: 'OK' };
  } catch (err: any) {
    const message = err?.message || '网络请求失败，请检查后端服务是否启动';
    return { success: false, error: message, message };
  }
}

export const api = {
  get: <T>(path: string) => request<T>(path, { method: 'GET' }),
  post: <T>(path: string, body?: any) =>
    request<T>(path, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    }),
  put: <T>(path: string, body?: any) =>
    request<T>(path, {
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
    }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};

export const API_BASE_URL = API_BASE;
