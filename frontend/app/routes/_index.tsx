import { useState, useEffect } from "react";
import { useNavigate } from "@remix-run/react";
import { Search, Filter, Play, CheckSquare } from "lucide-react";
import { api } from "../utils/api";
import { useAuth } from "../root";
import type { InspectionListItem, InspectionStatus } from "../utils/types";
import StatusBadge from "../components/StatusBadge";
import ExpiryIndicator from "../components/ExpiryIndicator";

type ExpiryStatus = "normal" | "approaching" | "overdue";

function getExpiryStatus(deadline: string): ExpiryStatus {
  const now = new Date();
  const dl = new Date(deadline);
  const diffDays = (dl.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
  if (diffDays < 0) return "overdue";
  if (diffDays <= 3) return "approaching";
  return "normal";
}

export default function Index() {
  const [inspections, setInspections] = useState<InspectionListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [expiryFilter, setExpiryFilter] = useState<string>("");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [batchAction, setBatchAction] = useState("");
  const [batchOpinion, setBatchOpinion] = useState("");
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    loadInspections();
  }, []);

  const loadInspections = async () => {
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set("status", statusFilter);
      if (search) params.set("search", search);
      const data = await api.get<InspectionListItem[]>(
        `/inspections?${params.toString()}`
      );
      setInspections(data);
    } catch {
      setInspections([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInspections();
  }, [statusFilter, search]);

  const filtered = inspections.filter((item) => {
    if (!expiryFilter) return true;
    return getExpiryStatus(item.deadline) === expiryFilter;
  });

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === filtered.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map((i) => i.id)));
    }
  };

  const handleBatchAction = async () => {
    if (selected.size === 0 || !batchAction) return;
    try {
      const results = await api.post<import("../utils/types").BatchResult[]>(
        "/inspections/batch-process",
        {
          inspection_ids: Array.from(selected),
          action: batchAction,
          opinion: batchOpinion || null,
        }
      );
      sessionStorage.setItem("batchResults", JSON.stringify(results));
      navigate("/batch-result");
    } catch (err) {
      alert("批量操作失败：" + (err instanceof Error ? err.message : "未知错误"));
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-400">加载中...</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-800">设备巡检单列表</h2>
        {user?.role === "duty_officer" && (
          <a
            href="/inspection/new"
            className="bg-emerald-accent text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-emerald-600 transition-colors"
          >
            新建巡检单
          </a>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <Filter size={16} className="text-gray-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-accent"
            >
              <option value="">全部状态</option>
              <option value="pending_submit">待提交</option>
              <option value="pending_process">待处理</option>
              <option value="pending_review">待复核</option>
              <option value="completed">已完成</option>
              <option value="returned">已退回</option>
              <option value="resubmitted">重新提交</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={expiryFilter}
              onChange={(e) => setExpiryFilter(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-accent"
            >
              <option value="">全部到期状态</option>
              <option value="normal">正常</option>
              <option value="approaching">临期</option>
              <option value="overdue">逾期</option>
            </select>
          </div>

          <div className="flex items-center gap-2 flex-1 min-w-[200px]">
            <Search size={16} className="text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="搜索巡检单..."
              className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-accent"
            />
          </div>
        </div>
      </div>

      {selected.size > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-center gap-4 flex-wrap">
          <span className="text-sm text-blue-700">
            已选择 {selected.size} 项
          </span>
          <select
            value={batchAction}
            onChange={(e) => setBatchAction(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
          >
            <option value="">选择操作</option>
            <option value="submit">提交</option>
            <option value="process">处理</option>
            <option value="approve">批准</option>
            <option value="reject">退回</option>
          </select>
          {batchAction && (
            <input
              type="text"
              value={batchOpinion}
              onChange={(e) => setBatchOpinion(e.target.value)}
              placeholder="处理意见（可选）"
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm flex-1 min-w-[200px]"
            />
          )}
          <button
            onClick={handleBatchAction}
            disabled={!batchAction}
            className="bg-blue-500 text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Play size={14} className="inline mr-1" />
            执行
          </button>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              <th className="w-10 px-4 py-3">
                <input
                  type="checkbox"
                  checked={selected.size === filtered.length && filtered.length > 0}
                  onChange={toggleAll}
                  className="rounded border-gray-300 text-emerald-accent focus:ring-emerald-accent"
                />
              </th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">ID</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">标题</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">状态</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">创建人</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">处理人</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">截止日期</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">到期</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-center py-8 text-gray-400 text-sm">
                  暂无数据
                </td>
              </tr>
            ) : (
              filtered.map((item) => {
                const expiry = getExpiryStatus(item.deadline);
                return (
                  <tr
                    key={item.id}
                    className="hover:bg-gray-50 cursor-pointer"
                    onClick={() => navigate(`/inspection/${item.id}`)}
                  >
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selected.has(item.id)}
                        onChange={() => toggleSelect(item.id)}
                        className="rounded border-gray-300 text-emerald-accent focus:ring-emerald-accent"
                      />
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500 font-mono">
                      {item.id.slice(0, 8)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-800 font-medium">
                      {item.title}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={item.status} />
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {item.creator_id}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {item.processor_id || "-"}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {item.deadline}
                    </td>
                    <td className="px-4 py-3">
                      <ExpiryIndicator status={expiry} />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
