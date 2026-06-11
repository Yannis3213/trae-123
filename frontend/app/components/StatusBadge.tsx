type Status = "pending_assign" | "transferred" | "visited";

const STATUS_MAP: Record<Status, { label: string; className: string }> = {
  pending_assign: { label: "待分派", className: "badge-blue" },
  transferred: { label: "已转办", className: "badge-orange" },
  visited: { label: "已回访", className: "badge-green" },
};

export default function StatusBadge({ status }: { status: string }) {
  const info = STATUS_MAP[status as Status] || { label: status, className: "badge-blue" };
  return <span className={`badge ${info.className}`}>{info.label}</span>;
}
