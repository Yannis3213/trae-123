import { getStatusLabel, getStatusColor } from "../utils/helpers.ts";

interface StatusBadgeProps {
  status: string;
}

export default function StatusBadge({ status }: StatusBadgeProps) {
  const label = getStatusLabel(status);
  const colorClass = getStatusColor(status);

  return (
    <span className={`px-2 py-1 text-xs font-medium rounded-full ${colorClass}`}>
      {label}
    </span>
  );
}
