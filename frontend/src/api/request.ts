import type { ApiResponse } from '@/types';

const BASE_URL = 'http://localhost:8002/api';

class RequestError extends Error {
  code: number;
  constructor(code: number, message: string) {
    super(message);
    this.code = code;
    this.name = 'RequestError';
  }
}

export async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const token = localStorage.getItem('token');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      ...options,
      headers,
    });
    const data = (await res.json()) as ApiResponse<T>;
    if (data.code !== 0) {
      throw new RequestError(data.code, data.message);
    }
    return data;
  } catch (err) {
    if (err instanceof RequestError) {
      throw err;
    }
    throw new RequestError(-1, '网络请求失败，请检查后端服务是否启动');
  }
}

export { RequestError };
