import { useState, useEffect } from "react";
import { useNavigate } from "@remix-run/react";
import Layout from "~/components/Layout";
import { apiFetch } from "~/utils/api";
import { getToken, isAuthenticated } from "~/utils/auth";

interface StatusCount {
  status: string;
  count: number;
}

interface ExpiryCount {
  expiry_status: string;
  count: number;
}

interface TimelineStat {
  date: string;
  created: number;
  completed: number;
}

interface AuditLog {
  id: string;
  record_id: string;
  action: string;
  handler: { id: string; name: string };
  record_no: string;
  comment?: string;
  review_opinion?: string;
  review_result?: string;
  return_reason?: string;
  correction_note?: string;
  round?: number;
  created_at: string;
  details?: string;
}

const STATUS_LABELS: Record<string, string> = {
  pending_assign: "待分派",
  transferred: "已转办",
  visited: "已回访",
};

const STATUS_COLORS: Record<string, string> = {
  pending_assign: "#2563eb",
  transferred: "#d97706",
  visited: "#16a34a",
};

const EXPIRY_LABELS: Record<string, string> = {
  normal: "正常",
  near_expiry: "临期",
  overdue: "逾期",
};

const EXPIRY_COLORS: Record<string, string> = {
  normal: "#16a34a",
  near_expiry: "#d97706",
  overdue: "#dc2626",
};

const ACTION_LABELS: Record<string, string> = {
  assign: "分派",
  transfer: "转办",
  review: "复核",
  return: "退回",
  correction: "补正",
  created: "创建",
};

export default function StatsPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusCounts, setStatusCounts] = useState<StatusCount[]>([]);
  const [expiryCounts, setExpiryCounts] = useState<ExpiryCount[]>([]);
  const [timelineStats, setTimelineStats] = useState<TimelineStat[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);

  useEffect(() => {
    if (!isAuthenticated()) {
      navigate("/login");
      return;
    }
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      setLoading(true);
      const token = getToken();
      const data = await apiFetch("/audit/stats", {}, token || undefined);
      setStatusCounts(data.status_counts || []);
      setExpiryCounts(data.expiry_counts || []);
      setTimelineStats(data.timeline || []);
      setAuditLogs(data.audit_logs || []);
    } catch (err: any) {
      setError(err.message || "加载统计数据失败");
    } finally {
      setLoading(false);
    }
  };

  const totalByStatus = statusCounts.reduce((sum, s) => sum + s.count, 0);
  const totalByExpiry = expiryCounts.reduce((sum, s) => sum + s.count, 0);

  const maxTimelineValue = Math.max(
    ...timelineStats.map((t) => Math.max(t.created, t.completed)),
    1
  );

  const renderBarChart = (
    items: { label: string; count: number; color: string }[],
    total: number
  ) => (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {items.map((item) => (
        <div key={item.label}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginBottom: 4,
            }}
          >
            <span className="font-medium text-sm">{item.label}</span>
            <span className="text-sm text-muted">
              {item.count} ({total > 0 ? Math.round((item.count / total) * 100) : 0}%)
            </span>
          </div>
          <div
            style={{
              width: "100%",
              height: 24,
              background: "var(--gray-100)",
              borderRadius: 4,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: `${total > 0 ? (item.count / total) * 100 : 0}%`,
                height: "100%",
                background: item.color,
                borderRadius: 4,
                transition: "width 0.3s ease",
                minWidth: item.count > 0 ? 4 : 0,
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );

  if (loading) {
    return (
      <Layout>
        <div className="empty-state" style={{ padding: 80 }}>
          <div className="empty-state-icon">⏳</div>
          <div className="empty-state-text">加载中...</div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700 }}>统计</h2>
        <p className="text-sm text-muted" style={{ marginTop: 4 }}>
          适当性记录处理统计数据概览
        </p>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        <div className="card">
          <div className="card-header">按处理状态统计</div>
          {statusCounts.length > 0
            ? renderBarChart(
                statusCounts.map((s) => ({
                  label: STATUS_LABELS[s.status] || s.status,
                  count: s.count,
                  color: STATUS_COLORS[s.status] || "var(--gray-400)",
                })),
                totalByStatus
              )
            : renderBarChart(
                [
                  { label: "待分派", count: 0, color: STATUS_COLORS.pending_assign },
                  { label: "已转办", count: 0, color: STATUS_COLORS.transferred },
                  { label: "已回访", count: 0, color: STATUS_COLORS.visited },
                ],
                0
              )}
          <div style={{ marginTop: 16, textAlign: "center" }}>
            <span className="text-sm text-muted">总计 </span>
            <span style={{ fontWeight: 700, fontSize: 20, color: "var(--primary)" }}>
              {totalByStatus}
            </span>
            <span className="text-sm text-muted"> 条记录</span>
          </div>
        </div>

        <div className="card">
          <div className="card-header">按到期状态统计</div>
          {expiryCounts.length > 0
            ? renderBarChart(
                expiryCounts.map((s) => ({
                  label: EXPIRY_LABELS[s.expiry_status] || s.expiry_status,
                  count: s.count,
                  color: EXPIRY_COLORS[s.expiry_status] || "var(--gray-400)",
                })),
                totalByExpiry
              )
            : renderBarChart(
                [
                  { label: "正常", count: 0, color: EXPIRY_COLORS.normal },
                  { label: "临期", count: 0, color: EXPIRY_COLORS.near_expiry },
                  { label: "逾期", count: 0, color: EXPIRY_COLORS.overdue },
                ],
                0
              )}
          <div style={{ marginTop: 16, textAlign: "center" }}>
            <span className="text-sm text-muted">总计 </span>
            <span style={{ fontWeight: 700, fontSize: 20, color: "var(--primary)" }}>
              {totalByExpiry}
            </span>
            <span className="text-sm text-muted"> 条记录</span>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 20 }}>
        <div className="card-header">处理时间线统计</div>
        {timelineStats.length > 0 ? (
          <div
            style={{
              display: "flex",
              alignItems: "flex-end",
              gap: 8,
              height: 200,
              padding: "0 8px",
            }}
          >
            {timelineStats.map((stat, i) => (
              <div
                key={i}
                style={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "flex-end",
                    gap: 2,
                    height: 160,
                    width: "100%",
                  }}
                >
                  <div
                    style={{
                      flex: 1,
                      height: `${(stat.created / maxTimelineValue) * 100}%`,
                      background: "var(--info)",
                      borderRadius: "3px 3px 0 0",
                      minHeight: stat.created > 0 ? 4 : 0,
                      transition: "height 0.3s ease",
                    }}
                    title={`创建: ${stat.created}`}
                  />
                  <div
                    style={{
                      flex: 1,
                      height: `${(stat.completed / maxTimelineValue) * 100}%`,
                      background: "var(--success)",
                      borderRadius: "3px 3px 0 0",
                      minHeight: stat.completed > 0 ? 4 : 0,
                      transition: "height 0.3s ease",
                    }}
                    title={`完成: ${stat.completed}`}
                  />
                </div>
                <span className="text-xs text-muted">{stat.date}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state" style={{ padding: 20 }}>
            <div className="empty-state-text">暂无时间线数据</div>
          </div>
        )}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            gap: 24,
            marginTop: 12,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 12, height: 12, background: "var(--info)", borderRadius: 2 }} />
            <span className="text-sm text-muted">创建</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 12, height: 12, background: "var(--success)", borderRadius: 2 }} />
            <span className="text-sm text-muted">完成</span>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 20 }}>
        <div className="card-header">审计日志</div>
        {auditLogs.length > 0 ? (
          <table>
            <thead>
              <tr>
                <th>时间</th>
                <th>操作人</th>
                <th>记录编号</th>
                <th>轮次</th>
                <th>操作</th>
                <th>备注</th>
                <th>复核意见</th>
                <th>退回补正要求</th>
                <th>补正说明</th>
              </tr>
            </thead>
            <tbody>
              {auditLogs.map((log) => (
                <tr key={log.id}>
                  <td className="text-sm text-muted">
                    {log.created_at ? new Date(log.created_at).toLocaleString("zh-CN") : ""}
                  </td>
                  <td>{log.handler?.name || "—"}</td>
                  <td
                    style={{ fontWeight: 500, color: "var(--primary)", cursor: "pointer" }}
                    onClick={() => navigate(`/records/${log.record_id}`)}
                  >
                    {log.record_no}
                  </td>
                  <td>
                    {log.round && log.round > 0 ? (
                      <span className="badge badge-warning">第{log.round}轮</span>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </td>
                  <td>
                    <span className="badge badge-blue">
                      {ACTION_LABELS[log.action] || log.action}
                    </span>
                  </td>
                  <td className="text-sm" style={{ maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {log.comment || "—"}
                  </td>
                  <td className="text-sm" style={{ maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {log.review_opinion ? (
                      <span>
                        {log.review_opinion}
                        {log.review_result && (
                          <span className={log.review_result === "approved" ? "badge badge-green" : "badge badge-red"} style={{ marginLeft: 4 }}>
                            {log.review_result === "approved" ? "通过" : "驳回"}
                          </span>
                        )}
                      </span>
                    ) : "—"}
                  </td>
                  <td className="text-sm" style={{ maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: log.return_reason ? "var(--warning)" : undefined }}>
                    {log.return_reason || "—"}
                  </td>
                  <td className="text-sm" style={{ maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: log.correction_note ? "var(--info)" : undefined }}>
                    {log.correction_note || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="empty-state" style={{ padding: 20 }}>
            <div className="empty-state-text">暂无审计日志</div>
          </div>
        )}
      </div>
    </Layout>
  );
}
