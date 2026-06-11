import { createSignal, Show, For, onMount } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import { api, STATUS_LABELS, STATUS_BADGE_CLASS, OVERDUE_LABELS, getCurrentUser } from '../lib/api';

export default function TaskList() {
  const navigate = useNavigate();
  const [tasks, setTasks] = createSignal<any[]>([]);
  const [statistics, setStatistics] = createSignal<any>({});
  const [statusFilter, setStatusFilter] = createSignal('');
  const [keyword, setKeyword] = createSignal('');
  const [overdueFilter, setOverdueFilter] = createSignal('');
  const [loading, setLoading] = createSignal(true);
  const [selectedIds, setSelectedIds] = createSignal<Set<string>>(new Set());
  const [batchResult, setBatchResult] = createSignal<any>(null);
  const [batchLoading, setBatchLoading] = createSignal(false);

  const user = () => getCurrentUser();

  const loadTasks = async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (statusFilter()) params.status = statusFilter();
      if (keyword()) params.keyword = keyword();
      if (overdueFilter()) params.overdueStatus = overdueFilter();
      const data: any = await api.tasks.list(params);
      setTasks(data);
    } catch (err) {
      console.error('加载任务列表失败', err);
    } finally {
      setLoading(false);
    }
  };

  const loadStatistics = async () => {
    try {
      const data: any = await api.tasks.statistics();
      setStatistics(data);
    } catch (err) {
      console.error('加载统计失败', err);
    }
  };

  onMount(async () => {
    await Promise.all([loadTasks(), loadStatistics()]);
  });

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds());
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const selectAll = () => {
    if (selectedIds().size === tasks().length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(tasks().map((t) => t.id)));
    }
  };

  const batchProcess = async (action: string) => {
    const ids = Array.from(selectedIds());
    if (ids.length === 0) return;
    setBatchLoading(true);
    try {
      const result: any = await api.tasks.batchProcess({
        taskIds: ids,
        action,
        evidence: `批量${action}操作`,
      });
      setBatchResult(result);
      setSelectedIds(new Set());
      await loadTasks();
      await loadStatistics();
    } catch (err: any) {
      setBatchResult({ error: true, message: err.message || '批量处理失败' });
    } finally {
      setBatchLoading(false);
    }
  };

  const handleExport = () => {
    const params: Record<string, string> = {};
    if (statusFilter()) params.status = statusFilter();
    if (keyword()) params.keyword = keyword();
    if (overdueFilter()) params.overdueStatus = overdueFilter();
    api.export.tasks(params);
  };

  const overdueBadge = (status: string) => {
    if (status === 'overdue') return <span class="badge bg-danger-100 text-danger-700 ml-2">逾期</span>;
    if (status === 'near_expiry') return <span class="badge bg-warning-100 text-warning-700 ml-2">临期</span>;
    return null;
  };

  const statCards = () => [
    { key: 'pendingAssign', label: '待分派', color: 'bg-gray-50 text-gray-700 border-gray-200', count: statistics().pendingAssign || 0 },
    { key: 'assigned', label: '已分派', color: 'bg-blue-50 text-blue-700 border-blue-200', count: statistics().assigned || 0 },
    { key: 'processing', label: '处理中', color: 'bg-yellow-50 text-yellow-700 border-yellow-200', count: statistics().processing || 0 },
    { key: 'transferred', label: '已转办', color: 'bg-purple-50 text-purple-700 border-purple-200', count: statistics().transferred || 0 },
    { key: 'followedUp', label: '已回访', color: 'bg-indigo-50 text-indigo-700 border-indigo-200', count: statistics().followedUp || 0 },
    { key: 'returnedForCorrection', label: '退回补正', color: 'bg-red-50 text-red-700 border-red-200', count: statistics().returnedForCorrection || 0 },
    { key: 'archived', label: '已归档', color: 'bg-green-50 text-green-700 border-green-200', count: statistics().archived || 0 },
  ];

  return (
    <div class="p-6">
      <div class="flex items-center justify-between mb-6">
        <div>
          <h2 class="text-xl font-bold text-gray-900">种植任务列表</h2>
          <p class="text-sm text-gray-500 mt-1">管理和处理所有种植任务</p>
        </div>
        <div class="flex gap-2">
          <button class="btn-secondary" onClick={handleExport}>
            📥 导出
          </button>
          <Show when={user()?.role === 'cooperative_director' || user()?.role === 'agricultural_technician'}>
            <button class="btn-primary" onClick={() => navigate('/tasks/new')}>
              ➕ 新建任务
            </button>
          </Show>
        </div>
      </div>

      <div class="grid grid-cols-7 gap-3 mb-6">
        <For each={statCards()}>
          {(card) => (
            <button
              class={`p-3 rounded-lg border text-center transition-all hover:shadow-md ${
                statusFilter() === card.key.replace(/([A-Z])/g, '_$1').toLowerCase() ? 'ring-2 ring-primary-500' : ''
              } ${card.color}`}
              onClick={() => {
                const statusMap: Record<string, string> = {
                  pendingAssign: 'pending_assign',
                  assigned: 'assigned',
                  processing: 'processing',
                  transferred: 'transferred',
                  followedUp: 'followed_up',
                  returnedForCorrection: 'returned_for_correction',
                  archived: 'archived',
                };
                setStatusFilter(statusFilter() === statusMap[card.key] ? '' : statusMap[card.key]);
                setTimeout(loadTasks, 0);
              }}
            >
              <div class="text-2xl font-bold">{card.count}</div>
              <div class="text-xs mt-1">{card.label}</div>
            </button>
          )}
        </For>
      </div>

      <div class="card">
        <div class="p-4 border-b border-gray-200 flex items-center gap-4 flex-wrap">
          <input
            type="text"
            class="input max-w-xs"
            placeholder="搜索任务编号、标题、计划名..."
            value={keyword()}
            onInput={(e) => setKeyword(e.currentTarget.value)}
            onKeyUp={(e) => e.key === 'Enter' && loadTasks()}
          />
          <select
            class="select max-w-xs"
            value={overdueFilter()}
            onChange={(e) => {
              setOverdueFilter(e.currentTarget.value);
              setTimeout(loadTasks, 0);
            }}
          >
            <option value="">全部到期状态</option>
            <option value="normal">正常</option>
            <option value="near_expiry">临期</option>
            <option value="overdue">逾期</option>
          </select>
          <button class="btn-secondary btn-sm" onClick={loadTasks}>🔍 搜索</button>

          <Show when={selectedIds().size > 0}>
            <div class="flex items-center gap-2 ml-auto">
              <span class="text-sm text-gray-500">已选 {selectedIds().size} 项</span>
              <button class="btn-primary btn-sm" onClick={() => batchProcess('process')} disabled={batchLoading()}>
                批量处理
              </button>
              <button class="btn-warning btn-sm" onClick={() => batchProcess('archive')} disabled={batchLoading()}>
                批量归档
              </button>
            </div>
          </Show>
        </div>

        <Show when={batchResult()}>
          <div class="p-4 border-b border-gray-200 bg-gray-50">
            <div class="flex items-center justify-between mb-2">
              <span class="text-sm font-medium">批量处理结果</span>
              <button class="text-xs text-gray-400 hover:text-gray-600" onClick={() => setBatchResult(null)}>关闭</button>
            </div>
            <Show when={!batchResult()?.error} fallback={<p class="text-sm text-danger-600">{batchResult()?.message}</p>}>
              <div class="flex gap-4 text-sm mb-2">
                <span class="text-primary-600">成功: {batchResult().successCount}</span>
                <span class="text-danger-600">失败: {batchResult().failCount}</span>
                <span class="text-gray-500">总计: {batchResult().total}</span>
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

        <Show when={!loading()} fallback={<div class="p-8 text-center text-gray-400">加载中...</div>}>
          <div class="overflow-x-auto">
            <table class="w-full">
              <thead>
                <tr class="border-b border-gray-100">
                  <th class="px-4 py-3 text-left">
                    <input
                      type="checkbox"
                      checked={selectedIds().size === tasks().length && tasks().length > 0}
                      onChange={selectAll}
                      class="rounded"
                    />
                  </th>
                  <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">任务编号</th>
                  <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">任务标题</th>
                  <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">状态</th>
                  <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">分派人</th>
                  <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">种植计划</th>
                  <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">截止日期</th>
                  <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">到期</th>
                  <th class="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">操作</th>
                </tr>
              </thead>
              <tbody>
                <For each={tasks()} fallback={<tr><td colSpan={9} class="px-4 py-8 text-center text-gray-400">暂无数据</td></tr>}>
                  {(task) => (
                    <tr class="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                      <td class="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={selectedIds().has(task.id)}
                          onChange={() => toggleSelect(task.id)}
                          class="rounded"
                        />
                      </td>
                      <td class="px-4 py-3 text-sm font-mono text-gray-600">{task.taskNo}</td>
                      <td class="px-4 py-3">
                        <button
                          class="text-sm font-medium text-primary-700 hover:text-primary-900 text-left"
                          onClick={() => navigate(`/tasks/${task.id}`)}
                        >
                          {task.title}
                        </button>
                        <Show when={task.exceptionReason}>
                          <p class="text-xs text-danger-500 mt-0.5">{task.exceptionReason}</p>
                        </Show>
                      </td>
                      <td class="px-4 py-3">
                        <span class={`badge ${STATUS_BADGE_CLASS[task.status] || 'badge-pending'}`}>
                          {task.statusLabel}
                        </span>
                      </td>
                      <td class="px-4 py-3 text-sm text-gray-600">{task.assigneeName || '-'}</td>
                      <td class="px-4 py-3 text-sm text-gray-600">{task.planName || '-'}</td>
                      <td class="px-4 py-3 text-sm text-gray-600">{task.deadline || '-'}</td>
                      <td class="px-4 py-3">{overdueBadge(task.overdueStatus)}</td>
                      <td class="px-4 py-3 text-right">
                        <button
                          class="text-xs text-primary-600 hover:text-primary-800"
                          onClick={() => navigate(`/tasks/${task.id}`)}
                        >
                          办理
                        </button>
                      </td>
                    </tr>
                  )}
                </For>
              </tbody>
            </table>
          </div>
        </Show>
      </div>
    </div>
  );
}
