const FRONTEND_PORT = 3108;
const BACKEND_PORT = 8108;
const BACKEND_URL = `http://localhost:${BACKEND_PORT}`;

export const config = {
  frontendPort: FRONTEND_PORT,
  backendPort: BACKEND_PORT,
  frontendUrl: `http://localhost:${FRONTEND_PORT}`,
  backendUrl: BACKEND_URL,
  apiBaseUrl: `${BACKEND_URL}/api`,
  storageKey: "exhibitor_auth_token",
  userKey: "exhibitor_user",
};

export const roleNames: Record<string, string> = {
  registrar: "展商登记员",
  audit_supervisor: "展商审核主管",
  review_leader: "展会主办方复核负责人",
};

export const queueNames: Record<string, string> = {
  material_supplement: "展商服务补齐材料",
  construction_audit: "搭建审核办理",
  project_closure: "项目负责人收口",
};

export const statusNames: Record<string, string> = {
  draft: "草稿",
  pending_submit: "待提交",
  pending_audit: "待审核",
  pending_review: "待复核",
  pending_booth_confirm: "待展位确认",
  correction_required: "需补正",
  rejected: "已拒绝",
  audit_passed: "审核通过",
  booth_confirmed: "展位已确认",
  archived: "已归档",
  synced: "已同步",
};

export const warningLevelNames: Record<string, string> = {
  normal: "正常",
  approaching: "临期",
  overdue: "逾期",
};

export const actionNames: Record<string, string> = {
  create: "创建",
  submit: "提交审核",
  correct: "补正材料",
  approve_audit: "审核通过",
  reject_audit: "拒绝申请",
  return_for_correction: "退回补正",
  approve_review: "复核通过",
  confirm_booth: "确认展位",
  archive: "归档",
  sync: "同步",
  add_note: "添加备注",
};

export const statGroupNames: Record<string, string> = {
  pending: "待审核",
  passed: "审核通过",
  synced: "已同步",
};

export const warningLevelColors: Record<string, string> = {
  normal: "#10b981",
  approaching: "#f59e0b",
  overdue: "#ef4444",
};

export const statusColors: Record<string, string> = {
  draft: "#6b7280",
  pending_submit: "#6366f1",
  pending_audit: "#f59e0b",
  pending_review: "#8b5cf6",
  pending_booth_confirm: "#ec4899",
  correction_required: "#f97316",
  rejected: "#ef4444",
  audit_passed: "#10b981",
  booth_confirmed: "#059669",
  archived: "#047857",
  synced: "#065f46",
};
