import { useSignal, useSignalEffect } from "@preact/signals";
import {
  User,
  PrescriptionFlow,
  ProcessRecord,
  AbnormalReason,
  AuditNote,
  apiFetch,
  getCurrentUser,
  setCurrentUser,
  STATUS_LABELS,
  STATUS_COLORS,
  URGENCY_LABELS,
  URGENCY_COLORS,
  ROLE_LABELS,
  ABNORMAL_TYPE_LABELS,
  ACTION_LABELS,
  formatDateTime,
  getAvailableActions,
  canHandleFlow,
} from "../utils/api.ts";

interface Props {
  id: number;
}

export default function FlowDetailIsland({ id }: Props) {
  const users = useSignal<User[]>([]);
  const currentUser = useSignal<User | null>(getCurrentUser());
  const flow = useSignal<PrescriptionFlow | null>(null);
  const records = useSignal<ProcessRecord[]>([]);
  const abnormalReasons = useSignal<AbnormalReason[]>([]);
  const auditNotes = useSignal<AuditNote[]>([]);
  const loading = useSignal(true);
  const error = useSignal("");
  const successMsg = useSignal("");

  const showActionModal = useSignal(false);
  const actionForm = useSignal({
    action: "",
    remark: "",
    evidence: "",
    return_reason: "",
    prescription_info: "",
    decoction_info: "",
    delivery_info: "",
  });

  useSignalEffect(() => {
    loadAll();
    loadUsers();
  });

  async function loadUsers() {
    try {
      users.value = await apiFetch<User[]>("/users");
      if (!currentUser.value && users.value.length > 0) {
        currentUser.value = users.value[0];
        setCurrentUser(currentUser.value);
      }
    } catch (_e) {
      // ignore
    }
  }

  async function loadAll() {
    loading.value = true;
    error.value = "";
    try {
      const res: any = await apiFetch(`/flows/${id}`);
      flow.value = res.flow;
      records.value = res.process_records || [];
      abnormalReasons.value = res.abnormal_reasons || [];
      auditNotes.value = res.audit_notes || [];
    } catch (e: any) {
      error.value = e.message;
    } finally {
      loading.value = false;
    }
  }

  function switchUser(username: string) {
    const u = users.value.find((x) => x.username === username);
    if (u) {
      currentUser.value = u;
      setCurrentUser(u);
    }
  }

  function isHandler(): boolean {
    if (!currentUser.value || !flow.value) return false;
    return canHandleFlow(
      currentUser.value.role,
      flow.value.status,
      flow.value.current_handler,
      currentUser.value.username
    );
  }

  function availableActions() {
    if (!flow.value || !isHandler()) return [];
    return getAvailableActions(flow.value.status);
  }

  function openActionModal(action: string) {
    if (!flow.value) return;
    actionForm.value = {
      action,
      remark: "",
      evidence: "",
      return_reason: "",
      prescription_info: flow.value.prescription_info || "",
      decoction_info: flow.value.decoction_info || "",
      delivery_info: flow.value.delivery_info || "",
    };
    showActionModal.value = true;
  }

  async function executeAction() {
    if (!flow.value) return;
    try {
      const body: any = {
        action: actionForm.value.action,
        remark: actionForm.value.remark,
        evidence: actionForm.value.evidence,
        version: flow.value.version,
      };
      if (actionForm.value.action === "return") {
        body.return_reason = actionForm.value.return_reason;
      }
      const needsMaterial = ["correct", "resubmit", "submit", "supplement"];
      if (needsMaterial.includes(actionForm.value.action)) {
        body.prescription_info = actionForm.value.prescription_info;
        body.decoction_info = actionForm.value.decoction_info;
        body.delivery_info = actionForm.value.delivery_info;
      }

      await apiFetch(`/flows/${id}/process`, {
        method: "POST",
        body: JSON.stringify(body),
      });

      showActionModal.value = false;
      successMsg.value = "处理成功！数据已刷新。";
      setTimeout(() => (successMsg.value = ""), 4000);
      await loadAll();
    } catch (e: any) {
      error.value = e.message;
      setTimeout(() => (error.value = ""), 6000);
    }
  }

  if (loading.value) {
    return (
      <div class="text-center py-16 text-gray-500">
        <div class="inline-block animate-spin rounded-full h-8 w-8 border-4 border-indigo-200 border-t-indigo-600 mb-3"></div>
        <div>加载中...</div>
      </div>
    );
  }

  if (!flow.value) {
    return (
      <div class="bg-white rounded-lg shadow p-8 text-center">
        <p class="text-red-600 mb-4">{error.value || "处方流转单不存在"}</p>
        <a
          href="/"
          class="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700"
        >
          返回列表
        </a>
      </div>
    );
  }

  const f = flow.value;
  const actions = availableActions();

  return (
    <div>
      {error.value && (
        <div class="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm flex justify-between items-center">
          <span>⚠ {error.value}</span>
          <button onClick={() => (error.value = "")} class="text-red-500 text-xs">
            ✕
          </button>
        </div>
      )}
      {successMsg.value && (
        <div class="mb-4 p-3 bg-green-50 border border-green-200 rounded text-green-700 text-sm flex justify-between items-center">
          <span>✓ {successMsg.value}</span>
          <button onClick={() => (successMsg.value = "")} class="text-green-500 text-xs">
            ✕
          </button>
        </div>
      )}

      <div class="bg-white rounded-lg shadow p-4 mb-6">
        <div class="flex flex-wrap items-center justify-between gap-4">
          <div class="flex items-center gap-3">
            <span class="text-sm font-medium text-gray-700">当前角色：</span>
            <select
              class="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              value={currentUser.value?.username || ""}
              onChange={(e) => switchUser((e.target as HTMLSelectElement).value)}
            >
              {users.value.map((u) => (
                <option value={u.username}>
                  {u.name} - {ROLE_LABELS[u.role] || u.role}
                </option>
              ))}
            </select>
          </div>
          <div class="flex items-center gap-3">
            {isHandler() ? (
              <span class="text-green-600 text-sm font-medium">✓ 您是当前处理人，可执行操作</span>
            ) : f.status === "archived" || f.status === "completed" ? (
              <span class="text-gray-500 text-sm">该单据已{STATUS_LABELS[f.status]}，不可操作</span>
            ) : f.current_handler ? (
              <span class="text-amber-600 text-sm">
                ⚠ 当前处理人：{f.current_handler}
                （{ROLE_LABELS[f.current_role] || f.current_role}）
              </span>
            ) : null}
            <button
              onClick={loadAll}
              class="px-3 py-1.5 bg-gray-100 text-gray-700 rounded text-sm hover:bg-gray-200"
            >
              ↻ 刷新
            </button>
          </div>
        </div>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div class="lg:col-span-2 space-y-6">
          <div class="bg-white rounded-lg shadow overflow-hidden">
            <div class="px-6 py-4 bg-gray-50 border-b flex items-center justify-between flex-wrap gap-2">
              <h3 class="font-medium text-gray-800">处方流转单信息</h3>
              <div class="flex items-center gap-3">
                <span
                  class={`inline-block px-2.5 py-1 rounded text-xs font-medium ${
                    STATUS_COLORS[f.status]
                  }`}
                >
                  {STATUS_LABELS[f.status]}
                </span>
                <span class="flex items-center gap-1 text-xs">
                  <span
                    class={`w-2.5 h-2.5 rounded-full ${URGENCY_COLORS[f.urgency]}`}
                  ></span>
                  <span class="font-medium">{URGENCY_LABELS[f.urgency]}</span>
                </span>
              </div>
            </div>
            <div class="p-6 space-y-5">
              {f.urgency === "overdue" && (
                <div class="p-3 bg-red-50 border-2 border-red-300 rounded-md">
                  <div class="flex items-center gap-2 text-sm text-red-700 font-bold">
                    <span>⚠ 该处方流转单已逾期</span>
                  </div>
                  <div class="mt-1 text-xs text-red-600">
                    截止时间：{formatDateTime(f.due_at)}，逾期责任人为：
                    <span class="font-bold underline">{f.current_handler}</span>
                    （{ROLE_LABELS[f.current_role] || f.current_role}）
                  </div>
                  <div class="mt-1 text-xs text-red-500">
                    逾期后仅可执行「补正资料」或「退回补正」动作，其他操作将被后端拦截
                  </div>
                </div>
              )}
              {f.urgency === "warning" && (
                <div class="p-3 bg-yellow-50 border border-yellow-300 rounded-md">
                  <div class="flex items-center gap-2 text-sm text-yellow-700 font-medium">
                    <span>⚡ 该处方流转单即将临期</span>
                  </div>
                  <div class="mt-1 text-xs text-yellow-600">
                    截止时间：{formatDateTime(f.due_at)}，当前责任人：{f.current_handler}
                  </div>
                </div>
              )}

              <div class="grid grid-cols-2 md:grid-cols-3 gap-4">
                <InfoCell label="流转单号" value={f.flow_no} mono />
                <InfoCell label="患者姓名" value={f.patient_name} />
                <InfoCell label="版本号" value={`v${f.version}`} />
                <InfoCell
                  label="资料齐全"
                  value={
                    f.is_material_complete ? (
                      <span class="text-green-600">✓ 齐全</span>
                    ) : (
                      <span class="text-red-600">✗ 不齐全</span>
                    )
                  }
                />
                <InfoCell label="创建人" value={f.created_by} />
                <InfoCell label="创建时间" value={formatDateTime(f.created_at)} />
                <InfoCell label="更新时间" value={formatDateTime(f.updated_at)} />
                <InfoCell
                  label="截止时间"
                  value={
                    <span
                      class={
                        f.urgency === "overdue"
                          ? "text-red-600 font-medium"
                          : f.urgency === "warning"
                          ? "text-yellow-600 font-medium"
                          : ""
                      }
                    >
                      {formatDateTime(f.due_at)}
                    </span>
                  }
                />
                <InfoCell
                  label="当前处理人"
                  value={
                    f.current_handler ? (
                      <span
                        class={
                          f.urgency === "overdue"
                            ? "text-red-600 font-bold underline"
                            : f.urgency === "warning"
                            ? "text-yellow-700 font-medium"
                            : ""
                        }
                      >
                        {f.current_handler} ({ROLE_LABELS[f.current_role] || f.current_role})
                      </span>
                    ) : (
                      "-"
                    )
                  }
                />
              </div>

              <div class="pt-2 border-t space-y-4">
                <MaterialBlock
                  title="处方开具信息"
                  value={f.prescription_info}
                  complete={!!f.prescription_info}
                />
                <MaterialBlock
                  title="煎药信息"
                  value={f.decoction_info}
                  complete={!!f.decoction_info}
                />
                <MaterialBlock
                  title="配送信息"
                  value={f.delivery_info}
                  complete={!!f.delivery_info}
                />
              </div>

              {f.abnormal_reason && (
                <div class="p-3 bg-red-50 border border-red-200 rounded">
                  <div class="text-xs text-red-600 font-medium mb-1">异常原因</div>
                  <div class="text-sm text-red-800">{f.abnormal_reason}</div>
                </div>
              )}
              {f.return_reason && (
                <div class="p-3 bg-orange-50 border border-orange-200 rounded">
                  <div class="text-xs text-orange-600 font-medium mb-1">退回原因</div>
                  <div class="text-sm text-orange-800">{f.return_reason}</div>
                </div>
              )}
            </div>
          </div>

          <div class="bg-white rounded-lg shadow overflow-hidden">
            <div class="px-6 py-4 bg-gray-50 border-b flex items-center justify-between">
              <h3 class="font-medium text-gray-800">异常 / 补正记录</h3>
              <span class="text-xs text-gray-500">{abnormalReasons.value.length} 条</span>
            </div>
            <div class="p-6">
              {abnormalReasons.value.length === 0 ? (
                <div class="text-center text-gray-400 py-6 text-sm">暂无异常或补正记录</div>
              ) : (
                <div class="space-y-3">
                  {abnormalReasons.value.map((r) => (
                    <div
                      key={r.id}
                      class={`p-3 rounded border ${
                        r.type === "corrected"
                          ? "bg-green-50 border-green-200"
                          : "bg-red-50 border-red-200"
                      }`}
                    >
                      <div class="flex items-center justify-between text-xs">
                        <div class="flex items-center gap-2">
                          <span
                            class={`px-2 py-0.5 rounded text-white text-xs font-medium ${
                              r.type === "corrected" ? "bg-green-600" : "bg-red-600"
                            }`}
                          >
                            {ABNORMAL_TYPE_LABELS[r.type] || r.type}
                          </span>
                          <span
                            class={r.type === "corrected" ? "text-green-700" : "text-red-700"}
                          >
                            操作人：{r.operator}
                          </span>
                          {r.responsible_person && (
                            <span class={`text-xs font-medium ${
                              r.type === "corrected" ? "text-green-800" : "text-red-800"
                            }`}>
                              · 责任人：{r.responsible_person}
                            </span>
                          )}
                          {r.attempt_count > 0 && (
                            <span class={`px-1.5 py-0.5 rounded text-white text-xs ${
                              r.type === "corrected" ? "bg-green-500" : "bg-red-500"
                            }`}>
                              第 {r.attempt_count} 次
                            </span>
                          )}
                        </div>
                        <span class="text-gray-500">{formatDateTime(r.created_at)}</span>
                      </div>
                      <div
                        class={`text-sm mt-1.5 ${
                          r.type === "corrected" ? "text-green-800" : "text-red-800"
                        }`}
                      >
                        {r.reason}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div class="bg-white rounded-lg shadow overflow-hidden">
            <div class="px-6 py-4 bg-gray-50 border-b flex items-center justify-between">
              <h3 class="font-medium text-gray-800">审计轨迹 · 处理记录</h3>
              <span class="text-xs text-gray-500">{records.value.length} 条</span>
            </div>
            <div class="p-6">
              {records.value.length === 0 ? (
                <div class="text-center text-gray-400 py-6 text-sm">暂无处理记录</div>
              ) : (
                <div class="relative">
                  <div class="absolute left-3.5 top-2 bottom-2 w-0.5 bg-gray-200"></div>
                  <div class="space-y-5">
                    {records.value.map((r) => (
                      <div key={r.id} class="relative pl-10">
                        <div class="absolute left-1 top-1 w-5 h-5 rounded-full bg-white border-2 border-indigo-400"></div>
                        <div class="bg-gray-50 rounded p-3">
                          <div class="flex items-center justify-between text-xs">
                            <div class="flex items-center gap-2">
                              <span class="font-medium text-indigo-700">
                                {ACTION_LABELS[r.action] || r.action}
                              </span>
                              <span class="text-gray-500">·</span>
                              <span class="text-gray-600">{r.operator}</span>
                              <span class="text-gray-400">
                                （{ROLE_LABELS[r.operator_role] || r.operator_role}）
                              </span>
                            </div>
                            <span class="text-gray-400">{formatDateTime(r.created_at)}</span>
                          </div>
                          {(r.from_status || r.to_status) && (
                            <div class="text-xs mt-1.5 text-gray-600">
                              {r.from_status && (
                                <span class="bg-gray-100 px-1.5 py-0.5 rounded">
                                  {STATUS_LABELS[r.from_status as keyof typeof STATUS_LABELS] ||
                                    r.from_status}
                                </span>
                              )}
                              {r.from_status && r.to_status && (
                                <span class="mx-1.5 text-gray-400">→</span>
                              )}
                              {r.to_status && (
                                <span
                                  class={`px-1.5 py-0.5 rounded text-white ${
                                    STATUS_COLORS[r.to_status as keyof typeof STATUS_COLORS] ||
                                    "bg-gray-600"
                                  }`}
                                >
                                  {STATUS_LABELS[r.to_status as keyof typeof STATUS_LABELS] ||
                                    r.to_status}
                                </span>
                              )}
                            </div>
                          )}
                          {r.remark && r.remark !== "无备注" && (
                            <div class="text-sm mt-2 text-gray-700">📝 {r.remark}</div>
                          )}
                          {r.evidence && r.evidence !== "未提供" && (
                            <div class="text-xs mt-1.5 text-gray-500">
                              📎 证据：{r.evidence}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div class="bg-white rounded-lg shadow overflow-hidden">
            <div class="px-6 py-4 bg-gray-50 border-b flex items-center justify-between">
              <h3 class="font-medium text-gray-800">审计备注</h3>
              <span class="text-xs text-gray-500">{auditNotes.value.length} 条</span>
            </div>
            <div class="p-6">
              {auditNotes.value.length === 0 ? (
                <div class="text-center text-gray-400 py-6 text-sm">暂无审计备注</div>
              ) : (
                <div class="space-y-2">
                  {auditNotes.value.map((n) => (
                    <div
                      key={n.id}
                      class="p-3 bg-indigo-50 border border-indigo-100 rounded"
                    >
                      <div class="flex items-center justify-between text-xs">
                        <span class="font-medium text-indigo-700">{n.operator}</span>
                        <span class="text-indigo-400">{formatDateTime(n.created_at)}</span>
                      </div>
                      <div class="text-sm mt-1 text-indigo-900">{n.note}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div class="space-y-6">
          <div class="bg-white rounded-lg shadow overflow-hidden sticky top-6">
            <div class="px-6 py-4 bg-gray-50 border-b">
              <h3 class="font-medium text-gray-800">业务操作</h3>
            </div>
            <div class="p-6 space-y-3">
              {actions.length === 0 ? (
                <div class="text-center py-6 text-gray-500 text-sm">
                  {f.status === "archived"
                    ? "该处方流转单已归档"
                    : isHandler()
                    ? "暂无可执行操作"
                    : "您不是当前处理人，无法操作"}
                </div>
              ) : (
                actions.map((a) => (
                  <button
                    key={a.action}
                    onClick={() => openActionModal(a.action)}
                    class={`w-full py-2.5 px-4 rounded text-sm font-medium transition ${
                      a.type === "primary"
                        ? "bg-indigo-600 text-white hover:bg-indigo-700"
                        : a.type === "success"
                        ? "bg-green-600 text-white hover:bg-green-700"
                        : a.type === "warning"
                        ? "bg-orange-600 text-white hover:bg-orange-700"
                        : "bg-red-600 text-white hover:bg-red-700"
                    }`}
                  >
                    {a.label}
                  </button>
                ))
              )}

              <div class="pt-4 mt-4 border-t space-y-1.5">
                <div class="text-xs text-gray-600">
                  <span class="font-medium">当前状态：</span>
                  <span
                    class={`ml-1 px-1.5 py-0.5 rounded text-xs ${STATUS_COLORS[f.status]}`}
                  >
                    {STATUS_LABELS[f.status]}
                  </span>
                </div>
                <div class="text-xs text-gray-600">
                  <span class="font-medium">处理人：</span>
                  <span class="ml-1">{f.current_handler || "-"}</span>
                </div>
                <div class="text-xs text-gray-600">
                  <span class="font-medium">截止时间：</span>
                  <span
                    class={
                      f.urgency === "overdue"
                        ? "text-red-600 ml-1 font-medium"
                        : f.urgency === "warning"
                        ? "text-yellow-600 ml-1"
                        : "ml-1"
                    }
                  >
                    {formatDateTime(f.due_at)}
                  </span>
                </div>
                <div class="text-xs text-gray-600">
                  <span class="font-medium">资料：</span>
                  <span
                    class={
                      f.is_material_complete
                        ? "text-green-600 ml-1"
                        : "text-red-600 ml-1"
                    }
                  >
                    {f.is_material_complete ? "齐全" : "不齐全"}
                  </span>
                </div>
                <div class="text-xs text-gray-600">
                  <span class="font-medium">版本号：</span>
                  <span class="ml-1">v{f.version}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {showActionModal.value && (
        <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div class="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div class="px-6 py-4 border-b flex items-center justify-between">
              <h3 class="text-lg font-medium">
                {ACTION_LABELS[actionForm.value.action] || actionForm.value.action}
              </h3>
              <button
                onClick={() => (showActionModal.value = false)}
                class="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>
            <div class="px-6 py-4 space-y-4">
              {["correct", "resubmit", "submit", "supplement"].includes(
                actionForm.value.action
              ) && (
                <>
                  <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">
                      处方开具信息
                      <span class="text-red-500 ml-0.5">*</span>
                    </label>
                    <textarea
                      class="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      rows={2}
                      value={actionForm.value.prescription_info}
                      onChange={(e) =>
                        (actionForm.value = {
                          ...actionForm.value,
                          prescription_info: (e.target as HTMLTextAreaElement).value,
                        })
                      }
                      placeholder="例：感冒方：麻黄、桂枝、杏仁、甘草各10g"
                    />
                  </div>
                  <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">
                      煎药信息
                      <span class="text-red-500 ml-0.5">*</span>
                    </label>
                    <textarea
                      class="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      rows={2}
                      value={actionForm.value.decoction_info}
                      onChange={(e) =>
                        (actionForm.value = {
                          ...actionForm.value,
                          decoction_info: (e.target as HTMLTextAreaElement).value,
                        })
                      }
                      placeholder="例：水煎服，一日一剂"
                    />
                  </div>
                  <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">
                      配送信息
                      <span class="text-red-500 ml-0.5">*</span>
                    </label>
                    <textarea
                      class="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      rows={2}
                      value={actionForm.value.delivery_info}
                      onChange={(e) =>
                        (actionForm.value = {
                          ...actionForm.value,
                          delivery_info: (e.target as HTMLTextAreaElement).value,
                        })
                      }
                      placeholder="例：快递到付，地址北京市朝阳区"
                    />
                  </div>
                  <div class="text-xs text-amber-600 bg-amber-50 p-2.5 rounded">
                    ⚠ 处方开具、煎药配送信息必须全部齐全才能流转到下一环节，否则将停在异常队列
                  </div>
                </>
              )}

              {actionForm.value.action === "return" && (
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">
                    退回原因 <span class="text-red-500">*</span>
                  </label>
                  <textarea
                    class="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    rows={3}
                    value={actionForm.value.return_reason}
                    onChange={(e) =>
                      (actionForm.value = {
                        ...actionForm.value,
                        return_reason: (e.target as HTMLTextAreaElement).value,
                      })
                    }
                    placeholder="请详细说明退回原因，便于登记员或助理补正"
                  />
                </div>
              )}

              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">备注</label>
                <textarea
                  class="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  rows={2}
                  value={actionForm.value.remark}
                  onChange={(e) =>
                    (actionForm.value = {
                      ...actionForm.value,
                      remark: (e.target as HTMLTextAreaElement).value,
                    })
                  }
                  placeholder="可填写操作说明（非必填，后端将自动记录为「无备注」）"
                />
              </div>

              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">
                  证据材料 <span class="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  class="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  value={actionForm.value.evidence}
                  onChange={(e) =>
                    (actionForm.value = {
                      ...actionForm.value,
                      evidence: (e.target as HTMLInputElement).value,
                    })
                  }
                  placeholder="请提供操作证据：审批编号 / 附件链接 / 签字扫描件编号等"
                />
                <div class="text-xs text-gray-400 mt-1">
                  后端将强制校验，未提供证据将被拒绝
                </div>
              </div>

              <div class="text-xs text-gray-500 bg-gray-50 p-2.5 rounded space-y-0.5">
                <div>
                  <span class="font-medium">当前版本号：</span>v{f.version}
                  （后端将校验版本冲突）
                </div>
                <div>
                  <span class="font-medium">操作人：</span>
                  {currentUser.value?.name || "-"}（{currentUser.value?.username || "-"}）
                </div>
                <div>
                  <span class="font-medium">当前状态：</span>
                  {STATUS_LABELS[f.status]} → 将由后端计算下一状态
                </div>
              </div>
            </div>
            <div class="px-6 py-4 border-t flex justify-end gap-3">
              <button
                onClick={() => (showActionModal.value = false)}
                class="px-4 py-2 text-gray-700 bg-gray-100 rounded hover:bg-gray-200"
              >
                取消
              </button>
              <button
                onClick={executeAction}
                class="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 font-medium"
              >
                确认执行
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function InfoCell({
  label,
  value,
  mono,
}: {
  label: string;
  value: any;
  mono?: boolean;
}) {
  return (
    <div>
      <div class="text-xs text-gray-500 mb-1">{label}</div>
      <div class={`text-sm ${mono ? "font-mono" : ""} font-medium text-gray-800`}>
        {value || "-"}
      </div>
    </div>
  );
}

function MaterialBlock({
  title,
  value,
  complete,
}: {
  title: string;
  value: string;
  complete: boolean;
}) {
  return (
    <div>
      <div class="flex items-center gap-2 mb-1.5">
        <span
          class={`w-2 h-2 rounded-full ${complete ? "bg-green-500" : "bg-red-500"}`}
        ></span>
        <span class="text-xs font-medium text-gray-700">{title}</span>
        <span
          class={`text-xs ${complete ? "text-green-600" : "text-red-600"}`}
        >
          {complete ? "已填写" : "未填写"}
        </span>
      </div>
      <div
        class={`p-3 rounded text-sm ${
          complete ? "bg-green-50 text-gray-800" : "bg-red-50 text-gray-600"
        }`}
      >
        {value || <span class="text-gray-400 italic">（未填写）</span>}
      </div>
    </div>
  );
}
