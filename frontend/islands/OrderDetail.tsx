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
  hasEvidence,
} from "../utils/helpers.ts";

interface OrderDetailProps {
  id: number;
}

type ModuleType = "submission" | "sample" | "registration";

const MODULE_CONFIG: Record<ModuleType, {
  label: string;
  role: string;
  allowedStatuses: string[];
  nextStatus: string;
  evidenceField: keyof LiveSelectionOrder;
}> = {
  submission: {
    label: "选品提报",
    role: "registrar",
    allowedStatuses: ["draft", "returned"],
    nextStatus: "pending_audit",
    evidenceField: "submission_evidence",
  },
  sample: {
    label: "样品确认",
    role: "auditor",
    allowedStatuses: ["pending_audit"],
    nextStatus: "audit_passed",
    evidenceField: "sample_evidence",
  },
  registration: {
    label: "直播选品单登记",
    role: "reviewer",
    allowedStatuses: ["audit_passed"],
    nextStatus: "synced",
    evidenceField: "registration_evidence",
  },
};

export default function OrderDetail({ id }: OrderDetailProps) {
  const [order, setOrder] = useState<LiveSelectionOrder | null>(null);
  const [attachments, setAttachments] = useState<SelectionAttachment[]>([]);
  const [processRecords, setProcessRecords] = useState<ProcessRecord[]>([]);
  const [auditTrail, setAuditTrail] = useState<AuditRemark[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(0);
  const [user, setUser] = useState<{ username: string; role: string; name: string } | null>(null);
  const [prevVersion, setPrevVersion] = useState<number | null>(null);

  const [moduleStates, setModuleStates] = useState<Record<ModuleType, {
    evidence: string;
    opinion: string;
    audit_remark: string;
  }>>({
    submission: { evidence: "", opinion: "", audit_remark: "" },
    sample: { evidence: "", opinion: "", audit_remark: "" },
    registration: { evidence: "", opinion: "", audit_remark: "" },
  });

  const [processingModule, setProcessingModule] = useState<ModuleType | null>(null);
  const [showAttachmentModal, setShowAttachmentModal] = useState(false);
  const [attachmentModule, setAttachmentModule] = useState<ModuleType>("submission");
  const [attachmentForm, setAttachmentForm] = useState({
    file_name: "",
    file_type: "pdf",
    file_url: "",
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
      const newVersion = detailData.order.version;
      
      if (prevVersion !== null && prevVersion !== newVersion) {
        showToast(`数据已更新，当前版本 v${newVersion}`, "info");
      }
      
      setPrevVersion(newVersion);
      setOrder(detailData.order);
      setAttachments(detailData.attachments || []);
      setProcessRecords(detailData.process_records || []);
      setAuditTrail(detailData.audit_remarks || []);
      setModuleStates({
        submission: {
          evidence: hasEvidence(detailData.order.submission_evidence) 
            ? (detailData.order.submission_evidence || "") 
            : "",
          opinion: "",
          audit_remark: "",
        },
        sample: {
          evidence: hasEvidence(detailData.order.sample_evidence) 
            ? (detailData.order.sample_evidence || "") 
            : "",
          opinion: "",
          audit_remark: "",
        },
        registration: {
          evidence: hasEvidence(detailData.order.registration_evidence) 
            ? (detailData.order.registration_evidence || "") 
            : "",
          opinion: "",
          audit_remark: "",
        },
      });
    } catch (error) {
      showToast(error instanceof Error ? error.message : "加载失败", "error");
    } finally {
      setLoading(false);
    }
  };

  const tabs: { key: ModuleType; label: string }[] = [
    { key: "submission", label: "选品提报" },
    { key: "sample", label: "样品确认" },
    { key: "registration", label: "直播选品单登记" },
  ];

  const getModuleStatus = (moduleKey: ModuleType): "completed" | "available" | "missing" => {
    if (!order) return "missing";
    const config = MODULE_CONFIG[moduleKey];
    const evidence = order[config.evidenceField] as string;
    if (hasEvidence(evidence)) return "completed";
    if (user?.role === config.role && config.allowedStatuses.includes(order.status)) {
      return "available";
    }
    return "missing";
  };

  const getModuleStatusDot = (moduleKey: ModuleType) => {
    const status = getModuleStatus(moduleKey);
    if (status === "completed") return "bg-green-500";
    if (status === "available") return "bg-blue-500 animate-pulse";
    return "bg-red-500";
  };

  const getLastNonModuleProcessRecord = () => {
    if (!processRecords || processRecords.length === 0) return null;
    const filtered = processRecords.filter(r => !r.action.startsWith("process_"));
    if (filtered.length === 0) return null;
    return filtered[filtered.length - 1];
  };

  const handleModuleStateChange = (
    moduleKey: ModuleType,
    field: "evidence" | "opinion" | "audit_remark",
    value: string
  ) => {
    setModuleStates(prev => ({
      ...prev,
      [moduleKey]: { ...prev[moduleKey], [field]: value },
    }));
  };

  const handleProcess = async (moduleKey: ModuleType, submitNext: boolean) => {
    if (!order || !user) return;

    const state = moduleStates[moduleKey];
    if (submitNext) {
      if (!hasEvidence(state.evidence)) {
        showToast("请填写证据材料（空数组或空内容视为缺项）", "error");
        return;
      }
      if (!state.opinion.trim()) {
        showToast("请填写处理意见", "error");
        return;
      }
    }

    setProcessingModule(moduleKey);
    try {
      await api.processModule(order.id, {
        module_type: moduleKey,
        version: order.version,
        evidence: state.evidence,
        opinion: state.opinion,
        audit_remark: state.audit_remark || undefined,
        submit_next: submitNext,
      });
      showToast(
        submitNext ? "办理成功，已进入下一步" : "保存成功",
        "success"
      );
      loadData();
    } catch (error) {
      showToast(error instanceof Error ? error.message : "操作失败", "error");
    } finally {
      setProcessingModule(null);
    }
  };

  const openAttachmentModal = (moduleKey: ModuleType) => {
    setAttachmentModule(moduleKey);
    setAttachmentForm({ file_name: "", file_type: "pdf", file_url: "" });
    setShowAttachmentModal(true);
  };

  const handleUploadAttachment = async () => {
    if (!order) return;
    if (!attachmentForm.file_name.trim()) {
      showToast("请填写文件名", "error");
      return;
    }
    if (!attachmentForm.file_url.trim()) {
      showToast("请填写文件URL", "error");
      return;
    }

    try {
      const newAtt = await api.uploadAttachment(order.id, {
        file_name: attachmentForm.file_name,
        file_type: attachmentForm.file_type,
        file_url: attachmentForm.file_url,
        module_type: attachmentModule,
      });
      setAttachments(prev => [...prev, newAtt]);
      showToast("附件上传成功", "success");
      setShowAttachmentModal(false);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "上传失败", "error");
    }
  };

  const lastRemark = getLastNonModuleProcessRecord();

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
              <span className="text-yellow-500">·</span>
              <span className="text-yellow-600">{lastRemark.action}</span>
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
                className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
                  activeTab === index
                    ? "border-primary-500 text-primary-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                {tab.label}
                <span className={`w-2 h-2 rounded-full inline-block ${getModuleStatusDot(tab.key)}`} />
              </button>
            ))}
          </nav>
        </div>
        <div className="p-6">
          <ModuleProcessPanel
            moduleKey={tabs[activeTab].key}
            moduleLabel={tabs[activeTab].label}
            evidence={moduleStates[tabs[activeTab].key].evidence}
            opinion={moduleStates[tabs[activeTab].key].opinion}
            auditRemark={moduleStates[tabs[activeTab].key].audit_remark}
            attachments={attachments}
            order={order}
            user={user}
            processing={processingModule === tabs[activeTab].key}
            onStateChange={(field, value) => handleModuleStateChange(tabs[activeTab].key, field, value)}
            onProcess={(submitNext) => handleProcess(tabs[activeTab].key, submitNext)}
            onAddAttachment={() => openAttachmentModal(tabs[activeTab].key)}
          />
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
            <div className="space-y-4">
              {auditTrail.map((item, index) => (
                <div key={item.id} className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <div className={`w-3 h-3 rounded-full ${
                      item.remark_type === "status_change" ? "bg-primary-500" :
                      item.remark_type === "exception" ? "bg-red-500" :
                      item.remark_type === "supplement" ? "bg-green-500" :
                      item.remark_type?.startsWith("process_") ? "bg-blue-500" :
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
                         item.remark_type === "process_submission" ? "选品提报办理" :
                         item.remark_type === "process_sample" ? "样品确认办理" :
                         item.remark_type === "process_registration" ? "登记办理" :
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

      {showAttachmentModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">
                添加附件 - {MODULE_CONFIG[attachmentModule].label}
              </h3>
              <button
                onClick={() => setShowAttachmentModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="px-6 py-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  文件名 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={attachmentForm.file_name}
                  onChange={(e) => setAttachmentForm({ ...attachmentForm, file_name: (e.target as HTMLInputElement).value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  placeholder="请输入文件名"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  文件类型 <span className="text-red-500">*</span>
                </label>
                <select
                  value={attachmentForm.file_type}
                  onChange={(e) => setAttachmentForm({ ...attachmentForm, file_type: (e.target as HTMLSelectElement).value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                >
                  <option value="pdf">PDF</option>
                  <option value="jpg">JPG 图片</option>
                  <option value="png">PNG 图片</option>
                  <option value="doc">Word 文档</option>
                  <option value="xls">Excel 表格</option>
                  <option value="其他">其他</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  文件URL <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={attachmentForm.file_url}
                  onChange={(e) => setAttachmentForm({ ...attachmentForm, file_url: (e.target as HTMLInputElement).value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  placeholder="请输入文件访问URL（模拟上传）"
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  onClick={() => setShowAttachmentModal(false)}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  取消
                </button>
                <button
                  onClick={handleUploadAttachment}
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
                >
                  确认上传
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface ModuleProcessPanelProps {
  moduleKey: ModuleType;
  moduleLabel: string;
  evidence: string;
  opinion: string;
  auditRemark: string;
  attachments: SelectionAttachment[];
  order: LiveSelectionOrder;
  user: { username: string; role: string; name: string } | null;
  processing: boolean;
  onStateChange: (field: "evidence" | "opinion" | "audit_remark", value: string) => void;
  onProcess: (submitNext: boolean) => void;
  onAddAttachment: () => void;
}

function ModuleProcessPanel({
  moduleKey,
  moduleLabel,
  evidence,
  opinion,
  auditRemark,
  attachments,
  order,
  user,
  processing,
  onStateChange,
  onProcess,
  onAddAttachment,
}: ModuleProcessPanelProps) {
  const config = MODULE_CONFIG[moduleKey];
  const moduleAttachments = attachments.filter(a => a.module_type === moduleKey);
  const evidenceCompleted = hasEvidence(evidence);
  const roleMatch = !!user && user.role === config.role;
  const handlerMatch = !!user && order.current_handler === user.username;
  const statusMatch = config.allowedStatuses.includes(order.status);
  const canOperate = roleMatch && handlerMatch && statusMatch;

  const getCannotOperateReasons = () => {
    const reasons: string[] = [];
    if (!roleMatch) {
      reasons.push(`需要角色：${getRoleLabel(config.role)}`);
    }
    if (!handlerMatch) {
      reasons.push(`当前处理人：${order.current_handler || "-"}`);
    }
    if (!statusMatch) {
      reasons.push(`允许状态：${config.allowedStatuses.map(s => getStatusLabel(s)).join(" / ")}`);
    }
    return reasons;
  };

  const getStatusBadge = () => {
    if (evidenceCompleted) {
      return (
        <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-green-100 text-green-800">
          已完成
        </span>
      );
    }
    if (canOperate) {
      return (
        <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-blue-100 text-blue-800">
          待办理
        </span>
      );
    }
    return (
      <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-red-100 text-red-800">
        缺项
      </span>
    );
  };

  const fileTypeOptions = ["pdf", "jpg", "png", "doc", "xls", "其他"];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h4 className="font-medium text-gray-900 text-lg">{moduleLabel}</h4>
          {getStatusBadge()}
          <span className="text-sm text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
            📌 当前版本：v{order.version}
          </span>
        </div>
        {!canOperate && !evidenceCompleted && (
          <div className="text-xs text-gray-400 bg-gray-50 px-3 py-1 rounded">
            角色不匹配或状态不匹配，不可编辑
          </div>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          证据材料 {canOperate && <span className="text-red-500">*</span>}
        </label>
        <textarea
          value={evidence}
          onChange={(e) => onStateChange("evidence", (e.target as HTMLTextAreaElement).value)}
          rows={4}
          disabled={!canOperate}
          className={`w-full px-3 py-2 border rounded-lg ${
            canOperate
              ? "border-gray-300 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              : "border-gray-200 bg-gray-50 text-gray-500 cursor-not-allowed"
          }`}
          placeholder={canOperate ? "请输入证据材料说明或链接..." : "暂无证据材料"}
        />
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="block text-sm font-medium text-gray-700">
            附件列表
          </label>
          {canOperate && (
            <button
              onClick={onAddAttachment}
              className="text-sm text-primary-600 hover:text-primary-800 flex items-center gap-1"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              添加附件
            </button>
          )}
        </div>
        <div className="space-y-2">
          {moduleAttachments.length > 0 ? (
            moduleAttachments.map((att) => (
              <div
                key={att.id}
                className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg"
              >
                <svg className="h-8 w-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-900 truncate">{att.file_name}</div>
                  <div className="text-xs text-gray-500">
                    {fileTypeOptions.includes(att.file_type) ? att.file_type.toUpperCase() : att.file_type}
                    {" · "}上传人: {att.uploaded_by}
                    {" · "}{formatDate(att.uploaded_at)}
                  </div>
                </div>
                <a
                  href={att.file_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary-600 hover:text-primary-800 text-sm"
                >
                  查看
                </a>
              </div>
            ))
          ) : (
            <div className="text-center py-6 text-gray-400 border-2 border-dashed border-gray-200 rounded-lg">
              <svg className="mx-auto h-10 w-10 mb-2 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
              </svg>
              <p className="text-sm">暂无附件</p>
            </div>
          )}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          处理意见 {canOperate && <span className="text-red-500">*</span>}
        </label>
        <textarea
          value={opinion}
          onChange={(e) => onStateChange("opinion", (e.target as HTMLTextAreaElement).value)}
          rows={3}
          disabled={!canOperate}
          className={`w-full px-3 py-2 border rounded-lg ${
            canOperate
              ? "border-gray-300 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              : "border-gray-200 bg-gray-50 text-gray-500 cursor-not-allowed"
          }`}
          placeholder={canOperate ? "请输入处理意见..." : "暂无处理意见"}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          审计备注
          <span className="text-gray-400 font-normal ml-1">（可选）</span>
        </label>
        <textarea
          value={auditRemark}
          onChange={(e) => onStateChange("audit_remark", (e.target as HTMLTextAreaElement).value)}
          rows={2}
          disabled={!canOperate}
          className={`w-full px-3 py-2 border rounded-lg ${
            canOperate
              ? "border-gray-300 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              : "border-gray-200 bg-gray-50 text-gray-500 cursor-not-allowed"
          }`}
          placeholder={canOperate ? "请输入审计备注信息（可选）..." : "暂无审计备注"}
        />
      </div>

      {canOperate && (
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100">
          <button
            onClick={() => onProcess(false)}
            disabled={processing}
            className="px-5 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
            </svg>
            {processing ? "保存中..." : "仅保存"}
          </button>
          <button
            onClick={() => onProcess(true)}
            disabled={processing || !hasEvidence(evidence) || !opinion.trim()}
            className="px-5 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
            </svg>
            {processing ? "办理中..." : `办理并进入下一步（${getStatusLabel(config.nextStatus)}）`}
          </button>
        </div>
      )}

      {!canOperate && !evidenceCompleted && (
        <div className="mt-4 p-4 bg-red-50 rounded-lg border border-red-100">
          <div className="flex items-start gap-2 text-sm">
            <svg className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div>
              <div className="font-medium text-red-800 mb-1">不可操作原因</div>
              <ul className="space-y-0.5 list-disc list-inside text-red-700">
                {getCannotOperateReasons().map((reason, idx) => (
                  <li key={idx}>{reason}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {!canOperate && evidenceCompleted && (
        <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-100">
          <div className="flex items-start gap-2 text-sm text-gray-500">
            <svg className="h-5 w-5 text-gray-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <div className="font-medium text-gray-600 mb-1">办理说明</div>
              <ul className="space-y-0.5 list-disc list-inside">
                <li>所需角色：<span className="text-gray-700">{getRoleLabel(config.role)}</span></li>
                <li>允许状态：<span className="text-gray-700">{config.allowedStatuses.map(s => getStatusLabel(s)).join(" / ")}</span></li>
                <li>当前角色：<span className="text-gray-700">{user ? getRoleLabel(user.role) : "-"}</span></li>
                <li>当前状态：<span className="text-gray-700">{getStatusLabel(order.status)}</span></li>
              </ul>
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
