import axios from 'axios';
import type { AxiosInstance, InternalAxiosRequestConfig, AxiosResponse } from 'axios';

const TOKEN_KEY = 'auth_token';

export const getToken = (): string | null => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
};

export const setToken = (token: string): void => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(TOKEN_KEY, token);
};

export const removeToken = (): void => {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem('auth_user');
};

interface ApiResponse<T = any> {
  code: number;
  data: T;
  message: string;
}

const client: AxiosInstance = axios.create({
  baseURL: 'http://localhost:8002/api',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

client.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = getToken();
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

client.interceptors.response.use(
  (response: AxiosResponse<ApiResponse>) => {
    const res = response.data;
    if (res && typeof res === 'object' && 'code' in res) {
      if (res.code !== 0) {
        return Promise.reject(new Error(res.message || '请求失败'));
      }
      return res.data;
    }
    return res;
  },
  (error) => {
    if (error.response?.status === 401) {
      removeToken();
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
    }
    const res = error.response?.data;
    if (res && typeof res === 'object' && 'message' in res) {
      return Promise.reject(new Error(res.message || '请求失败'));
    }
    return Promise.reject(error);
  }
);

export default client;
