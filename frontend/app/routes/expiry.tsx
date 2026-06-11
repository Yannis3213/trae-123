import { useState, useEffect } from "react";
import { useNavigate } from "@remix-run/react";
import Layout from "~/components/Layout";
import StatusBadge from "~/components/StatusBadge";
import ExpiryBadge from "~/components/ExpiryBadge";
import BatchResultList from "~/components/BatchResultList";
import { apiFetch } from "~/utils/api";
import { getToken, isAuthenticated } from "~/utils/auth";

interface ExpiryRecord {
  id: string;
  record_no: string;
  client_name: string;
  business_type: string;
  status: string;
  expiry_status: string;
  expiry_date: string;
  days_remaining: number;
  current_handler: { id: string; name: string } | null;
  responsible_person?: string;
}

interface BatchResult {
  record_id: number;
  record_no?: string;
  success: boolean;
  reason?: string;
}

const SECTIONS = [
  { key: "normal", label: "正常", color: "var(--success)", bgColor: "var(--success-light)" },
  { key: "near_expiry", label: "临期", color: "var(--warning)", bgColor: "var(--warning-light)" },
  { key: "overdue", label: "逾期", color: "var(--danger)", bgColor: "var(--danger-light)" },
];

export default function ExpiryPage() {
  const navigate = useNavigate();
  const [records, setRecords] = useState<ExpiryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("overdue");
  const [processing, setProcessing] = useState(false);
  const [results, setResults] = useState<BatchResult[]>([]);

  useEffect(() => {
    if (!isAuthenticated()) {
      navigate("/login");
      return;
    }
    loadRecords();
  }, []);

  const loadRecords = async () => {
    try {
      setLoading(true);
      const token = getToken();
      const [overdueData, nearExpiryData, normalData] = await Promise.all([
        apiFetch("/expiry/overdue", {}, token || undefined),
        apiFetch("/expiry/near-expiry", {}, token || undefined),
        apiFetch("/expiry/normal", {}, token || undefined),
      ]);
      const allRecords = [
        ...(overdueData.records || []),
        ...(nearExpiryData.records || []),
        ...(normalData.records || []),
      ];
      setRecords(allRecords);
    } catch (err: any) {
      setError(err.message || "加载到期预警数据失败");
    } finally {
      setLoading(false);
    }
  };

  const getResponsiblePerson = (record: ExpiryRecord): string => {
    if (record.responsible_person) return record.responsible_person;
    return record.current_handler?.name || "未分派";
  };

  const overdueRecords = records.filter((r) => r.expiry_status === "overdue");
  const nearExpiryRecords = records.filter((r) => r.expiry_status === "near_expiry");
  const normalRecords = records.filter((r) => r.expiry_status === "normal");

  const handleBatchAdvance = async () => {
    if (overdueRecords.length === 0) return;
    setProcessing(true);
    setResults([]);
    setError("");
    try {
      const token = getToken();
      const data = await apiFetch("/batch/overdue-advance", {
        method: "POST",
        body: JSON.stringify({ record_ids: overdueRecords.map(r => parseInt(String(r.id))) }),
      }, token || undefined);
      setResults(data.results || []);
      loadRecords();
    } catch (err: any) {
      setError(err.message || "批量推进逾期记录失败");
    } finally {
      setProcessing(false);
    }
  };

  const renderSection = (
    sectionKey: string,
    label: string,
    color: string,
    bgColor: string,
    sectionRecords: ExpiryRecord[]
  ) => (
    <div
      style={{
        border: `2px solid ${color}`,
        borderRadius: "var(--radius-lg)",
        overflow: "hidden",
        marginBottom: 24,
      }}
    >
      <div
        style={{
          background: bgColor,
          padding: "12px 20px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          borderBottom: `1px solid ${color}`,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span
            style={{
              width: 12,
              height: 12,
              borderRadius: "50%",
              background: color,
              display: "inline-block",
            }}
          />
          <span style={{ fontWeight: 700, fontSize: 16, color }}>{label}</span>
          <span className="badge" style={{ background: color, color: "#fff" }}>
            {sectionRecords.length} 条
          </span>
        </div>
        {sectionKey === "overdue" && sectionRecords.length > 0 && (
          <button
            className="btn btn-danger btn-sm"
            onClick={handleBatchAdvance}
            disabled={processing}
          >
            {processing ? "处理中..." : "批量推进逾期记录"}
          </button>
        )}
      </div>

      {sectionRecords.length === 0 ? (
        <div
          className="empty-state"
          style={{ background: "#fff", padding: 20 }}
        >
          <div className="empty-state-text">无{label}记录</div>
        </div>
      ) : (
        <div style={{ background: "#fff" }}>
          <table>
            <thead>
              <tr>
                <th>记录编号</th>
                <th>客户姓名</th>
                <th>业务类型</th>
                <th>状态</th>
                <th>到期日期</th>
                <th>剩余天数</th>
                <th>负责人</th>
              </tr>
            </thead>
            <tbody>
              {sectionRecords.map((record) => (
                <tr
                  key={record.id}
                  style={{ cursor: "pointer" }}
                  onClick={() => navigate(`/records/${record.id}`)}
                >
                  <td style={{ fontWeight: 500, color: "var(--primary)" }}>
                    {record.record_no}
                  </td>
                  <td>{record.client_name}</td>
                  <td>{record.business_type}</td>
                  <td>
                    <StatusBadge status={record.status} />
                  </td>
                  <td className="text-sm">
                    {record.expiry_date
                      ? new Date(record.expiry_date).toLocaleDateString("zh-CN")
                      : "—"}
                  </td>
                  <td>
                    <span
                      style={{
                        fontWeight: 600,
                        color:
                          record.days_remaining < 0
                            ? "var(--danger)"
                            : record.days_remaining <= 7
                            ? "var(--warning)"
                            : "var(--success)",
                      }}
                    >
                      {record.days_remaining < 0
                        ? `逾期 ${Math.abs(record.days_remaining)} 天`
                        : `${record.days_remaining} 天`}
                    </span>
                  </td>
                  <td>{getResponsiblePerson(record)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  return (
    <Layout>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700 }}>到期预警</h2>
        <p className="text-sm text-muted" style={{ marginTop: 4 }}>
          按到期状态分类查看适当性记录，逾期记录可批量推进处理
        </p>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div style={{ display: "flex", gap: 12, marginBottom: 20 }}>
        {SECTIONS.map((s) => (
          <button
            key={s.key}
            onClick={() => setActiveTab(s.key)}
            style={{
              padding: "8px 20px",
              borderRadius: "var(--radius)",
              border: `2px solid ${activeTab === s.key ? s.color : "var(--gray-300)"}`,
              background: activeTab === s.key ? s.bgColor : "#fff",
              color: activeTab === s.key ? s.color : "var(--gray-600)",
              fontWeight: 600,
              fontSize: 14,
              cursor: "pointer",
            }}
          >
            {s.label}
            <span
              style={{
                marginLeft: 8,
                padding: "1px 8px",
                borderRadius: 999,
                background: activeTab === s.key ? s.color : "var(--gray-300)",
                color: "#fff",
                fontSize: 12,
              }}
            >
              {s.key === "normal"
                ? normalRecords.length
                : s.key === "near_expiry"
                ? nearExpiryRecords.length
                : overdueRecords.length}
            </span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="empty-state" style={{ padding: 80 }}>
          <div className="empty-state-icon">⏳</div>
          <div className="empty-state-text">加载中...</div>
        </div>
      ) : (
        <>
          {activeTab === "overdue" &&
            renderSection("overdue", "逾期", "var(--danger)", "var(--danger-light)", overdueRecords)}
          {activeTab === "near_expiry" &&
            renderSection("near_expiry", "临期", "var(--warning)", "var(--warning-light)", nearExpiryRecords)}
          {activeTab === "normal" &&
            renderSection("normal", "正常", "var(--success)", "var(--success-light)", normalRecords)}
        </>
      )}

      {results.length > 0 && (
        <div className="card" style={{ marginTop: 20 }}>
          <div className="card-header">批量推进结果</div>
          <BatchResultList results={results} />
        </div>
      )}
    </Layout>
  );
}
