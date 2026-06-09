import { useSignal, useSignalEffect } from "@preact/signals";
import {
  User,
  PrescriptionFlow,
  ProcessRecord,
  AbnormalReason,
  apiFetch,
  getCurrentUser,
  setCurrentUser,
  STATUS_LABELS,
  STATUS_COLORS,
  URGENCY_LABELS,
  URGENCY_COLORS,
  ROLE_LABELS,
  formatDateTime,
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
    loadData();
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

  async function loadData() {
    loading.value = true;
    error.value = "";
    try {
      const res: any = await apiFetch(`/flows/${id}`);
      flow.value = res.flow;
      records.value = res.process_records || [];
      abnormalReasons.value = res.abnormal_reasons || [];
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

  function canHandle(): boolean {
    if (!currentUser.value || !flow.value) return false;
    const status = flow.value.status;
    const role = currentUser.value.role;
    const handler = flow.value.current_handler;

    if (handler && handler !== currentUser.value.username) return false;

    const handlerRoles: Record<string, string[]> = {
      draft: ["registrar", "assistant"],
      returned: ["registrar", "assistant"],
      abnormal: ["assistant", "registrar"],
      to_confirm: ["review_supervisor", "physician"],
      processing: ["physician", "review_supervisor"],
      recheck: ["archivist", "pharmacist"],
    };

    return (handlerRoles[status] || []).includes(role);
  }

  function getAvailableActions(): { action: string; label: string; type: string }[] {
    if (!flow.value || !canHandle()) return [];
    const status = flow.value.status;
    switch (status) {
      case "draft":
        return [{ action: "submit", label: "提交审核", type: "primary" }];
      case "returned":
        return [
          { action: "resubmit", label: "补正后重新提交", type: "primary" },
          { action: "correct", label: "仅补正资料", type: "success" },
        ];
      case "abnormal":
        return [
          { action: "correct", label: "补正资料", type: "primary" },
          { action: "submit", label: "重新提交", type: "primary" },
        ];
      case "to_confirm":
        return [
          { action: "approve", label: "审批通过", type: "primary" },
          { action: "return", label: "退回补正", type: "warning" },
        ];
      case "processing":
        return [
          { action: "process", label: "办理完成", type: "primary" },
          { action: "return", label: "退回", type: "warning" },
        ];
      case "recheck":
        return [
          { action: "archive", label: "复核归档", type: "primary" },
          { action: "return", label: "退回重新办理", type: "warning" },
        ];
      default:
        return [];
    }
  }

  function openActionModal(action: string) {
    actionForm.value = {
      action,
      remark: "",
      evidence: "",
      return_reason: "",
      prescription_info: flow.value?.prescription_info || "",
      decoction_info: flow.value?.decoction_info || "",
      delivery_info: flow.value?.delivery_info || "",
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
      if (
        ["correct", "resubmit", "submit"].includes(actionForm.value.action)
      ) {
        body.prescription_info = actionForm.value.prescription_info;
        body.decoction_info = actionForm.value.decoction_info;
        body.delivery_info = actionForm.value.delivery_info;
      }

      await apiFetch(`/flows/${id}/process`, {
        method: "POST",
        body: JSON.stringify(body),
      });

      showActionModal.value = false;
      successMsg.value = "处理成功！";
      setTimeout(() => (successMsg.value = ""), 3000);
      await loadData();
    } catch (e: any) {
      error.value = e.message;
      setTimeout(() => (error.value = ""), 5000);
    }
  }

  if (loading.value) {
    return <div class="text-center py-12 text-gray-500">加载中...</div>;
  }

  if (!flow.value) {
    return (
      <div class="bg-white rounded-lg shadow p-8 text-center">
        <p class="text-red-600">{error.value || "处方流转单不存在"}</p>
        <a href="/" class="text-indigo-600 mt-4 inline-block">
          返回列表
        </a>
      </div>
    );
  }

  const actions = getAvailableActions();
  const f = flow.value;

  return (
    <div>
      {error.value && (
        <div class="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
          {error.value}
        </div>
      )}
      {successMsg.value && (
        <div class="mb-4 p-3 bg-green-50 border border-green-200 rounded text-green-700 text-sm">
          {successMsg.value}
        </div>
      )}

      <div class="bg-white rounded-lg shadow p-4 mb-6">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <span class="text-sm font-medium text-gray-700">当前角色：</span>
            <select
              class="px-3 py-2 border border-gray-300 rounded-md text-sm"
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
          <div class="text-sm text-gray-500">
            {canHandle() ? (
              <span class="text-green-600">✓ 您是当前处理人</span>
            ) : f.current_handler && currentUser.value ? (
              <span class="text-amber-600">
                ⚠ 当前处理人：{f.current_handler}
                ({ROLE_LABELS[f.current_role] || f.current_role})
              </span>
            ) : null}
          </div>
        </div>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div class="lg:col-span-2 space-y-6">
          <div class="bg-white rounded-lg shadow overflow-hidden">
            <div class="px-6 py-4 bg-gray-50 border-b flex items-center justify-between">
              <h3 class="font-medium text-gray-800">处方流转单信息</h3>
              <div class="flex items-center gap-3">
                <span
                  class={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                    STATUS_COLORS[f.status as keyof typeof STATUS_COLORS]
                  }`}
                >
                  {STATUS_LABELS[f.status as keyof typeof STATUS_LABELS]}
                </span>
                <span class="flex items-center gap-1 text-xs">
                  <span
                    class={`w-2 h-2 rounded-full ${
                      URGENCY_COLORS[f.urgency as keyof typeof URGENCY_COLORS]
                    }`}
                  ></span>
                  {URGENCY_LABELS[f.urgency as keyof typeof URGENCY_LABELS]}
                </span>
              </div>
            </div>
            <div class="p-6 space-y-4">
              <div class="grid grid-cols-2 gap-4">
                <div>
                  <div class="text-xs text-gray-500 mb-1">流转单号</div>
                  <div class="font-mono font-medium">{f.flow_no}</div>
                </div>
                <div>
                  <div class="text-xs text-gray-500 mb-1">患者姓名</div>
                  <div class="font-medium">{f.patient_name}</div>
                </div>
                <div>
                  <div class="text-xs text-gray-500 mb-1">版本号</div>
                  <div>v{f.version}</div>
                </div>
                <div>
                  <div class="text-xs text-gray-500 mb-1">资料齐全</div>
                  <div>
                    {f.is_material_complete ? (
                      <span class="text-green-600">✓ 齐全</span>
                    ) : (
                      <span class="text-red-600">✗ 不齐全</span>
                    )}
                  </div>
                </div>
                <div>
                  <div class="text-xs text-gray-500 mb-1">创建人</div>
                  <div>{f.created_by}</div>
                </div>
                <div>
                  <div class="text-xs text-gray-500 mb-1">创建时间</div>
                  <div>{formatDateTime(f.created_at)}</div>
                </div>
                <div>
                  <div class="text-xs text-gray-500 mb-1">更新时间</div>
                  <div>{formatDateTime(f.updated_at)}</div>
                </div>
                <div>
                  <div class="text-xs text-gray-500 mb-1">截止时间</div>
                  <div
                    class={
                      f.urgency === "overdue"
                        ? "text-red-600 font-medium"
                        : f.urgency === "warning"
                        ? "text-yellow-600"
                        : ""
                    }
                  >
                    {formatDateTime(f.due_at)}
                  </div>
                </div>
              </div>

              <div class="pt-4 border-t">
                <div class="text-xs text-gray-500 mb-1">处方开具信息</div>
                <div class="bg-gray-50 p-3 rounded text-sm">
                  {f.prescription_info || <span class="text-gray-400">未填写</span>}
                </div>
              </div>
              <div>
                <div class="text-xs text-gray-500 mb-1">煎药信息</div>
                <div class="bg-gray-50 p-3 rounded text-sm">
                  {f.decoction_info || <span class="text-gray-400">未填写</span>}
                </div>
              </div>
              <div>
                <div class="text-xs text-gray-500 mb-1">配送信息</div>
                <div class="bg-gray-50 p-3 rounded text-sm">
                  {f.delivery_info || <span class="text-gray-400">未填写</span>}
                </div>
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
            <div class="px-6 py-4 bg-gray-50 border-b">
              <h3 class="font-medium text-gray-800">异常/补正记录</h3>
            </div>
            <div class="p-6">
              {abnormalReasons.value.length === 0 ? (
                <div class="text-center text-gray-500 py-4 text-sm">
                  暂无异常记录
                </div>
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
                        <span
                          class={
                            r.type === "corrected"
                              ? "text-green-700"
                              : "text-red-700"
                          }
                        >
                          {r.type === "corrected" ? "✓ 已补正" : "✗ 异常"}
                        </span>
                        <span class="text-gray-500">
                          {r.operator} · {formatDateTime(r.created_at)}
                        </span>
                      </div>
                      <div
                        class={`text-sm mt-1 ${
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
            <div class="px-6 py-4 bg-gray-50 border-b">
              <h3 class="font-medium text-gray-800">审计轨迹 · 处理记录</h3>
            </div>
            <div class="p-6">
              {records.value.length === 0 ? (
                <div class="text-center text-gray-500 py-4 text-sm">
                  暂无处理记录
                </div>
              ) : (
                <div class="relative">
                  <div class="absolute left-3 top-2 bottom-2 w-0.5 bg-gray-200"></div>
                  <div class="space-y-4">
                    {records.value.map((r) => (
                      <div key={r.id} class="relative pl-8">
                        <div class="absolute left-1 top-1 w-5 h-5 rounded-full bg-white border-2 border-indigo-400"></div>
                        <div class="bg-gray-50 rounded p-3">
                          <div class="flex items-center justify-between text-xs">
                            <div>
                              <span class="font-medium text-indigo-700">
                                {getActionLabel(r.action)}
                              </span>
                              <span class="text-gray-500 mx-2">·</span>
                              <span class="text-gray-600">{r.operator}</span>
                              <span class="text-gray-400 mx-1">
                                ({ROLE_LABELS[r.operator_role] || r.operator_role})
                              </span>
                            </div>
                            <span class="text-gray-400">
                              {formatDateTime(r.created_at)}
                            </span>
                          </div>
                          {(r.from_status || r.to_status) && (
                            <div class="text-xs mt-1 text-gray-600">
                              {r.from_status && (
                                <span>
                                  {STATUS_LABELS[
                                    r.from_status as keyof typeof STATUS_LABELS
                                  ] || r.from_status}
                                </span>
                              )}
                              {r.from_status && r.to_status && (
                                <span class="mx-1">→</span>
                              )}
                              {r.to_status && (
                                <span class="font-medium">
                                  {STATUS_LABELS[
                                    r.to_status as keyof typeof STATUS_LABELS
                                  ] || r.to_status}
                                </span>
                              )}
                            </div>
                          )}
                          {r.remark && (
                            <div class="text-sm mt-2 text-gray-700">{r.remark}</div>
                          )}
                          {r.evidence && (
                            <div class="text-xs mt-1 text-gray-500">
                              证据: {r.evidence}
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
                    : canHandle()
                    ? "暂无可执行操作"
                    : "您不是当前处理人，无法操作"}
                </div>
              ) : (
                actions.map((a) => (
                  <button
                    key={a.action}
                    onClick={() => openActionModal(a.action)}
                    class={`w-full py-2.5 px-4 rounded text-sm font-medium ${
                      a.type === "primary"
                        ? "bg-indigo-600 text-white hover:bg-indigo-700"
                        : a.type === "success"
                        ? "bg-green-600 text-white hover:bg-green-700"
                        : "bg-orange-600 text-white hover:bg-orange-700"
                    }`}
                  >
                    {a.label}
                  </button>
                ))
              )}

              <div class="pt-4 border-t text-xs text-gray-500 space-y-1">
                <div>
                  <span class="font-medium">当前状态：</span>
                  {STATUS_LABELS[f.status as keyof typeof STATUS_LABELS]}
                </div>
                <div>
                  <span class="font-medium">处理人：</span>
                  {f.current_handler || "-"}
                </div>
                <div>
                  <span class="font-medium">截止时间：</span>
                  {formatDateTime(f.due_at)}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {showActionModal.value && (
        <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div class="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div class="px-6 py-4 border-b">
              <h3 class="text-lg font-medium">
                {getActionLabel(actionForm.value.action)}
              </h3>
            </div>
            <div class="px-6 py-4 space-y-4">
              {["correct", "resubmit", "submit"].includes(actionForm.value.action) && (
                <>
                  <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">
                      处方开具信息
                    </label>
                    <textarea
                      class="w-full px-3 py-2 border border-gray-300 rounded"
                      rows={2}
                      value={actionForm.value.prescription_info}
                      onChange={(e) =>
                        (actionForm.value = {
                          ...actionForm.value,
                          prescription_info: (e.target as HTMLTextAreaElement)
                            .value,
                        })
                      }
                    />
                  </div>
                  <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">
                      煎药信息
                    </label>
                    <textarea
                      class="w-full px-3 py-2 border border-gray-300 rounded"
                      rows={2}
                      value={actionForm.value.decoction_info}
                      onChange={(e) =>
                        (actionForm.value = {
                          ...actionForm.value,
                          decoction_info: (e.target as HTMLTextAreaElement)
                            .value,
                        })
                      }
                    />
                  </div>
                  <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">
                      配送信息
                    </label>
                    <textarea
                      class="w-full px-3 py-2 border border-gray-300 rounded"
                      rows={2}
                      value={actionForm.value.delivery_info}
                      onChange={(e) =>
                        (actionForm.value = {
                          ...actionForm.value,
                          delivery_info: (e.target as HTMLTextAreaElement).value,
                        })
                      }
                    />
                  </div>
                  <div class="text-xs text-amber-600 bg-amber-50 p-2 rounded">
                    处方开具、煎药配送信息必须全部齐全才能流转到下一环节
                  </div>
                </>
              )}

              {actionForm.value.action === "return" && (
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">
                    退回原因 *
                  </label>
                  <textarea
                    class="w-full px-3 py-2 border border-gray-300 rounded"
                    rows={3}
                    value={actionForm.value.return_reason}
                    onChange={(e) =>
                      (actionForm.value = {
                        ...actionForm.value,
                        return_reason: (e.target as HTMLTextAreaElement).value,
                      })
                    }
                    placeholder="请详细说明退回原因，便于登记员补正"
                  />
                </div>
              )}

              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">备注</label>
                <textarea
                  class="w-full px-3 py-2 border border-gray-300 rounded"
                  rows={2}
                  value={actionForm.value.remark}
                  onChange={(e) =>
                    (actionForm.value = {
                      ...actionForm.value,
                      remark: (e.target as HTMLTextAreaElement).value,
                    })
                  }
                />
              </div>

              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">
                  证据材料 *
                </label>
                <input
                  type="text"
                  class="w-full px-3 py-2 border border-gray-300 rounded"
                  value={actionForm.value.evidence}
                  onChange={(e) =>
                    (actionForm.value = {
                      ...actionForm.value,
                      evidence: (e.target as HTMLInputElement).value,
                    })
                  }
                  placeholder="请提供操作证据（审批编号、附件链接等）"
                />
                <div class="text-xs text-gray-400 mt-1">
                  后端将校验证据，没有证据将被拒绝
                </div>
              </div>

              <div class="text-xs text-gray-500 bg-gray-50 p-2 rounded">
                当前版本号：v{f.version}
                <br />
                后端将进行版本校验、角色校验、状态校验和超时校验
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
                class="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700"
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

function getActionLabel(action: string): string {
  const labels: Record<string, string> = {
    create: "创建",
    submit: "提交审核",
    resubmit: "补正后重新提交",
    approve: "审批通过",
    process: "办理完成",
    return: "退回补正",
    correct: "补正资料",
    supplement: "补充资料",
    archive: "复核归档",
    complete: "完成",
  };
  return labels[action] || action;
}
