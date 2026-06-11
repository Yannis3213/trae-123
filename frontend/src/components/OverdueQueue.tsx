import { createSignal, Show, For, onMount } from 'solid-js';
import { api, STATUS_LABELS, OVERDUE_LABELS, getErrorMessage } from '../lib/api';

export default function OverdueQueue() {
  const [data, setData] = createSignal<any>({ nearExpiry: [], overdue: [], nearExpiryCount: 0, overdueCount: 0 });
  const [loading, setLoading] = createSignal(true);
  const [selectedIds, setSelectedIds] = createSignal<Set<string>>(new Set());
  const [batchResult, setBatchResult] = createSignal<any>(null);
  const [batchLoading, setBatchLoading] = createSignal(false);
  const [activeTab, setActiveTab] = createSignal<'overdue' | 'nearExpiry'>('overdue');

  const loadData = async () => {
    setLoading(true);
    try {
      const result: any = await api.overdueQueue.list();
      setData(result);
    } catch (err) {
      console.error('加载到期预警失败', err);
    } finally {
      setLoading(false);
    }
  };

  onMount(loadData);

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds());
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const batchAdvance = async () => {
    const ids = Array.from(selectedIds());
    if (ids.length === 0) return;
    setBatchLoading(true);
    try {
      const result: any = await api.overdueQueue.batchAdvance({
        taskIds: ids,
        evidence: '逾期批量自动推进',
      });
      setBatchResult(result);
      setSelectedIds(new Set());
      await loadData();
    } catch (err: any) {
      setBatchResult({ error: true, message: getErrorMessage(err) });
    } finally {
      setBatchLoading(false);
    }
  };

  const currentList = () => activeTab() === 'overdue' ? data().overdue : data().nearExpiry;

  return (
    <div class="p-6">
      <div class="flex items-center justify-between mb-6">
        <div>
          <h2 class="text-xl font-bold text-gray-900">到期预警队列</h2>
          <p class="text-sm text-gray-500 mt-1">节点超时按责任人计算</p>
        </div>
        <Show when={selectedIds().size > 0}>
          <button class="btn-warning" onClick={batchAdvance} disabled={batchLoading()}>
            逾期批量推进 ({selectedIds().size})
          </button>
        </Show>
      </div>

      <div class="grid grid-cols-2 gap-4 mb-6">
        <button
          class={`p-4 rounded-lg border-2 text-center transition-all ${
            activeTab() === 'overdue' ? 'border-danger-400 bg-danger-50' : 'border-gray-200 bg-white'
          }`}
          onClick={() => setActiveTab('overdue')}
        >
          <div class="text-3xl font-bold text-danger-600">{data().overdueCount}</div>
          <div class="text-sm text-danger-600 mt-1">🔴 逾期</div>
        </button>
        <button
          class={`p-4 rounded-lg border-2 text-center transition-all ${
            activeTab() === 'nearExpiry' ? 'border-warning-400 bg-warning-50' : 'border-gray-200 bg-white'
          }`}
          onClick={() => setActiveTab('nearExpiry')}
        >
          <div class="text-3xl font-bold text-warning-600">{data().nearExpiryCount}</div>
          <div class="text-sm text-warning-600 mt-1">🟡 临期</div>
        </button>
      </div>

      <Show when={batchResult()}>
        <div class="mb-4 p-4 card">
          <div class="flex items-center justify-between mb-2">
            <span class="text-sm font-medium">批量推进结果</span>
            <button class="text-xs text-gray-400" onClick={() => setBatchResult(null)}>关闭</button>
          </div>
          <Show when={!batchResult()?.error} fallback={<p class="text-sm text-danger-600">{batchResult()?.message}</p>}>
            <div class="flex gap-4 text-sm mb-2">
              <span class="text-primary-600">成功: {batchResult().successCount}</span>
              <span class="text-danger-600">失败: {batchResult().failCount}</span>
            </div>
            <div class="space-y-1 max-h-40 overflow-y-auto">
              <For each={batchResult().results || []}>
                {(r: any) => (
                  <div class={`text-xs flex items-center gap-2 ${r.success ? 'text-primary-600' : 'text-danger-600'}`}>
                    <span>{r.success ? '✅' : '❌'}</span>
                    <span>{r.taskNo}</span>
                    <Show when={!r.success}><span>- {r.reason}</span></Show>
                  </div>
                )}
              </For>
            </div>
          </Show>
        </div>
      </Show>

      <Show when={!loading()} fallback={<div class="text-center text-gray-400 py-8">加载中...</div>}>
        <div class="card">
          <Show when={currentList().length > 0} fallback={<div class="p-8 text-center text-gray-400">暂无{activeTab() === 'overdue' ? '逾期' : '临期'}任务</div>}>
            <table class="w-full">
              <thead>
                <tr class="border-b border-gray-100">
                  <th class="px-4 py-3 text-left">
                    <input type="checkbox" class="rounded" />
                  </th>
                  <th class="px-4 py-3 text-left text-xs font-medium text-gray-500">任务编号</th>
                  <th class="px-4 py-3 text-left text-xs font-medium text-gray-500">任务标题</th>
                  <th class="px-4 py-3 text-left text-xs font-medium text-gray-500">当前状态</th>
                  <th class="px-4 py-3 text-left text-xs font-medium text-gray-500">责任人</th>
                  <th class="px-4 py-3 text-left text-xs font-medium text-gray-500">截止日期</th>
                  <th class="px-4 py-3 text-left text-xs font-medium text-gray-500">到期</th>
                </tr>
              </thead>
              <tbody>
                <For each={currentList()}>
                  {(item: any) => (
                    <tr class="border-b border-gray-50 hover:bg-gray-50">
                      <td class="px-4 py-3">
                        <input type="checkbox" checked={selectedIds().has(item.id)} onChange={() => toggleSelect(item.id)} class="rounded" />
                      </td>
                      <td class="px-4 py-3 text-sm font-mono">{item.taskNo}</td>
                      <td class="px-4 py-3 text-sm font-medium">{item.title}</td>
                      <td class="px-4 py-3 text-sm">{item.statusLabel}</td>
                      <td class="px-4 py-3 text-sm">{item.assigneeName || '-'}</td>
                      <td class="px-4 py-3 text-sm">{item.deadline}</td>
                      <td class="px-4 py-3">
                        <span class={`badge ${item.overdueStatus === 'overdue' ? 'bg-danger-100 text-danger-700' : 'bg-warning-100 text-warning-700'}`}>
                          {item.overdueStatusLabel}
                        </span>
                        <span class="text-xs text-gray-400 ml-1">
                          {item.daysRemaining > 0 ? `剩${item.daysRemaining}天` : `逾${Math.abs(item.daysRemaining)}天`}
                        </span>
                      </td>
                    </tr>
                  )}
                </For>
              </tbody>
            </table>
          </Show>
        </div>
      </Show>
    </div>
  );
}
