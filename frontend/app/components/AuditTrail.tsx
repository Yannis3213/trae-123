import { STATUS_LABELS, ROLE_LABELS } from "~/utils/status";
import type { ProcessingRecord, AuditNote, ExceptionReason } from "~/utils/api";

interface AuditTrailProps {
  records: ProcessingRecord[];
  notes: AuditNote[];
  exceptions?: ExceptionReason[];
}

interface TimelineEntry {
  type: "record" | "note" | "exception";
  timestamp: string;
  content: React.ReactNode;
}

export default function AuditTrail({ records, notes, exceptions = [] }: AuditTrailProps) {
  const entries: TimelineEntry[] = [
    ...records.map((r) => ({
      type: "record" as const,
      timestamp: r.created_at,
      content: (
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-gray-900">用户{r.handler_id}</span>
            <span className="text-xs text-gray-500">
              ({ROLE_LABELS[r.handler_role as keyof typeof ROLE_LABELS] || r.handler_role})
            </span>
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700">
              {r.action}
            </span>
            {r.from_status && (
              <>
                <span className="text-gray-400">→</span>
                <span className="text-xs">
                  {STATUS_LABELS[r.from_status as keyof typeof STATUS_LABELS] || r.from_status} → {STATUS_LABELS[r.to_status as keyof typeof STATUS_LABELS] || r.to_status}
                </span>
              </>
            )}
          </div>
          {r.opinion && (
            <div className="mt-1 text-sm text-gray-600 bg-gray-50 rounded px-3 py-1.5">
              意见: {r.opinion}
            </div>
          )}
        </div>
      ),
    })),
    ...notes.map((n) => ({
      type: "note" as const,
      timestamp: n.created_at,
      content: (
        <div>
          <div className="flex items-center gap-2">
            <span className="font-medium text-gray-900">用户{n.author_id}</span>
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-50 text-green-700">
              备注{n.note_type && n.note_type !== "general" ? `(${n.note_type})` : ""}
            </span>
          </div>
          <div className="mt-1 text-sm text-gray-600 bg-green-50/50 rounded px-3 py-1.5">
            {n.content}
          </div>
        </div>
      ),
    })),
    ...exceptions.map((ex) => ({
      type: "exception" as const,
      timestamp: ex.created_at,
      content: (
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-50 text-red-700">
              异常
            </span>
            <span className="text-xs text-gray-500">
              {ex.reason_type}
            </span>
            {ex.resolved && (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-50 text-green-700">
                已解决
              </span>
            )}
          </div>
          <div className="mt-1 text-sm text-red-600 bg-red-50 rounded px-3 py-1.5">
            {ex.description}
          </div>
        </div>
      ),
    })),
  ];

  entries.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  if (entries.length === 0) {
    return (
      <div className="text-center py-8 text-gray-400">
        暂无处理记录
      </div>
    );
  }

  return (
    <div className="flow-root">
      <ul className="-mb-8">
        {entries.map((entry, idx) => (
          <li key={idx}>
            <div className="relative pb-8">
              {idx !== entries.length - 1 && (
                <span
                  className="absolute left-4 top-4 -ml-px h-full w-0.5 bg-gray-200"
                  aria-hidden="true"
                />
              )}
              <div className="relative flex space-x-3">
                <div>
                  <span className={`flex h-8 w-8 items-center justify-center rounded-full ring-8 ring-white ${
                    entry.type === "record"
                      ? "bg-blue-100"
                      : entry.type === "note"
                      ? "bg-green-100"
                      : "bg-red-100"
                  }`}>
                    {entry.type === "record" ? (
                      <svg className="h-4 w-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    ) : entry.type === "note" ? (
                      <svg className="h-4 w-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                      </svg>
                    ) : (
                      <svg className="h-4 w-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                      </svg>
                    )}
                  </span>
                </div>
                <div className="flex min-w-0 flex-1 justify-between space-x-4 pt-1.5">
                  <div className="text-sm">{entry.content}</div>
                  <div className="whitespace-nowrap text-right text-xs text-gray-400">
                    {new Date(entry.timestamp).toLocaleString("zh-CN")}
                  </div>
                </div>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
