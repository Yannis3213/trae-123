import { component$, useSignal, $, useVisibleTask$ } from "@builder.io/qwik";
import { type DocumentHead, Link } from "@builder.io/qwik-city";
import { api, type AuditOrder, type AuditListQuery } from "../utils/api";
import { loadAuthFromStorage, getAuth, setAuthState, ROLE_LABELS, type UserRole } from "../stores/auth";
import { STATUS_MAP, EXPIRY_MAP, getExpiryStatus } from "../utils/constants";

export default component$(() => {
  const authData = useSignal(getAuth());
  const audits = useSignal<AuditOrder[]>([]);
  const total = useSignal(0);
  const page = useSignal(1);
  const pageSize = useSignal(20);
  const loading = useSignal(false);

  const statusFilter = useSignal<string>("");
  const expiryFilter = useSignal<string>("");
  const search = useSignal("");
  const selectedIds = useSignal<Set<string>>(new Set());
  const toast = useSignal({ show: false, message: "", type: "" });

  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(() => {
    loadAuthFromStorage();
    authData.value = getAuth();
    fetchAudits();
  });

  const statusTabs = [
    { value: "", label: "全部" },
    { value: "pending", label: "待处理" },
    { value: "processing", label: "处理中" },
    { value: "reviewing", label: "复核中" },
    { value: "correction_needed", label: "待补正" },
    { value: "completed", label: "办结" },
  ];

  const expiryTabs = [
    { value: "", label: "全部" },
    { value: "normal", label: "正常" },
    { value: "expiring_soon", label: "临期" },
    { value: "overdue", label: "逾期" },
  ];

  const roleOptions: { value: UserRole; label: string }[] = [
    { value: "dispatcher", label: "派单客服" },
    { value: "supervisor", label: "服务督导" },
    { value: "manager", label: "城市经理" },
  ];

  const switchRole = $((role: UserRole) => {
    if (typeof window !== "undefined" && authData.value) {
      localStorage.setItem("role", role);
      authData.value = { ...authData.value, role };
      setAuthState(authData.value);
      fetchAudits();
    }
  });

  const fetchAudits = $(async () => {
    loading.value = true;
    try {
      const query: AuditListQuery = {
        page: page.value,
        page_size: pageSize.value,
      };
      if (statusFilter.value) query.status = statusFilter.value;
      if (expiryFilter.value) query.expiry_status = expiryFilter.value as "normal" | "expiring_soon" | "overdue";
      if (authData.value?.role) query.role_queue = authData.value.role;
      const res = await api.getAudits(query);
      audits.value = res.items;
      total.value = res.total;
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

  const toggleAll = $(() => {
    if (selectedIds.value.size === audits.value.length) {
      selectedIds.value = new Set();
    } else {
      selectedIds.value = new Set(audits.value.map((a) => a.id));
    }
  });

  const handleBatchAction = $(async (action: string) => {
    if (selectedIds.value.size === 0) {
      showToast("请先选择审核单", "error");
      return;
    }
    try {
      const res = await api.batchProcess({
        action: action as "advance" | "return_correction" | "review_pass" | "complete",
        audit_ids: Array.from(selectedIds.value),
        comment: "",
        exception_reason: null,
      });
      const failed = res.results.filter((r: any) => !r.success);
      if (failed.length === 0) {
        showToast(`批量操作成功：${res.success_count}条`, "success");
      } else {
        showToast(`成功${res.success_count}条，失败${res.fail_count}条`, "error");
      }
      selectedIds.value = new Set();
      fetchAudits();
    } catch (e: any) {
      showToast(e.message || "批量操作失败", "error");
    }
  });

  const getAvailableBatchActions = () => {
    const role = authData.value?.role;
    if (role === "supervisor") return [{ action: "advance", label: "批量推进" }];
    if (role === "manager") return [
      { action: "review_pass", label: "批量复核通过" },
      { action: "return_correction", label: "批量退回补正" },
      { action: "complete", label: "批量办结" },
    ];
    return [];
  };

  const currentRole = authData.value?.role as UserRole | undefined;

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

      <div class="bg-white border-b border-stone-200 px-6 py-3 flex items-center justify-between">
        <span class="text-lg font-bold text-stone-800">📋 审核单系统</span>
        <div class="flex items-center gap-4">
          {authData.value && (
            <>
              <select
                class="border border-stone-300 rounded-lg px-2 py-1 text-sm"
                value={authData.value.role}
                onChange$={(_, el) => switchRole(el.value as UserRole)}
              >
                {roleOptions.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
              <span class="text-sm text-stone-600">
                {authData.value.username} · {currentRole ? ROLE_LABELS[currentRole] : ""}
              </span>
            </>
          )}
        </div>
      </div>

      <div class="bg-white border-b border-stone-200 px-6 py-3 flex flex-wrap items-center gap-3">
        <div class="flex items-center gap-1">
          {statusTabs.map((tab) => (
            <button
              key={tab.value}
              onClick$={() => { statusFilter.value = tab.value; page.value = 1; fetchAudits(); }}
              class={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                statusFilter.value === tab.value
                  ? "bg-primary text-white"
                  : "bg-stone-100 text-stone-600 hover:bg-stone-200"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div class="h-5 w-px bg-stone-300" />
        <div class="flex items-center gap-1">
          {expiryTabs.map((tab) => (
            <button
              key={tab.value}
              onClick$={() => { expiryFilter.value = tab.value; page.value = 1; fetchAudits(); }}
              class={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                expiryFilter.value === tab.value
                  ? "bg-primary text-white"
                  : "bg-stone-100 text-stone-600 hover:bg-stone-200"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div class="h-5 w-px bg-stone-300" />
        <input
          type="text"
          value={search.value}
          onInput$={(_, el) => (search.value = el.value)}
          class="border border-stone-300 rounded-lg px-3 py-1.5 text-sm w-48 focus:outline-none focus:ring-2 focus:ring-primary"
          placeholder="搜索单号/阿姨姓名"
        />
      </div>

      <div class="flex-1 overflow-auto p-6">
        {loading.value ? (
          <div class="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} class="bg-white rounded-xl p-4 animate-pulse">
                <div class="h-4 bg-stone-200 rounded w-1/3 mb-2" />
                <div class="h-3 bg-stone-200 rounded w-1/2" />
              </div>
            ))}
          </div>
        ) : audits.value.length === 0 ? (
          <div class="text-center py-16 text-stone-400">暂无审核单数据</div>
        ) : (
          <div class="bg-white rounded-xl shadow-sm overflow-hidden">
            <table class="w-full text-sm">
              <thead>
                <tr class="bg-stone-50 text-stone-600">
                  <th class="px-4 py-3 text-left w-10">
                    <input
                      type="checkbox"
                      checked={selectedIds.value.size === audits.value.length && audits.value.length > 0}
                      onChange$={toggleAll}
                      class="rounded"
                    />
                  </th>
                  <th class="px-4 py-3 text-left">单号</th>
                  <th class="px-4 py-3 text-left">阿姨姓名</th>
                  <th class="px-4 py-3 text-left">状态</th>
                  <th class="px-4 py-3 text-left">到期</th>
                  <th class="px-4 py-3 text-left">创建人</th>
                  <th class="px-4 py-3 text-left">当前处理人</th>
                  <th class="px-4 py-3 text-left">创建时间</th>
                  <th class="px-4 py-3 text-left">操作</th>
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
                      <td class="px-4 py-3 font-mono text-xs text-primary">
                        <Link href={`/audit/${audit.id}`} class="hover:underline">
                          {audit.order_no}
                        </Link>
                      </td>
                      <td class="px-4 py-3 text-stone-800">
                        {audit.nanny_profile?.name || "-"}
                      </td>
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
                      <td class="px-4 py-3 text-stone-600">{audit.creator_name}</td>
                      <td class="px-4 py-3 text-stone-600">{audit.current_handler_name || "-"}</td>
                      <td class="px-4 py-3 text-stone-400 text-xs">
                        {new Date(audit.created_at).toLocaleDateString("zh-CN")}
                      </td>
                      <td class="px-4 py-3">
                        <Link
                          href={`/audit/${audit.id}`}
                          class="text-primary text-xs hover:underline"
                        >
                          查看
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div class="flex items-center justify-between mt-4">
          <span class="text-xs text-stone-400">
            共 {total.value} 条
          </span>
          <div class="flex items-center gap-2">
            <button
              onClick$={() => { if (page.value > 1) page.value--; fetchAudits(); }}
              disabled={page.value <= 1}
              class="px-3 py-1 text-xs border border-stone-300 rounded-lg disabled:opacity-50 hover:bg-stone-50"
            >
              上一页
            </button>
            <span class="text-xs text-stone-600">
              {page.value} / {Math.max(1, Math.ceil(total.value / pageSize.value))}
            </span>
            <button
              onClick$={() => { page.value++; fetchAudits(); }}
              disabled={page.value >= Math.ceil(total.value / pageSize.value)}
              class="px-3 py-1 text-xs border border-stone-300 rounded-lg disabled:opacity-50 hover:bg-stone-50"
            >
              下一页
            </button>
          </div>
        </div>
      </div>

      {selectedIds.value.size > 0 && (
        <div class="fixed bottom-0 left-56 right-0 bg-white border-t border-stone-200 px-6 py-3 flex items-center justify-between shadow-lg z-40">
          <span class="text-sm text-stone-600">
            已选择 <strong class="text-primary">{selectedIds.value.size}</strong> 条
          </span>
          <div class="flex items-center gap-2">
            {getAvailableBatchActions().map((item) => (
              <button
                key={item.action}
                onClick$={() => handleBatchAction(item.action)}
                class="px-4 py-1.5 bg-primary text-white rounded-lg text-xs font-medium hover:bg-primary-dark transition-colors"
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
});

export const head: DocumentHead = {
  title: "审核单列表 - 审核单系统",
};
