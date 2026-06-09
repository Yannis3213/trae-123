import { useSignal, useSignalEffect } from "@preact/signals";
import {
  User,
  PrescriptionFlow,
  apiFetch,
  getCurrentUser,
  setCurrentUser,
  STATUS_LABELS,
  STATUS_COLORS,
  URGENCY_LABELS,
  URGENCY_COLORS,
  ROLE_LABELS,
  formatDateTime,
  BatchResult,
  PrescriptionStatus,
} from "../utils/api.ts";

export default function FlowListIsland() {
  const users = useSignal<User[]>([]);
  const currentUser = useSignal<User | null>(getCurrentUser());
  const flows = useSignal<PrescriptionFlow[]>([]);
  const loading = useSignal(true);
  const error = useSignal("");
  const statusFilter = useSignal("all");
  const urgencyFilter = useSignal("all");
  const selectedIds = useSignal<number[]>([]);
  const showBatchModal = useSignal(false);
  const batchAction = useSignal("");
  const batchRemark = useSignal("");
  const batchEvidence = useSignal("");
  const batchResults = useSignal<BatchResult[]>([]);
  const showBatchResults = useSignal(false);
  const showCreateModal = useSignal(false);
  const createForm = useSignal({
    patient_name: "",
    prescription_info: "",
    decoction_info: "",
    delivery_info: "",
  });
  const statistics = useSignal<any>({ to_confirm: 0, abnormal: 0, recheck: 0, total: 0, urgency: {} });

  useSignalEffect(() => {
    loadUsers();
    loadStatistics();
    loadFlows();
  });

  async function loadUsers() {
    try {
      users.value = await apiFetch<User[]>("/users");
      if (!currentUser.value && users.value.length > 0) {
        currentUser.value = users.value[0];
        setCurrentUser(currentUser.value);
      }
    } catch (e: any) {
      error.value = e.message;
    }
  }

  async function loadStatistics() {
    try {
      statistics.value = await apiFetch<any>("/statistics");
    } catch (_e) {
      // ignore
    }
  }

  async function loadFlows() {
    loading.value = true;
    error.value = "";
    try {
      const params = new URLSearchParams();
      if (statusFilter.value !== "all") params.set("status", statusFilter.value);
      if (urgencyFilter.value !== "all") params.set("urgency", urgencyFilter.value);
      const qs = params.toString();
      flows.value = await apiFetch<PrescriptionFlow[]>(
        qs ? `/flows?${qs}` : "/flows"
      );
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
      selectedIds.value = [];
      Promise.all([loadFlows(), loadStatistics()]);
    }
  }

  function toggleSelect(id: number) {
    if (selectedIds.value.includes(id)) {
      selectedIds.value = selectedIds.value.filter((x) => x !== id);
    } else {
      selectedIds.value = [...selectedIds.value, id];
    }
  }

  function toggleSelectAll() {
    if (selectedIds.value.length === flows.value.length) {
      selectedIds.value = [];
    } else {
      selectedIds.value = flows.value.map((f) => f.id);
    }
  }

  function openBatchModal(action: string) {
    batchAction.value = action;
    batchRemark.value = "";
    batchEvidence.value = "";
    showBatchModal.value = true;
  }

  async function executeBatch() {
    if (!batchAction.value) return;
    try {
      const res = await apiFetch<{ results: BatchResult[] }>("/flows/batch", {
        method: "POST",
        body: JSON.stringify({
          flow_ids: selectedIds.value,
          action: batchAction.value,
          remark: batchRemark.value,
          evidence: batchEvidence.value,
        }),
      });
      batchResults.value = res.results;
      showBatchResults.value = true;
      showBatchModal.value = false;
      selectedIds.value = [];
      await loadFlows();
      await loadStatistics();
    } catch (e: any) {
      error.value = e.message;
    }
  }

  async function createFlow() {
    try {
      await apiFetch("/flows", {
        method: "POST",
        body: JSON.stringify(createForm.value),
      });
      showCreateModal.value = false;
      createForm.value = {
        patient_name: "",
        prescription_info: "",
        decoction_info: "",
        delivery_info: "",
      };
      await loadFlows();
      await loadStatistics();
    } catch (e: any) {
      error.value = e.message;
    }
  }

  const groupedFlows = {
    to_confirm: flows.value.filter((f) => f.status === "to_confirm"),
    abnormal: flows.value.filter((f) => f.status === "abnormal"),
    recheck: flows.value.filter((f) => f.status === "recheck"),
    others: flows.value.filter(
      (f) => !["to_confirm", "abnormal", "recheck"].includes(f.status)
    ),
  };

  const canCreate = currentUser.value &&
    ["registrar", "assistant"].includes(currentUser.value.role);

  const canBatchProcess = currentUser.value &&
    selectedIds.value.length > 0 &&
    ["registrar", "review_supervisor", "archivist", "assistant", "physician", "pharmacist"]
      .includes(currentUser.value.role);

  return (
    <div>
      {error.value && (
        <div class="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
          {error.value}
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

          <div class="flex items-center gap-2">
            {canCreate && (
              <button
                onClick={() => (showCreateModal.value = true)}
                class="px-4 py-2 bg-indigo-600 text-white rounded-md text-sm font-medium hover:bg-indigo-700"
              >
                + 登记处方流转单
              </button>
            )}
            <button
              onClick={() => loadFlows()}
              class="px-4 py-2 bg-gray-100 text-gray-700 rounded-md text-sm hover:bg-gray-200"
            >
              刷新
            </button>
          </div>
        </div>

        <div class="mt-4 grid grid-cols-2 md:grid-cols-5 gap-3">
          <div class="p-3 bg-yellow-50 rounded border border-yellow-200">
            <div class="text-xs text-yellow-700">待确认</div>
            <div class="text-2xl font-bold text-yellow-800">{statistics.value.to_confirm || 0}</div>
          </div>
          <div class="p-3 bg-red-50 rounded border border-red-200">
            <div class="text-xs text-red-700">异常</div>
            <div class="text-2xl font-bold text-red-800">{statistics.value.abnormal || 0}</div>
          </div>
          <div class="p-3 bg-purple-50 rounded border border-purple-200">
            <div class="text-xs text-purple-700">已复查</div>
            <div class="text-2xl font-bold text-purple-800">{statistics.value.recheck || 0}</div>
          </div>
          <div class="p-3 bg-green-50 rounded border border-green-200">
            <div class="text-xs text-green-700">总数</div>
            <div class="text-2xl font-bold text-green-800">{statistics.value.total || 0}</div>
          </div>
          <div class="p-3 bg-gray-50 rounded border">
            <div class="text-xs text-gray-600">到期预警</div>
            <div class="flex gap-2 mt-1 text-xs">
              <span class="text-green-600">正常 {statistics.value.urgency?.normal || 0}</span>
              <span class="text-yellow-600">临期 {statistics.value.urgency?.warning || 0}</span>
              <span class="text-red-600">逾期 {statistics.value.urgency?.overdue || 0}</span>
            </div>
          </div>
        </div>

        <div class="mt-4 flex flex-wrap items-center gap-3">
          <span class="text-sm text-gray-600">状态筛选：</span>
          <select
            class="px-3 py-1.5 border border-gray-300 rounded text-sm"
            value={statusFilter.value}
            onChange={(e) => {
              statusFilter.value = (e.target as HTMLSelectElement).value;
              loadFlows();
            }}
          >
            <option value="all">全部</option>
            <option value="to_confirm">待确认</option>
            <option value="abnormal">异常</option>
            <option value="processing">办理中</option>
            <option value="recheck">待复查</option>
            <option value="returned">已退回</option>
            <option value="archived">已归档</option>
          </select>
          <span class="text-sm text-gray-600 ml-4">预警筛选：</span>
          <select
            class="px-3 py-1.5 border border-gray-300 rounded text-sm"
            value={urgencyFilter.value}
            onChange={(e) => {
              urgencyFilter.value = (e.target as HTMLSelectElement).value;
              loadFlows();
            }}
          >
            <option value="all">全部</option>
            <option value="normal">正常</option>
            <option value="warning">临期</option>
            <option value="overdue">逾期</option>
          </select>
        </div>

        {canBatchProcess && (
          <div class="mt-4 flex flex-wrap items-center gap-2 p-3 bg-blue-50 rounded border border-blue-200">
            <span class="text-sm text-blue-700">已选 {selectedIds.value.length} 条</span>
            {currentUser.value && ["registrar", "assistant"].includes(currentUser.value.role) && (
              <>
                <button onClick={() => openBatchModal("submit")} class="px-3 py-1 bg-blue-600 text-white rounded text-sm">批量提交</button>
                <button onClick={() => openBatchModal("correct")} class="px-3 py-1 bg-green-600 text-white rounded text-sm">批量补正</button>
              </>
            )}
            {currentUser.value && ["review_supervisor", "physician"].includes(currentUser.value.role) && (
              <>
                <button onClick={() => openBatchModal("approve")} class="px-3 py-1 bg-blue-600 text-white rounded text-sm">批量审批</button>
                <button onClick={() => openBatchModal("return")} class="px-3 py-1 bg-orange-600 text-white rounded text-sm">批量退回</button>
              </>
            )}
            {currentUser.value && ["physician"].includes(currentUser.value.role) && (
              <button onClick={() => openBatchModal("process")} class="px-3 py-1 bg-indigo-600 text-white rounded text-sm">批量办理</button>
            )}
            {currentUser.value && ["archivist", "pharmacist"].includes(currentUser.value.role) && (
              <button onClick={() => openBatchModal("archive")} class="px-3 py-1 bg-green-600 text-white rounded text-sm">批量归档</button>
            )}
          </div>
        )}
      </div>

      {loading.value ? (
        <div class="text-center py-12 text-gray-500">加载中...</div>
      ) : (
        <div class="space-y-6">
          {["to_confirm", "abnormal", "recheck"].map((groupKey) => {
            const groupName: Record<string, string> = {
              to_confirm: "待确认队列",
              abnormal: "异常队列",
              recheck: "待复查/已复查队列",
            };
            const groupFlows =
              groupKey === "to_confirm"
                ? groupedFlows.to_confirm
                : groupKey === "abnormal"
                ? groupedFlows.abnormal
                : groupedFlows.recheck;

            if (urgencyFilter.value !== "all" || statusFilter.value !== "all") {
              return null;
            }

            return (
              <div key={groupKey} class="bg-white rounded-lg shadow overflow-hidden">
                <div class="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                  <h3 class="font-medium text-gray-800">{groupName[groupKey]}</h3>
                  <span class="text-sm text-gray-500">{groupFlows.length} 条</span>
                </div>
                {groupFlows.length === 0 ? (
                  <div class="p-6 text-center text-gray-500">暂无数据</div>
                ) : (
                  <FlowTable
                    flows={groupFlows}
                    selectedIds={selectedIds.value}
                    onToggle={toggleSelect}
                    onToggleAll={toggleSelectAll}
                    allSelected={groupFlows.every((f) => selectedIds.value.includes(f.id))}
                  />
                )}
              </div>
            );
          })}

          {(urgencyFilter.value !== "all" || statusFilter.value !== "all" || groupedFlows.others.length > 0) && (
            <div class="bg-white rounded-lg shadow overflow-hidden">
              <div class="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                <h3 class="font-medium text-gray-800">
                  {urgencyFilter.value !== "all" || statusFilter.value !== "all"
                    ? "筛选结果"
                    : "其他队列"}
                </h3>
                <span class="text-sm text-gray-500">{flows.value.length} 条</span>
              </div>
              {flows.value.length === 0 ? (
                <div class="p-6 text-center text-gray-500">暂无数据</div>
              ) : (
                <FlowTable
                  flows={flows.value}
                  selectedIds={selectedIds.value}
                  onToggle={toggleSelect}
                  onToggleAll={toggleSelectAll}
                  allSelected={flows.value.every((f) => selectedIds.value.includes(f.id))}
                />
              )}
            </div>
          )}
        </div>
      )}

      {showCreateModal.value && (
        <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div class="bg-white rounded-lg shadow-xl w-full max-w-lg">
            <div class="px-6 py-4 border-b">
              <h3 class="text-lg font-medium">登记处方流转单</h3>
            </div>
            <div class="px-6 py-4 space-y-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">患者姓名 *</label>
                <input
                  type="text"
                  class="w-full px-3 py-2 border border-gray-300 rounded"
                  value={createForm.value.patient_name}
                  onChange={(e) =>
                    (createForm.value = {
                      ...createForm.value,
                      patient_name: (e.target as HTMLInputElement).value,
                    })
                  }
                />
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">处方开具信息</label>
                <textarea
                  class="w-full px-3 py-2 border border-gray-300 rounded"
                  rows={2}
                  value={createForm.value.prescription_info}
                  onChange={(e) =>
                    (createForm.value = {
                      ...createForm.value,
                      prescription_info: (e.target as HTMLTextAreaElement).value,
                    })
                  }
                  placeholder="例：感冒方：麻黄、桂枝、杏仁、甘草各10g"
                />
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">煎药信息</label>
                <textarea
                  class="w-full px-3 py-2 border border-gray-300 rounded"
                  rows={2}
                  value={createForm.value.decoction_info}
                  onChange={(e) =>
                    (createForm.value = {
                      ...createForm.value,
                      decoction_info: (e.target as HTMLTextAreaElement).value,
                    })
                  }
                  placeholder="例：水煎服，一日一剂"
                />
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">配送信息</label>
                <textarea
                  class="w-full px-3 py-2 border border-gray-300 rounded"
                  rows={2}
                  value={createForm.value.delivery_info}
                  onChange={(e) =>
                    (createForm.value = {
                      ...createForm.value,
                      delivery_info: (e.target as HTMLTextAreaElement).value,
                    })
                  }
                  placeholder="例：快递到付，地址北京市朝阳区"
                />
              </div>
              <div class="text-xs text-amber-600 bg-amber-50 p-2 rounded">
                提示：处方开具、煎药配送信息不齐全时，流转单将停在异常队列
              </div>
            </div>
            <div class="px-6 py-4 border-t flex justify-end gap-3">
              <button
                onClick={() => (showCreateModal.value = false)}
                class="px-4 py-2 text-gray-700 bg-gray-100 rounded hover:bg-gray-200"
              >
                取消
              </button>
              <button
                onClick={createFlow}
                class="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700"
              >
                提交登记
              </button>
            </div>
          </div>
        </div>
      )}

      {showBatchModal.value && (
        <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div class="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div class="px-6 py-4 border-b">
              <h3 class="text-lg font-medium">批量处理 ({selectedIds.value.length} 条)</h3>
            </div>
            <div class="px-6 py-4 space-y-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">备注</label>
                <textarea
                  class="w-full px-3 py-2 border border-gray-300 rounded"
                  rows={2}
                  value={batchRemark.value}
                  onChange={(e) => (batchRemark.value = (e.target as HTMLTextAreaElement).value)}
                />
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">证据材料 *</label>
                <input
                  type="text"
                  class="w-full px-3 py-2 border border-gray-300 rounded"
                  value={batchEvidence.value}
                  onChange={(e) => (batchEvidence.value = (e.target as HTMLInputElement).value)}
                  placeholder="请提供操作证据（如审批编号、附件链接等）"
                />
              </div>
              {batchAction.value === "return" && (
                <div class="text-xs text-red-600 bg-red-50 p-2 rounded">
                  退回操作将把单据打回登记员处补正
                </div>
              )}
            </div>
            <div class="px-6 py-4 border-t flex justify-end gap-3">
              <button
                onClick={() => (showBatchModal.value = false)}
                class="px-4 py-2 text-gray-700 bg-gray-100 rounded hover:bg-gray-200"
              >
                取消
              </button>
              <button
                onClick={executeBatch}
                class="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700"
              >
                确认批量处理
              </button>
            </div>
          </div>
        </div>
      )}

      {showBatchResults.value && (
        <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div class="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[80vh] overflow-hidden">
            <div class="px-6 py-4 border-b">
              <h3 class="text-lg font-medium">批量处理结果</h3>
            </div>
            <div class="px-6 py-4 overflow-y-auto max-h-96">
              <div class="space-y-2">
                {batchResults.value.map((r) => (
                  <div
                    key={r.flow_id}
                    class={`p-3 rounded border ${
                      r.success
                        ? "bg-green-50 border-green-200 text-green-800"
                        : "bg-red-50 border-red-200 text-red-800"
                    }`}
                  >
                    <div class="font-medium text-sm">
                      {r.flow_no || `#${r.flow_id}`} - {r.success ? "成功" : "失败"}
                    </div>
                    <div class="text-xs mt-1">{r.message}</div>
                  </div>
                ))}
              </div>
            </div>
            <div class="px-6 py-4 border-t flex justify-end">
              <button
                onClick={() => (showBatchResults.value = false)}
                class="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700"
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface FlowTableProps {
  flows: PrescriptionFlow[];
  selectedIds: number[];
  onToggle: (id: number) => void;
  onToggleAll: () => void;
  allSelected: boolean;
}

function FlowTable({ flows, selectedIds, onToggle, onToggleAll, allSelected }: FlowTableProps) {
  return (
    <div class="overflow-x-auto">
      <table class="w-full text-sm">
        <thead class="bg-gray-50 text-gray-600 text-xs uppercase">
          <tr>
            <th class="px-3 py-2 text-left w-10">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={onToggleAll}
              />
            </th>
            <th class="px-3 py-2 text-left">流转单号</th>
            <th class="px-3 py-2 text-left">患者</th>
            <th class="px-3 py-2 text-left">状态</th>
            <th class="px-3 py-2 text-left">预警</th>
            <th class="px-3 py-2 text-left">当前处理人</th>
            <th class="px-3 py-2 text-left">资料齐全</th>
            <th class="px-3 py-2 text-left">截止时间</th>
            <th class="px-3 py-2 text-left">操作</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100">
          {flows.map((f) => (
            <tr key={f.id} class="hover:bg-gray-50">
              <td class="px-3 py-2">
                <input
                  type="checkbox"
                  checked={selectedIds.includes(f.id)}
                  onChange={() => onToggle(f.id)}
                />
              </td>
              <td class="px-3 py-2 font-mono text-xs">{f.flow_no}</td>
              <td class="px-3 py-2 font-medium">{f.patient_name}</td>
              <td class="px-3 py-2">
                <span
                  class={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                    STATUS_COLORS[f.status as PrescriptionStatus]
                  }`}
                >
                  {STATUS_LABELS[f.status as PrescriptionStatus]}
                </span>
              </td>
              <td class="px-3 py-2">
                <span class="flex items-center gap-1">
                  <span
                    class={`w-2 h-2 rounded-full ${URGENCY_COLORS[f.urgency]}`}
                  ></span>
                  <span class="text-xs">{URGENCY_LABELS[f.urgency]}</span>
                </span>
              </td>
              <td class="px-3 py-2 text-gray-600">
                {f.current_handler}
                <div class="text-xs text-gray-400">
                  {ROLE_LABELS[f.current_role] || f.current_role}
                </div>
              </td>
              <td class="px-3 py-2">
                {f.is_material_complete ? (
                  <span class="text-green-600 text-xs">✓ 齐全</span>
                ) : (
                  <span class="text-red-600 text-xs">✗ 缺失</span>
                )}
              </td>
              <td class="px-3 py-2 text-gray-600 text-xs">{formatDateTime(f.due_at)}</td>
              <td class="px-3 py-2">
                <a
                  href={`/flows/${f.id}`}
                  class="text-indigo-600 hover:text-indigo-800 text-sm"
                >
                  查看详情
                </a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
