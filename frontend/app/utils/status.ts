export type RequestStatus =
  | "draft"
  | "pending_submit"
  | "submitted"
  | "under_review"
  | "returned"
  | "resubmitted"
  | "reviewed"
  | "archived";

export type BriefStatus = "pending" | "received" | "missing";
export type ScheduleStatus = "pending" | "scheduled" | "missing";
export type DeadlineLevel = "normal" | "approaching" | "overdue";
export type UserRole = "creative_registrar" | "review_supervisor" | "review_manager";

export const STATUS_LABELS: Record<RequestStatus, string> = {
  draft: "草稿",
  pending_submit: "待提交",
  submitted: "已提交",
  under_review: "审核中",
  returned: "已退回",
  resubmitted: "重新提交",
  reviewed: "已审核",
  archived: "已归档",
};

export const STATUS_COLORS: Record<RequestStatus, string> = {
  draft: "bg-gray-100 text-gray-700",
  pending_submit: "bg-yellow-100 text-yellow-800",
  submitted: "bg-blue-100 text-blue-800",
  under_review: "bg-purple-100 text-purple-800",
  returned: "bg-red-100 text-red-800",
  resubmitted: "bg-indigo-100 text-indigo-800",
  reviewed: "bg-green-100 text-green-800",
  archived: "bg-gray-200 text-gray-600",
};

export const STATUS_DOT_COLORS: Record<RequestStatus, string> = {
  draft: "bg-gray-400",
  pending_submit: "bg-yellow-500",
  submitted: "bg-blue-500",
  under_review: "bg-purple-500",
  returned: "bg-red-500",
  resubmitted: "bg-indigo-500",
  reviewed: "bg-green-500",
  archived: "bg-gray-400",
};

export const BRIEF_STATUS_LABELS: Record<BriefStatus, string> = {
  pending: "待处理",
  received: "已接收",
  missing: "缺失",
};

export const BRIEF_STATUS_COLORS: Record<BriefStatus, string> = {
  pending: "bg-gray-100 text-gray-600",
  received: "bg-green-100 text-green-700",
  missing: "bg-red-100 text-red-700",
};

export const SCHEDULE_STATUS_LABELS: Record<ScheduleStatus, string> = {
  pending: "待处理",
  scheduled: "已排期",
  missing: "缺失",
};

export const SCHEDULE_STATUS_COLORS: Record<ScheduleStatus, string> = {
  pending: "bg-gray-100 text-gray-600",
  scheduled: "bg-green-100 text-green-700",
  missing: "bg-red-100 text-red-700",
};

export const ROLE_LABELS: Record<UserRole, string> = {
  creative_registrar: "创意需求登记员",
  review_supervisor: "创意需求审核主管",
  review_manager: "广告代理公司复核负责人",
};

export const DEADLINE_LABELS: Record<DeadlineLevel, string> = {
  normal: "正常",
  approaching: "临期",
  overdue: "逾期",
};

export const DEADLINE_COLORS: Record<DeadlineLevel, string> = {
  normal: "text-green-600",
  approaching: "text-yellow-600",
  overdue: "text-red-600",
};

export const DEADLINE_BG_COLORS: Record<DeadlineLevel, string> = {
  normal: "bg-green-50 border-green-200",
  approaching: "bg-yellow-50 border-yellow-200",
  overdue: "bg-red-50 border-red-200",
};

export function computeDeadlineLevel(deadline: string | null | undefined): DeadlineLevel {
  if (!deadline) return "normal";
  const now = new Date();
  const dl = new Date(deadline);
  const diffMs = dl.getTime() - now.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  if (diffDays < 0) return "overdue";
  if (diffDays <= 3) return "approaching";
  return "normal";
}

export const ALLOWED_TRANSITIONS: Record<UserRole, Record<RequestStatus, RequestStatus[]>> = {
  creative_registrar: {
    draft: ["pending_submit", "submitted"],
    pending_submit: ["submitted"],
    submitted: [],
    under_review: [],
    returned: ["resubmitted"],
    resubmitted: [],
    reviewed: [],
    archived: [],
  },
  review_supervisor: {
    draft: [],
    pending_submit: [],
    submitted: ["under_review", "returned"],
    under_review: ["reviewed", "returned"],
    returned: [],
    resubmitted: ["under_review", "returned"],
    reviewed: [],
    archived: [],
  },
  review_manager: {
    draft: [],
    pending_submit: [],
    submitted: [],
    under_review: [],
    returned: [],
    resubmitted: [],
    reviewed: ["archived", "returned"],
    archived: [],
  },
};

export function canTransition(role: UserRole, fromStatus: RequestStatus, toStatus: RequestStatus): boolean {
  return ALLOWED_TRANSITIONS[role]?.[fromStatus]?.includes(toStatus) ?? false;
}

export function getActionLabel(fromStatus: RequestStatus, toStatus: RequestStatus): string {
  const map: Record<string, string> = {
    "draft->pending_submit": "保存待提交",
    "draft->submitted": "提交",
    "pending_submit->submitted": "提交",
    "submitted->under_review": "开始审核",
    "submitted->returned": "退回",
    "under_review->reviewed": "通过",
    "under_review->returned": "退回",
    "returned->resubmitted": "重新提交",
    "resubmitted->under_review": "开始审核",
    "resubmitted->returned": "退回",
    "reviewed->archived": "归档",
    "reviewed->returned": "退回",
  };
  return map[`${fromStatus}->${toStatus}`] || toStatus;
}

export const USER_NUMERIC_ID: Record<string, number> = {
  zhangsan: 1,
  lisi: 2,
  wangwu: 3,
};

export const ATTACHMENT_CATEGORY_LABELS: Record<string, string> = {
  brief: "Brief",
  schedule: "排期",
  creative_material: "创意素材",
  other: "其他",
};

export const ATTACHMENT_CATEGORY_COLORS: Record<string, string> = {
  brief: "bg-blue-100 text-blue-700",
  schedule: "bg-purple-100 text-purple-700",
  creative_material: "bg-orange-100 text-orange-700",
  other: "bg-gray-100 text-gray-700",
};
