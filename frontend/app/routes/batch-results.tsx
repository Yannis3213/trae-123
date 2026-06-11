import { useState, useEffect } from "react";
import { Link, useOutletContext } from "@remix-run/react";
import { getRequests, batchProcess, type CreativeRequestListItem, type BatchResult } from "~/utils/api";
import type { UserRole, RequestStatus } from "~/utils/status";
import { STATUS_LABELS } from "~/utils/status";
import StatusBadge from "~/components/StatusBadge";
import DeadlineWarning from "~/components/DeadlineWarning";

interface OutletContext {
  userId: string;
  role: UserRole;
}

export default function BatchResults() {
  const { role } = useOutletContext<OutletContext>();

  const [requests, setRequests] = useState<CreativeRequestListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [action, setAction] = useState<string>("submit");
  const [opinion, setOpinion] = useState("");
  const [processing, setProcessing] = useState(false);
  const [results, setResults] = useState<BatchResult | null>(null);

  useEffect(() => {
    getRequests()
      .then((data) => setRequests(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const toggleSelect = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === requests.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(requests.map((r) => r.id)));
    }
  };

  const handleProcess = async () => {
    if (selected.size === 0) {
      alert("请选择至少一条需求单");
      return;
    }
    if ((action === "return") && !opinion.trim()) {
      alert("退回操作必须填写意见");
      return;
    }
    if (!confirm(`确定要对 ${selected.size} 条需求单执行批量操作吗？`)) return;

    setProcessing(true);
    try {
      const selectedRequests = requests.filter((r) => selected.has(r.id));
      const effectiveAction = action === "archive" ? "approve" : action;
      const items = selectedRequests.map((r) => ({
        id: r.id,
        version: r.version,
        action: effectiveAction,
        opinion: opinion || "",
      }));
      const batchResults = await batchProcess({ items });
      setResults(batchResults);
      setSelected(new Set());
      setOpinion("");
    } catch (err) {
      alert("批量处理失败: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setProcessing(false);
    }
  };

  const successCount = results ? results.results.filter((r) => r.success).length : 0;
  const failCount = results ? results.results.filter((r) => !r.success).length : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">批量处理</h1>
        <p className="mt-1 text-sm text-gray-500">批量选择需求单并执行操作</p>
      </div>

      <div className="bg-white shadow rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex flex-wrap items-center gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">操作类型</label>
              <select
                value={action}
                onChange={(e) => setAction(e.target.value)}
                className="block rounded-md border-gray-300 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500"
              >
                <option value="submit">批量提交</option>
                <option value="approve">批量通过</option>
                <option value="return">批量退回</option>
                <option value="archive">批量归档</option>
              </select>
            </div>
            {action === "return" && (
              <div className="flex-1 min-w-[200px]">
                <label className="block text-xs font-medium text-gray-500 mb-1">退回意见 <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={opinion}
                  onChange={(e) => setOpinion(e.target.value)}
                  placeholder="请输入退回意见"
                  className="block w-full rounded-md border-gray-300 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
            )}
            <div className="self-end">
              <button
                onClick={handleProcess}
                disabled={processing || selected.size === 0}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {processing ? "处理中..." : `执行 (${selected.size} 项)`}
              </button>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="p-12 text-center text-gray-400">加载中...</div>
        ) : requests.length === 0 ? (
          <div className="p-12 text-center text-gray-400">暂无可处理的需求单</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left">
                    <input
                      type="checkbox"
                      checked={selected.size === requests.length && requests.length > 0}
                      onChange={toggleAll}
                      className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">单据编号</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">标题</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">客户</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">状态</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">版本</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">到期预警</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {requests.map((req) => (
                  <tr
                    key={req.id}
                    className={`hover:bg-gray-50 cursor-pointer ${
                      selected.has(req.id) ? "bg-blue-50" : ""
                    }`}
                  >
                    <td className="px-6 py-4">
                      <input
                        type="checkbox"
                        checked={selected.has(req.id)}
                        onChange={() => toggleSelect(req.id)}
                        className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                    </td>
                    <td className="px-6 py-4 text-sm font-mono">
                      <Link to={`/creative-requests/${req.id}`} className="text-blue-600 hover:text-blue-800 hover:underline">
                        {req.request_number}
                      </Link>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">{req.title}</td>
                    <td className="px-6 py-4 text-sm text-gray-700">{req.client_name}</td>
                    <td className="px-6 py-4"><StatusBadge status={req.status as RequestStatus} size="sm" /></td>
                    <td className="px-6 py-4 text-sm text-gray-500">v{req.version}</td>
                    <td className="px-6 py-4"><DeadlineWarning deadline={req.deadline} showLabel={false} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {results && (
        <div className="bg-white shadow rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <h2 className="text-lg font-medium text-gray-900">处理结果</h2>
              <div className="flex items-center gap-3">
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                  成功 {successCount}
                </span>
                {failCount > 0 && (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                    失败 {failCount}
                  </span>
                )}
              </div>
            </div>
            <button
              onClick={() => setResults(null)}
              className="text-gray-400 hover:text-gray-600"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">需求单ID</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">结果</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">新状态</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">原因</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {results.results.map((r, idx) => (
                  <tr key={idx} className={r.success ? "" : "bg-red-50/50"}>
                    <td className="px-6 py-4 text-sm font-mono text-gray-900">{r.id}</td>
                    <td className="px-6 py-4">
                      {r.success ? (
                        <span className="inline-flex items-center gap-1.5 text-sm text-green-700">
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                          成功
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-sm text-red-700">
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                          </svg>
                          失败
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {r.new_status ? (STATUS_LABELS[r.new_status as RequestStatus] || r.new_status) : "-"}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {r.error || "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
