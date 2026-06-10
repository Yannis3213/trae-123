import { useState } from "react";
import { api } from "../utils/api";
import type { ChargingPileInspection, FaultReport, InspectionCreate } from "../utils/types";

interface InspectionFormProps {
  chargingPileInspections: ChargingPileInspection[];
  faultReports: FaultReport[];
  onSubmit: (data: InspectionCreate) => void;
  isSubmitting?: boolean;
}

export default function InspectionForm({
  chargingPileInspections,
  faultReports,
  onSubmit,
  isSubmitting = false,
}: InspectionFormProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [deadline, setDeadline] = useState("");
  const [selectedCPI, setSelectedCPI] = useState<string[]>([]);
  const [selectedFR, setSelectedFR] = useState<string[]>([]);

  const toggleCPI = (id: string) => {
    setSelectedCPI((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const toggleFR = (id: string) => {
    setSelectedFR((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      title,
      description: description || null,
      deadline: deadline + "T23:59:59",
      charging_pile_inspection_ids: selectedCPI,
      fault_report_ids: selectedFR,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          标题 <span className="text-coral-red">*</span>
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-accent"
          placeholder="请输入巡检单标题"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          描述
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-accent"
          placeholder="请输入巡检单描述"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          截止日期 <span className="text-coral-red">*</span>
        </label>
        <input
          type="date"
          value={deadline}
          onChange={(e) => setDeadline(e.target.value)}
          required
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-accent"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          关联充电桩巡检
        </label>
        {chargingPileInspections.length === 0 ? (
          <p className="text-sm text-gray-400">暂无可关联的充电桩巡检</p>
        ) : (
          <div className="max-h-40 overflow-y-auto border border-gray-200 rounded-lg p-2 space-y-1">
            {chargingPileInspections.map((cpi) => (
              <label
                key={cpi.id}
                className="flex items-center gap-2 px-2 py-1.5 hover:bg-gray-50 rounded cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={selectedCPI.includes(cpi.id)}
                  onChange={() => toggleCPI(cpi.id)}
                  className="rounded border-gray-300 text-emerald-accent focus:ring-emerald-accent"
                />
                <span className="text-sm text-gray-700">
                  {cpi.pile_code} - {cpi.result || "无结果"}
                </span>
              </label>
            ))}
          </div>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          关联故障上报
        </label>
        {faultReports.length === 0 ? (
          <p className="text-sm text-gray-400">暂无可关联的故障上报</p>
        ) : (
          <div className="max-h-40 overflow-y-auto border border-gray-200 rounded-lg p-2 space-y-1">
            {faultReports.map((fr) => (
              <label
                key={fr.id}
                className="flex items-center gap-2 px-2 py-1.5 hover:bg-gray-50 rounded cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={selectedFR.includes(fr.id)}
                  onChange={() => toggleFR(fr.id)}
                  className="rounded border-gray-300 text-emerald-accent focus:ring-emerald-accent"
                />
                <span className="text-sm text-gray-700">
                  {fr.equipment_code} - {fr.description} ({fr.severity})
                </span>
              </label>
            ))}
          </div>
        )}
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        className="bg-emerald-accent text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {isSubmitting ? "提交中..." : "提交巡检单"}
      </button>
    </form>
  );
}
