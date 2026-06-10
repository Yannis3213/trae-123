import { useState } from "react";
import { useNavigate } from "@remix-run/react";
import { ArrowLeft, Zap } from "lucide-react";
import { api } from "../utils/api";

export default function ChargingPileInspectionNew() {
  const navigate = useNavigate();
  const [pileCode, setPileCode] = useState("");
  const [inspectionItems, setInspectionItems] = useState("");
  const [result, setResult] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post("/charging-pile-inspections", {
        pile_code: pileCode,
        inspection_items: inspectionItems || null,
        result: result || null,
      });
      navigate("/charging-pile-inspection");
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
          onClick={() => navigate("/charging-pile-inspection")}
          className="text-gray-400 hover:text-gray-600"
        >
          <ArrowLeft size={20} />
        </button>
        <h2 className="text-lg font-semibold text-gray-800">新建充电桩巡检</h2>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 max-w-lg">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              充电桩编号 <span className="text-coral-red">*</span>
            </label>
            <input
              type="text"
              value={pileCode}
              onChange={(e) => setPileCode(e.target.value)}
              required
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-accent"
              placeholder="例如：CP-001"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              检查项目
            </label>
            <textarea
              value={inspectionItems}
              onChange={(e) => setInspectionItems(e.target.value)}
              rows={3}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-accent"
              placeholder="请输入检查项目内容"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              巡检结果
            </label>
            <select
              value={result}
              onChange={(e) => setResult(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-accent"
            >
              <option value="">请选择</option>
              <option value="pass">通过</option>
              <option value="fail">不通过</option>
            </select>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="bg-emerald-accent text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-emerald-600 disabled:opacity-50 transition-colors"
          >
            <Zap size={16} className="inline mr-1" />
            {submitting ? "提交中..." : "创建巡检"}
          </button>
        </form>
      </div>
    </div>
  );
}
