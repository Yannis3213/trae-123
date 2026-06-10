import type { InspectionStatus } from "../utils/types";
import { STATUS_LABELS } from "../utils/types";

const STATUS_COLORS: Record<InspectionStatus, string> = {
  pending_submit: "bg-gray-200 text-gray-700",
  pending_process: "bg-blue-100 text-blue-700",
  pending_review: "bg-yellow-100 text-yellow-700",
  completed: "bg-emerald-100 text-emerald-700",
  returned: "bg-red-100 text-red-700",
  resubmitted: "bg-orange-100 text-orange-700",
};

interface StatusBadgeProps {
  status: InspectionStatus;
}

export default function StatusBadge({ status }: StatusBadgeProps) {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[status]}`}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}
