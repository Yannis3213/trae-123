import { useState, useEffect } from "react";
import { useNavigate } from "@remix-run/react";
import { Plus, AlertTriangle } from "lucide-react";
import { api } from "../utils/api";
import type { FaultReport } from "../utils/types";

export default function FaultReportList() {
  const [reports, setReports] = useState<FaultReport[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    loadReports();
  }, []);

  const loadReports = async () => {
    try {
      const data = await api.get<FaultReport[]>("/fault-reports");
      setReports(data);
    } catch {
      setReports([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-800">故障上报列表</h2>
        <a
          href="/fault-report/new"
          className="bg-emerald-accent text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-emerald-600 transition-colors inline-flex items-center gap-1"
        >
          <Plus size={16} />
          新建故障上报
        </a>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">ID</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">设备编号</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">描述</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">严重程度</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">关联巡检单</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">创建人</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">创建时间</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {loading ? (
              <tr>
                <td colSpan={7} className="text-center py-8 text-gray-400 text-sm">
                  加载中...
                </td>
              </tr>
            ) : reports.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-8 text-gray-400 text-sm">
                  暂无数据
                </td>
              </tr>
            ) : (
              reports.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-mono text-gray-500">
                    {item.id.slice(0, 8)}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700 font-medium">
                    <AlertTriangle size={14} className="inline mr-1 text-amber-accent" />
                    {item.equipment_code}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 max-w-[200px] truncate">
                    {item.description}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                      item.severity === "high" ? "bg-red-100 text-red-700"
                        : item.severity === "medium" ? "bg-yellow-100 text-yellow-700"
                        : "bg-green-100 text-green-700"
                    }`}>
                      {item.severity === "high" ? "高" : item.severity === "medium" ? "中" : "低"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {item.inspection_id ? item.inspection_id.slice(0, 8) : "-"}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {item.created_by}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {new Date(item.created_at).toLocaleString("zh-CN")}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
