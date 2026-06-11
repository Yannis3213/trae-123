type ExpiryStatus = "normal" | "near_expiry" | "overdue";

const EXPIRY_MAP: Record<ExpiryStatus, { label: string; className: string }> = {
  normal: { label: "正常", className: "badge-green" },
  near_expiry: { label: "临期", className: "badge-orange" },
  overdue: { label: "逾期", className: "badge-red" },
};

export default function ExpiryBadge({ status }: { status: string }) {
  const info = EXPIRY_MAP[status as ExpiryStatus] || { label: status, className: "badge-green" };
  return <span className={`badge ${info.className}`}>{info.label}</span>;
}
