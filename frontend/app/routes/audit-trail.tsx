import { useState, useEffect } from "react";
import { Search } from "lucide-react";
import { api } from "../utils/api";
import type { ProcessingRecord, AuditRemark, CorrectionRecord, ExceptionReason } from "../utils/types";
import { STATUS_LABELS, ROLE_LABELS } from "../utils/types";

type AuditEntry = {
  id: string;
  time: string;
  inspectionId: string;
  fromStatus: string;
  toStatus: string;
  operator: string;
  role: string;
  remark: string;
  type: string;
};

export default function AuditTrailPage() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterId, setFilterId] = useState("");

  useEffect(() => {
    loadAuditTrail();
  }, []);

  const loadAuditTrail = async () => {
    try {
      const data = await api.get<{
        processing_records: ProcessingRecord[];
        audit_remarks: AuditRemark[];
        correction_records: CorrectionRecord[];
        exception_reasons: ExceptionReason[];
      }>("/inspections/global-audit-trail");

      const all: AuditEntry[] = [
        ...data.processing_records.map((r) => ({
          id: r.id,
          time: r.created_at,
          inspectionId: r.inspection_id,
          fromStatus: r.from_status,
          toStatus: r.to_status,
          operator: r.operator_id,
          role: r.operator_role,
          remark: r.opinion || "",
          type: "处理记录",
        })),
        ...data.audit_remarks.map((r) => ({
          id: `ar-${r.id}`,
          time: r.created_at,
          inspectionId: r.inspection_id,
          fromStatus: r.from_status,
          toStatus: r.to_status,
          operator: r.operator_id,
          role: "",
          remark: r.remark || "",
          type: "审计备注",
        })),
      ].sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());

      setEntries(all);
    } catch {
      setEntries([]);
    } finally {
      setLoading(false);
    }
  };

  const filtered = filterId
    ? entries.filter((e) => e.inspectionId.includes(filterId))
    : entries;

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-gray-800">审计轨迹</h2>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <div className="flex items-center gap-2">
          <Search size={16} className="text-gray-400" />
          <input
            type="text"
            value={filterId}
            onChange={(e) => setFilterId(e.target.value)}
            placeholder="按巡检单ID筛选..."
            className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-accent"
          />
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">时间</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">巡检单ID</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">类型</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">原状态</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">新状态</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">操作人</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">角色</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">备注</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {loading ? (
              <tr>
                <td colSpan={8} className="text-center py-8 text-gray-400 text-sm">
                  加载中...
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-center py-8 text-gray-400 text-sm">
                  暂无数据
                </td>
              </tr>
            ) : (
              filtered.map((entry) => (
                <tr key={entry.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {new Date(entry.time).toLocaleString("zh-CN")}
                  </td>
                  <td className="px-4 py-3 text-sm font-mono text-gray-500">
                    {entry.inspectionId.slice(0, 8)}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">{entry.type}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {STATUS_LABELS[entry.fromStatus as keyof typeof STATUS_LABELS] || entry.fromStatus}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {STATUS_LABELS[entry.toStatus as keyof typeof STATUS_LABELS] || entry.toStatus}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">{entry.operator}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {ROLE_LABELS[entry.role as keyof typeof ROLE_LABELS] || entry.role}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500 max-w-[200px] truncate">
                    {entry.remark || "-"}
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
