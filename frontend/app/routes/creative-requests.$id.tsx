import { useState, useEffect, useCallback } from "react";
import { Link, useOutletContext, useParams } from "@remix-run/react";
import {
  getRequest,
  reviewRequest,
  supplementRequest,
  submitRequest,
  addAuditNote,
  type CreativeRequestDetail,
  type ProcessingRecord,
  type AuditNote,
  type ExceptionReason,
  type Attachment,
} from "~/utils/api";
import {
  STATUS_LABELS,
  BRIEF_STATUS_LABELS,
  BRIEF_STATUS_COLORS,
  SCHEDULE_STATUS_LABELS,
  SCHEDULE_STATUS_COLORS,
  ROLE_LABELS,
  computeDeadlineLevel,
  canTransition,
  getActionLabel,
  USER_NUMERIC_ID,
} from "~/utils/status";
import type { UserRole, RequestStatus, BriefStatus, ScheduleStatus } from "~/utils/status";
import StatusBadge from "~/components/StatusBadge";
import DeadlineWarning from "~/components/DeadlineWarning";
import AuditTrail from "~/components/AuditTrail";
import AttachmentList from "~/components/AttachmentList";

interface OutletContext {
  userId: string;
  role: UserRole;
}

export default function RequestDetail() {
  const { id } = useParams<{ id: string }>();
  const { userId, role } = useOutletContext<OutletContext>();
  const numericUserId = USER_NUMERIC_ID[userId] ?? 0;

  const [request, setRequest] = useState<CreativeRequestDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [opinion, setOpinion] = useState("");
  const [noteContent, setNoteContent] = useState("");
  const [supplementBrief, setSupplementBrief] = useState<BriefStatus | "">("");
  const [supplementSchedule, setSupplementSchedule] = useState<ScheduleStatus | "">("");
  const [supplementDescription, setSupplementDescription] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  const refreshDetail = useCallback(() => {
    if (!id) return;
    setLoading(true);
    getRequest(Number(id))
      .then((req) => setRequest(req))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    refreshDetail();
  }, [refreshDetail]);

  const handleSubmit = async () => {
    if (!request) return;
    setActionLoading(true);
    try {
      const updated = await submitRequest(request.id, { version: request.version });
      setRequest(updated);
      refreshDetail();
    } catch (err) {
      alert("提交失败: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setActionLoading(false);
    }
  };

  const handleReview = async (action: string) => {
    if (!request) return;
    const needOpinion =
      action === "start_review" ||
      action === "approve" ||
      action === "return";
    if (needOpinion && !opinion.trim()) {
      alert("开始审核、通过、退回、归档操作均需填写处理意见");
      return;
    }
    setActionLoading(true);
    try {
      const updated = await reviewRequest(request.id, {
        action,
        opinion: opinion || "",
        version: request.version,
      });
      setRequest(updated);
      setOpinion("");
      refreshDetail();
    } catch (err) {
      alert("操作失败: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setActionLoading(false);
    }
  };

  const handleSupplement = async () => {
    if (!request) return;
    if (!supplementBrief && !supplementSchedule) {
      alert("请至少选择一项补正内容");
      return;
    }
    setActionLoading(true);
    try {
      const updated = await supplementRequest(request.id, {
        brief_status: supplementBrief || undefined,
        schedule_status: supplementSchedule || undefined,
        description: supplementDescription || undefined,
        version: request.version,
      });
      setRequest(updated);
      setSupplementBrief("");
      setSupplementSchedule("");
      setSupplementDescription("");
      refreshDetail();
    } catch (err) {
      alert("补正失败: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setActionLoading(false);
    }
  };

  const handleAddNote = async () => {
    if (!request || !noteContent.trim()) return;
    setActionLoading(true);
    try {
      await addAuditNote(request.id, { content: noteContent, note_type: "audit" });
      setNoteContent("");
      refreshDetail();
    } catch (err) {
      alert("添加备注失败: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-400">加载中...</div>
      </div>
    );
  }

  if (error || !request) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
        <p className="text-red-600">加载失败: {error || "未找到该需求单"}</p>
        <Link to="/creative-requests" className="mt-3 inline-block text-sm text-blue-500 underline">
          返回列表
        </Link>
      </div>
    );
  }

  const deadlineLevel = computeDeadlineLevel(request.deadline);
  const isCurrentHandler = request.current_handler_id === numericUserId;

  const canSubmit =
    canTransition(role, request.status as RequestStatus, "submitted") && isCurrentHandler;
  const canStartReview =
    canTransition(role, request.status as RequestStatus, "under_review") && isCurrentHandler;
  const canApprove =
    canTransition(role, request.status as RequestStatus, "reviewed") && isCurrentHandler;
  const canReturn =
    canTransition(role, request.status as RequestStatus, "returned") && isCurrentHandler;
  const canArchive =
    canTransition(role, request.status as RequestStatus, "archived") && isCurrentHandler;
  const canResubmit =
    canTransition(role, request.status as RequestStatus, "resubmitted") && isCurrentHandler;
  const canSupplement =
    role === "creative_registrar" &&
    request.status === "returned" &&
    (request.brief_status === "missing" || request.schedule_status === "missing") &&
    isCurrentHandler;

  const opinionRequiredForReview = canStartReview || canApprove || canArchive || canReturn;

  const previousOpinions = request.processing_records
    .filter((r) => r.opinion)
    .map((r) => ({
      handlerId: r.handler_id,
      handlerRole: r.handler_role,
      opinion: r.opinion,
      action: r.action,
      createdAt: r.created_at,
    }));

  const hasExceptions = request.exception_reasons && request.exception_reasons.length > 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            to="/creative-requests"
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900">{request.title}</h1>
              <StatusBadge status={request.status as RequestStatus} />
            </div>
            <p className="text-sm text-gray-500 mt-1">
              {request.request_number} · 版本 v{request.version}
            </p>
          </div>
        </div>
        <DeadlineWarning deadline={request.deadline} currentHandler={request.handler_name} />
      </div>

      {hasExceptions && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <div>
              <h3 className="text-sm font-semibold text-red-800">异常原因</h3>
              <div className="mt-1 space-y-1">
                {request.exception_reasons.map((ex) => (
                  <p key={ex.id} className="text-sm text-red-700">
                    {ex.description}
                    {ex.resolved && <span className="ml-2 text-green-600">(已解决)</span>}
                  </p>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {deadlineLevel === "overdue" && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
          <svg className="w-5 h-5 text-red-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
          </svg>
          <div>
            <span className="text-sm font-semibold text-red-800">此需求单已逾期</span>
            {request.handler_name && (
              <span className="text-sm text-red-700 ml-2">当前处理人: {request.handler_name}</span>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white shadow rounded-lg">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-medium text-gray-900">基本信息</h2>
            </div>
            <div className="px-6 py-4">
              <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
                <div>
                  <dt className="text-sm font-medium text-gray-500">单据编号</dt>
                  <dd className="mt-1 text-sm text-gray-900 font-mono">{request.request_number}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">客户名称</dt>
                  <dd className="mt-1 text-sm text-gray-900">{request.client_name}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">品牌</dt>
                  <dd className="mt-1 text-sm text-gray-900">{request.brand}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">活动名称</dt>
                  <dd className="mt-1 text-sm text-gray-900">{request.campaign_name}</dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-sm font-medium text-gray-500">需求描述</dt>
                  <dd className="mt-1 text-sm text-gray-900 whitespace-pre-wrap">{request.description}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">创建人</dt>
                  <dd className="mt-1 text-sm text-gray-900">{request.creator_name || request.created_by}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">当前处理人</dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    {request.handler_name || "-"}
                    {request.current_handler_role && (
                      <span className="ml-2 text-xs text-gray-400">
                        ({ROLE_LABELS[request.current_handler_role as UserRole]})
                      </span>
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">创建时间</dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    {new Date(request.created_at).toLocaleString("zh-CN")}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">更新时间</dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    {new Date(request.updated_at).toLocaleString("zh-CN")}
                  </dd>
                </div>
              </dl>
            </div>
          </div>

          <div className="bg-white shadow rounded-lg">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-lg font-medium text-gray-900">Brief接收状态</h2>
              <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${BRIEF_STATUS_COLORS[request.brief_status as BriefStatus] || "bg-gray-100 text-gray-600"}`}>
                {BRIEF_STATUS_LABELS[request.brief_status as BriefStatus] || request.brief_status}
              </span>
            </div>
            {request.brief_status === "missing" && (
              <div className="px-6 py-3 bg-red-50 border-b border-red-100">
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  <span className="text-sm text-red-700">Brief缺失，请补正后重新提交</span>
                </div>
              </div>
            )}
            <div className="px-6 py-4">
              {request.attachments.filter((a) => a.category === "brief").length > 0 ? (
                <div className="space-y-2">
                  {request.attachments.filter((a) => a.category === "brief").map((att) => (
                    <div key={att.id} className="flex items-center gap-2 text-sm">
                      <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                      </svg>
                      <span className="text-blue-600 hover:underline cursor-pointer">
                        {att.file_name}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-400">暂无Brief附件</p>
              )}
            </div>
          </div>

          <div className="bg-white shadow rounded-lg">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-lg font-medium text-gray-900">创意排期状态</h2>
              <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${SCHEDULE_STATUS_COLORS[request.schedule_status as ScheduleStatus] || "bg-gray-100 text-gray-600"}`}>
                {SCHEDULE_STATUS_LABELS[request.schedule_status as ScheduleStatus] || request.schedule_status}
              </span>
            </div>
            {request.schedule_status === "missing" && (
              <div className="px-6 py-3 bg-red-50 border-b border-red-100">
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  <span className="text-sm text-red-700">排期缺失，请补正后重新提交</span>
                </div>
              </div>
            )}
            <div className="px-6 py-4">
              {request.attachments.filter((a) => a.category === "schedule").length > 0 ? (
                <div className="space-y-2">
                  {request.attachments.filter((a) => a.category === "schedule").map((att) => (
                    <div key={att.id} className="flex items-center gap-2 text-sm">
                      <svg className="w-4 h-4 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <span className="text-blue-600 hover:underline cursor-pointer">
                        {att.file_name}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-400">暂无排期附件</p>
              )}
            </div>
          </div>

          <div className="bg-white shadow rounded-lg">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-medium text-gray-900">附件</h2>
            </div>
            <div className="px-6 py-4">
              <AttachmentList
                requestId={request.id}
                attachments={request.attachments}
                onRefresh={refreshDetail}
                readOnly={role !== "creative_registrar"}
              />
            </div>
          </div>

          {previousOpinions.length > 0 && (
            <div className="bg-white shadow rounded-lg">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-medium text-gray-900">历史处理意见</h2>
              </div>
              <div className="px-6 py-4 space-y-4">
                {previousOpinions.map((op, idx) => (
                  <div key={idx} className="bg-gray-50 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="font-medium text-sm text-gray-900">用户ID: {op.handlerId}</span>
                      <span className="text-xs text-gray-400">
                        ({ROLE_LABELS[op.handlerRole as UserRole] || op.handlerRole})
                      </span>
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700">
                        {op.action}
                      </span>
                      <span className="text-xs text-gray-400 ml-auto">
                        {new Date(op.createdAt).toLocaleString("zh-CN")}
                      </span>
                    </div>
                    <p className="text-sm text-gray-700">{op.opinion}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="bg-white shadow rounded-lg">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-medium text-gray-900">处理记录</h2>
            </div>
            <div className="px-6 py-4">
              <AuditTrail
                records={request.processing_records}
                notes={request.audit_notes}
                exceptions={request.exception_reasons}
              />
            </div>
            <div className="px-6 py-4 border-t border-gray-200">
              <div className="flex gap-3">
                <input
                  type="text"
                  value={noteContent}
                  onChange={(e) => setNoteContent(e.target.value)}
                  placeholder="添加备注..."
                  className="flex-1 block rounded-md border-gray-300 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && noteContent.trim()) handleAddNote();
                  }}
                />
                <button
                  onClick={handleAddNote}
                  disabled={!noteContent.trim() || actionLoading}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  添加备注
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white shadow rounded-lg">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-medium text-gray-900">操作</h2>
            </div>
            <div className="px-6 py-4 space-y-4">
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="text-xs text-gray-500 mb-1">当前状态</div>
                <StatusBadge status={request.status as RequestStatus} />
              </div>

              {(canSubmit || canStartReview || canApprove || canReturn || canArchive || canResubmit) && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    审核意见
                    {opinionRequiredForReview && <span className="text-red-500 ml-1">*</span>}
                    <span className="ml-2 text-xs text-gray-400">
                      （开始审核/通过/退回/归档必填）
                    </span>
                  </label>
                  <textarea
                    value={opinion}
                    onChange={(e) => setOpinion(e.target.value)}
                    rows={3}
                    placeholder="请输入处理意见..."
                    className="block w-full rounded-md border-gray-300 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
              )}

              <div className="space-y-2">
                {canSubmit && (
                  <button
                    onClick={handleSubmit}
                    disabled={actionLoading}
                    className="w-full inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                    {getActionLabel(request.status as RequestStatus, "submitted")}
                  </button>
                )}

                {canStartReview && (
                  <button
                    onClick={() => handleReview("start_review")}
                    disabled={actionLoading || !opinion.trim()}
                    className="w-full inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-purple-600 hover:bg-purple-700 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500"
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                    {getActionLabel(request.status as RequestStatus, "under_review")}
                  </button>
                )}

                {canApprove && (
                  <button
                    onClick={() => handleReview("approve")}
                    disabled={actionLoading || !opinion.trim()}
                    className="w-full inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    {getActionLabel(request.status as RequestStatus, "reviewed")}
                  </button>
                )}

                {canArchive && (
                  <button
                    onClick={() => handleReview("approve")}
                    disabled={actionLoading || !opinion.trim()}
                    className="w-full inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-gray-600 hover:bg-gray-700 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                    </svg>
                    {getActionLabel(request.status as RequestStatus, "archived")}
                  </button>
                )}

                {canReturn && (
                  <button
                    onClick={() => handleReview("return")}
                    disabled={actionLoading || !opinion.trim()}
                    className="w-full inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                    </svg>
                    {getActionLabel(request.status as RequestStatus, "returned")}
                  </button>
                )}

                {canResubmit && (
                  <button
                    onClick={handleSubmit}
                    disabled={actionLoading}
                    className="w-full inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    重新提交
                  </button>
                )}
              </div>

              {canSupplement && (
                <div className="border-t border-gray-200 pt-4 space-y-3">
                  <h3 className="text-sm font-medium text-gray-700">补正操作</h3>
                  {request.brief_status === "missing" && (
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Brief状态补正</label>
                      <select
                        value={supplementBrief}
                        onChange={(e) => setSupplementBrief(e.target.value as BriefStatus)}
                        className="block w-full rounded-md border-gray-300 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500"
                      >
                        <option value="">请选择</option>
                        <option value="received">已接收</option>
                        <option value="pending">待处理</option>
                      </select>
                    </div>
                  )}
                  {request.schedule_status === "missing" && (
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">排期状态补正</label>
                      <select
                        value={supplementSchedule}
                        onChange={(e) => setSupplementSchedule(e.target.value as ScheduleStatus)}
                        className="block w-full rounded-md border-gray-300 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500"
                      >
                        <option value="">请选择</option>
                        <option value="scheduled">已排期</option>
                        <option value="pending">待处理</option>
                      </select>
                    </div>
                  )}
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">补充说明</label>
                    <textarea
                      value={supplementDescription}
                      onChange={(e) => setSupplementDescription(e.target.value)}
                      rows={2}
                      placeholder="请输入补充说明..."
                      className="block w-full rounded-md border-gray-300 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    />
                  </div>
                  <button
                    onClick={handleSupplement}
                    disabled={actionLoading || (!supplementBrief && !supplementSchedule)}
                    className="w-full inline-flex items-center justify-center px-4 py-2 border border-orange-300 text-sm font-medium rounded-md shadow-sm text-orange-700 bg-orange-50 hover:bg-orange-100 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500"
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                    补正
                  </button>
                </div>
              )}

              {!canSubmit && !canStartReview && !canApprove && !canReturn && !canArchive && !canResubmit && !canSupplement && (
                <div className="text-center py-4 text-sm text-gray-400">
                  当前角色在此状态下无可用操作
                </div>
              )}
            </div>
          </div>

          <div className="bg-white shadow rounded-lg">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-medium text-gray-900">版本信息</h2>
            </div>
            <div className="px-6 py-4">
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500">当前版本:</span>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                  v{request.version}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
