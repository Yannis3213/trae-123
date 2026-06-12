import { createSignal, createEffect, For, Show } from 'solid-js';
import { useAuth, RoleSwitcher } from '../components/AuthProvider';
import { apiFetch, STATUS_LABELS, PRIORITY_LABELS, TYPE_LABELS, WARNING_LABELS, type Plan, type PlanType, type PlanStatus, type Stats, type BatchResult } from '../utils/api';

export default function PlanList() {
  const { user } = useAuth();
  const [plans, setPlans] = createSignal<Plan[]>([]);
  const [stats, setStats] = createSignal<Stats | null>(null);
  const [activeTab, setActiveTab] = createSignal<PlanType | 'all'>('all');
  const [filterStatus, setFilterStatus] = createSignal<string>('');
  const [filterPriority, setFilterPriority] = createSignal<string>('');
  const [filterWarning, setFilterWarning] = createSignal<string>('');
  const [selectedIds, setSelectedIds] = createSignal<Set<number>>(new Set());
  const [batchResults, setBatchResults] = createSignal<BatchResult[] | null>(null);
  const [showBatchModal, setShowBatchModal] = createSignal(false);
  const [loading, setLoading] = createSignal(false);
  const [showCreateModal, setShowCreateModal] = createSignal(false);

  const loadPlans = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (activeTab() !== 'all') params.set('type', activeTab());
      if (filterStatus()) params.set('status', filterStatus());
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
      loadPlans();
      loadStats();
    }
  });

  const toggleSelect = (id: number) => {
    const s = new Set(selectedIds());
    if (s.has(id)) s.delete(id);
    else s.add(id);
    setSelectedIds(s);
  };

  const toggleSelectAll = () => {
    if (selectedIds().size === plans().length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(plans().map((p) => p.id)));
    }
  };

  const handleBatchSign = async () => {
    try {
      const ids = Array.from(selectedIds());
      const res = await apiFetch<BatchResult[]>('/plans/batch-sign', {
        method: 'POST',
        body: JSON.stringify({ planIds: ids }),
      });
      setBatchResults(res.data);
      setShowBatchModal(true);
      setSelectedIds(new Set());
      loadPlans();
      loadStats();
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleBatchVerify = async () => {
    try {
      const ids = Array.from(selectedIds());
      const res = await apiFetch<BatchResult[]>('/plans/batch-verify', {
        method: 'POST',
        body: JSON.stringify({ planIds: ids, result: 'approve' }),
      });
      setBatchResults(res.data);
      setShowBatchModal(true);
      setSelectedIds(new Set());
      loadPlans();
      loadStats();
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleSeed = async () => {
    try {
      await apiFetch('/plans/seed', { method: 'POST' });
      loadPlans();
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

  return (
    <div class="min-h-screen bg-[var(--color-surface)]">
      <RoleSwitcher />

      <div class="flex">
        <div class="flex-1 p-4">
          <div class="flex items-center justify-between mb-4">
            <div class="flex items-center gap-2">
              <h2 class="text-lg font-bold text-[var(--color-primary)]">传播计划单列表</h2>
              <Show when={stats()}>
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
              value={filterStatus()}
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              <option value="">全部状态</option>
              <option value="pending_sign">待签收</option>
              <option value="reviewing">审核中</option>
              <option value="pending_verify">待复核</option>
              <option value="archived">签收完成</option>
              <option value="returned">退回补正</option>
              <option value="rejected">异常回传</option>
            </select>
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
            <button class="btn btn-outline btn-sm" onClick={loadPlans}>刷新</button>
          </div>

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
                    {(plan) => (
                      <tr class="border-b hover:bg-gray-50 transition-colors">
                        <td class="px-3 py-2">
                          <input
                            type="checkbox"
                            checked={selectedIds().has(plan.id)}
                            onChange={() => toggleSelect(plan.id)}
                          />
                        </td>
                        <td class="px-3 py-2 font-mono text-xs text-[var(--color-primary)]">{plan.planNo}</td>
                        <td class="px-3 py-2">
                          <a href={`/plan/${plan.id}`} class="text-[var(--color-primary)] hover:text-[var(--color-accent)] font-medium no-underline">
                            {plan.title}
                          </a>
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
                        <td class="px-3 py-2 text-gray-600 text-xs">{plan.dueDate}</td>
                        <td class="px-3 py-2 text-gray-600">{plan.currentHandler || '-'}</td>
                        <td class="px-3 py-2">
                          <span class={`warning-${plan.dueWarning}`}>
                            {WARNING_LABELS[plan.dueWarning]}
                          </span>
                        </td>
                        <td class="px-3 py-2">
                          <Show when={plan.exceptionTag}>
                            <span class="tag tag-exception">{plan.exceptionTag}</span>
                          </Show>
                        </td>
                        <td class="px-3 py-2">
                          <a href={`/plan/${plan.id}`} class="btn btn-primary btn-sm text-xs no-underline">查看</a>
                        </td>
                      </tr>
                    )}
                  </For>
                </tbody>
              </table>
            </div>
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
        </div>
      </div>

      <Show when={showBatchModal() && batchResults()}>
        <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowBatchModal(false)}>
          <div class="bg-white rounded-lg p-6 max-w-lg w-full max-h-[80vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
            <h3 class="text-lg font-bold text-[var(--color-primary)] mb-4">批量处理结果</h3>
            <div class="space-y-2">
              <For each={batchResults()!}>
                {(r) => (
                  <div class={`flex items-center gap-2 p-2 rounded ${r.success ? 'bg-green-50' : 'bg-red-50'}`}>
                    <span class={`text-lg ${r.success ? 'text-green-600' : 'text-red-600'}`}>
                      {r.success ? '✓' : '✗'}
                    </span>
                    <div class="flex-1">
                      <span class="font-mono text-xs">{r.planNo}</span>
                      <Show when={r.reason}>
                        <span class="text-xs text-red-600 ml-2">{r.reason}</span>
                      </Show>
                    </div>
                  </div>
                )}
              </For>
            </div>
            <button class="btn btn-primary mt-4 w-full" onClick={() => setShowBatchModal(false)}>关闭</button>
          </div>
        </div>
      </Show>

      <Show when={showCreateModal()}>
        <CreatePlanModal
          onClose={() => setShowCreateModal(false)}
          onCreated={() => { loadPlans(); loadStats(); setShowCreateModal(false); }}
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
