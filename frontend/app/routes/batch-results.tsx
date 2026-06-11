import { useState, useEffect } from "react";
import { Link, useOutletContext } from "@remix-run/react";
import { getRequests, batchProcess, type CreativeRequestListItem, type BatchResult } from "~/utils/api";
import type { UserRole, RequestStatus } from "~/utils/status";
import {
  STATUS_LABELS,
  USER_NUMERIC_ID,
  ROLE_LABELS,
  BRIEF_STATUS_LABELS,
  BRIEF_STATUS_COLORS,
  SCHEDULE_STATUS_LABELS,
  SCHEDULE_STATUS_COLORS,
  computeDeadlineLevel,
} from "~/utils/status";
import StatusBadge from "~/components/StatusBadge";
import DeadlineWarning from "~/components/DeadlineWarning";

interface OutletContext {
  userId: string;
  role: UserRole;
}

export default function BatchResults() {
  const { userId, role } = useOutletContext<OutletContext>();
  const numericUserId = USER_NUMERIC_ID[userId] ?? 0;

  const [requests, setRequests] = useState<CreativeRequestListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [action, setAction] = useState<string>("submit");
  const [opinion, setOpinion] = useState("");
  const [processing, setProcessing] = useState(false);
  const [results, setResults] = useState<BatchResult | null>(null);

  const opinionRequiredActions = ["start_review", "approve", "return", "archive"];
  const needsOpinion = opinionRequiredActions.includes(action);

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
    const actionableIds = requests
      .filter((r) => {
        const isMine = r.current_handler_id === numericUserId;
        const isOverdue = computeDeadlineLevel(r.deadline) === "overdue";
        const isBriefMissing = r.brief_status === "missing";
        const isScheduleMissing = r.schedule_status === "missing";
        return isMine && !isOverdue && !isBriefMissing && !isScheduleMissing;
      })
      .map((r) => r.id);
    const actionableSize = actionableIds.length;
    const allActionableSelected =
      actionableIds.every((id) => selected.has(id)) && actionableSize > 0;
    if (allActionableSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(actionableIds));
    }
  };

  const handleProcess = async () => {
    if (selected.size === 0) {
      alert("请选择至少一条需求单");
      return;
    }
    if (needsOpinion && !opinion.trim()) {
      alert("当前批量动作必须填写处理意见（开始审核/通过/退回/归档）");
      return;
    }
    const selectedRequests = requests.filter((r) => selected.has(r.id));
    const notHandlerCount = selectedRequests.filter(
      (r) => r.current_handler_id !== numericUserId
    ).length;
    let confirmMsg = `确定要对 ${selected.size} 条需求单执行批量操作吗？`;
    if (notHandlerCount > 0) {
      confirmMsg += `\n\n⚠️ 其中 ${notHandlerCount} 条不是您当前作为处理人的单据，后端将逐条拦截并记录异常。`;
    }
    if (!confirm(confirmMsg)) return;

    setProcessing(true);
    try {
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
                <option value="start_review">批量开始审核</option>
                <option value="approve">批量通过</option>
                <option value="return">批量退回</option>
                <option value="archive">批量归档</option>
              </select>
            </div>
            {needsOpinion && (
              <div className="flex-1 min-w-[200px]">
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  {action === "return"
                    ? "退回意见"
                    : action === "start_review"
                    ? "开始审核意见"
                    : action === "approve"
                    ? "通过/归档意见"
                    : "处理意见"}
                  <span className="text-red-500"> *</span>
                </label>
                <input
                  type="text"
                  value={opinion}
                  onChange={(e) => setOpinion(e.target.value)}
                  placeholder={
                    action === "return"
                      ? "请输入退回意见"
                      : action === "start_review"
                      ? "请输入开始审核意见（必填）"
                      : action === "approve"
                      ? "请输入通过/归档意见（必填）"
                      : "请输入处理意见"
                  }
                  className="block w-full rounded-md border-gray-300 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
            )}
            <div className="self-end">
              <button
                onClick={handleProcess}
                disabled={
                  processing ||
                  selected.size === 0 ||
                  (needsOpinion && !opinion.trim())
                }
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
                      checked={
                        selected.size === requests.filter((r) => {
                          const isMine = r.current_handler_id === numericUserId;
                          const isOverdue = computeDeadlineLevel(r.deadline) === "overdue";
                          const isBriefMissing = r.brief_status === "missing";
                          const isScheduleMissing = r.schedule_status === "missing";
                          return isMine && !isOverdue && !isBriefMissing && !isScheduleMissing;
                        }).length &&
                        requests.some((r) => {
                          const isMine = r.current_handler_id === numericUserId;
                          const isOverdue = computeDeadlineLevel(r.deadline) === "overdue";
                          const isBriefMissing = r.brief_status === "missing";
                          const isScheduleMissing = r.schedule_status === "missing";
                          return isMine && !isOverdue && !isBriefMissing && !isScheduleMissing;
                        })
                      }
                      onChange={toggleAll}
                      className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">单据编号</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">标题</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">客户</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">状态</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Brief</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">排期</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">当前处理人</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">版本</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">到期预警</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">拦截原因</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {requests.map((req) => {
                  const isMine = req.current_handler_id === numericUserId;
                  const isOverdue = computeDeadlineLevel(req.deadline) === "overdue";
                  const isBriefMissing = req.brief_status === "missing";
                  const isScheduleMissing = req.schedule_status === "missing";
                  const blockReasons: string[] = [];
                  if (!isMine) blockReasons.push("非当前处理人");
                  if (isOverdue) blockReasons.push("逾期");
                  if (isBriefMissing) blockReasons.push("Brief缺失");
                  if (isScheduleMissing) blockReasons.push("排期缺失");
                  const isBlocked = blockReasons.length > 0;
                  return (
                    <tr
                      key={req.id}
                      className={`cursor-pointer ${
                        selected.has(req.id)
                          ? "bg-blue-50"
                          : isMine && !isBlocked
                          ? "hover:bg-gray-50"
                          : "bg-gray-50/50 opacity-70 hover:bg-gray-100/70"
                      }`}
                    >
                      <td className="px-6 py-4 align-middle">
                        <input
                          type="checkbox"
                          checked={selected.has(req.id)}
                          onChange={() => toggleSelect(req.id)}
                          disabled={!isMine || isOverdue || isBriefMissing || isScheduleMissing}
                          className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 disabled:cursor-not-allowed"
                          title={
                            !isMine
                              ? "非当前分派给您处理的单据"
                              : isOverdue
                              ? "逾期单据不可批量推进，请逐单处理"
                              : isBriefMissing
                              ? "Brief 缺失，不可批量推进，请逐单补正或退回"
                              : isScheduleMissing
                              ? "排期缺失，不可批量推进，请逐单补正或退回"
                              : undefined
                          }
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
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        BRIEF_STATUS_COLORS[req.brief_status as keyof typeof BRIEF_STATUS_COLORS] || "bg-gray-100 text-gray-600"
                      }`}>
                        {BRIEF_STATUS_LABELS[req.brief_status as keyof typeof BRIEF_STATUS_LABELS] || req.brief_status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        SCHEDULE_STATUS_COLORS[req.schedule_status as keyof typeof SCHEDULE_STATUS_COLORS] || "bg-gray-100 text-gray-600"
                      }`}>
                        {SCHEDULE_STATUS_LABELS[req.schedule_status as keyof typeof SCHEDULE_STATUS_LABELS] || req.schedule_status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm">
                      {isMine ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                          </svg>
                          我（{ROLE_LABELS[role]}）
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                          待查看（ID: {req.current_handler_id}）
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">v{req.version}</td>
                    <td className="px-6 py-4"><DeadlineWarning deadline={req.deadline} showLabel={false} /></td>
                    <td className="px-6 py-4 text-xs">
                      {isBlocked ? (
                        <div className="space-y-0.5">
                          {blockReasons.map((r, i) => (
                            <span key={i} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-red-50 text-red-600">
                              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                              </svg>
                              {r}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-green-600">可操作</span>
                      )}
                    </td>
                  </tr>
                  );
                })}
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
