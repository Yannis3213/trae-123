import { useState, useEffect } from "react";
import { useParams, useNavigate } from "@remix-run/react";
import {
  ArrowLeft,
  Send,
  CheckCircle,
  XCircle,
  Upload,
  Save,
} from "lucide-react";
import { api } from "../utils/api";
import { useAuth } from "../root";
import type { Inspection, ProcessingRecord } from "../utils/types";
import { STATUS_LABELS, ROLE_LABELS } from "../utils/types";
import StatusBadge from "../components/StatusBadge";
import AuditTimeline from "../components/AuditTimeline";

export default function InspectionDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [inspection, setInspection] = useState<Inspection | null>(null);
  const [loading, setLoading] = useState(true);
  const [opinion, setOpinion] = useState("");
  const [correctionField, setCorrectionField] = useState("");
  const [correctionValue, setCorrectionValue] = useState("");
  const [correctionReason, setCorrectionReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (id) loadInspection();
  }, [id]);

  const loadInspection = async () => {
    try {
      const data = await api.get<Inspection>(`/inspections/${id}`);
      setInspection(data);
    } catch {
      alert("加载失败");
    } finally {
      setLoading(false);
    }
  };

  const refresh = () => {
    setLoading(true);
    loadInspection();
  };

  const handleSubmit = async () => {
    if (!inspection) return;
    setSubmitting(true);
    try {
      await api.put(`/inspections/${inspection.id}/submit`, {
        version: inspection.version,
      });
      refresh();
    } catch (err) {
      alert("提交失败：" + (err instanceof Error ? err.message : "未知错误"));
    } finally {
      setSubmitting(false);
    }
  };

  const handleProcess = async () => {
    if (!inspection) return;
    setSubmitting(true);
    try {
      await api.put(`/inspections/${inspection.id}/process`, {
        opinion,
        version: inspection.version,
      });
      setOpinion("");
      refresh();
    } catch (err) {
      alert("处理失败：" + (err instanceof Error ? err.message : "未知错误"));
    } finally {
      setSubmitting(false);
    }
  };

  const handleReview = async (action: "approve" | "reject") => {
    if (!inspection) return;
    setSubmitting(true);
    try {
      await api.put(`/inspections/${inspection.id}/review`, {
        opinion,
        action,
        version: inspection.version,
      });
      setOpinion("");
      refresh();
    } catch (err) {
      alert("审核失败：" + (err instanceof Error ? err.message : "未知错误"));
    } finally {
      setSubmitting(false);
    }
  };

  const handleCorrect = async () => {
    if (!inspection) return;
    setSubmitting(true);
    try {
      await api.put(`/inspections/${inspection.id}/correct`, {
        field: correctionField,
        new_value: correctionValue,
        reason: correctionReason,
        version: inspection.version,
      });
      setCorrectionField("");
      setCorrectionValue("");
      setCorrectionReason("");
      refresh();
    } catch (err) {
      alert("纠正失败：" + (err instanceof Error ? err.message : "未知错误"));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-400">加载中...</div>
      </div>
    );
  }

  if (!inspection) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-400">巡检单不存在</p>
        <button
          onClick={() => navigate("/")}
          className="mt-4 text-emerald-accent hover:underline text-sm"
        >
          返回列表
        </button>
      </div>
    );
  }

  const lastProcessorRecord = [...inspection.processing_records]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .find((r) => r.opinion);

  const canSubmit = user?.role === "duty_officer" && inspection.status === "pending_submit";
  const canProcess = user?.role === "maintenance_engineer" && inspection.status === "pending_process";
  const canReview = user?.role === "operations_manager" && inspection.status === "pending_review";
  const canCorrect = user?.role === "duty_officer" && inspection.status === "returned";
  const canResubmit = user?.role === "duty_officer" && inspection.status === "resubmitted";

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
          巡检单详情
        </h2>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-gray-800">
            {inspection.title}
          </h3>
          <StatusBadge status={inspection.status} />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
          <div>
            <span className="text-gray-400">ID：</span>
            <span className="text-gray-700 font-mono">{inspection.id}</span>
          </div>
          <div>
            <span className="text-gray-400">描述：</span>
            <span className="text-gray-700">{inspection.description || "-"}</span>
          </div>
          <div>
            <span className="text-gray-400">创建人：</span>
            <span className="text-gray-700">{inspection.creator_id}</span>
          </div>
          <div>
            <span className="text-gray-400">处理人：</span>
            <span className="text-gray-700">{inspection.processor_id || "-"}</span>
          </div>
          <div>
            <span className="text-gray-400">审核人：</span>
            <span className="text-gray-700">{inspection.reviewer_id || "-"}</span>
          </div>
          <div>
            <span className="text-gray-400">截止日期：</span>
            <span className="text-gray-700">{inspection.deadline}</span>
          </div>
          <div>
            <span className="text-gray-400">版本：</span>
            <span className="text-gray-700">v{inspection.version}</span>
          </div>
          <div>
            <span className="text-gray-400">创建时间：</span>
            <span className="text-gray-700">
              {new Date(inspection.created_at).toLocaleString("zh-CN")}
            </span>
          </div>
          <div>
            <span className="text-gray-400">更新时间：</span>
            <span className="text-gray-700">
              {new Date(inspection.updated_at).toLocaleString("zh-CN")}
            </span>
          </div>
        </div>
      </div>

      {inspection.charging_pile_inspections.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h4 className="text-sm font-semibold text-gray-700 mb-3">关联充电桩巡检</h4>
          <div className="space-y-2">
            {inspection.charging_pile_inspections.map((cpi) => (
              <div key={cpi.id} className="bg-gray-50 rounded-lg p-3 text-sm">
                <span className="font-medium text-gray-700">{cpi.pile_code}</span>
                <span className="text-gray-400 mx-2">|</span>
                <span className="text-gray-600">{cpi.inspection_items || "无检查项"}</span>
                <span className="text-gray-400 mx-2">|</span>
                <span className="text-gray-600">结果：{cpi.result || "无"}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {inspection.fault_reports.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h4 className="text-sm font-semibold text-gray-700 mb-3">关联故障上报</h4>
          <div className="space-y-2">
            {inspection.fault_reports.map((fr) => (
              <div key={fr.id} className="bg-gray-50 rounded-lg p-3 text-sm">
                <span className="font-medium text-gray-700">{fr.equipment_code}</span>
                <span className="text-gray-400 mx-2">|</span>
                <span className="text-gray-600">{fr.description}</span>
                <span className={`ml-2 px-2 py-0.5 rounded text-xs font-medium ${
                  fr.severity === "high" ? "bg-red-100 text-red-700"
                    : fr.severity === "medium" ? "bg-yellow-100 text-yellow-700"
                    : "bg-green-100 text-green-700"
                }`}>
                  {fr.severity === "high" ? "高" : fr.severity === "medium" ? "中" : "低"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {lastProcessorRecord && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h4 className="text-sm font-semibold text-gray-700 mb-3">上一处理人意见</h4>
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
              <span>{lastProcessorRecord.operator_id}</span>
              <span>({ROLE_LABELS[lastProcessorRecord.operator_role as keyof typeof ROLE_LABELS] || lastProcessorRecord.operator_role})</span>
              <span>{new Date(lastProcessorRecord.created_at).toLocaleString("zh-CN")}</span>
            </div>
            <p className="text-sm text-gray-700">
              {lastProcessorRecord.opinion || "无意见"}
            </p>
          </div>
        </div>
      )}

      {inspection.exception_reasons.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h4 className="text-sm font-semibold text-gray-700 mb-3">异常原因</h4>
          <div className="space-y-2">
            {inspection.exception_reasons.map((er) => (
              <div key={er.id} className="bg-red-50 rounded-lg p-3 text-sm">
                <span className="font-medium text-red-700">{er.type}</span>
                <span className="text-red-400 mx-2">|</span>
                <span className="text-red-600">{er.description}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {(canSubmit || canProcess || canReview || canCorrect || canResubmit) && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h4 className="text-sm font-semibold text-gray-700 mb-4">操作区域</h4>

          {canSubmit && (
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="bg-blue-500 text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-600 disabled:opacity-50 transition-colors"
            >
              <Send size={16} className="inline mr-1" />
              提交巡检单
            </button>
          )}

          {canResubmit && (
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="bg-orange-500 text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-orange-600 disabled:opacity-50 transition-colors"
            >
              <Send size={16} className="inline mr-1" />
              重新提交
            </button>
          )}

          {canProcess && (
            <div className="space-y-3">
              <textarea
                value={opinion}
                onChange={(e) => setOpinion(e.target.value)}
                rows={3}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-accent"
                placeholder="请输入处理意见"
              />
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-1 text-sm text-gray-500 cursor-pointer bg-gray-100 hover:bg-gray-200 px-3 py-2 rounded-lg transition-colors">
                  <Upload size={14} />
                  上传附件
                  <input type="file" className="hidden" />
                </label>
              </div>
              <button
                onClick={handleProcess}
                disabled={submitting || !opinion.trim()}
                className="bg-emerald-accent text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-emerald-600 disabled:opacity-50 transition-colors"
              >
                <CheckCircle size={16} className="inline mr-1" />
                处理完成
              </button>
            </div>
          )}

          {canReview && (
            <div className="space-y-3">
              <textarea
                value={opinion}
                onChange={(e) => setOpinion(e.target.value)}
                rows={3}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-accent"
                placeholder="请输入审核意见"
              />
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-1 text-sm text-gray-500 cursor-pointer bg-gray-100 hover:bg-gray-200 px-3 py-2 rounded-lg transition-colors">
                  <Upload size={14} />
                  上传附件
                  <input type="file" className="hidden" />
                </label>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => handleReview("approve")}
                  disabled={submitting}
                  className="bg-emerald-accent text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-emerald-600 disabled:opacity-50 transition-colors"
                >
                  <CheckCircle size={16} className="inline mr-1" />
                  批准
                </button>
                <button
                  onClick={() => handleReview("reject")}
                  disabled={submitting}
                  className="bg-coral-red text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-red-600 disabled:opacity-50 transition-colors"
                >
                  <XCircle size={16} className="inline mr-1" />
                  退回
                </button>
              </div>
            </div>
          )}

          {canCorrect && (
            <div className="space-y-3">
              <p className="text-sm text-amber-accent font-medium">
                该巡检单已被退回，请纠正后重新提交
              </p>
              <div>
                <label className="block text-sm text-gray-600 mb-1">纠正字段</label>
                <select
                  value={correctionField}
                  onChange={(e) => setCorrectionField(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                >
                  <option value="">选择字段</option>
                  <option value="title">标题</option>
                  <option value="description">描述</option>
                  <option value="deadline">截止日期</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">新值</label>
                <input
                  type="text"
                  value={correctionValue}
                  onChange={(e) => setCorrectionValue(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  placeholder="请输入新值"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">纠正原因</label>
                <input
                  type="text"
                  value={correctionReason}
                  onChange={(e) => setCorrectionReason(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  placeholder="请输入纠正原因"
                />
              </div>
              <button
                onClick={handleCorrect}
                disabled={submitting || !correctionField || !correctionValue || !correctionReason}
                className="bg-amber-accent text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-amber-500 disabled:opacity-50 transition-colors"
              >
                <Save size={16} className="inline mr-1" />
                提交纠正
              </button>
            </div>
          )}
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h4 className="text-sm font-semibold text-gray-700 mb-4">审计轨迹</h4>
        <AuditTimeline
          processingRecords={inspection.processing_records}
          auditRemarks={inspection.audit_remarks}
          correctionRecords={inspection.correction_records}
          exceptionReasons={inspection.exception_reasons}
        />
      </div>
    </div>
  );
}
