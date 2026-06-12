import { component$, useSignal, $, useVisibleTask$ } from "@builder.io/qwik";
import { type DocumentHead, Link } from "@builder.io/qwik-city";
import { api, type AuditOrder, type BatchProcessItemResult } from "../../utils/api";
import { loadAuthFromStorage, getAuth } from "../../stores/auth";
import { STATUS_MAP } from "../../utils/constants";

export default component$(() => {
  const authData = useSignal(getAuth());
  const loading = useSignal(false);
  const batchLoading = useSignal(false);
  const toast = useSignal({ show: false, message: "", type: "" });
  const batchResults = useSignal<BatchProcessItemResult[] | null>(null);
  const showBatchResults = useSignal(false);

  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(() => {
    loadAuthFromStorage();
    authData.value = getAuth();
    fetchExpiry();
  });

  const normalItems = useSignal<AuditOrder[]>([]);
  const expiringItems = useSignal<AuditOrder[]>([]);
  const overdueItems = useSignal<AuditOrder[]>([]);

  const fetchExpiry = $(async () => {
    loading.value = true;
    try {
      const data = await api.getExpiryList();
      normalItems.value = data.normal || [];
      expiringItems.value = data.expiring_soon || [];
      overdueItems.value = data.overdue || [];
    } catch (e: any) {
      showToast(e.message || "获取到期预警数据失败", "error");
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

  const getResponsiblePerson = (audit: AuditOrder): string => {
    if (audit.responsible_name) return audit.responsible_name;
    const status = audit.status;
    if (status === "pending") return audit.creator_name || "派单客服";
    if (status === "processing" || status === "correction_needed") return audit.current_handler_name || "服务督导";
    if (status === "reviewing") return audit.current_handler_name || "城市经理";
    return "-";
  };

  const handleBatchAdvance = $(async () => {
    const overdueNonCompleted = overdueItems.value.filter(
      (a) => a.status !== "completed" && a.status !== "withdrawn"
    );
    if (overdueNonCompleted.length === 0) {
      showToast("无逾期可推进的审核单", "error");
      return;
    }
    batchLoading.value = true;
    try {
      const res = await api.batchProcess({
        action: "advance",
        audit_ids: overdueNonCompleted.map((a) => a.id),
        comment: "逾期批量推进",
        exception_reason: null,
      });
      batchResults.value = res.results;
      showBatchResults.value = true;
      const failed = res.results.filter((r: any) => !r.success);
      if (failed.length === 0) {
        showToast(`逾期批量推进成功：${res.success_count}条`, "success");
      } else {
        showToast(`成功${res.success_count}条，失败${res.fail_count}条`, "error");
      }
      fetchExpiry();
    } catch (e: any) {
      showToast(e.message || "批量推进失败", "error");
    } finally {
      batchLoading.value = false;
    }
  });

  const renderCard = (audit: AuditOrder) => {
    const statusInfo = STATUS_MAP[audit.status] || STATUS_MAP.pending;
    return (
      <div key={audit.id} class="bg-white rounded-lg border border-stone-200 p-4 mb-3">
        <div class="flex items-center justify-between mb-2">
          <Link
            href={`/audit/${audit.id}`}
            class="font-mono text-xs text-primary hover:underline"
          >
            {audit.order_no}
          </Link>
          <span class={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${statusInfo.bg} ${statusInfo.color}`}>
            {statusInfo.label}
          </span>
        </div>
        <div class="text-sm font-medium text-stone-800 mb-1">
          {audit.nanny_profile?.name || "未填写"}
        </div>
        <div class="flex items-center justify-between text-xs text-stone-500">
          <span>到期：{audit.expiry_date}</span>
          <span>责任人：{getResponsiblePerson(audit)}</span>
        </div>
      </div>
    );
  };

  const columns = [
    {
      title: "正常",
      count: normalItems.value.length,
      color: "bg-status-green",
      items: normalItems.value,
    },
    {
      title: "临期",
      count: expiringItems.value.length,
      color: "bg-status-yellow",
      items: expiringItems.value,
    },
    {
      title: "逾期",
      count: overdueItems.value.length,
      color: "bg-status-red",
      items: overdueItems.value,
    },
  ];

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

      <div class="bg-white border-b border-stone-200 px-6 py-4 flex items-center justify-between">
        <div>
          <h2 class="text-lg font-bold text-stone-800">⏰ 到期预警看板</h2>
          <p class="text-xs text-stone-500 mt-1">按到期状态分列展示审核单</p>
        </div>
        <button
          onClick$={handleBatchAdvance}
          disabled={batchLoading.value || overdueItems.value.length === 0}
          class="px-4 py-2 bg-status-red text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors disabled:opacity-50"
        >
          {batchLoading.value ? "处理中..." : "逾期批量推进"}
        </button>
      </div>

      <div class="flex-1 overflow-auto p-6">
        {loading.value ? (
          <div class="grid grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} class="animate-pulse space-y-3">
                <div class="h-6 bg-stone-200 rounded w-1/3" />
                <div class="h-24 bg-stone-200 rounded" />
                <div class="h-24 bg-stone-200 rounded" />
              </div>
            ))}
          </div>
        ) : (
          <div class="grid grid-cols-3 gap-6">
            {columns.map((col) => (
              <div key={col.title}>
                <div class="flex items-center gap-2 mb-4">
                  <div class={`w-3 h-3 rounded-full ${col.color}`} />
                  <h3 class="font-bold text-stone-800">{col.title}</h3>
                  <span class="text-xs text-stone-400 bg-stone-100 px-2 py-0.5 rounded-full">
                    {col.count}
                  </span>
                </div>
                {col.items.length === 0 ? (
                  <div class="text-center py-8 text-stone-400 text-sm">暂无</div>
                ) : (
                  col.items.map((item) => renderCard(item))
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {showBatchResults.value && batchResults.value && (
        <div class="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick$={() => (showBatchResults.value = false)}>
          <div class="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[80vh] overflow-auto" onClick$={(e) => e.stopPropagation()}>
            <div class="px-6 py-4 border-b border-stone-200 flex items-center justify-between">
              <h3 class="font-bold text-stone-800">逾期批量推进结果</h3>
              <button onClick$={() => (showBatchResults.value = false)} class="text-stone-400 hover:text-stone-600">✕</button>
            </div>
            <div class="p-6 space-y-2">
              {batchResults.value.map((item) => (
                <div
                  key={item.audit_id}
                  class={`p-3 rounded-lg text-sm ${
                    item.success ? "bg-green-50" : "bg-red-50"
                  }`}
                >
                  <div class="flex items-center gap-3">
                    <span class={item.success ? "text-status-green" : "text-status-red"}>
                      {item.success ? "✓" : "✗"}
                    </span>
                    <span class="font-mono text-xs">{item.order_no}</span>
                    <span class={item.success ? "text-green-700" : "text-red-700"}>
                      {item.success ? "成功" : item.error_message || "失败"}
                    </span>
                  </div>
                  {!item.success && item.error_code && (
                    <div class="mt-1 ml-7 text-xs text-red-500 font-mono">[{item.error_code}]</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

export const head: DocumentHead = {
  title: "到期预警 - 审核单系统",
};
