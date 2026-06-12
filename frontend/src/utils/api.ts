const API_BASE = 'http://localhost:8107/api';

let _getAuthHeader: (() => Record<string, string>) | null = null;

export function setAuthHeaderProvider(fn: () => Record<string, string>) {
  _getAuthHeader = fn;
}

export async function apiFetch<T>(path: string, options?: RequestInit): Promise<{ code: number; message: string; data: T }> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (_getAuthHeader) {
    Object.assign(headers, _getAuthHeader());
  }
  const res = await fetch(`${API_BASE}${path}`, {
    headers,
    ...options,
  });
  if (!res.ok) {
    const text = await res.text();
    let errorData;
    try {
      errorData = JSON.parse(text);
    } catch {
      throw new Error(`HTTP ${res.status}: ${text}`);
    }
    throw new Error(errorData.message || `HTTP ${res.status}`);
  }
  return res.json();
}

export type Role = 'registrar' | 'reviewer' | 'director';
export type PlanStatus = 'pending_sign' | 'reviewing' | 'pending_verify' | 'archived' | 'returned' | 'rejected';
export type Priority = 'urgent' | 'high' | 'normal' | 'low';
export type DueWarning = 'normal' | 'approaching' | 'overdue';
export type PlanType = 'communication_plan' | 'material_review' | 'placement_confirm';

export interface User {
  id: number;
  username: string;
  role: Role;
  name: string;
}

export interface Attachment {
  id: number;
  planId: number;
  fileName: string;
  fileSize: number;
  fileType: string;
  required: boolean;
  uploadedAt: string | null;
}

export interface ProcessRecord {
  id: number;
  planId: number;
  action: string;
  operator: string;
  operatorRole: string;
  fromStatus: string | null;
  toStatus: string;
  result: string | null;
  returnReason: string | null;
  auditNote: string | null;
  exceptionReason: string | null;
  createdAt: string;
}

export interface AuditNote {
  id: number;
  planId: number;
  content: string;
  author: string;
  authorRole: string;
  createdAt: string;
}

export interface Plan {
  id: number;
  planNo: string;
  title: string;
  type: PlanType;
  status: PlanStatus;
  priority: Priority;
  dueDate: string;
  responsiblePerson: string;
  currentHandler: string;
  currentHandlerRole: Role;
  version: number;
  exceptionTag: string | null;
  dueWarning: DueWarning;
  creatorId: number;
  reviewResult: string | null;
  verifyResult: string | null;
  returnReason: string | null;
  createdAt: string;
  updatedAt: string;
  attachments: Attachment[];
  processRecords: ProcessRecord[];
  auditNotes: AuditNote[];
}

export interface BatchResult {
  planId: number;
  planNo: string;
  success: boolean;
  reason: string | null;
}

export interface Stats {
  total: number;
  pending_sign: number;
  reviewing: number;
  pending_verify: number;
  archived: number;
  returned: number;
  rejected: number;
  overdue: number;
  exception: number;
}

export const STATUS_LABELS: Record<PlanStatus, string> = {
  pending_sign: '待签收',
  reviewing: '审核中',
  pending_verify: '待复核',
  archived: '签收完成',
  returned: '退回补正',
  rejected: '异常回传',
};

export const PRIORITY_LABELS: Record<Priority, string> = {
  urgent: '紧急',
  high: '高',
  normal: '普通',
  low: '低',
};

export const TYPE_LABELS: Record<PlanType, string> = {
  communication_plan: '传播计划',
  material_review: '素材审核',
  placement_confirm: '投放确认',
};

export const ROLE_LABELS: Record<Role, string> = {
  registrar: '传播计划登记员',
  reviewer: '传播计划审核主管',
  director: '公关传播团队复核负责人',
};

export const WARNING_LABELS: Record<DueWarning, string> = {
  normal: '正常',
  approaching: '临期',
  overdue: '逾期',
};
