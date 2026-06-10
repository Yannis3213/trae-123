type ExpiryStatus = "normal" | "approaching" | "overdue";

interface ExpiryIndicatorProps {
  status: ExpiryStatus;
  label?: string;
}

const DOT_COLORS: Record<ExpiryStatus, string> = {
  normal: "bg-emerald-accent",
  approaching: "bg-amber-accent",
  overdue: "bg-coral-red",
};

const TEXT_COLORS: Record<ExpiryStatus, string> = {
  normal: "text-emerald-accent",
  approaching: "text-amber-accent",
  overdue: "text-coral-red",
};

const LABELS: Record<ExpiryStatus, string> = {
  normal: "正常",
  approaching: "临期",
  overdue: "逾期",
};

export default function ExpiryIndicator({ status, label }: ExpiryIndicatorProps) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`w-2.5 h-2.5 rounded-full ${DOT_COLORS[status]}`} />
      <span className={`text-xs font-medium ${TEXT_COLORS[status]}`}>
        {label || LABELS[status]}
      </span>
    </span>
  );
}
