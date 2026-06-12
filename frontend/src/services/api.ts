import { config } from "~/config";
import type {
  LoginRequest,
  LoginResponse,
  ApplicationListResponse,
  ApplicationDetailResponse,
  ActionRequest,
  BatchActionRequest,
  BatchActionResponse,
  StatisticsResponse,
  ConstantsResponse,
  User,
} from "~/types";

function getToken(): string | null {
  if (typeof window !== "undefined") {
    return localStorage.getItem(config.storageKey);
  }
  return null;
}

function clearAuth(): void {
  if (typeof window !== "undefined") {
    localStorage.removeItem(config.storageKey);
    localStorage.removeItem(config.userKey);
  }
}

function setAuth(token: string, user: User): void {
  if (typeof window !== "undefined") {
    localStorage.setItem(config.storageKey, token);
    localStorage.setItem(config.userKey, JSON.stringify(user));
  }
}

function getStoredUser(): User | null {
  if (typeof window !== "undefined") {
    const userStr = localStorage.getItem(config.userKey);
    if (userStr) {
      try {
        return JSON.parse(userStr);
      } catch {
        return null;
      }
    }
  }
  return null;
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  authRequired = true
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (authRequired) {
    const token = getToken();
    if (!token) {
      throw new Error("未登录");
    }
    headers["Authorization"] = `Bearer ${token}`;
  }

  try {
    const response = await fetch(`${config.apiBaseUrl}${path}`, {
      ...options,
      headers,
    });

    if (response.status === 401) {
      clearAuth();
      if (typeof window !== "undefined") {
        window.location.href = "/login";
      }
      throw new Error("登录已过期，请重新登录");
    }

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.detail || data.error_message || "请求失败");
    }

    return data as T;
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error("网络错误");
  }
}

export const api = {
  auth: {
    login: async (data: LoginRequest): Promise<LoginResponse> => {
      const response = await request<LoginResponse>(
        "/auth/login",
        {
          method: "POST",
          body: JSON.stringify(data),
        },
        false
      );
      setAuth(response.access_token, response.user);
      return response;
    },

    logout: (): void => {
      clearAuth();
    },

    getCurrentUser: (): User | null => {
      return getStoredUser();
    },

    me: async (): Promise<User> => {
      return request<User>("/auth/me");
    },
  },

  constants: async (): Promise<ConstantsResponse> => {
    return request<ConstantsResponse>("/constants");
  },

  applications: {
    list: async (params: {
      status?: string;
      queue?: string;
      warning_level?: string;
      stat_group?: string;
      keyword?: string;
      page?: number;
      page_size?: number;
    }): Promise<ApplicationListResponse> => {
      const query = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== "") {
          query.append(key, String(value));
        }
      });
      const queryStr = query.toString();
      return request<ApplicationListResponse>(
        `/applications${queryStr ? `?${queryStr}` : ""}`
      );
    },

    get: async (id: number): Promise<ApplicationDetailResponse> => {
      return request<ApplicationDetailResponse>(`/applications/${id}`);
    },

    create: async (data: any): Promise<any> => {
      return request<any>("/applications", {
        method: "POST",
        body: JSON.stringify(data),
      });
    },

    action: async (
      id: number,
      data: ActionRequest
    ): Promise<ApplicationDetailResponse> => {
      return request<ApplicationDetailResponse>(`/applications/${id}/action`, {
        method: "POST",
        body: JSON.stringify(data),
      });
    },

    addNote: async (id: number, note: string): Promise<any> => {
      return request<any>(`/applications/${id}/notes`, {
        method: "POST",
        body: JSON.stringify({ note }),
      });
    },
  },

  batch: {
    action: async (data: BatchActionRequest): Promise<BatchActionResponse> => {
      return request<BatchActionResponse>("/batch/action", {
        method: "POST",
        body: JSON.stringify(data),
      });
    },
  },

  statistics: async (): Promise<StatisticsResponse> => {
    return request<StatisticsResponse>("/statistics");
  },
};
