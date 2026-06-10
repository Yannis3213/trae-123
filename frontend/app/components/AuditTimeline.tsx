import { CheckCircle, ArrowRight, RotateCcw, Edit, AlertTriangle } from "lucide-react";
import type { ProcessingRecord, AuditRemark, CorrectionRecord, ExceptionReason } from "../utils/types";
import { STATUS_LABELS } from "../utils/types";

interface AuditTimelineProps {
  processingRecords: ProcessingRecord[];
  auditRemarks: AuditRemark[];
  correctionRecords: CorrectionRecord[];
  exceptionReasons: ExceptionReason[];
}

function getIcon(fromStatus: string, toStatus: string) {
  if (toStatus === "completed") return <CheckCircle size={16} className="text-emerald-accent" />;
  if (toStatus === "returned") return <RotateCcw size={16} className="text-coral-red" />;
  if (fromStatus === "returned" && toStatus === "resubmitted") return <Edit size={16} className="text-orange-500" />;
  return <ArrowRight size={16} className="text-blue-500" />;
}

export default function AuditTimeline({
  processingRecords,
  auditRemarks,
  correctionRecords,
  exceptionReasons,
}: AuditTimelineProps) {
  type TimelineEntry = {
    id: string;
    time: string;
    content: string;
    fromStatus: string;
    toStatus: string;
  };

  const entries: TimelineEntry[] = [
    ...processingRecords.map((r) => ({
      id: r.id,
      time: r.created_at,
      content: `[处理] ${STATUS_LABELS[r.from_status as keyof typeof STATUS_LABELS] || r.from_status} → ${STATUS_LABELS[r.to_status as keyof typeof STATUS_LABELS] || r.to_status}${r.opinion ? `，意见：${r.opinion}` : ""}`,
      fromStatus: r.from_status,
      toStatus: r.to_status,
    })),
    ...auditRemarks.map((r) => ({
      id: `ar-${r.id}`,
      time: r.created_at,
      content: `[审计] ${STATUS_LABELS[r.from_status as keyof typeof STATUS_LABELS] || r.from_status} → ${STATUS_LABELS[r.to_status as keyof typeof STATUS_LABELS] || r.to_status}${r.remark ? `，备注：${r.remark}` : ""}`,
      fromStatus: r.from_status,
      toStatus: r.to_status,
    })),
    ...correctionRecords.map((r) => ({
      id: `cr-${r.id}`,
      time: r.created_at,
      content: `[纠正] 字段「${r.field}」：${r.old_value || "(空)"} → ${r.new_value || "(空)"}，原因：${r.reason}`,
      fromStatus: "",
      toStatus: "",
    })),
    ...exceptionReasons.map((r) => ({
      id: `er-${r.id}`,
      time: r.created_at,
      content: `[异常] 类型：${r.type}，描述：${r.description}`,
      fromStatus: "",
      toStatus: "",
    })),
  ].sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());

  if (entries.length === 0) {
    return <p className="text-sm text-gray-400">暂无审计记录</p>;
  }

  return (
    <div className="relative">
      <div className="absolute left-[7px] top-2 bottom-2 w-0.5 bg-gray-200" />
      <div className="space-y-4">
        {entries.map((entry) => (
          <div key={entry.id} className="relative pl-8">
            <div className="absolute left-0 top-1 w-4 h-4 flex items-center justify-center bg-white">
              {entry.fromStatus ? getIcon(entry.fromStatus, entry.toStatus) : <AlertTriangle size={16} className="text-amber-accent" />}
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-sm text-gray-700">{entry.content}</p>
              <p className="text-xs text-gray-400 mt-1">
                {new Date(entry.time).toLocaleString("zh-CN")}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
