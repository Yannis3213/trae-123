import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "@remix-run/react";
import Layout from "~/components/Layout";
import StatusBadge from "~/components/StatusBadge";
import BatchResultList from "~/components/BatchResultList";
import { apiFetch } from "~/utils/api";
import { getToken, isAuthenticated, getCurrentUser } from "~/utils/auth";

interface Record {
  id: string;
  record_no: string;
  client_name: string;
  business_type: string;
  status: string;
  current_handler: { id: string; name: string } | null;
  needs_correction?: boolean;
  correction_round?: number;
}

interface UserOption {
  id: string;
  name: string;
  role: string;
}

interface BatchResult {
  record_id: number;
  record_no?: string;
  success: boolean;
  reason?: string;
}

const ACTION_OPTIONS = [
  { key: "assign", label: "批量分派", status: "pending_assign" },
  { key: "transfer", label: "批量转办", status: "transferred" },
  { key: "review", label: "批量审核", status: "visited" },
];

const STATUS_TABS = [
  { key: "pending_assign", label: "待分派" },
  { key: "transferred", label: "已转办" },
  { key: "visited", label: "已回访" },
];

const CORRECTION_FILTERS = [
  { key: "all", label: "全部" },
  { key: "true", label: "待补正" },
  { key: "false", label: "无需补正" },
];

export default function BatchPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [records, setRecords] = useState<Record[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("pending_assign");
  const [correctionFilter, setCorrectionFilter] = useState("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [action, setAction] = useState("assign");
  const [handlerId, setHandlerId] = useState("");
  const [comment, setComment] = useState("");
  const [reviewOpinion, setReviewOpinion] = useState("");
  const [reviewResult, setReviewResult] = useState<"approved" | "rejected">("approved");
  const [returnReason, setReturnReason] = useState("");
  const [users, setUsers] = useState<UserOption[]>([]);
  const [processing, setProcessing] = useState(false);
  const [results, setResults] = useState<BatchResult[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isAuthenticated()) {
      navigate("/login");
      return;
    }
    loadRecords();
    loadUsers();

    const paramAction = searchParams.get("action");
    const paramIds = searchParams.get("ids");
    if (paramAction) setAction(paramAction);
    if (paramIds) setSelectedIds(new Set(paramIds.split(",")));
  }, []);

  useEffect(() => {
    loadRecords();
  }, [statusFilter, correctionFilter]);

  useEffect(() => {
    const match = ACTION_OPTIONS.find((a) => a.key === action);
    if (match) setStatusFilter(match.status);
  }, [action]);

  const loadRecords = async () => {
    try {
      setLoading(true);
      const token = getToken();
      const params = new URLSearchParams();
      params.set("status", statusFilter);
      if (correctionFilter !== "all") params.set("needs_correction", correctionFilter);
      const qs = params.toString();
      const data = await apiFetch(`/records${qs ? "?" + qs : ""}`, {}, token || undefined);
      setRecords(data.records || data || []);
    } catch (err: any) {
      setError(err.message || "加载记录失败");
    } finally {
      setLoading(false);
    }
  };

  const loadUsers = async () => {
    try {
      const token = getToken();
      const data = await apiFetch("/auth/users", {}, token || undefined);
      setUsers(data || []);
    } catch {}
  };

  const filteredRecords = records.filter((r) => r.status === statusFilter);

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const toggleSelectAll = () => {
    const filteredIds = filteredRecords.map((r) => r.id);
    if (filteredIds.every((id) => selectedIds.has(id))) {
      const next = new Set(selectedIds);
      filteredIds.forEach((id) => next.delete(id));
      setSelectedIds(next);
    } else {
      setSelectedIds(new Set([...selectedIds, ...filteredIds]));
    }
  };

  const handlerUsers = users.filter((u) => {
    if (action === "assign") return u.role === "compliance_officer";
    if (action === "transfer") return u.role === "branch_manager";
    return false;
  });

  const handleBatchProcess = async () => {
    if (selectedIds.size === 0) {
      setError("请选择至少一条记录");
      return;
    }
    if (action === "review" && !reviewOpinion) {
      setError("批量审核必须填写复核意见");
      return;
    }
    setProcessing(true);
    setResults([]);
    setError("");
    try {
      const token = getToken();
      const body: any = {
        record_ids: Array.from(selectedIds).map(id => parseInt(String(id))),
        action,
      };
      if (handlerId) body.assigned_to = parseInt(handlerId);
      if (comment) body.comment = comment;
      if (action === "review") {
        body.review_opinion = reviewOpinion;
        body.review_result = reviewResult;
      }
      if (returnReason) body.return_reason = returnReason;
      const data = await apiFetch("/batch/process", {
        method: "POST",
        body: JSON.stringify(body),
      }, token || undefined);
      setResults(data.results || []);
    } catch (err: any) {
      setError(err.message || "批量处理失败");
    } finally {
      setProcessing(false);
    }
  };

  const user = getCurrentUser();

  return (
    <Layout>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700 }}>批量处理</h2>
        <p className="text-sm text-muted" style={{ marginTop: 4 }}>
          批量选择适当性记录进行分派、转办或审核操作
        </p>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header">操作设置</div>
        <div style={{ display: "flex", gap: 16, alignItems: "flex-end", flexWrap: "wrap" }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>批量操作类型</label>
            <select
              className="form-control"
              value={action}
              onChange={(e) => setAction(e.target.value)}
              style={{ minWidth: 160 }}
            >
              {ACTION_OPTIONS.map((opt) => (
                <option key={opt.key} value={opt.key}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {action !== "review" && (
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>指定处理人</label>
              <select
                className="form-control"
                value={handlerId}
                onChange={(e) => setHandlerId(e.target.value)}
                style={{ minWidth: 160 }}
              >
                <option value="">请选择</option>
                {handlerUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {action === "review" && (
            <>
              <div className="form-group" style={{ marginBottom: 0, flex: 1 }}>
                <label>复核意见 <span style={{ color: "var(--danger)" }}>*</span></label>
                <input
                  className="form-control"
                  value={reviewOpinion}
                  onChange={(e) => setReviewOpinion(e.target.value)}
                  placeholder="请输入复核意见"
                />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>复核结果</label>
                <select
                  className="form-control"
                  value={reviewResult}
                  onChange={(e) => setReviewResult(e.target.value as "approved" | "rejected")}
                  style={{ minWidth: 120 }}
                >
                  <option value="approved">通过</option>
                  <option value="rejected">驳回</option>
                </select>
              </div>
            </>
          )}

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>备注</label>
            <input
              className="form-control"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="退回原因或备注"
              style={{ minWidth: 160 }}
            />
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>退回补正要求</label>
            <input
              className="form-control"
              value={returnReason}
              onChange={(e) => setReturnReason(e.target.value)}
              placeholder="退回时的补正要求"
              style={{ minWidth: 160 }}
            />
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8, paddingBottom: 2 }}>
            <span className="text-sm font-medium">
              已选择 {selectedIds.size} 条
            </span>
            <button
              className="btn btn-primary"
              onClick={handleBatchProcess}
              disabled={processing || selectedIds.size === 0}
            >
              {processing ? "处理中..." : "执行批量操作"}
            </button>
          </div>
        </div>
      </div>

      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 12 }}>
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
          <div className="tabs" style={{ marginBottom: 0, borderBottom: "none" }}>
            {CORRECTION_FILTERS.map((tab) => (
              <button
                key={tab.key}
                className={`tab ${correctionFilter === tab.key ? "active" : ""}`}
                onClick={() => setCorrectionFilter(tab.key)}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="empty-state">
            <div className="empty-state-icon">⏳</div>
            <div className="empty-state-text">加载中...</div>
          </div>
        ) : filteredRecords.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📭</div>
            <div className="empty-state-text">当前筛选下无记录</div>
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th style={{ width: 36 }}>
                  <input
                    type="checkbox"
                    checked={
                      filteredRecords.length > 0 &&
                      filteredRecords.every((r) => selectedIds.has(r.id))
                    }
                    onChange={toggleSelectAll}
                  />
                </th>
                <th>记录编号</th>
                <th>客户姓名</th>
                <th>业务类型</th>
                <th>状态</th>
                <th>补正状态</th>
                <th>当前处理人</th>
              </tr>
            </thead>
            <tbody>
              {filteredRecords.map((record) => (
                <tr
                  key={record.id}
                  className={selectedIds.has(record.id) ? "selected" : ""}
                >
                  <td>
                    <input
                      type="checkbox"
                      checked={selectedIds.has(record.id)}
                      onChange={() => toggleSelect(record.id)}
                    />
                  </td>
                  <td
                    style={{ fontWeight: 500, color: "var(--primary)", cursor: "pointer" }}
                    onClick={() => navigate(`/records/${record.id}`)}
                  >
                    {record.record_no}
                  </td>
                  <td>{record.client_name}</td>
                  <td>{record.business_type}</td>
                  <td>
                    <StatusBadge status={record.status} />
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
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {results.length > 0 && (
        <div className="card" style={{ marginTop: 20 }}>
          <div className="card-header">处理结果</div>
          <BatchResultList results={results} />
        </div>
      )}
    </Layout>
  );
}
