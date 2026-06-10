import { useState, useEffect } from "react";
import { useNavigate } from "@remix-run/react";
import { Clock, AlertTriangle, CheckCircle } from "lucide-react";
import { api } from "../utils/api";
import type { InspectionListItem, ExpiryQueueResponse } from "../utils/types";
import StatusBadge from "../components/StatusBadge";
import ExpiryIndicator from "../components/ExpiryIndicator";

function getCountdown(deadline: string): string {
  const now = new Date();
  const dl = new Date(deadline);
  const diffMs = dl.getTime() - now.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

  if (diffMs < 0) {
    const overDays = Math.abs(diffDays);
    return `逾期 ${overDays} 天`;
  }
  if (diffDays === 0) {
    return `剩余 ${diffHours} 小时`;
  }
  return `剩余 ${diffDays} 天 ${diffHours} 小时`;
}

function InspectionCard({ item, variant }: { item: InspectionListItem; variant: "normal" | "approaching" | "overdue" }) {
  const navigate = useNavigate();
  const bgColors = {
    normal: "bg-emerald-50 border-emerald-200",
    approaching: "bg-amber-50 border-amber-200",
    overdue: "bg-red-50 border-red-200",
  };

  return (
    <div
      onClick={() => navigate(`/inspection/${item.id}`)}
      className={`border rounded-lg p-4 cursor-pointer hover:shadow-sm transition-shadow ${bgColors[variant]}`}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-gray-800">{item.title}</span>
        <StatusBadge status={item.status} />
      </div>
      <div className="flex items-center justify-between text-sm">
        <span className="text-gray-500">{item.creator_id}</span>
        <span className={`font-medium ${
          variant === "overdue" ? "text-coral-red" : variant === "approaching" ? "text-amber-accent" : "text-emerald-accent"
        }`}>
          {getCountdown(item.deadline)}
        </span>
      </div>
    </div>
  );
}

export default function ExpiryQueuePage() {
  const [data, setData] = useState<ExpiryQueueResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const result = await api.get<ExpiryQueueResponse>("/expiry-queue");
      setData(result);
    } catch {
      setData({ normal: [], approaching: [], overdue: [] });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-400">加载中...</div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-gray-800">到期预警队列</h2>

      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <CheckCircle size={18} className="text-emerald-accent" />
          <h3 className="text-sm font-semibold text-emerald-700">
            正常 ({data.normal.length})
          </h3>
        </div>
        {data.normal.length === 0 ? (
          <p className="text-sm text-gray-400">暂无数据</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {data.normal.map((item) => (
              <InspectionCard key={item.id} item={item} variant="normal" />
            ))}
          </div>
        )}
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <Clock size={18} className="text-amber-accent" />
          <h3 className="text-sm font-semibold text-amber-700">
            临期 ({data.approaching.length})
          </h3>
        </div>
        {data.approaching.length === 0 ? (
          <p className="text-sm text-gray-400">暂无数据</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {data.approaching.map((item) => (
              <InspectionCard key={item.id} item={item} variant="approaching" />
            ))}
          </div>
        )}
      </div>

      <div className="bg-red-50 border border-red-200 rounded-xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <AlertTriangle size={18} className="text-coral-red" />
          <h3 className="text-sm font-semibold text-red-700">
            逾期 ({data.overdue.length})
          </h3>
        </div>
        {data.overdue.length === 0 ? (
          <p className="text-sm text-gray-400">暂无数据</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {data.overdue.map((item) => (
              <InspectionCard key={item.id} item={item} variant="overdue" />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
