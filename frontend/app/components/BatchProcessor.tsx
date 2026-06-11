import { useState } from "react";
import { batchProcess, type BatchResult, type CreativeRequestListItem } from "~/utils/api";
import StatusBadge from "./StatusBadge";
import DeadlineWarning from "./DeadlineWarning";
import type { RequestStatus } from "~/utils/status";

interface BatchProcessorProps {
  requests: CreativeRequestListItem[];
  onComplete: (results: BatchResult) => void;
}

type BatchAction = "submit" | "approve" | "return" | "archive";

const ACTION_LABELS: Record<BatchAction, string> = {
  submit: "批量提交",
  approve: "批量通过",
  return: "批量退回",
  archive: "批量归档",
};

export default function BatchProcessor({ requests, onComplete }: BatchProcessorProps) {
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [action, setAction] = useState<BatchAction>("submit");
  const [opinion, setOpinion] = useState("");
  const [processing, setProcessing] = useState(false);

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
    if (!confirm(`确定要对 ${selected.size} 条需求单执行"${ACTION_LABELS[action]}"操作吗？`)) return;

    setProcessing(true);
    try {
      const selectedRequests = requests.filter((r) => selected.has(r.id));
      const items = selectedRequests.map((r) => ({
        id: r.id,
        version: r.version,
        action,
        opinion: opinion || "",
      }));
      const results = await batchProcess({ items });
      onComplete(results);
      setSelected(new Set());
      setOpinion("");
    } catch (err) {
      alert("批量处理失败: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium text-gray-700">
            批量操作
            {selected.size > 0 && (
              <span className="ml-2 text-blue-600">已选 {selected.size} 项</span>
            )}
          </h3>
          <div className="flex items-center gap-3">
            <select
              value={action}
              onChange={(e) => setAction(e.target.value as BatchAction)}
              className="block rounded-md border-gray-300 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500"
            >
              {Object.entries(ACTION_LABELS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
            {action === "return" && (
              <input
                type="text"
                value={opinion}
                onChange={(e) => setOpinion(e.target.value)}
                placeholder="退回意见（必填）"
                className="block rounded-md border-gray-300 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500 w-48"
              />
            )}
            <button
              onClick={handleProcess}
              disabled={processing || selected.size === 0}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              {processing ? "处理中..." : "执行"}
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left">
                  <input
                    type="checkbox"
                    checked={selected.size === requests.length && requests.length > 0}
                    onChange={toggleAll}
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">单据编号</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">标题</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">客户</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">状态</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">版本</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">到期预警</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {requests.map((req) => (
                <tr key={req.id} className={selected.has(req.id) ? "bg-blue-50" : "hover:bg-gray-50"}>
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selected.has(req.id)}
                      onChange={() => toggleSelect(req.id)}
                      className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900 font-mono">{req.request_number}</td>
                  <td className="px-4 py-3 text-sm text-gray-700">{req.title}</td>
                  <td className="px-4 py-3 text-sm text-gray-700">{req.client_name}</td>
                  <td className="px-4 py-3"><StatusBadge status={req.status as RequestStatus} size="sm" /></td>
                  <td className="px-4 py-3 text-sm text-gray-500">v{req.version}</td>
                  <td className="px-4 py-3"><DeadlineWarning deadline={req.deadline} showLabel={false} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
