export const STATUS_LABELS: Record<string, string> = {
  draft: "草稿",
  pending_audit: "待审核",
  audit_passed: "审核通过",
  synced: "已同步",
  returned: "退回补正",
};

export const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-800",
  pending_audit: "bg-yellow-100 text-yellow-800",
  audit_passed: "bg-blue-100 text-blue-800",
  synced: "bg-green-100 text-green-800",
  returned: "bg-red-100 text-red-800",
};

export const ROLE_LABELS: Record<string, string> = {
  registrar: "直播选品登记员",
  auditor: "直播选品审核主管",
  reviewer: "直播电商团队复核负责人",
};

const UTC_OFFSET = 8 * 60 * 60 * 1000;

function toUTC8(date: Date): Date {
  const utc = date.getTime() + date.getTimezoneOffset() * 60000;
  return new Date(utc + UTC_OFFSET);
}

export function formatDate(dateStr: string): string {
  if (!dateStr) return "-";
  const date = toUTC8(new Date(dateStr));
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  const hours = String(date.getUTCHours()).padStart(2, "0");
  const minutes = String(date.getUTCMinutes()).padStart(2, "0");
  return `${year}-${month}-${day} ${hours}:${minutes}`;
}

export function formatDateOnly(dateStr: string): string {
  if (!dateStr) return "-";
  const date = toUTC8(new Date(dateStr));
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getStatusLabel(status: string): string {
  return STATUS_LABELS[status] || status;
}

export function getStatusColor(status: string): string {
  return STATUS_COLORS[status] || "bg-gray-100 text-gray-800";
}

export function getRoleLabel(role: string): string {
  return ROLE_LABELS[role] || role;
}

export function showToast(message: string, type: "success" | "error" | "info" = "info") {
  if (typeof document === "undefined") return;
  
  const existingToast = document.getElementById("toast-container");
  if (existingToast) {
    existingToast.remove();
  }

  const container = document.createElement("div");
  container.id = "toast-container";
  container.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    z-index: 9999;
    display: flex;
    flex-direction: column;
    gap: 10px;
  `;

  const toast = document.createElement("div");
  const bgColor = type === "success" ? "#10b981" : type === "error" ? "#ef4444" : "#3b82f6";
  toast.style.cssText = `
    padding: 12px 20px;
    background: ${bgColor};
    color: white;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    font-size: 14px;
    animation: slideIn 0.3s ease-out;
  `;
  toast.textContent = message;

  container.appendChild(toast);
  document.body.appendChild(container);

  setTimeout(() => {
    toast.style.animation = "slideOut 0.3s ease-out forwards";
    setTimeout(() => {
      container.remove();
    }, 300);
  }, 3000);
}

export function getToken(): string | null {
  if (typeof localStorage === "undefined") return null;
  return localStorage.getItem("token");
}

export function setToken(token: string): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem("token", token);
}

export function getUser(): { username: string; role: string; name: string } | null {
  if (typeof localStorage === "undefined") return null;
  const userStr = localStorage.getItem("user");
  if (!userStr) return null;
  try {
    return JSON.parse(userStr);
  } catch {
    return null;
  }
}

export function setUser(user: { username: string; role: string; name: string }): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem("user", JSON.stringify(user));
}

export function clearAuth(): void {
  if (typeof localStorage === "undefined") return;
  localStorage.removeItem("token");
  localStorage.removeItem("user");
}

export function isAuthenticated(): boolean {
  return !!getToken();
}

export function hasEvidence(value: string | null | undefined): boolean {
  if (!value) return false;
  const trimmed = value.trim();
  if (trimmed === "" || trimmed === "[]" || trimmed === "null" || trimmed === "{}") {
    return false;
  }
  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) return parsed.length > 0;
    if (typeof parsed === "object" && parsed !== null) {
      return Object.keys(parsed).length > 0;
    }
    return !!parsed;
  } catch {
    return trimmed.length > 0;
  }
}

export function summarizeBatchResults(results: { order_id: number; success: boolean; message: string }[]) {
  const successList = results.filter(r => r.success);
  const failedList = results.filter(r => !r.success);
  return {
    total: results.length,
    successCount: successList.length,
    failedCount: failedList.length,
    successIds: successList.map(r => r.order_id),
    failedItems: failedList.map(r => ({ id: r.order_id, reason: r.message })),
  };
}
