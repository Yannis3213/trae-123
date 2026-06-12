import type { UserRole } from "../stores/auth";

export const STATUS_MAP: Record<string, { label: string; color: string; bg: string }> = {
  pending: { label: "待处理", color: "text-blue-700", bg: "bg-blue-100" },
  processing: { label: "处理中", color: "text-indigo-700", bg: "bg-indigo-100" },
  reviewing: { label: "复核中", color: "text-purple-700", bg: "bg-purple-100" },
  correction_needed: { label: "待补正", color: "text-orange-700", bg: "bg-orange-100" },
  completed: { label: "办结", color: "text-green-700", bg: "bg-green-100" },
  withdrawn: { label: "已撤回", color: "text-stone-500", bg: "bg-stone-100" },
};

export const EXPIRY_MAP: Record<string, { label: string; color: string; bg: string }> = {
  normal: { label: "正常", color: "text-green-700", bg: "bg-green-100" },
  expiring_soon: { label: "临期", color: "text-yellow-700", bg: "bg-yellow-100" },
  overdue: { label: "逾期", color: "text-red-700", bg: "bg-red-100" },
};

export function getExpiryStatus(expiryDate: string): "normal" | "expiring_soon" | "overdue" {
  const now = new Date();
  const exp = new Date(expiryDate);
  const diff = (exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
  if (diff <= 0) return "overdue";
  if (diff <= 7) return "expiring_soon";
  return "normal";
}

export function getRoleQueue(role: UserRole): UserRole {
  return role;
}

export const ACTION_LABELS: Record<string, string> = {
  advance: "推进",
  return_correction: "退回补正",
  review_pass: "复核通过",
  review_reject: "复核驳回",
  complete: "办结",
  withdraw: "撤回",
};
