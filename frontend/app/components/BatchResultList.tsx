const ERROR_CODE_MAP: Record<string, string> = {
  UNAUTHORIZED_ROLE: "越权操作",
  NOT_ASSIGNED_HANDLER: "非当前处理人",
  INVALID_STATUS: "状态不正确",
  VERSION_CONFLICT: "版本冲突",
  MISSING_EVIDENCE: "缺少必要证据",
  DUPLICATE_SUBMISSION: "重复提交",
};

interface BatchResult {
  record_id: number;
  record_no?: string;
  success: boolean;
  reason?: string;
}

function parseReason(reason: string | undefined): string {
  if (!reason) return "未知错误";
  const colonIdx = reason.indexOf(":");
  if (colonIdx > 0) {
    const code = reason.substring(0, colonIdx).trim();
    const detail = reason.substring(colonIdx + 1).trim();
    const label = ERROR_CODE_MAP[code];
    return label ? `${label}：${detail}` : reason;
  }
  return ERROR_CODE_MAP[reason] || reason;
}

export default function BatchResultList({ results }: { results: BatchResult[] }) {
  if (!results.length) return null;

  const successCount = results.filter((r) => r.success).length;
  const failCount = results.length - successCount;
  const progress = results.length > 0 ? (successCount / results.length) * 100 : 0;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 12 }}>
        <span style={{ fontWeight: 600 }}>处理进度</span>
        <div className="progress-bar" style={{ flex: 1 }}>
          <div
            className="progress-bar-fill success"
            style={{ width: `${progress}%` }}
          />
        </div>
        <span className="text-sm text-muted">
          {successCount}/{results.length} 成功
          {failCount > 0 && `，${failCount} 失败`}
        </span>
      </div>

      <table>
        <thead>
          <tr>
            <th>记录编号</th>
            <th>结果</th>
            <th>原因</th>
          </tr>
        </thead>
        <tbody>
          {results.map((r, i) => (
            <tr key={i}>
              <td style={{ fontWeight: 500 }}>{r.record_no || r.record_id}</td>
              <td>
                {r.success ? (
                  <span className="badge badge-green">成功</span>
                ) : (
                  <span className="badge badge-red">失败</span>
                )}
              </td>
              <td className="text-sm text-muted">
                {r.success ? "—" : parseReason(r.reason)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
