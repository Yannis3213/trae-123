<script lang="ts">
  import { fetchStats } from '$lib/api';
  import type { OrderStats } from '$lib/types';
  import { Clock, Shield, CheckCircle, AlertTriangle, Loader2, Users, BarChart3 } from 'lucide-svelte';

  let stats = $state<OrderStats | null>(null);
  let loading = $state(true);
  let error = $state('');

  let statusTotal = $derived(
    stats ? stats.pending_correction + stats.under_review + stats.completed : 0
  );

  let expiryTotal = $derived(
    stats ? stats.normal + stats.near_expiry + stats.overdue : 0
  );

  async function loadData() {
    loading = true;
    error = '';
    try {
      stats = await fetchStats();
    } catch (e: any) {
      error = e.message || '加载统计数据失败';
    } finally {
      loading = false;
    }
  }

  function pct(value: number, total: number): number {
    if (total === 0) return 0;
    return Math.round((value / total) * 100);
  }

  $effect(() => {
    loadData();
  });
</script>

<div class="space-y-6">
  <div class="flex items-center justify-between">
    <h2 class="text-lg font-semibold text-gray-800 flex items-center gap-2">
      <BarChart3 class="w-5 h-5 text-orange-500" />
      统计面板
    </h2>
    <button
      onclick={loadData}
      class="p-1.5 text-gray-400 hover:text-gray-600 rounded transition-colors"
      title="刷新"
    >
      <Loader2 class="w-4 h-4 {loading ? 'animate-spin' : ''}" />
    </button>
  </div>

  {#if loading}
    <div class="flex items-center justify-center py-20 text-gray-400">
      <Loader2 class="w-6 h-6 animate-spin mr-2" />
      加载中...
    </div>
  {:else if error}
    <div class="py-20 text-center text-red-500">{error}</div>
  {:else if stats}
    <!-- Status distribution -->
    <div class="bg-white rounded-lg border border-gray-200 shadow-sm p-5">
      <h3 class="text-sm font-semibold text-gray-800 mb-4">工单状态分布</h3>

      <div class="flex items-end gap-6 mb-6 h-48">
        <div class="flex-1 flex flex-col items-center justify-end h-full">
          <div class="w-full max-w-20 bg-amber-400 rounded-t-md transition-all relative group" style="height: {statusTotal > 0 ? (stats.pending_correction / statusTotal) * 100 : 0}%">
            <div class="absolute -top-6 left-1/2 -translate-x-1/2 text-sm font-bold text-amber-700">{stats.pending_correction}</div>
          </div>
          <div class="mt-2 text-xs text-gray-600 flex items-center gap-1">
            <Clock class="w-3 h-3 text-amber-500" />
            待补正
          </div>
        </div>
        <div class="flex-1 flex flex-col items-center justify-end h-full">
          <div class="w-full max-w-20 bg-blue-400 rounded-t-md transition-all relative" style="height: {statusTotal > 0 ? (stats.under_review / statusTotal) * 100 : 0}%">
            <div class="absolute -top-6 left-1/2 -translate-x-1/2 text-sm font-bold text-blue-700">{stats.under_review}</div>
          </div>
          <div class="mt-2 text-xs text-gray-600 flex items-center gap-1">
            <Shield class="w-3 h-3 text-blue-500" />
            复核中
          </div>
        </div>
        <div class="flex-1 flex flex-col items-center justify-end h-full">
          <div class="w-full max-w-20 bg-green-400 rounded-t-md transition-all relative" style="height: {statusTotal > 0 ? (stats.completed / statusTotal) * 100 : 0}%">
            <div class="absolute -top-6 left-1/2 -translate-x-1/2 text-sm font-bold text-green-700">{stats.completed}</div>
          </div>
          <div class="mt-2 text-xs text-gray-600 flex items-center gap-1">
            <CheckCircle class="w-3 h-3 text-green-500" />
            办结
          </div>
        </div>
      </div>

      <div class="flex gap-3">
        <div class="flex-1 bg-amber-50 border border-amber-200 rounded-md p-3 text-center">
          <div class="text-lg font-bold text-amber-700">{pct(stats.pending_correction, statusTotal)}%</div>
          <div class="text-xs text-amber-600">待补正率</div>
        </div>
        <div class="flex-1 bg-blue-50 border border-blue-200 rounded-md p-3 text-center">
          <div class="text-lg font-bold text-blue-700">{pct(stats.under_review, statusTotal)}%</div>
          <div class="text-xs text-blue-600">复核率</div>
        </div>
        <div class="flex-1 bg-green-50 border border-green-200 rounded-md p-3 text-center">
          <div class="text-lg font-bold text-green-700">{pct(stats.completed, statusTotal)}%</div>
          <div class="text-xs text-green-600">办结率</div>
        </div>
      </div>
    </div>

    <!-- Expiry distribution -->
    <div class="bg-white rounded-lg border border-gray-200 shadow-sm p-5">
      <h3 class="text-sm font-semibold text-gray-800 mb-4">到期状态分布</h3>

      <div class="space-y-4">
        <div>
          <div class="flex items-center justify-between text-sm mb-1">
            <span class="flex items-center gap-1 text-gray-700">
              <CheckCircle class="w-3.5 h-3.5 text-green-500" />
              正常
            </span>
            <span class="font-medium text-green-700">{stats.normal} ({pct(stats.normal, expiryTotal)}%)</span>
          </div>
          <div class="h-3 bg-gray-100 rounded-full overflow-hidden">
            <div class="h-full bg-green-400 rounded-full transition-all" style="width: {pct(stats.normal, expiryTotal)}%"></div>
          </div>
        </div>
        <div>
          <div class="flex items-center justify-between text-sm mb-1">
            <span class="flex items-center gap-1 text-gray-700">
              <AlertTriangle class="w-3.5 h-3.5 text-yellow-500" />
              临期
            </span>
            <span class="font-medium text-yellow-700">{stats.near_expiry} ({pct(stats.near_expiry, expiryTotal)}%)</span>
          </div>
          <div class="h-3 bg-gray-100 rounded-full overflow-hidden">
            <div class="h-full bg-yellow-400 rounded-full transition-all" style="width: {pct(stats.near_expiry, expiryTotal)}%"></div>
          </div>
        </div>
        <div>
          <div class="flex items-center justify-between text-sm mb-1">
            <span class="flex items-center gap-1 text-gray-700">
              <AlertTriangle class="w-3.5 h-3.5 text-red-500" />
              逾期
            </span>
            <span class="font-medium text-red-700">{stats.overdue} ({pct(stats.overdue, expiryTotal)}%)</span>
          </div>
          <div class="h-3 bg-gray-100 rounded-full overflow-hidden">
            <div class="h-full bg-red-400 rounded-full transition-all" style="width: {pct(stats.overdue, expiryTotal)}%"></div>
          </div>
        </div>
      </div>
    </div>

    <!-- Per-handler work count -->
    <div class="bg-white rounded-lg border border-gray-200 shadow-sm p-5">
      <h3 class="text-sm font-semibold text-gray-800 mb-4 flex items-center gap-1.5">
        <Users class="w-4 h-4 text-orange-500" />
        各处理人工单数量
      </h3>

      {#if stats.by_handler.length === 0}
        <p class="text-sm text-gray-400 text-center py-6">暂无数据</p>
      {:else}
        <div class="space-y-3">
          {#each stats.by_handler as item}
            {@const maxCount = Math.max(...stats.by_handler.map(h => h.count))}
            <div>
              <div class="flex items-center justify-between text-sm mb-1">
                <span class="text-gray-700 font-medium">{item.handler}</span>
                <span class="text-gray-500">{item.count} 件</span>
              </div>
              <div class="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                <div
                  class="h-full bg-orange-400 rounded-full transition-all"
                  style="width: {maxCount > 0 ? (item.count / maxCount) * 100 : 0}%"
                ></div>
              </div>
            </div>
          {/each}
        </div>
      {/if}
    </div>
  {/if}
</div>
