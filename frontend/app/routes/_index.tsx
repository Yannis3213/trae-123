import { useEffect, useState } from "react";
import { Link, useNavigate } from "@remix-run/react";
import {
  CheckCircle,
  XCircle,
  ChevronRight,
  FilePlus2,
  Filter,
} from "lucide-react";

import { api } from "../utils/api";
import {
  BatchResult,
  ExpiryStatus,
  InspectionListItem,
  InspectionStatus,
  STATUS_LABELS,
  UserRole,
} from "../utils/types";
import { useAuth } from "../utils/auth";
import StatusBadge from "../components/StatusBadge";
import ExpiryIndicator from "../components/ExpiryIndicator";

type BatchAction = "process" | "advance";

function getExpiryStatus(deadline: string): ExpiryStatus {
  const now = new Date();
  const dl = new Date(deadline);
  const diffDays = (dl.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
  if (diffDays < 0) return "overdue";
  if (diffDays <= 3) return "approaching";
  return "normal";
}

function statusFilterOptions(): { value: InspectionStatus | "all"; label: string }[] {
  return [
    { value: "all", label: "全部" },
    { value: "pending_submit", label: STATUS_LABELS.pending_submit },
    { value: "pending_process", label: STATUS_LABELS.pending_process },
    { value: "pending_review", label: STATUS_LABELS.pending_review },
    { value: "completed", label: STATUS_LABELS.completed },
    { value: "returned", label: STATUS_LABELS.returned },
    { value: "resubmitted", label: STATUS_LABELS.resubmitted },
  ];
}

function expiryFilterOptions(): { value: ExpiryStatus | "all"; label: string }[] {
  return [
    { value: "all", label: "全部" },
    { value: "normal", label: "正常" },
    { value: "approaching", label: "临期" },
    { value: "overdue", label: "逾期" },
  ];
}

export default function Index() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [items, setItems] = useState<InspectionListItem[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [statusFilter, setStatusFilter] = useState<InspectionStatus | "all">("all");
  const [expiryFilter, setExpiryFilter] = useState<ExpiryStatus | "all">("all");
  const [batchAction, setBatchAction] = useState<BatchAction>("process");
  const [batchOpinion, setBatchOpinion] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [batchResults, setBatchResults] = useState<BatchResult[]>([]);

  useEffect(() => {
    if (!user) return;
    loadList();
  }, [user?.user_id, statusFilter, expiryFilter]);

  async function loadList() {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.append("status", statusFilter);
      if (expiryFilter !== "all") params.append("expiry_status", expiryFilter);
      params.append("role", user?.role || "");
      const data = await api.get<InspectionListItem[]>(
        `/inspections?${params.toString()}`
      );
      setItems(data);
      setError("");
    } catch (e: any) {
      setError(e?.message || "加载失败");
    } finally {
      setLoading(false);
    }
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selected.size === filteredItems.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filteredItems.map((i) => i.id)));
    }
  }

  const filteredItems = items.filter((it) => {
    if (statusFilter !== "all" && it.status !== statusFilter) return false;
    if (expiryFilter !== "all" && getExpiryStatus(it.deadline) !== expiryFilter)
      return false;
    return true;
  });

  async function handleBatch() {
    if (selected.size === 0) {
      setError("请至少选择一条单据");
      return;
    }
    if (batchAction === "process" && !batchOpinion.trim()) {
      setError("批量处理需要填写处理意见");
      return;
    }
    try {
      setLoading(true);
      setError("");
      const results = await api.post<BatchResult[]>("/inspections/batch-process", {
        inspection_ids: Array.from(selected),
        action: batchAction,
        opinion: batchOpinion || null,
      });
      setBatchResults(results);
      const successIds = new Set(results.filter((r) => r.success).map((r) => r.inspection_id));
      setItems((prev) =>
        prev.map((it) => {
          if (successIds.has(it.id)) {
            const nextStatus: InspectionStatus =
              batchAction === "process" ? "pending_review" : it.status;
            return {
              ...it,
              status: nextStatus,
              version: it.version + 1,
              updated_at: new Date().toISOString(),
            };
          }
          return it;
        })
      );
      setSelected(new Set());
      sessionStorage.setItem("batchResults", JSON.stringify(results));
      navigate("/batch-result");
    } catch (e: any) {
      setError(e?.message || "批量操作失败");
    } finally {
      setLoading(false);
    }
  }

  if (!user) return null;

  const canBatchProcess = user.role === "maintenance_engineer";
  const canBatchAdvance = user.role === "operations_manager";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-800">
          设备巡检单列表
        </h1>
        {user.role === "duty_officer" && (
          <Link
            to="/inspection/new"
            className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow hover:bg-emerald-700"
          >
            <FilePlus2 className="h-4 w-4" />
            新建巡检单
          </Link>
        )}
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-slate-500" />
            <div className="flex gap-3">
              <div>
                <label className="mb-1 block text-xs text-slate-500">状态</label>
                <select
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  value={statusFilter}
                  onChange={(e) =>
                    setStatusFilter(e.target.value as InspectionStatus | "all")
                  }
                >
                  {statusFilterOptions().map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs text-slate-500">到期状态</label>
                <select
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  value={expiryFilter}
                  onChange={(e) =>
                    setExpiryFilter(e.target.value as ExpiryStatus | "all")
                  }
                >
                  {expiryFilterOptions().map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>

        {(canBatchProcess || canBatchAdvance) && (
          <div className="mt-4 flex flex-wrap items-end gap-3 rounded-lg bg-slate-50 p-3">
            <div>
              <label className="mb-1 block text-xs text-slate-500">批量操作</label>
              <select
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                value={batchAction}
                onChange={(e) => setBatchAction(e.target.value as BatchAction)}
              >
                {canBatchProcess && (
                  <option value="process">批量处理（运维工程师）</option>
                )}
                {canBatchAdvance && (
                  <option value="advance">批量推进逾期单据（运营经理）</option>
                )}
              </select>
            </div>
            {batchAction === "process" && (
              <div className="flex-1 min-w-[240px]">
                <label className="mb-1 block text-xs text-slate-500">
                  处理意见 <span className="text-red-500">*</span>
                </label>
                <input
                  className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  value={batchOpinion}
                  onChange={(e) => setBatchOpinion(e.target.value)}
                  placeholder="请输入批量处理意见"
                />
              </div>
            )}
            <button
              onClick={handleBatch}
              disabled={loading || selected.size === 0}
              className="rounded-lg bg-emerald-600 px-4 py-1.5 text-sm font-medium text-white shadow hover:bg-emerald-700 disabled:opacity-50"
            >
              批量执行（已选 {selected.size}）
            </button>
          </div>
        )}

        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs font-medium text-slate-500">
                <th className="px-3 py-2">
                  <input
                    type="checkbox"
                    checked={
                      filteredItems.length > 0 &&
                      selected.size === filteredItems.length
                    }
                    onChange={toggleSelectAll}
                    className="rounded border-slate-300"
                  />
                </th>
                <th className="px-3 py-2">单号</th>
                <th className="px-3 py-2">标题</th>
                <th className="px-3 py-2">状态</th>
                <th className="px-3 py-2">创建人</th>
                <th className="px-3 py-2">处理人</th>
                <th className="px-3 py-2">截止日期</th>
                <th className="px-3 py-2">到期</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.length === 0 && !loading && (
                <tr>
                  <td
                    colSpan={9}
                    className="px-3 py-8 text-center text-sm text-slate-400"
                  >
                    暂无数据
                  </td>
                </tr>
              )}
              {filteredItems.map((item) => {
                const batchResult = batchResults.find(
                  (r) => r.inspection_id === item.id
                );
                return (
                  <tr
                    key={item.id}
                    className="border-b border-slate-100 hover:bg-slate-50"
                  >
                    <td className="px-3 py-3">
                      <input
                        type="checkbox"
                        checked={selected.has(item.id)}
                        onChange={() => toggleSelect(item.id)}
                        className="rounded border-slate-300"
                      />
                    </td>
                    <td className="px-3 py-3 font-mono text-xs text-slate-600">
                      {item.id.slice(0, 8)}
                    </td>
                    <td className="px-3 py-3 text-slate-800">
                      <div className="flex items-center gap-2">
                        {item.title}
                        {batchResult &&
                          (batchResult.success ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700">
                              <CheckCircle className="h-3 w-3" />
                              成功
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-xs text-red-700" title={batchResult.reason || ""}>
                              <XCircle className="h-3 w-3" />
                              失败
                            </span>
                          ))}
                      </div>
                      {batchResult && !batchResult.success && batchResult.reason && (
                        <div className="mt-0.5 text-xs text-red-600">
                          {batchResult.reason}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <StatusBadge status={item.status} />
                    </td>
                    <td className="px-3 py-3 text-slate-600">
                      {item.creator_name || item.creator_id}
                    </td>
                    <td className="px-3 py-3 text-slate-600">
                      {item.processor_name || item.processor_id || "-"}
                    </td>
                    <td className="px-3 py-3 text-slate-600">{item.deadline}</td>
                    <td className="px-3 py-3">
                      <ExpiryIndicator expiry={getExpiryStatus(item.deadline)} />
                    </td>
                    <td className="px-3 py-3 text-right">
                      <Link
                        to={`/inspection/${item.id}`}
                        className="inline-flex items-center gap-1 text-sm text-emerald-600 hover:text-emerald-700"
                      >
                        详情
                        <ChevronRight className="h-4 w-4" />
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
