import { useState, useEffect } from "react";
import { useNavigate } from "@remix-run/react";
import Layout from "~/components/Layout";
import StatusBadge from "~/components/StatusBadge";
import ExpiryBadge from "~/components/ExpiryBadge";
import EvidenceSummary from "~/components/EvidenceSummary";
import { apiFetch } from "~/utils/api";
import { getToken, isAuthenticated, getCurrentUser } from "~/utils/auth";

interface Record {
  id: string;
  record_no: string;
  client_name: string;
  business_type: string;
  status: string;
  expiry_status: string;
  current_handler: { id: string; name: string } | null;
  created_at: string;
  suitability_check?: boolean;
  risk_assessment?: boolean;
  business_opening?: boolean;
  needs_correction?: boolean;
  correction_round?: number;
}

const STATUS_TABS = [
  { key: "all", label: "全部" },
  { key: "pending_assign", label: "待分派" },
  { key: "transferred", label: "已转办" },
  { key: "visited", label: "已回访" },
];

const EXPIRY_FILTERS = [
  { key: "all", label: "全部" },
  { key: "normal", label: "正常" },
  { key: "near_expiry", label: "临期" },
  { key: "overdue", label: "逾期" },
];

const CORRECTION_FILTERS = [
  { key: "all", label: "全部" },
  { key: "true", label: "待补正" },
  { key: "false", label: "无需补正" },
];

export default function Dashboard() {
  const navigate = useNavigate();
  const [records, setRecords] = useState<Record[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [expiryFilter, setExpiryFilter] = useState("all");
  const [correctionFilter, setCorrectionFilter] = useState("all");
  const [selectedRecord, setSelectedRecord] = useState<Record | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState("");

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
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (expiryFilter !== "all") params.set("expiry_status", expiryFilter);
      if (correctionFilter !== "all") params.set("needs_correction", correctionFilter);
      const qs = params.toString();
      const data = await apiFetch(`/records${qs ? "?" + qs : ""}`, {}, token || undefined);
      setRecords(data.records || []);
    } catch (err: any) {
      setError(err.message || "加载记录失败");
    } finally {
      setLoading(false);
    }
  };

  const user = getCurrentUser();

  useEffect(() => {
    if (isAuthenticated()) loadRecords();
  }, [statusFilter, expiryFilter, correctionFilter]);

  const filteredRecords = records;

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredRecords.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredRecords.map((r) => r.id)));
    }
  };

  const handleBatchAction = async (action: string) => {
    if (selectedIds.size === 0) return;
    navigate(`/batch?action=${action}&ids=${Array.from(selectedIds).join(",")}`);
  };

  const handleRowClick = (record: Record) => {
    setSelectedRecord(record);
  };

  return (
    <Layout>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: "var(--gray-800)" }}>
          适当性记录队列
        </h2>
        <p className="text-sm text-muted" style={{ marginTop: 4 }}>
          管理和跟踪所有适当性记录的处理状态
        </p>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div style={{ display: "flex", gap: 20, alignItems: "flex-start" }}>
        <div style={{ flex: 7, minWidth: 0 }}>
          <div className="card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div className="tabs" style={{ marginBottom: 0, borderBottom: "none" }}>
                {STATUS_TABS.map((tab) => (
                  <button
                    key={tab.key}
                    className={`tab ${statusFilter === tab.key ? "active" : ""}`}
                    onClick={() => setStatusFilter(tab.key)}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
              <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                <span className="text-sm text-muted">到期筛选:</span>
                <select
                  className="form-control"
                  style={{ width: "auto", padding: "4px 8px", fontSize: 13 }}
                  value={expiryFilter}
                  onChange={(e) => setExpiryFilter(e.target.value)}
                >
                  {EXPIRY_FILTERS.map((f) => (
                    <option key={f.key} value={f.key}>
                      {f.label}
                    </option>
                  ))}
                </select>
                <span className="text-sm text-muted" style={{ marginLeft: 8 }}>补正筛选:</span>
                <select
                  className="form-control"
                  style={{ width: "auto", padding: "4px 8px", fontSize: 13 }}
                  value={correctionFilter}
                  onChange={(e) => setCorrectionFilter(e.target.value)}
                >
                  {CORRECTION_FILTERS.map((f) => (
                    <option key={f.key} value={f.key}>
                      {f.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {selectedIds.size > 0 && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "10px 14px",
                  background: "var(--info-light)",
                  borderRadius: "var(--radius)",
                  marginBottom: 12,
                }}
              >
                <span className="text-sm font-medium">
                  已选择 {selectedIds.size} 条记录
                </span>
                {user?.role === "financial_advisor" && (
                  <button className="btn btn-primary btn-sm" onClick={() => handleBatchAction("assign")}>
                    批量分派
                  </button>
                )}
                {user?.role === "compliance_officer" && (
                  <button className="btn btn-primary btn-sm" onClick={() => handleBatchAction("transfer")}>
                    批量转办
                  </button>
                )}
                {user?.role === "branch_manager" && (
                  <button className="btn btn-success btn-sm" onClick={() => handleBatchAction("review")}>
                    批量审核
                  </button>
                )}
              </div>
            )}

            {loading ? (
              <div className="empty-state">
                <div className="empty-state-icon">⏳</div>
                <div className="empty-state-text">加载中...</div>
              </div>
            ) : filteredRecords.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">📭</div>
                <div className="empty-state-text">暂无记录</div>
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table>
                  <thead>
                    <tr>
                      <th style={{ width: 36 }}>
                        <input
                          type="checkbox"
                          checked={selectedIds.size === filteredRecords.length && filteredRecords.length > 0}
                          onChange={toggleSelectAll}
                        />
                      </th>
                      <th>记录编号</th>
                      <th>客户姓名</th>
                      <th>业务类型</th>
                      <th>状态</th>
                      <th>到期状态</th>
                      <th>补正状态</th>
                      <th>当前处理人</th>
                      <th>创建时间</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRecords.map((record) => (
                      <tr
                        key={record.id}
                        className={selectedRecord?.id === record.id ? "selected" : ""}
                        onClick={() => handleRowClick(record)}
                        style={{ cursor: "pointer" }}
                      >
                        <td onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={selectedIds.has(record.id)}
                            onChange={() => toggleSelect(record.id)}
                          />
                        </td>
                        <td style={{ fontWeight: 500, color: "var(--primary)" }}>
                          {record.record_no}
                        </td>
                        <td>{record.client_name}</td>
                        <td>{record.business_type}</td>
                        <td>
                          <StatusBadge status={record.status} />
                        </td>
                        <td>
                          <ExpiryBadge status={record.expiry_status} />
                        </td>
                        <td>
                          {record.needs_correction ? (
                            <span className="badge badge-warning">
                              待补正
                              {record.correction_round && record.correction_round > 0 ? ` (第${record.correction_round}轮)` : ""}
                            </span>
                          ) : (
                            <span className="badge badge-success">无需补正</span>
                          )}
                        </td>
                        <td>{record.current_handler?.name || "—"}</td>
                        <td className="text-sm text-muted">
                          {record.created_at
                            ? new Date(record.created_at).toLocaleString("zh-CN")
                            : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        <div style={{ flex: 3, minWidth: 280 }}>
          <div className="card" style={{ position: "sticky", top: 24 }}>
            <div className="card-header">证据摘要</div>
            {selectedRecord ? (
              <EvidenceSummary
                evidence={{
                  suitability_check: selectedRecord.suitability_check,
                  risk_assessment: selectedRecord.risk_assessment,
                  business_opening: selectedRecord.business_opening,
                }}
                showWarning
                onDetail={() => navigate(`/records/${selectedRecord.id}`)}
              />
            ) : (
              <div className="empty-state" style={{ padding: "30px 10px" }}>
                <div className="empty-state-icon">👈</div>
                <div className="empty-state-text">点击左侧记录查看证据摘要</div>
              </div>
            )}

            {selectedRecord && (
              <div style={{ marginTop: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: "var(--gray-700)" }}>
                  记录信息
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span className="text-sm text-muted">记录编号</span>
                    <span className="text-sm font-medium">{selectedRecord.record_no}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span className="text-sm text-muted">客户姓名</span>
                    <span className="text-sm font-medium">{selectedRecord.client_name}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span className="text-sm text-muted">业务类型</span>
                    <span className="text-sm font-medium">{selectedRecord.business_type}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span className="text-sm text-muted">处理状态</span>
                    <StatusBadge status={selectedRecord.status} />
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span className="text-sm text-muted">到期状态</span>
                    <ExpiryBadge status={selectedRecord.expiry_status} />
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span className="text-sm text-muted">补正状态</span>
                    {selectedRecord.needs_correction ? (
                      <span className="badge badge-warning">
                        待补正
                        {selectedRecord.correction_round && selectedRecord.correction_round > 0 ? ` (第${selectedRecord.correction_round}轮)` : ""}
                      </span>
                    ) : (
                      <span className="badge badge-success">无需补正</span>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
