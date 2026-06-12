import { createSignal, createEffect, For, Show, createMemo } from 'solid-js';
import { useAuth, RoleSwitcher } from '../components/AuthProvider';
import { apiFetch, STATUS_LABELS, PRIORITY_LABELS, TYPE_LABELS, WARNING_LABELS, ROLE_LABELS, type Plan, type PlanType, type PlanStatus, type Stats, type BatchResult, type Role } from '../utils/api';

type SidebarFilter = 'all' | 'my-queue' | PlanStatus;

export default function PlanList() {
  const { user } = useAuth();
  const [plans, setPlans] = createSignal<Plan[]>([]);
  const [stats, setStats] = createSignal<Stats | null>(null);
  const [activeTab, setActiveTab] = createSignal<PlanType | 'all'>('all');
  const [sidebarFilter, setSidebarFilter] = createSignal<SidebarFilter>('all');
  const [filterPriority, setFilterPriority] = createSignal<string>('');
  const [filterWarning, setFilterWarning] = createSignal<string>('');
  const [selectedIds, setSelectedIds] = createSignal<Set<number>>(new Set<number>());
  const [batchResults, setBatchResults] = createSignal<BatchResult[] | null>(null);
  const [showBatchModal, setShowBatchModal] = createSignal(false);
  const [loading, setLoading] = createSignal(false);
  const [showCreateModal, setShowCreateModal] = createSignal(false);
  const [sidebarCollapsed, setSidebarCollapsed] = createSignal(false);

  const sidebarItems: { key: SidebarFilter; label: string; icon: string }[] = [
    { key: 'all', label: '全部', icon: '📋' },
    { key: 'my-queue', label: '我的待办', icon: '📌' },
    { key: 'pending_sign', label: '待签收', icon: '📥' },
    { key: 'reviewing', label: '审核中', icon: '🔍' },
    { key: 'pending_verify', label: '待复核', icon: '✅' },
    { key: 'returned', label: '退回补正', icon: '↩️' },
    { key: 'rejected', label: '异常回传', icon: '⚠️' },
    { key: 'archived', label: '签收完成(已归档)', icon: '📦' },
  ];

  const loadPlans = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (activeTab() !== 'all') params.set('type', activeTab());
      if (sidebarFilter() !== 'all' && sidebarFilter() !== 'my-queue') {
        params.set('status', sidebarFilter());
      }
      if (filterPriority()) params.set('priority', filterPriority());
      if (filterWarning()) params.set('dueWarning', filterWarning());
      const query = params.toString() ? `?${params.toString()}` : '';
      const res = await apiFetch<Plan[]>(`/plans${query}`);
      setPlans(res.data || []);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const loadMyQueue = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (activeTab() !== 'all') params.set('type', activeTab());
      if (filterPriority()) params.set('priority', filterPriority());
      if (filterWarning()) params.set('dueWarning', filterWarning());
      const query = params.toString() ? `?${params.toString()}` : '';
      const res = await apiFetch<Plan[]>(`/plans/queue/my${query}`);
      setPlans(res.data || []);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const loadStats = async () => {
    try {
      const res = await apiFetch<Stats>('/plans/stats');
      setStats(res.data);
    } catch (e) {
      console.error(e);
    }
  };

  createEffect(() => {
    if (user()) {
      loadStats();
    }
  });

  createEffect(() => {
    if (!user()) return;
    if (sidebarFilter() === 'my-queue') {
      loadMyQueue();
    } else {
      loadPlans();
    }
  });

  const pendingTotal = createMemo(() => {
    const s = stats();
    if (!s) return 0;
    return s.pending_sign + s.reviewing + s.pending_verify;
  });

  const toggleSelect = (id: number) => {
    const s = new Set(selectedIds());
    if (s.has(id)) s.delete(id);
    else s.add(id);
    setSelectedIds(s);
  };

  const toggleSelectAll = () => {
    if (selectedIds().size === plans().length) {
      setSelectedIds(new Set<number>());
    } else {
      setSelectedIds(new Set(plans().map((p) => p.id)));
    }
  };

  const handleBatchSign = async () => {
    try {
      const ids = Array.from(selectedIds());
      const versions: Record<string, number> = {};
      for (const id of ids) {
        const p = plans().find((x) => x.id === id);
        if (p) versions[String(id)] = p.version;
      }
      const res = await apiFetch<BatchResult[]>('/plans/batch-sign', {
        method: 'POST',
        body: JSON.stringify({ planIds: ids, versions }),
      });
      setBatchResults(res.data);
      setShowBatchModal(true);
      setSelectedIds(new Set<number>());
      if (sidebarFilter() === 'my-queue') loadMyQueue();
      else loadPlans();
      loadStats();
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleBatchVerify = async () => {
    try {
      const ids = Array.from(selectedIds());
      const versions: Record<string, number> = {};
      for (const id of ids) {
        const p = plans().find((x) => x.id === id);
        if (p) versions[String(id)] = p.version;
      }
      const res = await apiFetch<BatchResult[]>('/plans/batch-verify', {
        method: 'POST',
        body: JSON.stringify({ planIds: ids, result: 'approve', versions }),
      });
      setBatchResults(res.data);
      setShowBatchModal(true);
      setSelectedIds(new Set<number>());
      if (sidebarFilter() === 'my-queue') loadMyQueue();
      else loadPlans();
      loadStats();
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleQuickSign = async (planId: number) => {
    try {
      const p = plans().find((x) => x.id === planId);
      const versions: Record<string, number> = { [String(planId)]: p?.version || 1 };
      const res = await apiFetch<BatchResult[]>('/plans/batch-sign', {
        method: 'POST',
        body: JSON.stringify({ planIds: [planId], versions }),
      });
      if (res.data && res.data[0]?.success) {
        if (sidebarFilter() === 'my-queue') loadMyQueue();
        else loadPlans();
        loadStats();
      } else {
        alert(res.data?.[0]?.reason || '签收失败');
      }
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleQuickVerify = async (planId: number) => {
    try {
      const p = plans().find((x) => x.id === planId);
      const versions: Record<string, number> = { [String(planId)]: p?.version || 1 };
      const res = await apiFetch<BatchResult[]>('/plans/batch-verify', {
        method: 'POST',
        body: JSON.stringify({ planIds: [planId], result: 'approve', versions }),
      });
      if (res.data && res.data[0]?.success) {
        if (sidebarFilter() === 'my-queue') loadMyQueue();
        else loadPlans();
        loadStats();
      } else {
        alert(res.data?.[0]?.reason || '复核失败');
      }
    } catch (e: any) {
      alert(e.message);
    }
  };

  const getQuickAction = (plan: Plan): { label: string; action: () => void; variant: string } | null => {
    const role = user()?.role;
    if (!role) return null;

    if (role === 'reviewer' && plan.status === 'pending_sign') {
      return { label: '签收', action: () => handleQuickSign(plan.id), variant: 'accent' };
    }
    if (role === 'director' && plan.status === 'pending_verify') {
      return { label: '复核通过', action: () => handleQuickVerify(plan.id), variant: 'accent' };
    }
    return null;
  };

  const handleSeed = async () => {
    try {
      await apiFetch('/plans/seed', { method: 'POST' });
      if (sidebarFilter() === 'my-queue') loadMyQueue();
      else loadPlans();
      loadStats();
    } catch (e: any) {
      alert(e.message);
    }
  };

  const tabs: { key: PlanType | 'all'; label: string }[] = [
    { key: 'all', label: '全部' },
    { key: 'communication_plan', label: '传播计划' },
    { key: 'material_review', label: '素材审核' },
    { key: 'placement_confirm', label: '投放确认' },
  ];

  const roleShortLabels: Record<Role, string> = {
    registrar: '登记员',
    reviewer: '审核主管',
    director: '复核负责人',
  };

  const handleSidebarClick = (key: SidebarFilter) => {
    setSidebarFilter(key);
    setSelectedIds(new Set<number>());
  };

  return (
    <div class="min-h-screen bg-[var(--color-surface)] flex flex-col">
      <RoleSwitcher />

      <div class="flex flex-1">
        <aside
          class={`bg-[#1a2332] text-white transition-all duration-300 flex flex-col ${
            sidebarCollapsed() ? 'w-16' : 'w-60'
          }`}
        >
          <div class="p-3 border-b border-white/10 flex items-center justify-between">
            <Show when={!sidebarCollapsed()}>
              <span class="text-sm font-bold text-[#c9a84c]">导航菜单</span>
            </Show>
            <button
              class="text-white/60 hover:text-white p-1 rounded hover:bg-white/10 transition-colors"
              onClick={() => setSidebarCollapsed(!sidebarCollapsed())}
              title={sidebarCollapsed() ? '展开侧边栏' : '收起侧边栏'}
            >
              {sidebarCollapsed() ? '›' : '‹'}
            </button>
          </div>

          <Show when={!sidebarCollapsed()}>
            <div class="p-3 border-b border-white/10">
              <div class="grid grid-cols-2 gap-2">
                <div class="bg-white/5 rounded p-2 text-center">
                  <div class="text-lg font-bold text-[#c9a84c]">{pendingTotal()}</div>
                  <div class="text-xs text-white/60">待办总数</div>
                </div>
                <div class="bg-white/5 rounded p-2 text-center">
                  <div class="text-lg font-bold text-red-400">{stats()?.overdue || 0}</div>
                  <div class="text-xs text-white/60">逾期数</div>
                </div>
                <div class="bg-white/5 rounded p-2 text-center">
                  <div class="text-lg font-bold text-orange-400">{stats()?.exception || 0}</div>
                  <div class="text-xs text-white/60">异常数</div>
                </div>
                <div class="bg-white/5 rounded p-2 text-center">
                  <div class="text-lg font-bold text-green-400">{stats()?.archived || 0}</div>
                  <div class="text-xs text-white/60">已完成</div>
                </div>
              </div>
            </div>
          </Show>

          <nav class="flex-1 py-2 overflow-y-auto">
            <For each={sidebarItems}>
              {(item) => (
                <button
                  class={`w-full flex items-center gap-3 px-3 py-2.5 text-sm transition-colors ${
                    sidebarFilter() === item.key
                      ? 'bg-[#c9a84c]/20 text-[#c9a84c] border-l-2 border-[#c9a84c]'
                      : 'text-white/70 hover:bg-white/5 hover:text-white border-l-2 border-transparent'
                  }`}
                  onClick={() => handleSidebarClick(item.key)}
                  title={sidebarCollapsed() ? item.label : undefined}
                >
                  <span class="text-base">{item.icon}</span>
                  <Show when={!sidebarCollapsed()}>
                    <span class="flex-1 text-left">{item.label}</span>
                    <Show when={item.key === 'pending_sign' && stats()}>
                      <span class="text-xs bg-[#c9a84c]/20 text-[#c9a84c] px-1.5 py-0.5 rounded">
                        {stats()!.pending_sign}
                      </span>
                    </Show>
                    <Show when={item.key === 'reviewing' && stats()}>
                      <span class="text-xs bg-[#c9a84c]/20 text-[#c9a84c] px-1.5 py-0.5 rounded">
                        {stats()!.reviewing}
                      </span>
                    </Show>
                    <Show when={item.key === 'pending_verify' && stats()}>
                      <span class="text-xs bg-[#c9a84c]/20 text-[#c9a84c] px-1.5 py-0.5 rounded">
                        {stats()!.pending_verify}
                      </span>
                    </Show>
                  </Show>
                </button>
              )}
            </For>
          </nav>

          <Show when={!sidebarCollapsed()}>
            <div class="p-3 border-t border-white/10">
              <div class="text-xs text-white/40 text-center">
                共 {stats()?.total || 0} 条计划单
              </div>
            </div>
          </Show>
        </aside>

        <main class="flex-1 p-4 overflow-auto">
          <div class="flex items-center justify-between mb-4">
            <div class="flex items-center gap-2">
              <h2 class="text-lg font-bold text-[var(--color-primary)]">
                {sidebarFilter() === 'my-queue' ? '我的待办' : '传播计划单列表'}
              </h2>
              <Show when={stats() && sidebarFilter() === 'all'}>
                <span class="text-xs text-gray-400">
                  (共{stats()!.total}条 · 待签收{stats()!.pending_sign} · 审核中{stats()!.reviewing} · 待复核{stats()!.pending_verify} · 逾期{stats()!.overdue})
                </span>
              </Show>
            </div>
            <div class="flex items-center gap-2">
              <button class="btn btn-outline btn-sm" onClick={handleSeed}>初始化演示数据</button>
              <Show when={user()?.role === 'registrar'}>
                <button class="btn btn-accent btn-sm" onClick={() => setShowCreateModal(true)}>+ 发起计划单</button>
              </Show>
            </div>
          </div>

          <div class="flex gap-1 mb-3 border-b border-gray-200">
            {tabs.map((t) => (
              <button
                class={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  activeTab() === t.key
                    ? 'border-[var(--color-accent)] text-[var(--color-primary)]'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
                onClick={() => setActiveTab(t.key)}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div class="flex gap-2 mb-3">
            <select
              class="text-sm border rounded px-2 py-1.5 bg-white"
              value={filterPriority()}
              onChange={(e) => setFilterPriority(e.target.value)}
            >
              <option value="">全部优先级</option>
              <option value="urgent">紧急</option>
              <option value="high">高</option>
              <option value="normal">普通</option>
              <option value="low">低</option>
            </select>
            <select
              class="text-sm border rounded px-2 py-1.5 bg-white"
              value={filterWarning()}
              onChange={(e) => setFilterWarning(e.target.value)}
            >
              <option value="">全部预警</option>
              <option value="normal">正常</option>
              <option value="approaching">临期</option>
              <option value="overdue">逾期</option>
            </select>
            <button class="btn btn-outline btn-sm" onClick={() => {
              if (sidebarFilter() === 'my-queue') loadMyQueue();
              else loadPlans();
            }}>刷新</button>
          </div>

          <Show when={loading()} fallback={
            <Show when={plans().length > 0} fallback={
              <div class="text-center py-12 text-gray-400">暂无数据，请点击"初始化演示数据"</div>
            }>
              <div class="bg-white rounded-lg border border-gray-200 overflow-hidden">
                <table class="w-full text-sm">
                  <thead>
                    <tr class="bg-gray-50 border-b">
                      <th class="px-3 py-2 text-left">
                        <input
                          type="checkbox"
                          checked={selectedIds().size === plans().length && plans().length > 0}
                          onChange={toggleSelectAll}
                        />
                      </th>
                      <th class="px-3 py-2 text-left font-medium text-gray-600">编号</th>
                      <th class="px-3 py-2 text-left font-medium text-gray-600">标题</th>
                      <th class="px-3 py-2 text-left font-medium text-gray-600">类型</th>
                      <th class="px-3 py-2 text-left font-medium text-gray-600">状态</th>
                      <th class="px-3 py-2 text-left font-medium text-gray-600">优先级</th>
                      <th class="px-3 py-2 text-left font-medium text-gray-600">责任人</th>
                      <th class="px-3 py-2 text-left font-medium text-gray-600">截止时间</th>
                      <th class="px-3 py-2 text-left font-medium text-gray-600">当前处理人</th>
                      <th class="px-3 py-2 text-left font-medium text-gray-600">预警</th>
                      <th class="px-3 py-2 text-left font-medium text-gray-600">异常</th>
                      <th class="px-3 py-2 text-left font-medium text-gray-600">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    <For each={plans()}>
                      {(plan) => {
                        const quickAction = getQuickAction(plan);
                        return (
                          <tr class={`border-b hover:bg-gray-50 transition-colors ${
                            plan.exceptionTag ? 'bg-red-50/30' : ''
                          }`}>
                            <td class="px-3 py-2">
                              <input
                                type="checkbox"
                                checked={selectedIds().has(plan.id)}
                                onChange={() => toggleSelect(plan.id)}
                              />
                            </td>
                            <td class="px-3 py-2 font-mono text-xs text-[var(--color-primary)]">{plan.planNo}</td>
                            <td class="px-3 py-2">
                              <div class="flex items-center gap-2">
                                <a href={`/plan/${plan.id}`} class="text-[var(--color-primary)] hover:text-[var(--color-accent)] font-medium no-underline">
                                  {plan.title}
                                </a>
                                <Show when={plan.exceptionTag}>
                                  <span class="tag tag-exception font-bold">异常</span>
                                </Show>
                              </div>
                            </td>
                            <td class="px-3 py-2">
                              <span class="text-gray-500 text-xs">{TYPE_LABELS[plan.type]}</span>
                            </td>
                            <td class="px-3 py-2">
                              <span class={`status-badge status-${plan.status}`}>
                                {STATUS_LABELS[plan.status]}
                              </span>
                            </td>
                            <td class="px-3 py-2">
                              <span class={`tag tag-${plan.priority}`}>{PRIORITY_LABELS[plan.priority]}</span>
                            </td>
                            <td class="px-3 py-2 text-gray-600">{plan.responsiblePerson}</td>
                            <td class="px-3 py-2">
                              <div class={`text-xs ${
                                plan.dueWarning === 'overdue' ? 'text-red-600 font-bold' :
                                plan.dueWarning === 'approaching' ? 'text-orange-500' :
                                'text-gray-500'
                              }`}>
                                {plan.dueDate}
                              </div>
                            </td>
                            <td class="px-3 py-2">
                              <div class="flex items-center gap-1.5">
                                <span class="text-gray-700">{plan.currentHandler || '-'}</span>
                                <Show when={plan.currentHandlerRole}>
                                  <span class="text-[10px] px-1.5 py-0.5 rounded bg-[var(--color-primary)]/10 text-[var(--color-primary)]">
                                    {roleShortLabels[plan.currentHandlerRole]}
                                  </span>
                                </Show>
                              </div>
                            </td>
                            <td class="px-3 py-2">
                              <span class={`warning-${plan.dueWarning} text-xs font-medium`}>
                                {WARNING_LABELS[plan.dueWarning]}
                              </span>
                            </td>
                            <td class="px-3 py-2">
                              <Show when={plan.exceptionTag}>
                                <span class="tag tag-exception font-medium">{plan.exceptionTag}</span>
                              </Show>
                              <Show when={!plan.exceptionTag}>
                                <span class="text-gray-300 text-xs">-</span>
                              </Show>
                            </td>
                            <td class="px-3 py-2">
                              <div class="flex items-center gap-1">
                                <Show when={quickAction}>
                                  <button
                                    class={`btn btn-${quickAction!.variant} btn-sm text-xs no-underline`}
                                    onClick={(e) => { e.preventDefault(); quickAction!.action(); }}
                                  >
                                    {quickAction!.label}
                                  </button>
                                </Show>
                                <a href={`/plan/${plan.id}`} class="btn btn-primary btn-sm text-xs no-underline">查看</a>
                              </div>
                            </td>
                          </tr>
                        );
                      }}
                    </For>
                  </tbody>
                </table>
              </div>
            </Show>
          }>
            <div class="text-center py-12 text-gray-400">加载中...</div>
          </Show>

          <Show when={selectedIds().size > 0}>
            <div class="fixed bottom-4 left-1/2 -translate-x-1/2 bg-[var(--color-primary)] text-white px-6 py-3 rounded-lg shadow-lg flex items-center gap-4 z-50">
              <span class="text-sm">已选择 {selectedIds().size} 条</span>
              <Show when={user()?.role === 'reviewer'}>
                <button class="btn btn-accent btn-sm" onClick={handleBatchSign}>批量签收</button>
              </Show>
              <Show when={user()?.role === 'director'}>
                <button class="btn btn-accent btn-sm" onClick={handleBatchVerify}>批量复核</button>
              </Show>
              <button class="btn btn-outline btn-sm text-white border-white/30" onClick={() => setSelectedIds(new Set())}>取消选择</button>
            </div>
          </Show>
        </main>
      </div>

      <Show when={showBatchModal() && batchResults()}>
        <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowBatchModal(false)}>
          <div class="bg-white rounded-lg p-6 max-w-lg w-full max-h-[80vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
            <h3 class="text-lg font-bold text-[var(--color-primary)] mb-2">批量处理结果</h3>
            <div class="flex gap-3 mb-3 text-xs text-gray-500">
              <span>成功 {batchResults()!.filter(r => r.success).length}</span>
              <span>失败 {batchResults()!.filter(r => !r.success).length}</span>
            </div>
            <div class="space-y-2">
              <For each={batchResults()!}>
                {(r) => {
                  const tagInfo = (() => {
                    if (r.success) return { label: '成功', cls: 'bg-green-100 text-green-700' };
                    if (r.reason?.includes('越权')) return { label: '越权', cls: 'bg-red-100 text-red-700' };
                    if (r.reason?.includes('版本冲突')) return { label: '版本冲突', cls: 'bg-orange-100 text-orange-700' };
                    if (r.reason?.includes('逾期')) return { label: '逾期拦截', cls: 'bg-yellow-100 text-yellow-700' };
                    if (r.reason?.includes('状态冲突')) return { label: '状态冲突', cls: 'bg-purple-100 text-purple-700' };
                    if (r.reason?.includes('处理人不匹配')) return { label: '处理人不匹配', cls: 'bg-red-100 text-red-700' };
                    if (r.reason?.includes('资料缺失')) return { label: '资料缺失', cls: 'bg-amber-100 text-amber-700' };
                    return { label: '失败', cls: 'bg-red-100 text-red-700' };
                  })();
                  return (
                    <div class={`flex items-start gap-2 p-2.5 rounded border ${r.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                      <span class={`text-lg mt-0.5 ${r.success ? 'text-green-600' : 'text-red-600'}`}>
                        {r.success ? '✓' : '✗'}
                      </span>
                      <div class="flex-1 min-w-0">
                        <div class="flex items-center gap-2">
                          <span class="font-mono text-xs font-bold">{r.planNo}</span>
                          <span class={`text-[10px] px-1.5 py-0.5 rounded font-medium ${tagInfo.cls}`}>{tagInfo.label}</span>
                        </div>
                        <Show when={r.reason}>
                          <div class="text-xs text-red-600 mt-1 break-all">{r.reason}</div>
                        </Show>
                      </div>
                    </div>
                  );
                }}
              </For>
            </div>
            <button class="btn btn-primary mt-4 w-full" onClick={() => setShowBatchModal(false)}>关闭</button>
          </div>
        </div>
      </Show>

      <Show when={showCreateModal()}>
        <CreatePlanModal
          onClose={() => setShowCreateModal(false)}
          onCreated={() => {
            if (sidebarFilter() === 'my-queue') loadMyQueue();
            else loadPlans();
            loadStats();
            setShowCreateModal(false);
          }}
        />
      </Show>
    </div>
  );
}

function CreatePlanModal(props: { onClose: () => void; onCreated: () => void }) {
  const [title, setTitle] = createSignal('');
  const [type, setType] = createSignal<PlanType>('communication_plan');
  const [priority, setPriority] = createSignal<string>('normal');
  const [dueDate, setDueDate] = createSignal('');
  const [responsible, setResponsible] = createSignal('张晓明');

  const handleSubmit = async () => {
    if (!title() || !dueDate()) {
      alert('请填写标题和截止时间');
      return;
    }
    try {
      await apiFetch('/plans', {
        method: 'POST',
        body: JSON.stringify({
          title: title(),
          type: type(),
          priority: priority(),
          dueDate: dueDate(),
          responsiblePerson: responsible(),
        }),
      });
      props.onCreated();
    } catch (e: any) {
      alert(e.message);
    }
  };

  return (
    <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={props.onClose}>
      <div class="bg-white rounded-lg p-6 max-w-md w-full" onClick={(e) => e.stopPropagation()}>
        <h3 class="text-lg font-bold text-[var(--color-primary)] mb-4">发起传播计划单</h3>
        <div class="space-y-3">
          <div>
            <label class="block text-xs text-gray-500 mb-1">标题</label>
            <input class="w-full border rounded px-3 py-2 text-sm" value={title()} onInput={(e) => setTitle(e.target.value)} />
          </div>
          <div>
            <label class="block text-xs text-gray-500 mb-1">类型</label>
            <select class="w-full border rounded px-3 py-2 text-sm" value={type()} onChange={(e) => setType(e.target.value as PlanType)}>
              <option value="communication_plan">传播计划</option>
              <option value="material_review">素材审核</option>
              <option value="placement_confirm">投放确认</option>
            </select>
          </div>
          <div>
            <label class="block text-xs text-gray-500 mb-1">优先级</label>
            <select class="w-full border rounded px-3 py-2 text-sm" value={priority()} onChange={(e) => setPriority(e.target.value)}>
              <option value="urgent">紧急</option>
              <option value="high">高</option>
              <option value="normal">普通</option>
              <option value="low">低</option>
            </select>
          </div>
          <div>
            <label class="block text-xs text-gray-500 mb-1">截止时间</label>
            <input type="date" class="w-full border rounded px-3 py-2 text-sm" value={dueDate()} onInput={(e) => setDueDate(e.target.value)} />
          </div>
          <div>
            <label class="block text-xs text-gray-500 mb-1">责任人</label>
            <input class="w-full border rounded px-3 py-2 text-sm" value={responsible()} onInput={(e) => setResponsible(e.target.value)} />
          </div>
        </div>
        <div class="flex gap-2 mt-4">
          <button class="btn btn-primary flex-1" onClick={handleSubmit}>提交</button>
          <button class="btn btn-outline flex-1" onClick={props.onClose}>取消</button>
        </div>
      </div>
    </div>
  );
}
