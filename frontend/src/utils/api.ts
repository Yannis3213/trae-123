const getApiBaseUrl = (): string => {
  const baseUrl = (import.meta as any).env?.VITE_API_BASE_URL;
  if (baseUrl) return baseUrl;
  const port = (import.meta as any).env?.VITE_BACKEND_PORT || '3000';
  return `http://localhost:${port}`;
};

const getToken = (): string | null => {
  return localStorage.getItem('token');
};

const setToken = (token: string) => {
  localStorage.setItem('token', token);
};

const clearToken = () => {
  localStorage.removeItem('token');
};

export interface ApiError {
  error: string;
  code: string;
  status?: number;
}

class ApiClient {
  private baseUrl: string;

  constructor() {
    this.baseUrl = getApiBaseUrl();
  }

  private async request<T>(
    method: string,
    path: string,
    body?: any,
    options: { requireAuth?: boolean } = { requireAuth: true }
  ): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (options.requireAuth) {
      const token = getToken();
      if (!token) {
        throw { error: '未登录', code: 'AUTH_ERROR', status: 401 } as ApiError;
      }
      headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    const data = await res.json().catch(() => ({
      error: res.statusText,
      code: 'UNKNOWN_ERROR',
    }));

    if (!res.ok) {
      throw { ...data, status: res.status } as ApiError;
    }

    return data as T;
  }

  async login(username: string, password: string) {
    const result = await this.request<any>(
      'POST',
      '/api/auth/login',
      { username, password },
      { requireAuth: false }
    );
    setToken(result.token);
    localStorage.setItem('user', JSON.stringify(result.user));
    return result;
  }

  logout() {
    clearToken();
    localStorage.removeItem('user');
  }

  getCurrentUser() {
    const userStr = localStorage.getItem('user');
    return userStr ? JSON.parse(userStr) : null;
  }

  async getMe() {
    return this.request<any>('GET', '/api/auth/me');
  }

  async getOrders(params: Record<string, any> = {}) {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') {
        query.set(k, String(v));
      }
    });
    const qs = query.toString();
    return this.request<any>(
      'GET',
      `/api/orders${qs ? `?${qs}` : ''}`
    );
  }

  async getOrder(id: string) {
    return this.request<any>('GET', `/api/orders/${id}`);
  }

  async createOrder(data: any) {
    return this.request<any>('POST', '/api/orders', data);
  }

  async updateOrder(id: string, data: any) {
    return this.request<any>('PUT', `/api/orders/${id}`, data);
  }

  async changeStatus(id: string, data: any) {
    return this.request<any>('PUT', `/api/orders/${id}/status`, data);
  }

  async batchProcess(data: any) {
    return this.request<any>('POST', '/api/orders/batch', data);
  }

  async uploadAttachment(id: string, data: any) {
    return this.request<any>('POST', `/api/orders/${id}/attachments`, data);
  }

  async getAttachments(id: string) {
    return this.request<any>('GET', `/api/orders/${id}/attachments`);
  }

  async getRecords(id: string) {
    return this.request<any>('GET', `/api/orders/${id}/records`);
  }

  async addRecord(id: string, data: any) {
    return this.request<any>('POST', `/api/orders/${id}/records`, data);
  }

  async addAuditNote(id: string, data: any) {
    return this.request<any>('POST', `/api/orders/${id}/audit`, data);
  }

  async getAuditNotes(id: string) {
    return this.request<any>('GET', `/api/orders/${id}/audit`);
  }

  async getDashboardStats() {
    return this.request<any>('GET', '/api/dashboard/stats');
  }
}

export const api = new ApiClient();
