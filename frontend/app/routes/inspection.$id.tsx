import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate, Link } from "@remix-run/react";
import {
  ArrowLeft,
  FileText,
  Upload,
  Download,
  MessageSquare,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Wrench,
  Clock,
  User,
  FileWarning,
  FilePlus,
} from "lucide-react";

import { api } from "../utils/api";
import { useAuth } from "../utils/auth";
import {
  InspectionDetail,
  STATUS_LABELS,
  ROLE_LABELS,
  EXCEPTION_TYPE_LABELS,
  Attachment,
  AuditRemark,
  CorrectionRecord,
  ExceptionReason,
  PreviousOpinion,
} from "../utils/types";
import StatusBadge from "../components/StatusBadge";
import ExpiryIndicator from "../components/ExpiryIndicator";

export default function InspectionDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [inspection, setInspection] = useState<InspectionDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const [processOpinion, setProcessOpinion] = useState("");
  const [reviewOpinion, setReviewOpinion] = useState("");
  const [reviewAction, setReviewAction] = useState<"approve" | "reject">("approve");
  const [returnReason, setReturnReason] = useState("");
  const [correctReason, setCorrectReason] = useState("");
  const [correctField, setCorrectField] = useState("description");
  const [correctValue, setCorrectValue] = useState("");

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (id) loadDetail();
  }, [id]);

  async function loadDetail() {
    try {
      setLoading(true);
      setError("");
      const data = await api.get<InspectionDetail>(`/inspections/${id}`);
      setInspection(data);
      if (correctField === "description") setCorrectValue(data.description || "");
    } catch (e: any) {
      setError(e?.message || "加载详情失败");
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit() {
    if (!inspection) return;
    try {
      setLoading(true);
      setError("");
      await api.put(`/inspections/${inspection.id}/submit`, {
        version: inspection.version,
      });
      setSuccessMsg("提交成功");
      loadDetail();
    } catch (e: any) {
      setError(e?.message || "提交失败");
    } finally {
      setLoading(false);
      setTimeout(() => setSuccessMsg(""), 2500);
    }
  }

  async function handleProcess() {
    if (!inspection) return;
    if (!processOpinion.trim()) {
      setError("处理意见不能为空");
      return;
    }
    try {
      setLoading(true);
      setError("");
      await api.put(`/inspections/${inspection.id}/process`, {
        opinion: processOpinion,
        version: inspection.version,
      });
      setSuccessMsg("处理成功");
      setProcessOpinion("");
      loadDetail();
    } catch (e: any) {
      setError(e?.message || "处理失败");
    } finally {
      setLoading(false);
      setTimeout(() => setSuccessMsg(""), 2500);
    }
  }

  async function handleReview() {
    if (!inspection) return;
    if (!reviewOpinion.trim()) {
      setError("复核意见不能为空");
      return;
    }
    try {
      setLoading(true);
      setError("");
      await api.put(`/inspections/${inspection.id}/review`, {
        opinion: reviewOpinion,
        action: reviewAction,
        version: inspection.version,
      });
      setSuccessMsg(reviewAction === "approve" ? "复核通过" : "已退回");
      setReviewOpinion("");
      loadDetail();
    } catch (e: any) {
      setError(e?.message || "复核失败");
    } finally {
      setLoading(false);
      setTimeout(() => setSuccessMsg(""), 2500);
    }
  }

  async function handleReturn() {
    if (!inspection) return;
    if (!returnReason.trim()) {
      setError("退回原因不能为空");
      return;
    }
    try {
      setLoading(true);
      setError("");
      await api.put(`/inspections/${inspection.id}/return`, {
        reason: returnReason,
        version: inspection.version,
      });
      setSuccessMsg("退回成功");
      setReturnReason("");
      loadDetail();
    } catch (e: any) {
      setError(e?.message || "退回失败");
    } finally {
      setLoading(false);
      setTimeout(() => setSuccessMsg(""), 2500);
    }
  }

  async function handleCorrect() {
    if (!inspection) return;
    if (!correctReason.trim()) {
      setError("补正原因不能为空");
      return;
    }
    try {
      setLoading(true);
      setError("");
      await api.put(`/inspections/${inspection.id}/correct`, {
        reason: correctReason,
        field: correctField,
        new_value: correctValue,
        version: inspection.version,
      });
      setSuccessMsg("补正成功");
      setCorrectReason("");
      loadDetail();
    } catch (e: any) {
      setError(e?.message || "补正失败");
    } finally {
      setLoading(false);
      setTimeout(() => setSuccessMsg(""), 2500);
    }
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    if (!inspection || !e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    try {
      setLoading(true);
      setError("");
      const formData = new FormData();
      formData.append("file", file);
      await api.postFile<Attachment>(
        `/inspections/${inspection.id}/attachments`,
        formData
      );
      loadDetail();
    } catch (e: any) {
      setError(e?.message || "上传失败");
    } finally {
      setLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  if (loading && !inspection) {
    return (
      <div className="flex items-center justify-center p-12 text-sm text-slate-500">
        加载中...
      </div>
    );
  }
  if (!inspection) {
    return (
      <div className="p-12 text-center text-sm text-slate-500">
        未找到巡检单 <Link to="/" className="text-emerald-600">返回列表</Link>
      </div>
    );
  }

  const isDuty = user?.role === "duty_officer";
  const isEngineer = user?.role === "maintenance_engineer";
  const isManager = user?.role === "operations_manager";
  const isCreator = inspection.creator_id === user?.id;

  const expiryStatus = (() => {
    const now = Date.now();
    const dl = new Date(inspection.deadline).getTime();
    const diffDays = (dl - now) / 86400000;
    if (diffDays < 0) return "overdue";
    if (diffDays <= 3) return "approaching";
    return "normal";
  })();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/")}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <h1 className="text-xl font-semibold text-slate-800">{inspection.title}</h1>
            <div className="mt-0.5 flex items-center gap-2 text-xs text-slate-500">
              <span className="font-mono">{inspection.id.slice(0, 12)}</span>
              <span>版本 v{inspection.version}</span>
              <StatusBadge status={inspection.status} />
              <ExpiryIndicator expiry={expiryStatus} />
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
          {error}
        </div>
      )}
      {successMsg && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-700">
          {successMsg}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2 space-y-6">
          <BasicInfoCard inspection={inspection} expiryStatus={expiryStatus} />
          <PreviousOpinionCard opinion={inspection.previous_opinion} />
          <AttachmentsCard
            attachments={inspection.attachments}
            onUpload={handleUpload}
            fileInputRef={fileInputRef}
            canUpload={isEngineer || isManager}
          />
          <CorrectionCard records={inspection.correction_records} />
          <ExceptionCard reasons={inspection.exception_reasons} />
          <ActionArea
            inspection={inspection}
            currentUserId={user?.id || ""}
            isDuty={isDuty}
            isEngineer={isEngineer}
            isManager={isManager}
            isCreator={isCreator}
            processOpinion={processOpinion}
            setProcessOpinion={setProcessOpinion}
            reviewOpinion={reviewOpinion}
            setReviewOpinion={setReviewOpinion}
            reviewAction={reviewAction}
            setReviewAction={setReviewAction}
            returnReason={returnReason}
            setReturnReason={setReturnReason}
            correctReason={correctReason}
            setCorrectReason={setCorrectReason}
            correctField={correctField}
            setCorrectField={setCorrectField}
            correctValue={correctValue}
            setCorrectValue={setCorrectValue}
            onSubmit={handleSubmit}
            onProcess={handleProcess}
            onReview={handleReview}
            onReturn={handleReturn}
            onCorrect={handleCorrect}
            loading={loading}
          />
        </div>
        <div className="space-y-6">
          <AuditTimelineCard remarks={inspection.audit_remarks} />
        </div>
      </div>
    </div>
  );
}

function BasicInfoCard({
  inspection,
  expiryStatus,
}: {
  inspection: InspectionDetail;
  expiryStatus: "normal" | "approaching" | "overdue";
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-700">
        <FileText className="h-4 w-4" />
        基本信息
      </h2>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
        <div>
          <dt className="text-xs text-slate-500">标题</dt>
          <dd className="mt-0.5 text-slate-800">{inspection.title}</dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">当前状态</dt>
          <dd className="mt-0.5">
            <StatusBadge status={inspection.status} />
          </dd>
        </div>
        <div className="col-span-2">
          <dt className="text-xs text-slate-500">描述</dt>
          <dd className="mt-0.5 whitespace-pre-wrap text-slate-800">
            {inspection.description || "—"}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">创建人</dt>
          <dd className="mt-0.5 text-slate-800">
            {inspection.creator_name || inspection.creator_id}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">处理人</dt>
          <dd className="mt-0.5 text-slate-800">
            {inspection.processor_name || inspection.processor_id || "—"}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">复核人</dt>
          <dd className="mt-0.5 text-slate-800">
            {inspection.reviewer_name || inspection.reviewer_id || "—"}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">截止日期 / 到期状态</dt>
          <dd className="mt-0.5 flex items-center gap-2 text-slate-800">
            <span>{inspection.deadline}</span>
            <ExpiryIndicator expiry={expiryStatus} />
          </dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">创建时间</dt>
          <dd className="mt-0.5 text-slate-800">{inspection.created_at}</dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">最后更新</dt>
          <dd className="mt-0.5 text-slate-800">{inspection.updated_at}</dd>
        </div>
        {inspection.charging_pile_inspections.length > 0 && (
          <div className="col-span-2">
            <dt className="text-xs text-slate-500">关联充电桩巡检</dt>
            <dd className="mt-1 space-y-1">
              {inspection.charging_pile_inspections.map((c) => (
                <div
                  key={c.id}
                  className="rounded-md bg-slate-50 px-2.5 py-1 text-xs text-slate-700"
                >
                  <Wrench className="mr-1 inline h-3 w-3 text-slate-400" />
                  {c.pile_code} — {c.inspection_items || "—"}
                  {c.result && (
                    <span className="ml-2 text-emerald-600">结果：{c.result}</span>
                  )}
                </div>
              ))}
            </dd>
          </div>
        )}
        {inspection.fault_reports.length > 0 && (
          <div className="col-span-2">
            <dt className="text-xs text-slate-500">关联故障上报</dt>
            <dd className="mt-1 space-y-1">
              {inspection.fault_reports.map((f) => (
                <div
                  key={f.id}
                  className="rounded-md bg-slate-50 px-2.5 py-1 text-xs text-slate-700"
                >
                  <AlertTriangle className="mr-1 inline h-3 w-3 text-amber-500" />
                  [{f.severity}] {f.equipment_code} — {f.description}
                </div>
              ))}
            </dd>
          </div>
        )}
      </dl>
    </div>
  );
}

function PreviousOpinionCard({ opinion }: { opinion: PreviousOpinion | null | undefined }) {
  if (!opinion) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700">
          <MessageSquare className="h-4 w-4" />
          上一处理人意见
        </h2>
        <p className="text-xs text-slate-400">暂无上一处理人意见</p>
      </div>
    );
  }
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-5 shadow-sm">
      <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-amber-800">
        <MessageSquare className="h-4 w-4" />
        上一处理人意见
      </h2>
      <div className="space-y-2 text-sm">
        <div className="flex items-center gap-2 text-xs text-amber-700">
          <User className="h-3.5 w-3.5" />
          <span>
            {opinion.operator_name || "—"}（
            {opinion.operator_role
              ? ROLE_LABELS[opinion.operator_role as keyof typeof ROLE_LABELS] || opinion.operator_role
              : "—"}
            ）
          </span>
          <Clock className="ml-2 h-3 w-3" />
          <span>{opinion.created_at}</span>
        </div>
        <p className="whitespace-pre-wrap rounded-md bg-white px-3 py-2 text-slate-800 ring-1 ring-amber-200">
          {opinion.opinion || "（无意见内容）"}
        </p>
        {opinion.attachments && opinion.attachments.length > 0 && (
          <div className="mt-2">
            <p className="mb-1 text-xs text-amber-700">附件证据：</p>
            <div className="flex flex-wrap gap-2">
              {opinion.attachments.map((a) => (
                <AttachmentChip key={a.id} att={a} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function AttachmentsCard({
  attachments,
  onUpload,
  fileInputRef,
  canUpload,
}: {
  attachments: Attachment[];
  onUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  canUpload: boolean;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-700">
          <FilePlus className="h-4 w-4" />
          附件证据
          <span className="text-xs font-normal text-slate-400">
            （共 {attachments.length} 个）
          </span>
        </h2>
        {canUpload && (
          <>
            <input
              ref={fileInputRef}
              type="file"
              onChange={onUpload}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700"
            >
              <Upload className="h-3.5 w-3.5" />
              上传附件
            </button>
          </>
        )}
      </div>
      {attachments.length === 0 ? (
        <p className="text-xs text-slate-400">暂无附件</p>
      ) : (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {attachments.map((a) => (
            <AttachmentChip key={a.id} att={a} />
          ))}
        </div>
      )}
    </div>
  );
}

function AttachmentChip({ att }: { att: Attachment }) {
  const url = `/${att.file_path}`;
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="flex items-center justify-between gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700 hover:bg-slate-100"
    >
      <span className="flex min-w-0 items-center gap-2">
        <FileText className="h-3.5 w-3.5 shrink-0 text-slate-400" />
        <span className="truncate">{att.file_name}</span>
      </span>
      <span className="flex items-center gap-2 shrink-0 text-slate-400">
        <span className="text-[10px]">{att.uploaded_by_name || att.uploaded_by}</span>
        <Download className="h-3 w-3" />
      </span>
    </a>
  );
}

function CorrectionCard({ records }: { records: CorrectionRecord[] }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700">
        <FileWarning className="h-4 w-4" />
        补正记录 / 退回意见
      </h2>
      {records.length === 0 ? (
        <p className="text-xs text-slate-400">暂无补正记录</p>
      ) : (
        <ol className="space-y-3">
          {records.map((r, i) => (
            <li
              key={r.id}
              className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm"
            >
              <div className="mb-1 flex items-center justify-between text-xs text-slate-500">
                <span>
                  #{i + 1} {r.corrector_name || r.corrector_id}
                </span>
                <span>{r.created_at}</span>
              </div>
              <div className="text-slate-800">
                <span className="font-medium text-slate-600">补正原因：</span>
                {r.reason}
              </div>
              <div className="mt-1 grid grid-cols-1 gap-1 text-xs sm:grid-cols-2">
                <div>
                  <span className="text-slate-500">字段：</span>
                  <code className="rounded bg-white px-1.5 py-0.5 text-slate-700 ring-1 ring-slate-200">
                    {r.field}
                  </code>
                </div>
                <div>
                  <span className="text-slate-500">原值：</span>
                  <span className="text-slate-700">{r.old_value || "（空）"}</span>
                </div>
                <div className="sm:col-span-2">
                  <span className="text-slate-500">新值：</span>
                  <span className="text-emerald-700">{r.new_value || "（空）"}</span>
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function ExceptionCard({ reasons }: { reasons: ExceptionReason[] }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700">
        <AlertTriangle className="h-4 w-4 text-amber-500" />
        异常原因
      </h2>
      {reasons.length === 0 ? (
        <p className="text-xs text-slate-400">暂无异常记录</p>
      ) : (
        <ol className="space-y-2">
          {reasons.map((r) => (
            <li
              key={r.id}
              className="flex items-start gap-2 rounded-md border border-red-100 bg-red-50 px-3 py-2 text-sm"
            >
              <span
                className={`mt-0.5 inline-block rounded-md px-1.5 py-0.5 text-[10px] font-medium ${
                  r.type === "material"
                    ? "bg-amber-100 text-amber-800"
                    : r.type === "permission"
                    ? "bg-violet-100 text-violet-800"
                    : r.type === "deadline"
                    ? "bg-red-100 text-red-800"
                    : "bg-slate-200 text-slate-800"
                }`}
              >
                {EXCEPTION_TYPE_LABELS[r.type] || r.type}
              </span>
              <div className="flex-1">
                <p className="text-slate-800">{r.description}</p>
                <p className="mt-0.5 text-[10px] text-slate-500">{r.created_at}</p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function ActionArea(props: {
  inspection: InspectionDetail;
  currentUserId: string;
  isDuty: boolean;
  isEngineer: boolean;
  isManager: boolean;
  isCreator: boolean;
  processOpinion: string;
  setProcessOpinion: (v: string) => void;
  reviewOpinion: string;
  setReviewOpinion: (v: string) => void;
  reviewAction: "approve" | "reject";
  setReviewAction: (v: "approve" | "reject") => void;
  returnReason: string;
  setReturnReason: (v: string) => void;
  correctReason: string;
  setCorrectReason: (v: string) => void;
  correctField: string;
  setCorrectField: (v: string) => void;
  correctValue: string;
  setCorrectValue: (v: string) => void;
  onSubmit: () => void;
  onProcess: () => void;
  onReview: () => void;
  onReturn: () => void;
  onCorrect: () => void;
  loading: boolean;
}) {
  const {
    inspection,
    currentUserId,
    isDuty,
    isEngineer,
    isManager,
    isCreator,
    processOpinion,
    setProcessOpinion,
    reviewOpinion,
    setReviewOpinion,
    reviewAction,
    setReviewAction,
    returnReason,
    setReturnReason,
    correctReason,
    setCorrectReason,
    correctField,
    setCorrectField,
    correctValue,
    setCorrectValue,
    onSubmit,
    onProcess,
    onReview,
    onReturn,
    onCorrect,
    loading,
  } = props;

  const showSubmit =
    isDuty && isCreator && ["pending_submit", "resubmitted"].includes(inspection.status);
  const showProcess =
    isEngineer &&
    (inspection.processor_id === null ||
      inspection.processor_id === currentUserId) &&
    inspection.status === "pending_process";
  const showReview =
    isManager &&
    (inspection.reviewer_id === null ||
      inspection.reviewer_id === currentUserId) &&
    inspection.status === "pending_review";
  const showReturn =
    isManager &&
    (inspection.reviewer_id === null ||
      inspection.reviewer_id === currentUserId) &&
    inspection.status === "pending_review";
  const showCorrect = isDuty && isCreator && inspection.status === "returned";

  if (!showSubmit && !showProcess && !showReview && !showReturn && !showCorrect) {
    return null;
  }

  return (
    <div className="rounded-lg border border-emerald-200 bg-emerald-50/40 p-5 shadow-sm">
      <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-emerald-800">
        <CheckCircle2 className="h-4 w-4" />
        当前角色可执行操作
      </h2>

      {showSubmit && (
        <div className="mb-4 rounded-md border border-emerald-200 bg-white p-4">
          <p className="mb-2 text-sm font-medium text-slate-700">
            {inspection.status === "resubmitted" ? "重新提交巡检单" : "提交巡检单"}
          </p>
          <p className="mb-3 text-xs text-slate-500">
            提交后将进入"待处理"队列，由运维工程师处理。
          </p>
          <button
            onClick={onSubmit}
            disabled={loading}
            className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            {inspection.status === "resubmitted" ? "重新提交" : "提交巡检单"}
          </button>
        </div>
      )}

      {showProcess && (
        <div className="mb-4 rounded-md border border-emerald-200 bg-white p-4">
          <p className="mb-2 text-sm font-medium text-slate-700">处理巡检单</p>
          <label className="mb-1 block text-xs text-slate-500">
            处理意见 <span className="text-red-500">*</span>
          </label>
          <textarea
            className="mb-3 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            rows={3}
            value={processOpinion}
            onChange={(e) => setProcessOpinion(e.target.value)}
            placeholder="请填写处理意见（必填），附件可在上方附件区上传"
          />
          <button
            onClick={onProcess}
            disabled={loading || !processOpinion.trim()}
            className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            提交处理结果
          </button>
        </div>
      )}

      {showReview && (
        <div className="mb-4 rounded-md border border-emerald-200 bg-white p-4">
          <p className="mb-2 text-sm font-medium text-slate-700">复核巡检单</p>
          <div className="mb-3 flex gap-3">
            <label className="inline-flex items-center gap-1.5 text-sm">
              <input
                type="radio"
                checked={reviewAction === "approve"}
                onChange={() => setReviewAction("approve")}
                className="accent-emerald-600"
              />
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              通过
            </label>
            <label className="inline-flex items-center gap-1.5 text-sm">
              <input
                type="radio"
                checked={reviewAction === "reject"}
                onChange={() => setReviewAction("reject")}
                className="accent-emerald-600"
              />
              <XCircle className="h-4 w-4 text-red-500" />
              退回
            </label>
          </div>
          <label className="mb-1 block text-xs text-slate-500">
            复核意见 <span className="text-red-500">*</span>
          </label>
          <textarea
            className="mb-3 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            rows={3}
            value={reviewOpinion}
            onChange={(e) => setReviewOpinion(e.target.value)}
            placeholder="请填写复核意见"
          />
          <button
            onClick={onReview}
            disabled={loading || !reviewOpinion.trim()}
            className={`rounded-md px-4 py-2 text-sm font-medium text-white disabled:opacity-50 ${
              reviewAction === "approve"
                ? "bg-emerald-600 hover:bg-emerald-700"
                : "bg-red-500 hover:bg-red-600"
            }`}
          >
            {reviewAction === "approve" ? "复核通过" : "复核退回"}
          </button>
        </div>
      )}

      {showReturn && !showReview && (
        <div className="mb-4 rounded-md border border-red-200 bg-white p-4">
          <p className="mb-2 text-sm font-medium text-slate-700">退回巡检单</p>
          <label className="mb-1 block text-xs text-slate-500">
            退回原因 <span className="text-red-500">*</span>
          </label>
          <textarea
            className="mb-3 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
            rows={3}
            value={returnReason}
            onChange={(e) => setReturnReason(e.target.value)}
            placeholder="请填写退回原因（必填）"
          />
          <button
            onClick={onReturn}
            disabled={loading || !returnReason.trim()}
            className="rounded-md bg-red-500 px-4 py-2 text-sm font-medium text-white hover:bg-red-600 disabled:opacity-50"
          >
            退回
          </button>
        </div>
      )}

      {showCorrect && (
        <div className="rounded-md border border-amber-200 bg-white p-4">
          <p className="mb-2 text-sm font-medium text-slate-700">补正巡检单</p>
          <label className="mb-1 block text-xs text-slate-500">
            补正原因 <span className="text-red-500">*</span>
          </label>
          <input
            className="mb-3 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
            value={correctReason}
            onChange={(e) => setCorrectReason(e.target.value)}
            placeholder="请填写补正原因（例如：运营经理退回要求补充排查过程）"
          />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs text-slate-500">补正字段</label>
              <select
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                value={correctField}
                onChange={(e) => {
                  setCorrectField(e.target.value);
                  if (e.target.value === "description")
                    setCorrectValue(inspection.description || "");
                  else if (e.target.value === "title")
                    setCorrectValue(inspection.title);
                  else setCorrectValue("");
                }}
              >
                <option value="description">描述</option>
                <option value="title">标题</option>
                <option value="deadline">截止日期</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-500">新值</label>
              <input
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                value={correctValue}
                onChange={(e) => setCorrectValue(e.target.value)}
              />
            </div>
          </div>
          <button
            onClick={onCorrect}
            disabled={loading || !correctReason.trim()}
            className="mt-3 rounded-md bg-amber-500 px-4 py-2 text-sm font-medium text-white hover:bg-amber-600 disabled:opacity-50"
          >
            补正并重新提交
          </button>
        </div>
      )}
    </div>
  );
}

function AuditTimelineCard({ remarks }: { remarks: AuditRemark[] }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-700">
        <Clock className="h-4 w-4" />
        审计轨迹
      </h2>
      {remarks.length === 0 ? (
        <p className="text-xs text-slate-400">暂无审计记录</p>
      ) : (
        <ol className="relative space-y-5 border-l border-slate-200 pl-5">
          {remarks.map((r) => (
            <li key={r.id} className="relative">
              <span className="absolute -left-[26px] top-1 block h-3 w-3 rounded-full border-2 border-white bg-emerald-500 ring-1 ring-emerald-300"></span>
              <div className="text-xs text-slate-500">
                {r.created_at}
              </div>
              <div className="mt-0.5 flex items-center gap-1.5 text-sm font-medium text-slate-700">
                <User className="h-3.5 w-3.5 text-slate-400" />
                {r.operator_name || r.operator_id}
              </div>
              <div className="mt-0.5 flex items-center gap-1 text-xs">
                <span className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-600">
                  {STATUS_LABELS[r.from_status as keyof typeof STATUS_LABELS] ||
                    r.from_status}
                </span>
                <span className="text-slate-400">→</span>
                <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-emerald-700">
                  {STATUS_LABELS[r.to_status as keyof typeof STATUS_LABELS] || r.to_status}
                </span>
              </div>
              {r.remark && (
                <p className="mt-1 whitespace-pre-wrap rounded-md bg-slate-50 px-2.5 py-1.5 text-xs text-slate-700">
                  {r.remark}
                </p>
              )}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
