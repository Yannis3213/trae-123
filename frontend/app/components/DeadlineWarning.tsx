import { computeDeadlineLevel, DEADLINE_LABELS, DEADLINE_COLORS } from "~/utils/status";

interface DeadlineWarningProps {
  deadline: string | null | undefined;
  currentHandler?: string | null;
  showLabel?: boolean;
}

export default function DeadlineWarning({ deadline, currentHandler, showLabel = true }: DeadlineWarningProps) {
  if (!deadline) {
    return <span className="text-gray-400 text-sm">未设置</span>;
  }

  const level = computeDeadlineLevel(deadline);
  const label = DEADLINE_LABELS[level];
  const colorClass = DEADLINE_COLORS[level];
  const deadlineDate = new Date(deadline);
  const now = new Date();
  const diffMs = deadlineDate.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  let dateLabel = "";
  if (diffDays < 0) {
    dateLabel = `逾期 ${Math.abs(diffDays)} 天`;
  } else if (diffDays === 0) {
    dateLabel = "今日到期";
  } else if (diffDays <= 3) {
    dateLabel = `剩余 ${diffDays} 天`;
  } else {
    dateLabel = `剩余 ${diffDays} 天`;
  }

  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-2">
        <span className="text-sm text-gray-700">
          {deadlineDate.toLocaleDateString("zh-CN")}
        </span>
        {showLabel && (
          <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${colorClass} ${
            level === "overdue"
              ? "bg-red-100"
              : level === "approaching"
              ? "bg-yellow-100"
              : "bg-green-100"
          }`}>
            {label}
          </span>
        )}
      </div>
      <span className={`text-xs ${colorClass}`}>{dateLabel}</span>
      {level === "overdue" && currentHandler && (
        <span className="text-xs text-red-500 mt-0.5">
          当前处理人: {currentHandler}
        </span>
      )}
    </div>
  );
}
