<script lang="ts">
  import { fetchOrders, fetchStats, createOrder, batchAction } from '$lib/api';
  import { currentRole, currentHandler, selectedOrders, toggleOrderSelection, clearSelection, selectAllOrders, listRefreshSignal, triggerListRefresh } from '$lib/stores.svelte';
  import type { SafetyOrder, OrderStats, Status, ExpiryStatus, BatchResult } from '$lib/types';
  import {
    AlertTriangle, CheckCircle, Clock, ChevronRight, Shield, Plus,
    X, Loader2, RefreshCw, CheckSquare, Square, Filter
  } from 'lucide-svelte';

  let orders = $state<SafetyOrder[]>([]);
  let stats = $state<OrderStats | null>(null);
  let loading = $state(true);
  let error = $state('');
  let activeTab = $state<Status>('pending_correction');
  let expiryFilter = $state<ExpiryStatus | 'all'>('all');
  let keyword = $state('');
  let showCreateModal = $state(false);
  let showBatchModal = $state(false);
  let showBatchConfirm = $state(false);
  let batchRemark = $state('');
  let batchAnomalyReason = $state('');
  let batchResult = $state<BatchResult | null>(null);
  let batchLoading = $state(false);
  let createLoading = $state(false);
  let createError = $state('');

  let newAddress = $state('');
  let newDeadline = $state('');

  const STATUS_TABS: { key: Status; label: string }[] = [
    { key: 'pending_correction', label: '待补正' },
    { key: 'under_review', label: '复核中' },
    { key: 'completed', label: '办结' }
  ];

  const STATUS_CONFIG: Record<Status, { label: string; color: string; bg: string; border: string }> = {
    pending_correction: { label: '待补正', color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-l-amber-400' },
    under_review: { label: '复核中', color: 'text-blue-700', bg: 'bg-blue-50', border: 'border-l-blue-400' },
    completed: { label: '办结', color: 'text-green-700', bg: 'bg-green-50', border: 'border-l-green-400' }
  };

  const EXPIRY_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
    normal: { label: '正常', color: 'text-green-700', bg: 'bg-green-100' },
    near_expiry: { label: '临期', color: 'text-yellow-700', bg: 'bg-yellow-100' },
    overdue: { label: '逾期', color: 'text-red-700', bg: 'bg-red-100' }
  };

  let filteredOrders = $derived(
    orders.filter(o => {
      const matchExpiry = expiryFilter === 'all' || o.expiry_status === expiryFilter;
      const matchKeyword = !keyword.trim() || 
        o.order_no.toLowerCase().includes(keyword.toLowerCase()) ||
        o.address.toLowerCase().includes(keyword.toLowerCase());
      return matchExpiry && matchKeyword;
    })
  );

  let tabCounts = $derived({
    pending_correction: orders.filter(o => o.status === 'pending_correction').length,
    under_review: orders.filter(o => o.status === 'under_review').length,
    completed: orders.filter(o => o.status === 'completed').length
  });

  let expiryCounts = $derived({
    normal: orders.filter(o => o.expiry_status === 'normal').length,
    near_expiry: orders.filter(o => o.expiry_status === 'near_expiry').length,
    overdue: orders.filter(o => o.expiry_status === 'overdue').length
  });

  let selectedCount = $derived(selectedOrders.value.size);

  let batchActionLabel = $derived(() => {
    const role = currentRole.value;
    if (role === 'agent') return '批量提交';
    if (role === 'supervisor') return '批量审核';
    return '批量推进';
  });

  let batchActionName = $derived(() => {
    const role = currentRole.value;
    if (role === 'agent') return 'submit';
    if (role === 'supervisor') return 'approve';
    return 'confirm';
  });

  async function loadData() {
    loading = true;
    error = '';
    try {
      const params: { status: Status; handler?: string } = { status: activeTab };
      const [ordersData, statsData] = await Promise.all([
        fetchOrders(params),
        fetchStats()
      ]);
      orders = ordersData;
      stats = statsData;
    } catch (e: any) {
      error = e.message || '加载数据失败';
    } finally {
      loading = false;
    }
  }

  async function handleTabChange(tab: Status) {
    activeTab = tab;
    expiryFilter = 'all';
    keyword = '';
    clearSelection();
    await loadData();
  }

  function openBatchConfirm() {
    batchRemark = '';
    batchAnomalyReason = '';
    showBatchConfirm = true;
  }

  async function handleBatchAction() {
    if (selectedOrders.value.size === 0) return;
    showBatchConfirm = false;
    batchLoading = true;
    error = '';
    try {
      const result = await batchAction({
        order_ids: Array.from(selectedOrders.value),
        action: batchActionName(),
        role: currentRole.value,
        handler: currentHandler.value,
        remark: batchRemark.trim() || undefined,
        anomaly_reason: batchAnomalyReason.trim() || undefined,
      });
      batchResult = result;
      showBatchModal = true;
      clearSelection();
      triggerListRefresh();
      await loadData();
      fetchStats().then(s => { stats = s; }).catch(() => {});
    } catch (e: any) {
      error = e.message || '批量操作失败';
    } finally {
      batchLoading = false;
    }
  }

  async function handleCreate() {
    if (!newAddress.trim() || !newDeadline) {
      createError = '请填写完整信息';
      return;
    }
    createLoading = true;
    createError = '';
    try {
      await createOrder({
        address: newAddress.trim(),
        deadline: newDeadline,
        inspector: currentHandler.value
      });
      showCreateModal = false;
      newAddress = '';
      newDeadline = '';
      triggerListRefresh();
      await loadData();
    } catch (e: any) {
      createError = e.message || '创建工单失败';
    } finally {
      createLoading = false;
    }
  }

  function formatDeadline(dateStr: string) {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' });
  }

  function daysUntilDeadline(dateStr: string): number {
    if (!dateStr) return 999;
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const deadline = new Date(dateStr);
    deadline.setHours(0, 0, 0, 0);
    return Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  }

  let lastActiveTab = $state<Status | ''>('');
  let lastRole = $state<string>('');
  let lastRefreshSignal = $state(0);

  $effect(() => {
    const tab = activeTab;
    const role = currentRole.value;
    const sig = listRefreshSignal.value;
    if (tab !== lastActiveTab || role !== lastRole || sig !== lastRefreshSignal) {
      lastActiveTab = tab;
      lastRole = role;
      lastRefreshSignal = sig;
      loadData();
    }
  });
</script>

<div class="space-y-5">
  <!-- Stats bar -->
  {#if stats}
    <div class="grid grid-cols-3 gap-4">
      <div class="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-center gap-3">
        <div class="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
          <Clock class="w-5 h-5 text-amber-600" />
        </div>
        <div>
          <div class="text-2xl font-bold text-amber-700">{stats.pending_correction}</div>
          <div class="text-xs text-amber-600">待补正</div>
        </div>
      </div>
      <div class="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-center gap-3">
        <div class="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
          <Shield class="w-5 h-5 text-blue-600" />
        </div>
        <div>
          <div class="text-2xl font-bold text-blue-700">{stats.under_review}</div>
          <div class="text-xs text-blue-600">复核中</div>
        </div>
      </div>
      <div class="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-3">
        <div class="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
          <CheckCircle class="w-5 h-5 text-green-600" />
        </div>
        <div>
          <div class="text-2xl font-bold text-green-700">{stats.completed}</div>
          <div class="text-xs text-green-600">办结</div>
        </div>
      </div>
    </div>
  {/if}

  <!-- Expiry warning section -->
  <div class="grid grid-cols-3 gap-4">
    <button
      onclick={() => (expiryFilter = expiryFilter === 'normal' ? 'all' : 'normal')}
      class="bg-white border rounded-lg p-3 flex items-center gap-3 transition-all {expiryFilter === 'normal' ? 'ring-2 ring-green-400 border-green-300' : 'border-gray-200 hover:border-green-300'}"
    >
      <div class="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
        <CheckCircle class="w-4 h-4 text-green-600" />
      </div>
      <div class="text-left">
        <div class="text-lg font-bold text-green-700">{expiryCounts.normal}</div>
        <div class="text-xs text-green-600">正常</div>
      </div>
    </button>
    <button
      onclick={() => (expiryFilter = expiryFilter === 'near_expiry' ? 'all' : 'near_expiry')}
      class="bg-white border rounded-lg p-3 flex items-center gap-3 transition-all {expiryFilter === 'near_expiry' ? 'ring-2 ring-yellow-400 border-yellow-300' : 'border-gray-200 hover:border-yellow-300'}"
    >
      <div class="w-8 h-8 rounded-full bg-yellow-100 flex items-center justify-center">
        <AlertTriangle class="w-4 h-4 text-yellow-600" />
      </div>
      <div class="text-left">
        <div class="text-lg font-bold text-yellow-700">{expiryCounts.near_expiry}</div>
        <div class="text-xs text-yellow-600">临期</div>
      </div>
    </button>
    <button
      onclick={() => (expiryFilter = expiryFilter === 'overdue' ? 'all' : 'overdue')}
      class="bg-white border rounded-lg p-3 flex items-center gap-3 transition-all {expiryFilter === 'overdue' ? 'ring-2 ring-red-400 border-red-300' : 'border-gray-200 hover:border-red-300'}"
    >
      <div class="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center">
        <AlertTriangle class="w-4 h-4 text-red-600" />
      </div>
      <div class="text-left">
        <div class="text-lg font-bold text-red-700">{expiryCounts.overdue}</div>
        <div class="text-xs text-red-600">逾期</div>
      </div>
    </button>
  </div>

  <!-- Tab bar -->
  <div class="bg-white rounded-lg border border-gray-200 shadow-sm">
    <div class="flex border-b border-gray-200">
      {#each STATUS_TABS as tab}
        <button
          onclick={() => handleTabChange(tab.key)}
          class="flex-1 py-3 text-sm font-medium transition-colors relative {activeTab === tab.key ? `${STATUS_CONFIG[tab.key].color} border-b-2 border-current` : 'text-gray-500 hover:text-gray-700'}"
        >
          {tab.label}
          <span class="ml-1.5 inline-flex items-center justify-center px-1.5 py-0.5 text-xs rounded-full {activeTab === tab.key ? STATUS_CONFIG[tab.key].bg + ' ' + STATUS_CONFIG[tab.key].color : 'bg-gray-100 text-gray-500'}">
            {tabCounts[tab.key]}
          </span>
        </button>
      {/each}
    </div>

    <!-- Filter & actions bar -->
    <div class="flex items-center justify-between px-4 py-2 bg-gray-50 border-b border-gray-100 gap-3">
      <div class="flex items-center gap-2 text-xs text-gray-500">
        <Filter class="w-3.5 h-3.5" />
        {#if expiryFilter !== 'all'}
          <span class="px-2 py-0.5 rounded-full {EXPIRY_CONFIG[expiryFilter]?.bg} {EXPIRY_CONFIG[expiryFilter]?.color}">
            {EXPIRY_CONFIG[expiryFilter]?.label}
          </span>
          <button onclick={() => (expiryFilter = 'all')} class="text-gray-400 hover:text-gray-600">
            <X class="w-3 h-3" />
          </button>
        {:else}
          <span>全部到期状态</span>
        {/if}
        <span class="text-gray-300">|</span>
        <span>共 {filteredOrders.length} 条</span>
      </div>
      <div class="flex items-center gap-2 flex-1 max-w-xs">
        <div class="relative w-full">
          <input
            type="text"
            bind:value={keyword}
            placeholder="搜索工单号、地址..."
            class="w-full pl-8 pr-3 py-1.5 border border-gray-200 rounded-md text-xs focus:ring-2 focus:ring-orange-400 focus:border-orange-400 outline-none"
          />
          <svg class="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
      </div>
      <div class="flex items-center gap-2">
        <button
          onclick={loadData}
          class="p-1.5 text-gray-400 hover:text-gray-600 rounded transition-colors"
          title="刷新"
        >
          <RefreshCw class="w-4 h-4" />
        </button>
        {#if filteredOrders.length > 0}
          <button
            onclick={() => selectAllOrders(filteredOrders.map(o => o.id))}
            class="text-xs text-gray-500 hover:text-orange-600 transition-colors"
          >
            全选
          </button>
        {/if}
        {#if currentRole.value === 'agent'}
          <button
            onclick={() => (showCreateModal = true)}
            class="flex items-center gap-1 px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white text-sm rounded-md transition-colors"
          >
            <Plus class="w-4 h-4" />
            新建工单
          </button>
        {/if}
      </div>
    </div>

    <!-- Order list -->
    <div class="divide-y divide-gray-100">
      {#if loading}
        <div class="flex items-center justify-center py-12 text-gray-400">
          <Loader2 class="w-5 h-5 animate-spin mr-2" />
          加载中...
        </div>
      {:else if error}
        <div class="py-12 text-center text-red-500 text-sm">{error}</div>
      {:else if filteredOrders.length === 0}
        <div class="py-12 text-center text-gray-400 text-sm">暂无工单</div>
      {:else}
        {#each filteredOrders as order (order.id)}
          <div class="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors group {STATUS_CONFIG[order.status].border} border-l-4">
            <button
              onclick={(e) => { e.preventDefault(); toggleOrderSelection(order.id); }}
              class="flex-shrink-0 text-gray-300 hover:text-orange-500 transition-colors"
            >
              {#if selectedOrders.value.has(order.id)}
                <CheckSquare class="w-4.5 h-4.5 text-orange-500" />
              {:else}
                <Square class="w-4.5 h-4.5" />
              {/if}
            </button>

            <a
              href="/orders/{order.id}"
              class="flex-1 min-w-0 flex items-center gap-4"
            >
              <div class="flex-shrink-0 w-28">
                <div class="text-sm font-mono font-semibold text-gray-800">{order.order_no}</div>
                <div class="text-xs text-gray-400 mt-0.5">{formatDeadline(order.deadline)}</div>
              </div>

              <div class="flex-1 min-w-0">
                <div class="text-sm text-gray-700 truncate">{order.address}</div>
                <div class="flex items-center gap-2 mt-1">
                  <span class="text-xs px-1.5 py-0.5 rounded {STATUS_CONFIG[order.status].bg} {STATUS_CONFIG[order.status].color}">
                    {STATUS_CONFIG[order.status].label}
                  </span>
                  <span class="text-xs px-1.5 py-0.5 rounded {EXPIRY_CONFIG[order.expiry_status]?.bg} {EXPIRY_CONFIG[order.expiry_status]?.color}">
                    {EXPIRY_CONFIG[order.expiry_status]?.label}
                  </span>
                </div>
              </div>

              <div class="flex-shrink-0 text-right">
                <div class="text-xs text-gray-500">{order.current_handler}</div>
                {#if order.expiry_status === 'overdue'}
                  <div class="text-xs text-red-500 font-medium mt-0.5">
                    逾期{Math.abs(daysUntilDeadline(order.deadline))}天
                  </div>
                {:else if order.expiry_status === 'near_expiry'}
                  <div class="text-xs text-yellow-600 mt-0.5">
                    剩{daysUntilDeadline(order.deadline)}天
                  </div>
                {/if}
              </div>

              <ChevronRight class="w-4 h-4 text-gray-300 group-hover:text-gray-500 flex-shrink-0" />
            </a>
          </div>
        {/each}
      {/if}
    </div>
  </div>
</div>

<!-- Batch action bar -->
{#if selectedCount > 0}
  <div class="fixed bottom-0 left-0 right-0 bg-[#1E293B] text-white py-3 px-4 z-40 shadow-[0_-4px_12px_rgba(0,0,0,0.15)]">
    <div class="max-w-7xl mx-auto flex items-center justify-between">
      <div class="flex items-center gap-3">
        <span class="text-sm">已选择 <span class="text-orange-400 font-bold">{selectedCount}</span> 条工单</span>
        <button
          onclick={clearSelection}
          class="text-xs text-gray-400 hover:text-white transition-colors"
        >
          取消选择
        </button>
      </div>
      <div class="flex items-center gap-2">
        <button
          onclick={openBatchConfirm}
          disabled={batchLoading}
          class="px-4 py-1.5 bg-orange-500 hover:bg-orange-600 disabled:bg-orange-800 text-white text-sm rounded-md transition-colors flex items-center gap-1"
        >
          {#if batchLoading}
            <Loader2 class="w-4 h-4 animate-spin" />
          {/if}
          {batchActionLabel()}
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- Batch confirm modal -->
{#if showBatchConfirm}
  <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onclick={() => (showBatchConfirm = false)}>
    <div class="bg-white rounded-lg shadow-xl w-full max-w-md mx-4" onclick={(e) => e.stopPropagation()}>
      <div class="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
        <h3 class="text-lg font-semibold text-gray-800">批量{batchActionLabel()}</h3>
        <button onclick={() => (showBatchConfirm = false)} class="text-gray-400 hover:text-gray-600">
          <X class="w-5 h-5" />
        </button>
      </div>
      <div class="p-5 space-y-4">
        <div class="text-sm text-gray-600 bg-blue-50 border border-blue-100 rounded-md px-3 py-2">
          即将对 <span class="font-bold text-blue-700">{selectedCount}</span> 条工单执行「<span class="font-bold text-blue-700">{batchActionLabel()}</span>」操作
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">审计备注</label>
          <textarea
            bind:value={batchRemark}
            rows="2"
            placeholder="可填写本次批量操作的说明（可选）"
            class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-orange-400 focus:border-orange-400 outline-none resize-none"
          />
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">
            异常原因
            {#if batchActionName() === 'reject' || batchActionName() === 'return'}
              <span class="text-red-500"> *</span>
            {/if}
          </label>
          <textarea
            bind:value={batchAnomalyReason}
            rows="2"
            placeholder={batchActionName() === 'reject' || batchActionName() === 'return' ? '驳回/退回原因（必填）' : '如有异常情况可填写（选填）'}
            class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-orange-400 focus:border-orange-400 outline-none resize-none"
          />
          <div class="mt-1 text-xs text-yellow-600">
            {#if (batchActionName() === 'reject' || batchActionName() === 'return') && !batchAnomalyReason.trim()}
              ⚠️ 驳回/退回操作必须填写异常原因
            {/if}
          </div>
        </div>

        <div class="text-xs text-gray-500 bg-gray-50 rounded-md px-3 py-2">
          <div class="font-medium text-gray-600 mb-1">💡 提示</div>
          <ul class="space-y-0.5 list-disc list-inside">
            <li>系统将逐条校验每条工单的状态、角色、处理人和证据完整性</li>
            <li>证据不全、越权、版本冲突、逾期等情况会被逐条拦截</li>
            <li>操作完成后可在结果弹窗中查看每条工单的成功/失败原因</li>
          </ul>
        </div>
      </div>
      <div class="px-5 py-3 border-t border-gray-200 flex justify-end gap-2">
        <button
          onclick={() => (showBatchConfirm = false)}
          class="px-4 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm rounded-md transition-colors"
        >
          取消
        </button>
        <button
          onclick={handleBatchAction}
          disabled={batchLoading || ((batchActionName() === 'reject' || batchActionName() === 'return') && !batchAnomalyReason.trim())}
          class="px-4 py-1.5 bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 text-white text-sm rounded-md transition-colors flex items-center gap-1"
        >
          {#if batchLoading}
            <Loader2 class="w-4 h-4 animate-spin" />
          {/if}
          确认执行
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- Batch result modal -->
{#if showBatchModal && batchResult}
  <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onclick={() => (showBatchModal = false)}>
    <div class="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4" onclick={(e) => e.stopPropagation()}>
      <div class="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
        <h3 class="text-lg font-semibold text-gray-800">批量操作结果</h3>
        <button onclick={() => (showBatchModal = false)} class="text-gray-400 hover:text-gray-600">
          <X class="w-5 h-5" />
        </button>
      </div>
      <div class="p-5">
        <div class="flex items-center gap-4 mb-4">
          <div class="text-center">
            <div class="text-2xl font-bold text-gray-800">{batchResult.total}</div>
            <div class="text-xs text-gray-500">总计</div>
          </div>
          <div class="text-center">
            <div class="text-2xl font-bold text-green-600">{batchResult.success}</div>
            <div class="text-xs text-gray-500">成功</div>
          </div>
          <div class="text-center">
            <div class="text-2xl font-bold text-red-600">{batchResult.failed}</div>
            <div class="text-xs text-gray-500">失败</div>
          </div>
        </div>
        {#if batchResult.results.length > 0}
          <div class="text-xs text-gray-500 mb-2">逐条结果（点击失败项可查看详细原因）：</div>
          <div class="max-h-72 overflow-y-auto divide-y divide-gray-100 border rounded-md">
            {#each batchResult.results as r}
              <div class="px-3 py-2.5 text-sm">
                <div class="flex items-center justify-between">
                  <span class="font-medium text-gray-700">{r.order_no || r.order_id}</span>
                  {#if r.success}
                    <span class="inline-flex items-center gap-1 text-green-600 text-xs bg-green-50 px-2 py-0.5 rounded-full">
                      <CheckCircle class="w-3 h-3" /> 成功
                    </span>
                  {:else}
                    <span class="inline-flex items-center gap-1 text-red-600 text-xs bg-red-50 px-2 py-0.5 rounded-full">
                      <X class="w-3 h-3" /> 失败
                    </span>
                  {/if}
                </div>
                {#if !r.success && r.message}
                  <div class="mt-1.5 text-xs text-red-700 bg-red-50 border border-red-100 rounded px-2 py-1 leading-relaxed">
                    <span class="font-medium">原因：</span>{r.message}
                  </div>
                {/if}
              </div>
            {/each}
          </div>
        {/if}
      </div>
      <div class="px-5 py-3 border-t border-gray-200 flex justify-end">
        <button
          onclick={() => (showBatchModal = false)}
          class="px-4 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm rounded-md transition-colors"
        >
          关闭
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- Create order modal -->
{#if showCreateModal}
  <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onclick={() => (showCreateModal = false)}>
    <div class="bg-white rounded-lg shadow-xl w-full max-w-md mx-4" onclick={(e) => e.stopPropagation()}>
      <div class="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
        <h3 class="text-lg font-semibold text-gray-800">新建工单</h3>
        <button onclick={() => (showCreateModal = false)} class="text-gray-400 hover:text-gray-600">
          <X class="w-5 h-5" />
        </button>
      </div>
      <div class="p-5 space-y-4">
        {#if createError}
          <div class="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-md">{createError}</div>
        {/if}
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">地址 <span class="text-red-500">*</span></label>
          <input
            type="text"
            bind:value={newAddress}
            placeholder="请输入安检地址"
            class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-orange-400 focus:border-orange-400 outline-none"
          />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">截止日期 <span class="text-red-500">*</span></label>
          <input
            type="date"
            bind:value={newDeadline}
            class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-orange-400 focus:border-orange-400 outline-none"
          />
        </div>
        <div class="text-xs text-gray-500 bg-gray-50 px-3 py-2 rounded-md">
          安检员默认设置为：<span class="font-medium text-gray-700">{currentHandler.value}</span>
        </div>
      </div>
      <div class="px-5 py-3 border-t border-gray-200 flex justify-end gap-2">
        <button
          onclick={() => (showCreateModal = false)}
          class="px-4 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm rounded-md transition-colors"
        >
          取消
        </button>
        <button
          onclick={handleCreate}
          disabled={createLoading}
          class="px-4 py-1.5 bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 text-white text-sm rounded-md transition-colors flex items-center gap-1"
        >
          {#if createLoading}
            <Loader2 class="w-4 h-4 animate-spin" />
          {/if}
          创建
        </button>
      </div>
    </div>
  </div>
{/if}
