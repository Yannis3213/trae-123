export const API_BASE = "http://localhost:8003/api";

export interface User {
  id: number;
  username: string;
  name: string;
  role: string;
}

export type PrescriptionStatus =
  | "draft"
  | "pending"
  | "to_confirm"
  | "abnormal"
  | "processing"
  | "recheck"
  | "returned"
  | "completed"
  | "archived";

export type UrgencyLevel = "normal" | "warning" | "overdue";

export interface PrescriptionFlow {
  id: number;
  flow_no: string;
  patient_name: string;
  prescription_info: string;
  decoction_info: string;
  delivery_info: string;
  status: PrescriptionStatus;
  urgency: UrgencyLevel;
  current_handler: string;
  current_role: string;
  version: number;
  created_by: string;
  created_at: string;
  updated_at: string;
  due_at: string;
  abnormal_reason?: string;
  return_reason?: string;
  is_material_complete: boolean;
}

export interface ProcessRecord {
  id: number;
  flow_id: number;
  action: string;
  operator: string;
  operator_role: string;
  from_status: string;
  to_status: string;
  remark: string;
  evidence: string;
  created_at: string;
}

export interface AbnormalReason {
  id: number;
  flow_id: number;
  reason: string;
  type: string;
  operator: string;
  responsible_person: string;
  attempt_count: number;
  created_at: string;
}

export interface AuditNote {
  id: number;
  flow_id: number;
  note: string;
  operator: string;
  created_at: string;
}

export const ABNORMAL_TYPE_LABELS: Record<string, string> = {
  material_missing: "资料缺失",
  returned: "退回补正",
  corrected: "已补正",
  timeout: "超时",
};

export interface ActionOption {
  action: string;
  label: string;
  type: "primary" | "success" | "warning" | "danger";
}

export function getAvailableActions(
  status: PrescriptionStatus
): ActionOption[] {
  switch (status) {
    case "draft":
      return [{ action: "submit", label: "提交审核", type: "primary" }];
    case "returned":
      return [
        { action: "resubmit", label: "补正后重新提交", type: "primary" },
        { action: "correct", label: "仅补正资料", type: "success" },
      ];
    case "abnormal":
      return [
        { action: "correct", label: "补正资料", type: "primary" },
        { action: "submit", label: "补正后提交审核", type: "primary" },
      ];
    case "to_confirm":
      return [
        { action: "approve", label: "审批通过", type: "primary" },
        { action: "return", label: "退回补正", type: "warning" },
      ];
    case "processing":
      return [
        { action: "process", label: "办理完成", type: "primary" },
        { action: "return", label: "退回补正", type: "warning" },
      ];
    case "recheck":
      return [
        { action: "archive", label: "复核归档", type: "primary" },
        { action: "return", label: "退回重新办理", type: "warning" },
      ];
    default:
      return [];
  }
}

export function canHandleFlow(
  role: string,
  status: PrescriptionStatus,
  currentHandler: string,
  myUsername: string
): boolean {
  if (status === "archived" || status === "completed") return false;

  if (currentHandler && currentHandler !== myUsername) return false;

  const handlerRoles: Record<PrescriptionStatus, string[]> = {
    draft: ["registrar", "assistant"],
    returned: ["registrar", "assistant"],
    abnormal: ["assistant", "registrar"],
    to_confirm: ["review_supervisor", "physician"],
    processing: ["physician", "review_supervisor"],
    recheck: ["archivist", "pharmacist"],
    pending: ["registrar"],
    completed: ["archivist"],
    archived: [],
  };

  const allowed = handlerRoles[status] || [];
  return allowed.includes(role);
}

export const ACTION_LABELS: Record<string, string> = {
  create: "创建",
  submit: "提交审核",
  resubmit: "补正后重新提交",
  approve: "审批通过",
  process: "办理完成",
  return: "退回补正",
  correct: "补正资料",
  supplement: "补充资料",
  archive: "复核归档",
  complete: "完成",
};

export interface BatchResult {
  flow_id: number;
  flow_no: string;
  success: boolean;
  message: string;
  current_status?: string;
  current_handler?: string;
  current_role?: string;
  responsible_person?: string;
}

const CURRENT_USER_KEY = "current_user";

export function getCurrentUser(): User | null {
  try {
    const stored = localStorage.getItem(CURRENT_USER_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}

export function setCurrentUser(user: User | null) {
  if (user) {
    localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
  } else {
    localStorage.removeItem(CURRENT_USER_KEY);
  }
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const user = getCurrentUser();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> || {}),
  };

  if (user) {
    headers["X-User"] = user.username;
    headers["X-Role"] = user.role;
    headers["X-Name"] = user.name;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    let errMsg = `请求失败 (${res.status})`;
    try {
      const err = await res.json();
      if (err.message) errMsg = err.message;
    } catch {
      // ignore
    }
    throw new Error(errMsg);
  }

  if (res.status === 204) {
    return null as unknown as T;
  }

  return res.json() as Promise<T>;
}

export const STATUS_LABELS: Record<PrescriptionStatus, string> = {
  draft: "草稿",
  pending: "待处理",
  to_confirm: "待确认",
  abnormal: "异常",
  processing: "办理中",
  recheck: "待复查",
  returned: "已退回",
  completed: "已完成",
  archived: "已归档",
};

export const STATUS_COLORS: Record<PrescriptionStatus, string> = {
  draft: "bg-gray-100 text-gray-800",
  pending: "bg-blue-100 text-blue-800",
  to_confirm: "bg-yellow-100 text-yellow-800",
  abnormal: "bg-red-100 text-red-800",
  processing: "bg-indigo-100 text-indigo-800",
  recheck: "bg-purple-100 text-purple-800",
  returned: "bg-orange-100 text-orange-800",
  completed: "bg-green-100 text-green-800",
  archived: "bg-teal-100 text-teal-800",
};

export const URGENCY_LABELS: Record<UrgencyLevel, string> = {
  normal: "正常",
  warning: "临期",
  overdue: "逾期",
};

export const URGENCY_COLORS: Record<UrgencyLevel, string> = {
  normal: "bg-green-500",
  warning: "bg-yellow-500",
  overdue: "bg-red-500",
};

export const ROLE_LABELS: Record<string, string> = {
  registrar: "处方流转登记员",
  review_supervisor: "处方流转审核主管",
  archivist: "中医馆复核负责人",
  assistant: "接诊助理",
  physician: "坐诊医师",
  pharmacist: "药房管理员",
};

export function formatDateTime(isoStr: string): string {
  if (!isoStr) return "-";
  try {
    const d = new Date(isoStr);
    return d.toLocaleString("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return isoStr;
  }
}

export function canPerformAction(
  role: string,
  status: PrescriptionStatus,
  action: string
): boolean {
  const handlerRoles: Record<PrescriptionStatus, string[]> = {
    draft: ["registrar", "assistant"],
    returned: ["registrar", "assistant"],
    abnormal: ["assistant", "registrar"],
    to_confirm: ["review_supervisor", "physician"],
    processing: ["physician", "review_supervisor"],
    recheck: ["archivist", "pharmacist"],
    pending: ["registrar"],
    completed: ["archivist"],
    archived: [],
  };

  const allowed = handlerRoles[status] || [];
  return allowed.includes(role);
}
