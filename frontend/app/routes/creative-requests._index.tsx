import { useState, useEffect } from "react";
import { Link, useOutletContext } from "@remix-run/react";
import { getRequests, batchProcess, type CreativeRequestListItem, type BatchResult } from "~/utils/api";
import { STATUS_LABELS, BRIEF_STATUS_LABELS, BRIEF_STATUS_COLORS, SCHEDULE_STATUS_LABELS, SCHEDULE_STATUS_COLORS, DEADLINE_LABELS, ALLOWED_TRANSITIONS } from "~/utils/status";
import type { UserRole, BriefStatus, ScheduleStatus, RequestStatus } from "~/utils/status";
import StatusBadge from "~/components/StatusBadge";
import DeadlineWarning from "~/components/DeadlineWarning";
import BatchProcessor from "~/components/BatchProcessor";

interface OutletContext {
  userId: string;
  role: UserRole;
}

export default function CreativeRequestsList() {
  const { userId, role } = useOutletContext<OutletContext>();
  const [data, setData] = useState<CreativeRequestListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState("");
  const [deadlineFilter, setDeadlineFilter] = useState("");
  const [keyword, setKeyword] = useState("");
  const [showBatch, setShowBatch] = useState(false);
  const [batchResults, setBatchResults] = useState<BatchResult | null>(null);

  useEffect(() => {
    setLoading(true);
    getRequests({
      status: statusFilter || undefined,
      deadline_warning: deadlineFilter || undefined,
      keyword: keyword || undefined,
    })
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [statusFilter, deadlineFilter, keyword]);

  const canCreate = role === "creative_registrar";

  const getVisibleStatuses = (): RequestStatus[] => {
    return Object.keys(ALLOWED_TRANSITIONS[role]) as RequestStatus[];
  };

  const visibleStatuses = getVisibleStatuses();

  const deadlineWarningColor = (warning: string) => {
    if (warning === "overdue") return "bg-red-100 text-red-700";
    if (warning === "approaching") return "bg-yellow-100 text-yellow-700";
    return "bg-green-100 text-green-700";
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">工作台</h1>
          <p className="mt-1 text-sm text-gray-500">管理和处理创意需求单</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowBatch(!showBatch)}
            className={`inline-flex items-center px-4 py-2 border text-sm font-medium rounded-md shadow-sm transition-colors ${
              showBatch
                ? "border-blue-300 text-blue-700 bg-blue-50"
                : "border-gray-300 text-gray-700 bg-white hover:bg-gray-50"
            }`}
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            批量处理
          </button>
          {canCreate && (
            <Link
              to="/creative-requests/new"
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              新建需求单
            </Link>
          )}
        </div>
      </div>

      {batchResults && (
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-gray-700">批量处理结果</h3>
            <button
              onClick={() => setBatchResults(null)}
              className="text-gray-400 hover:text-gray-600"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="space-y-2">
            {batchResults.results.map((r, idx) => (
              <div
                key={idx}
                className={`flex items-center justify-between p-2 rounded text-sm ${
                  r.success ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
                }`}
              >
                <span className="font-mono">ID: {r.id}</span>
                <span>{r.success ? `成功 → ${r.new_status || ""}` : `失败: ${r.error}`}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white shadow rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex flex-wrap items-center gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">状态筛选</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="block rounded-md border-gray-300 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500"
              >
                <option value="">全部状态</option>
                {visibleStatuses.map((s) => (
                  <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">到期预警</label>
              <select
                value={deadlineFilter}
                onChange={(e) => setDeadlineFilter(e.target.value)}
                className="block rounded-md border-gray-300 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500"
              >
                <option value="">全部</option>
                <option value="overdue">逾期</option>
                <option value="approaching">临期</option>
                <option value="normal">正常</option>
              </select>
            </div>
            <div className="flex-1 min-w-[200px]">
              <label className="block text-xs font-medium text-gray-500 mb-1">关键词搜索</label>
              <input
                type="text"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder="搜索编号、标题、客户..."
                className="block w-full rounded-md border-gray-300 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500"
              />
            </div>
            <div className="self-end">
              <button
                onClick={() => { setStatusFilter(""); setDeadlineFilter(""); setKeyword(""); }}
                className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
              >
                重置
              </button>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="p-12 text-center text-gray-400">加载中...</div>
        ) : error ? (
          <div className="p-12 text-center text-red-500">加载失败: {error}</div>
        ) : showBatch && data.length > 0 ? (
          <div className="p-4">
            <BatchProcessor
              requests={data}
              onComplete={setBatchResults}
            />
          </div>
        ) : data.length === 0 ? (
          <div className="p-12 text-center">
            <svg className="w-12 h-12 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="text-gray-400">暂无需求单</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">单据编号</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">标题</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">客户</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">状态</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Brief状态</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">排期状态</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">到期预警</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">当前处理人</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {data.map((req) => (
                  <tr
                    key={req.id}
                    className={`hover:bg-gray-50 cursor-pointer ${
                      req.deadline_warning === "overdue" ? "bg-red-50/50" : ""
                    }`}
                    onClick={() => window.location.href = `/creative-requests/${req.id}`}
                  >
                    <td className="px-6 py-4 text-sm font-mono text-blue-600 hover:text-blue-800">
                      {req.request_number}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900 font-medium">
                      <div className="flex items-center gap-2">
                        {req.deadline_warning === "overdue" && (
                          <span className="flex-shrink-0 w-2 h-2 rounded-full bg-red-500" title="逾期" />
                        )}
                        {req.deadline_warning === "approaching" && (
                          <span className="flex-shrink-0 w-2 h-2 rounded-full bg-yellow-500" title="临期" />
                        )}
                        {req.title}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700">{req.client_name}</td>
                    <td className="px-6 py-4"><StatusBadge status={req.status as RequestStatus} size="sm" /></td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${BRIEF_STATUS_COLORS[req.brief_status as BriefStatus] || "bg-gray-100 text-gray-600"}`}>
                        {BRIEF_STATUS_LABELS[req.brief_status as BriefStatus] || req.brief_status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${SCHEDULE_STATUS_COLORS[req.schedule_status as ScheduleStatus] || "bg-gray-100 text-gray-600"}`}>
                        {SCHEDULE_STATUS_LABELS[req.schedule_status as ScheduleStatus] || req.schedule_status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {req.deadline_warning ? (
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${deadlineWarningColor(req.deadline_warning)}`}>
                          {DEADLINE_LABELS[req.deadline_warning as "normal" | "approaching" | "overdue"] || req.deadline_warning}
                        </span>
                      ) : (
                        <DeadlineWarning deadline={req.deadline} showLabel={true} />
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">{req.handler_name || "-"}</td>
                    <td className="px-6 py-4 text-right">
                      <Link
                        to={`/creative-requests/${req.id}`}
                        className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                        onClick={(e) => e.stopPropagation()}
                      >
                        查看详情
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
