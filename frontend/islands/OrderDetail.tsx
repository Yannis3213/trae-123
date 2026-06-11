import { useState, useEffect } from "preact/hooks";
import {
  api,
  LiveSelectionOrder,
  ProcessRecord,
  SelectionAttachment,
  AuditRemark,
} from "../utils/api.ts";
import {
  formatDate,
  showToast,
  getStatusLabel,
  getStatusColor,
  getUser,
  getRoleLabel,
} from "../utils/helpers.ts";

interface OrderDetailProps {
  id: number;
}

export default function OrderDetail({ id }: OrderDetailProps) {
  const [order, setOrder] = useState<LiveSelectionOrder | null>(null);
  const [attachments, setAttachments] = useState<SelectionAttachment[]>([]);
  const [processRecords, setProcessRecords] = useState<ProcessRecord[]>([]);
  const [auditTrail, setAuditTrail] = useState<AuditRemark[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(0);
  const [user, setUser] = useState<{ username: string; role: string; name: string } | null>(null);
  const [showActionModal, setShowActionModal] = useState(false);
  const [actionType, setActionType] = useState<string>("");
  const [opinion, setOpinion] = useState("");
  const [pass, setPass] = useState(true);
  const [showSupplementModal, setShowSupplementModal] = useState(false);
  const [supplementData, setSupplementData] = useState({
    submission_evidence: "",
    sample_evidence: "",
    registration_evidence: "",
  });

  useEffect(() => {
    const currentUser = getUser();
    setUser(currentUser);
    if (!currentUser) {
      window.location.href = "/login";
      return;
    }
    loadData();
  }, [id]);

  const loadData = async () => {
    setLoading(true);
    try {
      const detailData = await api.getOrder(id);
      setOrder(detailData.order);
      setAttachments(detailData.attachments || []);
      setProcessRecords(detailData.process_records || []);
      setAuditTrail(detailData.audit_remarks || []);
      setSupplementData({
        submission_evidence: detailData.order.submission_evidence || "",
        sample_evidence: detailData.order.sample_evidence || "",
        registration_evidence: detailData.order.registration_evidence || "",
      });
    } catch (error) {
      showToast(error instanceof Error ? error.message : "加载失败", "error");
    } finally {
      setLoading(false);
    }
  };

  const tabs = [
    { key: "submission", label: "选品提报", evidence: order?.submission_evidence, field: "submission_evidence" },
    { key: "sample", label: "样品确认", evidence: order?.sample_evidence, field: "sample_evidence" },
    { key: "registration", label: "直播选品单登记", evidence: order?.registration_evidence, field: "registration_evidence" },
  ];

  const canSubmit = user?.role === "registrar" && order?.status === "draft";
  const canAudit = user?.role === "auditor" && order?.status === "pending_audit";
  const canReview = user?.role === "reviewer" && order?.status === "audit_passed";
  const canSupplement = user?.role === "registrar" && order?.status === "returned";

  const openActionModal = (type: string, isPass: boolean = true) => {
    setActionType(type);
    setPass(isPass);
    setOpinion("");
    setShowActionModal(true);
  };

  const handleAction = async () => {
    if (!order) return;

    try {
      if (actionType === "submit") {
        await api.submitOrder(order.id, order.version);
        showToast("提交审核成功", "success");
      } else if (actionType === "audit") {
        await api.auditOrder(order.id, {
          pass,
          opinion,
          version: order.version,
        });
        showToast(pass ? "审核通过成功" : "退回补正成功", "success");
      } else if (actionType === "review") {
        await api.reviewOrder(order.id, opinion, order.version);
        showToast("复核归档成功", "success");
      }
      setShowActionModal(false);
      loadData();
    } catch (error) {
      showToast(error instanceof Error ? error.message : "操作失败", "error");
    }
  };

  const handleSupplement = async () => {
    if (!order) return;

    try {
      await api.supplementOrder(order.id, {
        ...supplementData,
        version: order.version,
      });
      showToast("补正提交成功", "success");
      setShowSupplementModal(false);
      loadData();
    } catch (error) {
      showToast(error instanceof Error ? error.message : "补正失败", "error");
    }
  };

  const getLastProcessRecord = () => {
    if (!processRecords || processRecords.length === 0) return null;
    const lastRecord = processRecords[processRecords.length - 1];
    return lastRecord;
  };

  const lastRemark = getLastProcessRecord();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex items-center gap-3 text-gray-500">
          <svg className="animate-spin h-6 w-6 text-primary-600" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          加载中...
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="text-center py-20 text-gray-500">
        选品单不存在
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <a href="/" className="text-gray-500 hover:text-gray-700">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </a>
          <h1 className="text-xl font-semibold text-gray-900">
            选品单详情
          </h1>
        </div>
        <div className="flex items-center gap-3">
          {canSubmit && (
            <button
              onClick={() => openActionModal("submit")}
              className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
            >
              提交审核
            </button>
          )}
          {canAudit && (
            <>
              <button
                onClick={() => openActionModal("audit", false)}
                className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
              >
                退回补正
              </button>
              <button
                onClick={() => openActionModal("audit", true)}
                className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
              >
                审核通过
              </button>
            </>
          )}
          {canReview && (
            <button
              onClick={() => openActionModal("review")}
              className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
            >
              复核归档
            </button>
          )}
          {canSupplement && (
            <button
              onClick={() => setShowSupplementModal(true)}
              className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
            >
              补正后重提交
            </button>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-start justify-between mb-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="text-lg font-semibold text-gray-900">{order.order_no}</span>
              <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(order.status)}`}>
                {getStatusLabel(order.status)}
              </span>
              {order.is_overdue && (
                <span className="px-2 py-1 text-xs font-medium bg-red-100 text-red-800 rounded-full">
                  已逾期
                </span>
              )}
            </div>
            <h2 className="text-2xl font-bold text-gray-900">{order.product_name}</h2>
          </div>
          <div className="text-right text-sm text-gray-500 space-y-1">
            <div>版本号: v{order.version}</div>
            <div>创建时间: {formatDate(order.created_at)}</div>
            <div>更新时间: {formatDate(order.updated_at)}</div>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-6">
          <InfoItem label="商品品类" value={order.product_category} />
          <InfoItem label="商品价格" value={`¥${order.price?.toFixed(2)}`} />
          <InfoItem label="库存数量" value={String(order.stock)} />
          <InfoItem label="截止时间" value={formatDate(order.deadline)} />
          <InfoItem label="当前处理人" value={order.current_handler || "-"} />
          <InfoItem label="当前角色" value={order.current_role ? getRoleLabel(order.current_role) : "-"} />
          <InfoItem label="创建人" value={order.created_by} />
          <InfoItem label="是否逾期" value={order.is_overdue ? "是" : "否"} valueClass={order.is_overdue ? "text-red-600" : ""} />
        </div>

        {order.exception_reason && (
          <div className="mt-4 p-4 bg-red-50 rounded-lg border border-red-200">
            <div className="text-sm font-medium text-red-800 mb-1">异常原因</div>
            <div className="text-sm text-red-600">{order.exception_reason}</div>
          </div>
        )}

        {order.overdue_reason && (
          <div className="mt-4 p-4 bg-orange-50 rounded-lg border border-orange-200">
            <div className="text-sm font-medium text-orange-800 mb-1">逾期原因</div>
            <div className="text-sm text-orange-600">{order.overdue_reason}</div>
          </div>
        )}
      </div>

      {lastRemark && lastRemark.opinion && (
        <div className="bg-yellow-50 rounded-xl border border-yellow-200 p-6">
          <div className="flex items-center gap-2 mb-3">
            <svg className="h-5 w-5 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
            <span className="font-medium text-yellow-800">上一处理人意见</span>
          </div>
          <div className="flex items-center justify-between text-sm text-yellow-700">
            <div className="flex items-center gap-2">
              <span className="font-medium">{lastRemark.operator}</span>
              <span className="text-yellow-500">({getRoleLabel(lastRemark.operator_role)})</span>
            </div>
            <span className="text-yellow-500">{formatDate(lastRemark.created_at)}</span>
          </div>
          <div className="mt-2 text-yellow-700 bg-yellow-100 bg-opacity-50 rounded-lg p-3">
            {lastRemark.opinion}
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="border-b border-gray-200">
          <nav className="flex -mb-px">
            {tabs.map((tab, index) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(index)}
                className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === index
                    ? "border-primary-500 text-primary-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                {tab.label}
                {!tab.evidence && (
                  <span className="ml-2 w-2 h-2 bg-red-500 rounded-full inline-block" />
                )}
              </button>
            ))}
          </nav>
        </div>
        <div className="p-6">
          <EvidenceSection
            label={tabs[activeTab].label}
            evidence={tabs[activeTab].evidence}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <svg className="h-5 w-5 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
            </svg>
            附件列表
          </h3>
          <div className="space-y-2">
            {attachments && attachments.length > 0 ? (
              attachments.map((att) => (
                <div
                  key={att.id}
                  className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <svg className="h-8 w-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900 truncate">{att.file_name}</div>
                    <div className="text-xs text-gray-500">{att.file_type}</div>
                  </div>
                  <a
                    href={att.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary-600 hover:text-primary-800 text-sm"
                  >
                    下载
                  </a>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-gray-400">
                <svg className="mx-auto h-12 w-12 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                </svg>
                暂无附件
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <svg className="h-5 w-5 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            审计轨迹
          </h3>
          <div className="relative">
            {auditTrail.length > 0 ? (
              <div className="space-y-4 max-h-80 overflow-y-auto">
                {auditTrail.map((item, index) => (
                  <div key={item.id} className="flex gap-4">
                    <div className="flex flex-col items-center">
                      <div className={`w-3 h-3 rounded-full ${
                        item.remark_type === "status_change" ? "bg-primary-500" :
                        item.remark_type === "exception" ? "bg-red-500" :
                        item.remark_type === "supplement" ? "bg-green-500" :
                        "bg-gray-400"
                      }`} />
                      {index < auditTrail.length - 1 && (
                        <div className="w-0.5 flex-1 bg-gray-200" />
                      )}
                    </div>
                    <div className="flex-1 pb-4">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium text-gray-900">
                          {item.remark_type === "status_change" ? "状态变更" :
                           item.remark_type === "exception" ? "异常拦截" :
                           item.remark_type === "supplement" ? "补正操作" :
                           item.remark_type}
                        </span>
                      </div>
                      <div className="text-xs text-gray-500 mb-1">
                        {item.operator} ({getRoleLabel(item.operator_role)}) · {formatDate(item.created_at)}
                      </div>
                      {item.content && (
                        <div className="text-sm text-gray-600 bg-gray-50 rounded p-2">
                          {item.content}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-400">
                <svg className="mx-auto h-12 w-12 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                暂无轨迹
              </div>
            )}
          </div>
        </div>
      </div>

      {showActionModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">
                {actionType === "submit" && "提交审核"}
                {actionType === "audit" && (pass ? "审核通过" : "退回补正")}
                {actionType === "review" && "复核归档"}
              </h3>
            </div>
            <div className="px-6 py-4 space-y-4">
              {actionType === "submit" && (
                <p className="text-sm text-gray-600">
                  确定要提交该选品单进入审核流程吗？
                </p>
              )}
              {actionType === "audit" && (
                <>
                  <p className="text-sm text-gray-600">
                    确定要{pass ? "审核通过" : "退回补正"}该选品单吗？
                  </p>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {pass ? "审核意见" : "退回原因"} <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      value={opinion}
                      onChange={(e) => setOpinion((e.target as HTMLTextAreaElement).value)}
                      rows={4}
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      placeholder={`请输入${pass ? "审核意见" : "退回原因"}`}
                    />
                  </div>
                </>
              )}
              {actionType === "review" && (
                <>
                  <p className="text-sm text-gray-600">
                    确定要对该选品单进行复核归档吗？归档后将同步至直播系统。
                  </p>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      复核意见 <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      value={opinion}
                      onChange={(e) => setOpinion((e.target as HTMLTextAreaElement).value)}
                      rows={4}
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      placeholder="请输入复核意见"
                    />
                  </div>
                </>
              )}
              <div className="flex justify-end gap-3 pt-2">
                <button
                  onClick={() => setShowActionModal(false)}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  取消
                </button>
                <button
                  onClick={handleAction}
                  disabled={(actionType === "audit" || actionType === "review") && !opinion}
                  className={`px-4 py-2 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed ${
                    actionType === "audit" && !pass
                      ? "bg-red-500 hover:bg-red-600"
                      : "bg-green-500 hover:bg-green-600"
                  }`}
                >
                  确认
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showSupplementModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white">
              <h3 className="text-lg font-semibold text-gray-900">补正后重提交</h3>
              <button
                onClick={() => setShowSupplementModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-gray-600">
                请补充完善以下证据材料，补正后将重新提交审核。
              </p>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  选品提报证据
                </label>
                <input
                  type="text"
                  value={supplementData.submission_evidence}
                  onChange={(e) => setSupplementData({ ...supplementData, submission_evidence: (e.target as HTMLInputElement).value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  placeholder="请输入提报证据链接或说明"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  样品确认证据
                </label>
                <input
                  type="text"
                  value={supplementData.sample_evidence}
                  onChange={(e) => setSupplementData({ ...supplementData, sample_evidence: (e.target as HTMLInputElement).value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  placeholder="请输入样品确认证据链接或说明"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  登记证据
                </label>
                <input
                  type="text"
                  value={supplementData.registration_evidence}
                  onChange={(e) => setSupplementData({ ...supplementData, registration_evidence: (e.target as HTMLInputElement).value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  placeholder="请输入登记证据链接或说明"
                />
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                <button
                  onClick={() => setShowSupplementModal(false)}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  取消
                </button>
                <button
                  onClick={handleSupplement}
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
                >
                  补正提交
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function InfoItem({ label, value, valueClass = "" }: { label: string; value: string; valueClass?: string }) {
  return (
    <div>
      <div className="text-sm text-gray-500 mb-1">{label}</div>
      <div className={`text-base font-medium text-gray-900 ${valueClass}`}>{value}</div>
    </div>
  );
}

function EvidenceSection({ label, evidence }: { label: string; evidence?: string }) {
  const hasEvidence = !!evidence;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h4 className="font-medium text-gray-900">{label} - 证据材料</h4>
          <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
            hasEvidence ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
          }`}>
            {hasEvidence ? "已提供" : "缺项"}
          </span>
        </div>
      </div>
      {hasEvidence ? (
        <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
          <div className="text-sm text-gray-700">{evidence}</div>
        </div>
      ) : (
        <div className="p-8 border-2 border-dashed border-gray-300 rounded-lg text-center">
          <svg className="mx-auto h-12 w-12 text-gray-300 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p className="text-gray-400 text-sm">暂未提供证据材料</p>
        </div>
      )}
    </div>
  );
}
