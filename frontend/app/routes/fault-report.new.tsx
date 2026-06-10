import { useState } from "react";
import { useNavigate } from "@remix-run/react";
import { ArrowLeft, AlertTriangle } from "lucide-react";
import { api } from "../utils/api";

export default function FaultReportNew() {
  const navigate = useNavigate();
  const [equipmentCode, setEquipmentCode] = useState("");
  const [description, setDescription] = useState("");
  const [severity, setSeverity] = useState("medium");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post("/fault-reports", {
        equipment_code: equipmentCode,
        description,
        severity,
      });
      navigate("/fault-report");
    } catch (err) {
      alert("创建失败：" + (err instanceof Error ? err.message : "未知错误"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate("/fault-report")}
          className="text-gray-400 hover:text-gray-600"
        >
          <ArrowLeft size={20} />
        </button>
        <h2 className="text-lg font-semibold text-gray-800">新建故障上报</h2>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 max-w-lg">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              设备编号 <span className="text-coral-red">*</span>
            </label>
            <input
              type="text"
              value={equipmentCode}
              onChange={(e) => setEquipmentCode(e.target.value)}
              required
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-accent"
              placeholder="例如：EQ-001"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              故障描述 <span className="text-coral-red">*</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              required
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-accent"
              placeholder="请详细描述故障情况"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              严重程度
            </label>
            <select
              value={severity}
              onChange={(e) => setSeverity(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-accent"
            >
              <option value="low">低</option>
              <option value="medium">中</option>
              <option value="high">高</option>
            </select>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="bg-emerald-accent text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-emerald-600 disabled:opacity-50 transition-colors"
          >
            <AlertTriangle size={16} className="inline mr-1" />
            {submitting ? "提交中..." : "上报故障"}
          </button>
        </form>
      </div>
    </div>
  );
}
