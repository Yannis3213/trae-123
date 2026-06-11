import {
  SamplingTask,
  TaskListResponse,
  TaskDetailResponse,
  ApiResponse,
  BatchResultItem,
  UserRole,
} from '@/types';

const API_BASE = '/api';

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${url}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  const data: ApiResponse<T> = await res.json();

  if (data.code !== 0) {
    throw new Error(data.message || '请求失败');
  }

  return data.data;
}

export interface TaskQueryParams {
  status?: string;
  role?: UserRole;
  handler?: string;
  priority?: string;
  keyword?: string;
  overdue_status?: string;
  page?: number;
  page_size?: number;
}

export const taskApi = {
  list: (params: TaskQueryParams) => {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        query.append(key, String(value));
      }
    });
    return request<TaskListResponse>(`/tasks?${query.toString()}`);
  },

  get: (id: string, role: UserRole) =>
    request<TaskDetailResponse>(`/tasks/${id}?role=${role}`),

  create: (data: {
    task_name: string;
    order_no: string;
    style_no?: string;
    priority: string;
    deadline: string;
    responsible_person: string;
    created_by: string;
    operator_role: UserRole;
    initial_evidence?: boolean;
  }) => request<SamplingTask>('/tasks', {
    method: 'POST',
    body: JSON.stringify(data),
  }),

  process: (data: {
    task_id: string;
    action: string;
    operator_role: UserRole;
    operator_name: string;
    opinion?: string;
    result?: string;
    return_reason?: string;
    audit_note?: string;
    version: number;
    new_handler?: string;
    new_deadline?: string;
    has_mass_production_evidence?: boolean;
    evidence_note?: string;
    abnormal_tags?: string[];
  }) => request<SamplingTask>('/tasks/process', {
    method: 'POST',
    body: JSON.stringify(data),
  }),

  batchProcess: (data: {
    task_ids: string[];
    action: string;
    operator_role: UserRole;
    operator_name: string;
    opinion?: string;
    return_reason?: string;
    audit_note?: string;
    new_handler?: string;
    version_map?: Record<string, number>;
  }) => request<BatchResultItem[]>('/tasks/batch-process', {
    method: 'POST',
    body: JSON.stringify(data),
  }),

  getStatistics: (role: UserRole) =>
    request<any>(`/tasks/statistics?role=${role}`),
};

export function getOverdueStatus(deadline: string): 'normal' | 'warning' | 'overdue' {
  const deadlineTime = new Date(deadline).getTime();
  const now = Date.now();
  const oneDay = 24 * 60 * 60 * 1000;

  if (deadlineTime < now) {
    return 'overdue';
  } else if (deadlineTime - now <= oneDay) {
    return 'warning';
  } else {
    return 'normal';
  }
}

export function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}`;
}

export function parseAbnormalTags(tagsStr: string | null): string[] {
  if (!tagsStr) return [];
  try {
    return JSON.parse(tagsStr);
  } catch {
    return [];
  }
}
