import { useState, useEffect } from "react";
import { useNavigate } from "@remix-run/react";
import { ArrowLeft } from "lucide-react";
import { api } from "../utils/api";
import { useAuth } from "../root";
import type { ChargingPileInspection, FaultReport, InspectionCreate } from "../utils/types";
import InspectionForm from "../components/InspectionForm";

export default function InspectionNew() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [cpiList, setCpiList] = useState<ChargingPileInspection[]>([]);
  const [frList, setFrList] = useState<FaultReport[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [cpi, fr] = await Promise.all([
        api.get<ChargingPileInspection[]>("/charging-pile-inspections"),
        api.get<FaultReport[]>("/fault-reports"),
      ]);
      setCpiList(cpi.filter((c) => !c.inspection_id));
      setFrList(fr.filter((f) => !f.inspection_id));
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (data: InspectionCreate) => {
    setIsSubmitting(true);
    try {
      await api.post("/inspections", data);
      navigate("/");
    } catch (err) {
      alert("创建失败：" + (err instanceof Error ? err.message : "未知错误"));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (user?.role !== "duty_officer") {
    return (
      <div className="text-center py-12">
        <p className="text-gray-400">仅值班员可创建巡检单</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate("/")}
          className="text-gray-400 hover:text-gray-600"
        >
          <ArrowLeft size={20} />
        </button>
        <h2 className="text-lg font-semibold text-gray-800">
          新建巡检单
        </h2>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        {loading ? (
          <div className="text-center py-8 text-gray-400">加载关联数据...</div>
        ) : (
          <InspectionForm
            chargingPileInspections={cpiList}
            faultReports={frList}
            onSubmit={handleSubmit}
            isSubmitting={isSubmitting}
          />
        )}
      </div>
    </div>
  );
}
