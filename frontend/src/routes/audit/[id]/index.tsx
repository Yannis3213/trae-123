import { component$, useSignal, $, useVisibleTask$ } from "@builder.io/qwik";
import { type DocumentHead, useLocation } from "@builder.io/qwik-city";
import {
  api,
  type AuditOrder,
  type AuditLog,
  type NannyProfile,
  type QualificationReview,
  type OnDutyConfirmation,
} from "../../../utils/api";
import { loadAuthFromStorage, getAuth, ROLE_LABELS, type UserRole } from "../../../stores/auth";
import { STATUS_MAP, EXPIRY_MAP, getExpiryStatus, ACTION_LABELS } from "../../../utils/constants";

export default component$(() => {
  const loc = useLocation();
  const authData = useSignal(getAuth());
  const audit = useSignal<AuditOrder | null>(null);
  const logs = useSignal<AuditLog[]>([]);
  const loading = useSignal(true);
  const activeTab = useSignal(0);
  const actionLoading = useSignal(false);
  const toast = useSignal({ show: false, message: "", type: "" });

  const comment = useSignal("");
  const exceptionReason = useSignal("");

  const nannyProfile = useSignal<NannyProfile>({
    name: "",
    id_card: "",
    phone: "",
    service_type: "",
    work_experience: "",
  });

  const qualificationReview = useSignal<QualificationReview>({
    health_cert: "",
    health_cert_expiry: "",
    training_cert: "",
    training_cert_expiry: "",
    background_check: "",
    background_check_result: "",
  });

  const onDutyConfirmation = useSignal<OnDutyConfirmation>({
    on_duty_date: "",
    service_area: "",
    contract_no: "",
    confirmation_status: "",
  });

  const id = loc.params.id;

  const fetchAudit = $(async () => {
    loading.value = true;
    try {
      const data = await api.getAudit(id);
      audit.value = data;
      if (data.nanny_profile) nannyProfile.value = { ...data.nanny_profile };
      if (data.qualification_review) qualificationReview.value = { ...data.qualification_review };
      if (data.on_duty_confirmation) onDutyConfirmation.value = { ...data.on_duty_confirmation };
      logs.value = (data as any).audit_logs || [];
    } catch (e: any) {
      showToast(e.message || "获取详情失败", "error");
    } finally {
      loading.value = false;
    }
  });

  const showToast = $((message: string, type: string) => {
    toast.value = { show: true, message, type };
    setTimeout(() => {
      toast.value = { show: false, message: "", type: "" };
    }, 3000);
  });

  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(() => {
    loadAuthFromStorage();
    authData.value = getAuth();
    fetchAudit();
  });

  const handleAction = $(async (action: string) => {
    if (!audit.value) return;
    actionLoading.value = true;
    try {
      const res = await api.processAudit(id, {
        action: action as any,
        comment: comment.value,
        exception_reason: exceptionReason.value || null,
        nanny_profile: { ...nannyProfile.value },
        qualification_review: { ...qualificationReview.value },
        on_duty_confirmation: { ...onDutyConfirmation.value },
        version: audit.value.version,
      });
      if (res.success) {
        const actionLabel = ACTION_LABELS[action] || action;
        showToast(`${actionLabel}成功`, "success");
        comment.value = "";
        exceptionReason.value = "";
        await fetchAudit();
      } else {
        showToast(res.error_message || "操作失败", "error");
      }
    } catch (e: any) {
      showToast(e.message || "操作失败", "error");
    } finally {
      actionLoading.value = false;
    }
  });

  const handleWithdraw = $(async () => {
    if (!audit.value) return;
    actionLoading.value = true;
    try {
      const res = await api.withdrawAudit(id);
      if (res.success) {
        showToast("撤回成功", "success");
        await fetchAudit();
      } else {
        showToast(res.error_message || "撤回失败", "error");
      }
    } catch (e: any) {
      showToast(e.message || "撤回失败", "error");
    } finally {
      actionLoading.value = false;
    }
  });

  const canEdit = () => {
    if (!audit.value || !authData.value) return false;
    const status = audit.value.status;
    const role = authData.value.role as UserRole;
    if (role === "supervisor" && (status === "pending" || status === "correction_needed" || status === "processing")) return true;
    if (role === "manager" && status === "reviewing") return true;
    return false;
  };

  const getAvailableActions = () => {
    if (!audit.value || !authData.value) return [];
    const status = audit.value.status;
    const role = authData.value.role as UserRole;
    const actions: { action: string; label: string; variant: string }[] = [];
    if (role === "dispatcher" && status === "pending") {
      actions.push({ action: "withdraw", label: "撤回", variant: "outlined" });
    }
    if (role === "supervisor") {
      if (status === "pending" || status === "correction_needed") {
        actions.push({ action: "advance", label: "推进", variant: "primary" });
      }
      if (status === "pending" || status === "processing" || status === "correction_needed") {
        actions.push({ action: "return_correction", label: "退回补正", variant: "outlined" });
      }
    }
    if (role === "manager") {
      if (status === "reviewing") {
        actions.push({ action: "review_pass", label: "复核通过", variant: "primary" });
        actions.push({ action: "return_correction", label: "退回补正", variant: "outlined" });
        actions.push({ action: "complete", label: "办结", variant: "primary" });
      }
    }
    return actions;
  };

  const tabs = ["阿姨档案", "资质审核", "上岗确认"];

  const statusInfo = audit.value ? (STATUS_MAP[audit.value.status] || STATUS_MAP.pending) : STATUS_MAP.pending;
  const expiryStatus = audit.value ? getExpiryStatus(audit.value.expiry_date) : "normal";
  const expiryInfo = EXPIRY_MAP[expiryStatus];

  return (
    <div class="h-full flex flex-col">
      {toast.value.show && toast.value.message && (
        <div
          class={`fixed top-4 right-4 z-50 px-4 py-2 rounded-lg text-sm text-white shadow-lg ${
            toast.value.type === "error" ? "bg-status-red" : "bg-status-green"
          }`}
        >
          {toast.value.message}
        </div>
      )}

      <div class="bg-white border-b border-stone-200 px-6 py-3 flex items-center gap-3">
        <a href="/" class="text-stone-400 hover:text-stone-600 text-sm">← 返回列表</a>
        <span class="text-stone-300">|</span>
        <span class="font-bold text-stone-800 text-sm">{audit.value?.order_no || "加载中..."}</span>
        {audit.value && (
          <>
            <span class={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${statusInfo.bg} ${statusInfo.color}`}>
              {statusInfo.label}
            </span>
            <span class={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${expiryInfo.bg} ${expiryInfo.color}`}>
              {expiryInfo.label}
            </span>
          </>
        )}
      </div>

      <div class="flex-1 flex overflow-hidden">
        <div class="flex-1 overflow-auto p-6">
          {loading.value ? (
            <div class="animate-pulse space-y-4">
              <div class="h-6 bg-stone-200 rounded w-1/4" />
              <div class="h-4 bg-stone-200 rounded w-1/2" />
              <div class="h-4 bg-stone-200 rounded w-1/3" />
            </div>
          ) : !audit.value ? (
            <div class="text-center py-16 text-stone-400">未找到审核单</div>
          ) : (
            <>
              <div class="flex gap-1 mb-6">
                {tabs.map((tab, i) => (
                  <button
                    key={i}
                    onClick$={() => (activeTab.value = i)}
                    class={`px-4 py-2 rounded-t-lg text-sm font-medium transition-colors ${
                      activeTab.value === i
                        ? "bg-white text-primary border border-b-white border-stone-200"
                        : "bg-stone-100 text-stone-500 hover:text-stone-700"
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              {activeTab.value === 0 && (
                <div class="bg-white rounded-xl border border-stone-200 p-6">
                  <h3 class="font-bold text-stone-800 mb-4">阿姨档案</h3>
                  <div class="grid grid-cols-2 gap-4">
                    <div>
                      <label class="block text-xs text-stone-500 mb-1">姓名</label>
                      <input
                        type="text"
                        value={nannyProfile.value.name}
                        onInput$={(_, el) => (nannyProfile.value = { ...nannyProfile.value, name: el.value })}
                        disabled={!canEdit()}
                        class="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm disabled:bg-stone-50 disabled:text-stone-500 focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                    </div>
                    <div>
                      <label class="block text-xs text-stone-500 mb-1">身份证号</label>
                      <input
                        type="text"
                        value={nannyProfile.value.id_card}
                        onInput$={(_, el) => (nannyProfile.value = { ...nannyProfile.value, id_card: el.value })}
                        disabled={!canEdit()}
                        class="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm disabled:bg-stone-50 disabled:text-stone-500 focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                    </div>
                    <div>
                      <label class="block text-xs text-stone-500 mb-1">联系方式</label>
                      <input
                        type="text"
                        value={nannyProfile.value.phone}
                        onInput$={(_, el) => (nannyProfile.value = { ...nannyProfile.value, phone: el.value })}
                        disabled={!canEdit()}
                        class="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm disabled:bg-stone-50 disabled:text-stone-500 focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                    </div>
                    <div>
                      <label class="block text-xs text-stone-500 mb-1">服务类型</label>
                      <input
                        type="text"
                        value={nannyProfile.value.service_type}
                        onInput$={(_, el) => (nannyProfile.value = { ...nannyProfile.value, service_type: el.value })}
                        disabled={!canEdit()}
                        class="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm disabled:bg-stone-50 disabled:text-stone-500 focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                    </div>
                    <div class="col-span-2">
                      <label class="block text-xs text-stone-500 mb-1">工作经历</label>
                      <textarea
                        value={nannyProfile.value.work_experience}
                        onInput$={(_, el) => (nannyProfile.value = { ...nannyProfile.value, work_experience: el.value })}
                        disabled={!canEdit()}
                        rows={3}
                        class="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm disabled:bg-stone-50 disabled:text-stone-500 focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                    </div>
                  </div>
                </div>
              )}

              {activeTab.value === 1 && (
                <div class="bg-white rounded-xl border border-stone-200 p-6">
                  <h3 class="font-bold text-stone-800 mb-4">资质审核</h3>
                  <div class="grid grid-cols-2 gap-4">
                    <div>
                      <label class="block text-xs text-stone-500 mb-1">健康证编号</label>
                      <input
                        type="text"
                        value={qualificationReview.value.health_cert}
                        onInput$={(_, el) => (qualificationReview.value = { ...qualificationReview.value, health_cert: el.value })}
                        disabled={!canEdit()}
                        class="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm disabled:bg-stone-50 disabled:text-stone-500 focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                    </div>
                    <div>
                      <label class="block text-xs text-stone-500 mb-1">健康证到期日</label>
                      <input
                        type="date"
                        value={qualificationReview.value.health_cert_expiry}
                        onInput$={(_, el) => (qualificationReview.value = { ...qualificationReview.value, health_cert_expiry: el.value })}
                        disabled={!canEdit()}
                        class="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm disabled:bg-stone-50 disabled:text-stone-500 focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                    </div>
                    <div>
                      <label class="block text-xs text-stone-500 mb-1">培训证编号</label>
                      <input
                        type="text"
                        value={qualificationReview.value.training_cert}
                        onInput$={(_, el) => (qualificationReview.value = { ...qualificationReview.value, training_cert: el.value })}
                        disabled={!canEdit()}
                        class="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm disabled:bg-stone-50 disabled:text-stone-500 focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                    </div>
                    <div>
                      <label class="block text-xs text-stone-500 mb-1">培训证到期日</label>
                      <input
                        type="date"
                        value={qualificationReview.value.training_cert_expiry}
                        onInput$={(_, el) => (qualificationReview.value = { ...qualificationReview.value, training_cert_expiry: el.value })}
                        disabled={!canEdit()}
                        class="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm disabled:bg-stone-50 disabled:text-stone-500 focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                    </div>
                    <div>
                      <label class="block text-xs text-stone-500 mb-1">背景调查编号</label>
                      <input
                        type="text"
                        value={qualificationReview.value.background_check}
                        onInput$={(_, el) => (qualificationReview.value = { ...qualificationReview.value, background_check: el.value })}
                        disabled={!canEdit()}
                        class="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm disabled:bg-stone-50 disabled:text-stone-500 focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                    </div>
                    <div>
                      <label class="block text-xs text-stone-500 mb-1">背景调查结果</label>
                      <input
                        type="text"
                        value={qualificationReview.value.background_check_result}
                        onInput$={(_, el) => (qualificationReview.value = { ...qualificationReview.value, background_check_result: el.value })}
                        disabled={!canEdit()}
                        class="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm disabled:bg-stone-50 disabled:text-stone-500 focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                    </div>
                  </div>
                </div>
              )}

              {activeTab.value === 2 && (
                <div class="bg-white rounded-xl border border-stone-200 p-6">
                  <h3 class="font-bold text-stone-800 mb-4">上岗确认</h3>
                  <div class="grid grid-cols-2 gap-4">
                    <div>
                      <label class="block text-xs text-stone-500 mb-1">上岗日期</label>
                      <input
                        type="date"
                        value={onDutyConfirmation.value.on_duty_date}
                        onInput$={(_, el) => (onDutyConfirmation.value = { ...onDutyConfirmation.value, on_duty_date: el.value })}
                        disabled={!canEdit()}
                        class="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm disabled:bg-stone-50 disabled:text-stone-500 focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                    </div>
                    <div>
                      <label class="block text-xs text-stone-500 mb-1">服务区域</label>
                      <input
                        type="text"
                        value={onDutyConfirmation.value.service_area}
                        onInput$={(_, el) => (onDutyConfirmation.value = { ...onDutyConfirmation.value, service_area: el.value })}
                        disabled={!canEdit()}
                        class="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm disabled:bg-stone-50 disabled:text-stone-500 focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                    </div>
                    <div>
                      <label class="block text-xs text-stone-500 mb-1">合同编号</label>
                      <input
                        type="text"
                        value={onDutyConfirmation.value.contract_no}
                        onInput$={(_, el) => (onDutyConfirmation.value = { ...onDutyConfirmation.value, contract_no: el.value })}
                        disabled={!canEdit()}
                        class="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm disabled:bg-stone-50 disabled:text-stone-500 focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                    </div>
                    <div>
                      <label class="block text-xs text-stone-500 mb-1">确认状态</label>
                      <input
                        type="text"
                        value={onDutyConfirmation.value.confirmation_status}
                        onInput$={(_, el) => (onDutyConfirmation.value = { ...onDutyConfirmation.value, confirmation_status: el.value })}
                        disabled={!canEdit()}
                        class="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm disabled:bg-stone-50 disabled:text-stone-500 focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <div class="w-80 border-l border-stone-200 bg-white overflow-auto p-6 flex flex-col gap-6">
          {audit.value && (
            <>
              <div>
                <h3 class="font-bold text-stone-800 mb-3">当前状态</h3>
                <div class="flex items-center gap-2 mb-2">
                  <span class={`inline-block px-2.5 py-1 rounded-full text-xs font-medium ${statusInfo.bg} ${statusInfo.color}`}>
                    {statusInfo.label}
                  </span>
                  <span class="text-xs text-stone-400">v{audit.value.version}</span>
                </div>
                <div class="text-xs text-stone-500 space-y-1">
                  <div>到期日：{audit.value.expiry_date}</div>
                  <div>创建人：{audit.value.creator_name}</div>
                  <div>处理人：{audit.value.current_handler_name || "无"}</div>
                </div>
              </div>

              <div>
                <h3 class="font-bold text-stone-800 mb-3">操作</h3>
                <div class="space-y-2">
                  <textarea
                    value={comment.value}
                    onInput$={(_, el) => (comment.value = el.value)}
                    placeholder="备注说明"
                    rows={2}
                    class="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                  <input
                    type="text"
                    value={exceptionReason.value}
                    onInput$={(_, el) => (exceptionReason.value = el.value)}
                    placeholder="异常原因（退回补正时填写）"
                    class="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                  <div class="flex flex-wrap gap-2">
                    {getAvailableActions().map((item) => (
                      <button
                        key={item.action}
                        onClick$={() => item.action === "withdraw" ? handleWithdraw() : handleAction(item.action)}
                        disabled={actionLoading.value}
                        class={`px-4 py-2 rounded-lg text-xs font-medium transition-colors disabled:opacity-50 ${
                          item.variant === "primary"
                            ? "bg-primary text-white hover:bg-primary-dark"
                            : "border border-primary text-primary hover:bg-primary hover:text-white"
                        }`}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <h3 class="font-bold text-stone-800 mb-3">审计备注</h3>
                <div class="space-y-3">
                  {logs.value.length === 0 ? (
                    <div class="text-xs text-stone-400">暂无记录</div>
                  ) : (
                    logs.value.map((log) => (
                      <div key={log.id} class="relative pl-4 border-l-2 border-stone-200 pb-3">
                        <div class="absolute -left-1.5 top-1 w-2.5 h-2.5 rounded-full bg-primary" />
                        <div class="text-xs font-medium text-stone-700">
                          {log.operator_name}
                          <span class="text-stone-400 ml-1">({log.operator_role ? ROLE_LABELS[log.operator_role as UserRole] || log.operator_role : ""})</span>
                          <span class="text-stone-400 ml-1">· {ACTION_LABELS[log.action] || log.action}</span>
                        </div>
                        {log.from_status && (
                          <div class="text-xs text-stone-400">
                            {STATUS_MAP[log.from_status]?.label || log.from_status} → {STATUS_MAP[log.to_status]?.label || log.to_status}
                          </div>
                        )}
                        {log.comment && (
                          <div class="text-xs text-stone-600 mt-0.5">{log.comment}</div>
                        )}
                        {log.exception_reason && (
                          <div class="text-xs text-status-red mt-0.5">异常：{log.exception_reason}</div>
                        )}
                        <div class="text-xs text-stone-300 mt-0.5">
                          {new Date(log.created_at).toLocaleString("zh-CN")}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
});

export const head: DocumentHead = {
  title: "审核单详情 - 审核单系统",
};
