import { createSignal, Show, For, onMount } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import { api, STATUS_LABELS, getErrorMessage, getCurrentUser, STATUS_BADGE_CLASS, ACTION_LABELS } from '../lib/api';

type TabType = 'overdue' | 'nearExpiry' | 'normal';

const TAB_LABELS: Record<TabType, string> = {
  overdue: '已逾期',
  nearExpiry: '临期预警',
  normal: '正常进行',
};

const TAB_BADGE_CLASS: Record<TabType, string> = {
  overdue: 'bg-red-100 text-red-700 border-red-200',
  nearExpiry: 'bg-amber-100 text-amber-700 border-amber-200',
  normal: 'bg-green-100 text-green-700 border-green-200',
};

interface OverdueTaskItem {
  id: string;
  taskNo: string;
  title: string;
  status: string;
  statusLabel: string;
  assigneeId?: string;
  assigneeName?: string;
  assigneeRole?: string;
  deadline: string;
  overdueStatus: string;
  overdueStatusLabel: string;
  daysRemaining: number;
  version: number;
  nextAction?: string;
  nextActionLabel?: string;
  canAdvance: boolean;
  blockReason?: string;
}

interface BatchResultItem {
  taskId: string;
  taskNo: string;
  success: boolean;
  reason?: string;
  beforeStatus?: string;
  afterStatus?: string;
  action?: string;
}

export default function OverdueQueue() {
  const navigate = useNavigate();
  const user = getCurrentUser();
  const [loading, setLoading] = createSignal(true);
  const [data, setData] = createSignal<any>(null);
  const [activeTab, setActiveTab] = createSignal<TabType>('overdue');
  const [selectedIds, setSelectedIds] = createSignal<Set<string>>(new Set());
  const [batchLoading, setBatchLoading] = createSignal(false);
  const [batchResult, setBatchResult] = createSignal<any>(null);
  const [showAssigneeFilter, setShowAssigneeFilter] = createSignal(false);
  const [selectedAssignee, setSelectedAssignee] = createSignal<string>('');

  const loadData = async () => {
    setLoading(true);
    try {
      const result: any = await api.overdueQueue.list();
      setData(result);
    } catch (err: any) {
      console.error('加载到期预警失败:', err);
    } finally {
      setLoading(false);
    }
  };

  onMount(() => {
    loadData();
  });

  const currentTabData = () => {
    const d = data();
    if (!d) return { count: 0, items: [] };
    const key = activeTab() === 'nearExpiry' ? 'nearExpiry' : activeTab();
    return d[key] || { count: 0, items: [] };
  };

  const filteredItems = () => {
    let items = currentTabData().items as OverdueTaskItem[];
    if (selectedAssignee()) {
      items = items.filter((item: OverdueTaskItem) =>
        selectedAssignee() === 'unassigned'
          ? !item.assigneeId
          : item.assigneeId === selectedAssignee()
      );
    }
    return items;
  };

  const toggleSelect = (id: string, canAdvance: boolean) => {
    if (!canAdvance) return;
    const next = new Set(selectedIds());
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const selectAll = () => {
    const advanceable = filteredItems().filter((i: OverdueTaskItem) => i.canAdvance);
    if (advanceable.length === selectedIds().size) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(advanceable.map((i: OverdueTaskItem) => i.id)));
    }
  };

  const batchAdvance = async () => {
    const ids = Array.from(selectedIds());
    if (ids.length === 0) return;
    setBatchLoading(true);
    setBatchResult(null);
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

  const formatDaysRemaining = (days: number, overdueStatus: string) => {
    if (overdueStatus === 'overdue') {
      return `逾期 ${Math.abs(days)} 天`;
    } else if (overdueStatus === 'near_expiry') {
      return `还剩 ${days} 天`;
    }
    return `剩余 ${days} 天`;
  };

  return (
    <div class="p-6">
      <div class="mb-6">
        <h1 class="text-2xl font-bold text-gray-800 mb-2">到期预警</h1>
        <p class="text-gray-500">按截止日期对种植任务进行分组预警，支持批量推进</p>
      </div>

      <div class="flex gap-3 mb-6">
        <For each={(['overdue', 'nearExpiry', 'normal'] as TabType[])}>
          {(tab) => {
            const count = data()?.[tab === 'nearExpiry' ? 'nearExpiry' : tab]?.count || 0;
            return (
              <button
                class={`px-4 py-2 rounded-lg border-2 font-medium transition-all flex items-center gap-2 ${
                  activeTab() === tab
                    ? `${TAB_BADGE_CLASS[tab]} border-current bg-white`
                    : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
                }`}
                onClick={() => setActiveTab(tab)}
              >
                {TAB_LABELS[tab]}
                <span class={`px-2 py-0.5 rounded-full text-sm font-bold ${
                  activeTab() === tab ? TAB_BADGE_CLASS[tab] : 'bg-gray-100 text-gray-600'
                }`}>
                  {count}
                </span>
              </button>
            );
          }}
        </For>
      </div>

      <div class="flex justify-between items-center mb-4">
        <div class="flex items-center gap-3">
          <button
            class="text-sm text-green-600 hover:text-green-700 font-medium"
            onClick={() => setShowAssigneeFilter(!showAssigneeFilter())}
          >
            {showAssigneeFilter() ? '▼ 按责任人筛选' : '▶ 按责任人筛选'}
          </button>
          <span class="text-sm text-gray-500">
            共 {filteredItems().length} 条任务
          </span>
        </div>
        <div class="flex gap-2">
          <button
            class="btn btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={batchAdvance}
            disabled={batchLoading() || selectedIds().size === 0}
          >
            {batchLoading() ? '推进中...' : `批量推进 (${selectedIds().size})`}
          </button>
        </div>
      </div>

      <Show when={showAssigneeFilter()}>
        <div class="bg-gray-50 p-4 rounded-lg mb-4">
          <div class="flex flex-wrap gap-2">
            <button
              class={`px-3 py-1 text-sm rounded-full border ${
                !selectedAssignee()
                  ? 'bg-green-600 text-white border-green-600'
                  : 'bg-white border-gray-300 text-gray-600 hover:border-gray-400'
              }`}
              onClick={() => setSelectedAssignee('')}
            >
              全部
            </button>
            <For each={data()?.byAssignee || []}>
              {(a: any) => (
                <button
                  class={`px-3 py-1 text-sm rounded-full border ${
                    selectedAssignee() === a.assigneeId
                      ? 'bg-green-600 text-white border-green-600'
                      : 'bg-white border-gray-300 text-gray-600 hover:border-gray-400'
                  }`}
                  onClick={() => setSelectedAssignee(a.assigneeId)}
                >
                  {a.assigneeName}
                  <span class="ml-1 text-xs">
                    ({a.overdueCount || 0}逾期 / {a.nearExpiryCount || 0}临期 / {a.normalCount || 0}正常)
                  </span>
                </button>
              )}
            </For>
          </div>
        </div>
      </Show>

      <Show when={batchResult()}>
        <div class="bg-white border-2 rounded-lg p-4 mb-4 shadow-sm">
          <div class="flex justify-between items-center mb-3">
            <h3 class="font-bold text-gray-800">
              批量推进结果
            </h3>
            <button class="text-sm text-gray-400 hover:text-gray-600" onClick={() => setBatchResult(null)}>
              ✕
            </button>
          </div>
          <Show when={batchResult().error}>
            <p class="text-red-600">{batchResult().message}</p>
          </Show>
          <Show when={!batchResult().error}>
            <div class="flex gap-4 mb-3 text-sm">
              <span class="text-gray-600">共 <strong>{batchResult().total}</strong> 条</span>
              <span class="text-green-600">成功 <strong>{batchResult().successCount}</strong> 条</span>
              <span class="text-red-600">失败 <strong>{batchResult().failCount}</strong> 条</span>
            </div>
            <div class="max-h-64 overflow-y-auto">
              <table class="w-full text-sm">
                <thead class="bg-gray-50 sticky top-0">
                  <tr>
                    <th class="text-left py-2 px-3">任务编号</th>
                    <th class="text-left py-2 px-3">状态变化</th>
                    <th class="text-left py-2 px-3">结果</th>
                    <th class="text-left py-2 px-3">说明</th>
                  </tr>
                </thead>
                <tbody>
                  <For each={batchResult().results as BatchResultItem[]}>
                    {(item) => (
                      <tr class="border-t border-gray-100">
                        <td class="py-2 px-3 font-mono text-xs">{item.taskNo}</td>
                        <td class="py-2 px-3">
                          <span class="text-gray-500">
                            {item.beforeStatus && STATUS_LABELS[item.beforeStatus]}
                          </span>
                          <span class="mx-1 text-gray-300">→</span>
                          <span class={item.success ? 'text-green-600' : 'text-gray-500'}>
                            {item.success && item.afterStatus ? STATUS_LABELS[item.afterStatus] : STATUS_LABELS[item.beforeStatus || '']}
                          </span>
                        </td>
                        <td class="py-2 px-3">
                          <span class={item.success ? 'text-green-600' : 'text-red-600'}>
                            {item.success ? '✓ 成功' : '✗ 失败'}
                          </span>
                        </td>
                        <td class="py-2 px-3 text-gray-600 text-xs">
                          {item.success ? (item.action ? ACTION_LABELS[item.action] || item.action : '已推进') : item.reason}
                        </td>
                      </tr>
                    )}
                  </For>
                </tbody>
              </table>
            </div>
          </Show>
        </div>
      </Show>

      <div class="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <Show when={loading()}>
          <div class="p-12 text-center text-gray-400">加载中...</div>
        </Show>

        <Show when={!loading() && filteredItems().length === 0}>
          <div class="p-12 text-center text-gray-400">
            暂无{TAB_LABELS[activeTab()]}任务
          </div>
        </Show>

        <Show when={!loading() && filteredItems().length > 0}>
          <table class="w-full text-sm">
            <thead class="bg-gray-50 border-b border-gray-200">
              <tr>
                <th class="text-left py-3 px-4 w-10">
                  <input
                    type="checkbox"
                    checked={
                      filteredItems().filter((i: OverdueTaskItem) => i.canAdvance).length > 0 &&
                      filteredItems().filter((i: OverdueTaskItem) => i.canAdvance).length === selectedIds().size
                    }
                    onChange={selectAll}
                  />
                </th>
                <th class="text-left py-3 px-4">任务编号</th>
                <th class="text-left py-3 px-4">任务标题</th>
                <th class="text-left py-3 px-4">当前状态</th>
                <th class="text-left py-3 px-4">责任人</th>
                <th class="text-left py-3 px-4">截止日期</th>
                <th class="text-left py-3 px-4">剩余时间</th>
                <th class="text-left py-3 px-4">下一步</th>
              </tr>
            </thead>
            <tbody>
              <For each={filteredItems()}>
                {(item: OverdueTaskItem) => (
                  <tr
                    class={`border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors ${
                      !item.canAdvance ? 'opacity-60' : ''
                    }`}
                    onClick={() => navigate(`/tasks/${item.id}`)}
                  >
                    <td class="py-3 px-4" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedIds().has(item.id)}
                        disabled={!item.canAdvance}
                        onChange={() => toggleSelect(item.id, item.canAdvance)}
                      />
                    </td>
                    <td class="py-3 px-4 font-mono text-xs text-gray-600">{item.taskNo}</td>
                    <td class="py-3 px-4 font-medium text-gray-800">{item.title}</td>
                    <td class="py-3 px-4">
                      <span class={`badge ${STATUS_BADGE_CLASS[item.status] || 'bg-gray-100 text-gray-600'}`}>
                        {item.statusLabel}
                      </span>
                    </td>
                    <td class="py-3 px-4 text-gray-600">
                      {item.assigneeName || <span class="text-gray-400">待分派</span>}
                    </td>
                    <td class="py-3 px-4 text-gray-600">{item.deadline}</td>
                    <td class="py-3 px-4">
                      <span class={`font-medium ${
                        item.overdueStatus === 'overdue' ? 'text-red-600' :
                        item.overdueStatus === 'near_expiry' ? 'text-amber-600' : 'text-green-600'
                      }`}>
                        {formatDaysRemaining(item.daysRemaining, item.overdueStatus)}
                      </span>
                    </td>
                    <td class="py-3 px-4">
                      <Show when={item.canAdvance}>
                        <span class="text-green-600 text-xs">
                          → {item.nextActionLabel}
                        </span>
                      </Show>
                      <Show when={!item.canAdvance}>
                        <span class="text-gray-400 text-xs" title={item.blockReason}>
                          ✕ {item.blockReason}
                        </span>
                      </Show>
                    </td>
                  </tr>
                )}
              </For>
            </tbody>
          </table>
        </Show>
      </div>
    </div>
  );
}
