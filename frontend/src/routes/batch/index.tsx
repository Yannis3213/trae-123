import { component$, useSignal, $, useVisibleTask$ } from "@builder.io/qwik";
import { type DocumentHead } from "@builder.io/qwik-city";
import { api, type AuditOrder, type BatchProcessItemResult } from "../../utils/api";
import { loadAuthFromStorage, getAuth } from "../../stores/auth";
import { STATUS_MAP, getExpiryStatus, EXPIRY_MAP } from "../../utils/constants";

export default component$(() => {
  const authData = useSignal(getAuth());
  const audits = useSignal<AuditOrder[]>([]);
  const loading = useSignal(false);
  const submitLoading = useSignal(false);
  const selectedIds = useSignal<Set<string>>(new Set());
  const action = useSignal<string>("advance");
  const comment = useSignal("");
  const exceptionReason = useSignal("");
  const results = useSignal<BatchProcessItemResult[] | null>(null);
  const showResults = useSignal(false);
  const idInput = useSignal("");
  const toast = useSignal({ show: false, message: "", type: "" });

  const actionOptions = [
    { value: "advance", label: "推进" },
    { value: "review_pass", label: "复核通过" },
    { value: "return_correction", label: "退回补正" },
    { value: "complete", label: "办结" },
  ];

  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(() => {
    loadAuthFromStorage();
    authData.value = getAuth();
    fetchAudits();
  });

  const fetchAudits = $(async () => {
    loading.value = true;
    try {
      const res = await api.getAudits({ role_queue: authData.value?.role, page_size: 100 });
      audits.value = res.items;
    } catch (e: any) {
      showToast(e.message || "获取数据失败", "error");
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

  const toggleSelect = $((id: string) => {
    const next = new Set(selectedIds.value);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    selectedIds.value = next;
  });

  const addIdsFromInput = $(() => {
    if (!idInput.value.trim()) return;
    const ids = idInput.value.split(/[,\n\s]+/).filter(Boolean);
    const next = new Set(selectedIds.value);
    ids.forEach((id) => next.add(id.trim()));
    selectedIds.value = next;
    idInput.value = "";
  });

  const handleSubmit = $(async () => {
    if (selectedIds.value.size === 0) {
      showToast("请先选择审核单", "error");
      return;
    }
    submitLoading.value = true;
    try {
      const res = await api.batchProcess({
        action: action.value as "advance" | "return_correction" | "review_pass" | "complete",
        audit_ids: Array.from(selectedIds.value),
        comment: comment.value,
        exception_reason: exceptionReason.value || null,
      });
      results.value = res.results;
      showResults.value = true;
      const failed = res.results.filter((r: BatchProcessItemResult) => !r.success);
      if (failed.length === 0) {
        showToast(`全部成功：${res.success_count}条`, "success");
      } else {
        showToast(`成功${res.success_count}条，失败${res.fail_count}条`, "error");
      }
      selectedIds.value = new Set();
      comment.value = "";
      exceptionReason.value = "";
      fetchAudits();
    } catch (e: any) {
      showToast(e.message || "批量操作失败", "error");
    } finally {
      submitLoading.value = false;
    }
  });

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

      <div class="bg-white border-b border-stone-200 px-6 py-4">
        <h2 class="text-lg font-bold text-stone-800">⚡ 批量处理</h2>
        <p class="text-xs text-stone-500 mt-1">选择多个审核单并执行批量操作</p>
      </div>

      <div class="flex-1 overflow-auto p-6 space-y-6">
        <div class="bg-white rounded-xl border border-stone-200 p-6">
          <h3 class="font-bold text-stone-800 mb-3">操作配置</h3>
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-xs text-stone-500 mb-1">操作类型</label>
              <select
                value={action.value}
                onChange$={(_, el) => (action.value = el.value)}
                class="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              >
                {actionOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label class="block text-xs text-stone-500 mb-1">备注说明</label>
              <input
                type="text"
                value={comment.value}
                onInput$={(_, el) => (comment.value = el.value)}
                class="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="可选"
              />
            </div>
            <div>
              <label class="block text-xs text-stone-500 mb-1">异常原因</label>
              <input
                type="text"
                value={exceptionReason.value}
                onInput$={(_, el) => (exceptionReason.value = el.value)}
                class="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="退回补正时填写"
              />
            </div>
            <div>
              <label class="block text-xs text-stone-500 mb-1">按ID添加</label>
              <div class="flex gap-2">
                <input
                  type="text"
                  value={idInput.value}
                  onInput$={(_, el) => (idInput.value = el.value)}
                  onKeyDown$={(e) => { if (e.key === "Enter") addIdsFromInput(); }}
                  class="flex-1 border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="输入审核单ID，逗号分隔"
                />
                <button
                  onClick$={addIdsFromInput}
                  class="px-3 py-2 border border-primary text-primary rounded-lg text-sm hover:bg-primary hover:text-white transition-colors"
                >
                  添加
                </button>
              </div>
            </div>
          </div>
        </div>

        <div class="bg-white rounded-xl border border-stone-200 overflow-hidden">
          <div class="px-6 py-4 border-b border-stone-200 flex items-center justify-between">
            <h3 class="font-bold text-stone-800">
              选择审核单
              <span class="text-xs font-normal text-stone-500 ml-2">
                已选 {selectedIds.value.size} 条
              </span>
            </h3>
            <button
              onClick$={handleSubmit}
              disabled={submitLoading.value || selectedIds.value.size === 0}
              class="px-6 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-dark transition-colors disabled:opacity-50"
            >
              {submitLoading.value ? "提交中..." : "执行批量操作"}
            </button>
          </div>

          {loading.value ? (
            <div class="p-6 animate-pulse space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} class="h-8 bg-stone-200 rounded" />
              ))}
            </div>
          ) : audits.value.length === 0 ? (
            <div class="text-center py-12 text-stone-400">暂无审核单</div>
          ) : (
            <table class="w-full text-sm">
              <thead>
                <tr class="bg-stone-50 text-stone-600">
                  <th class="px-4 py-3 text-left w-10">
                    <input
                      type="checkbox"
                      checked={selectedIds.value.size === audits.value.length && audits.value.length > 0}
                      onChange$={() => {
                        if (selectedIds.value.size === audits.value.length) {
                          selectedIds.value = new Set();
                        } else {
                          selectedIds.value = new Set(audits.value.map((a) => a.id));
                        }
                      }}
                      class="rounded"
                    />
                  </th>
                  <th class="px-4 py-3 text-left">单号</th>
                  <th class="px-4 py-3 text-left">阿姨姓名</th>
                  <th class="px-4 py-3 text-left">状态</th>
                  <th class="px-4 py-3 text-left">到期</th>
                </tr>
              </thead>
              <tbody>
                {audits.value.map((audit) => {
                  const expiryStatus = getExpiryStatus(audit.expiry_date);
                  const statusInfo = STATUS_MAP[audit.status] || STATUS_MAP.pending;
                  const expiryInfo = EXPIRY_MAP[expiryStatus];
                  return (
                    <tr key={audit.id} class="border-t border-stone-100 hover:bg-stone-50">
                      <td class="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={selectedIds.value.has(audit.id)}
                          onChange$={() => toggleSelect(audit.id)}
                          class="rounded"
                        />
                      </td>
                      <td class="px-4 py-3 font-mono text-xs text-primary">{audit.order_no}</td>
                      <td class="px-4 py-3">{audit.nanny_profile?.name || "-"}</td>
                      <td class="px-4 py-3">
                        <span class={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${statusInfo.bg} ${statusInfo.color}`}>
                          {statusInfo.label}
                        </span>
                      </td>
                      <td class="px-4 py-3">
                        <span class={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${expiryInfo.bg} ${expiryInfo.color}`}>
                          {expiryInfo.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {showResults.value && results.value && (
        <div class="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick$={() => (showResults.value = false)}>
          <div class="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[80vh] overflow-auto" onClick$={(e) => e.stopPropagation()}>
            <div class="px-6 py-4 border-b border-stone-200 flex items-center justify-between">
              <h3 class="font-bold text-stone-800">批量处理结果</h3>
              <button onClick$={() => (showResults.value = false)} class="text-stone-400 hover:text-stone-600">✕</button>
            </div>
            <div class="p-6 space-y-2">
              {results.value.map((item) => (
                <div
                  key={item.audit_id}
                  class={`flex items-center gap-3 p-3 rounded-lg text-sm ${
                    item.success ? "bg-green-50" : "bg-red-50"
                  }`}
                >
                  <span class={item.success ? "text-status-green" : "text-status-red"}>
                    {item.success ? "✓" : "✗"}
                  </span>
                  <span class="font-mono text-xs">{item.order_no}</span>
                  <span class={item.success ? "text-green-700" : "text-red-700"}>
                    {item.success ? "成功" : item.error_message || "失败"}
                  </span>
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
  title: "批量处理 - 审核单系统",
};
