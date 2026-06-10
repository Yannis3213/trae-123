<script lang="ts">
  import { fetchOrder, submitAction } from '$lib/api';
  import { currentRole, currentHandler } from '$lib/stores.svelte';
  import type { SafetyOrder, Step, ActionData } from '$lib/types';
  import { page } from '$app/state';
  import {
    ArrowLeft, CheckCircle, Loader2, X, Save
  } from 'lucide-svelte';

  let order = $state<SafetyOrder | null>(null);
  let loading = $state(true);
  let error = $state('');
  let actionError = $state('');
  let actionLoading = $state(false);
  let activeTab = $state<Step>('home_inspection');

  let remark = $state('');
  let anomalyReason = $state('');

  let hiInspector = $state('');
  let hiDate = $state('');
  let hiResult = $state('');
  let hiAnomalies = $state('');

  let hrLevel = $state('');
  let hrMeasures = $state('');
  let hrDate = $state('');

  let rcResult = $state('');
  let rcDate = $state('');

  const STEPS: { key: Step; label: string }[] = [
    { key: 'home_inspection', label: '入户安检' },
    { key: 'hazard_rectification', label: '隐患整改' },
    { key: 'recheck_closure', label: '复查关闭' }
  ];

  const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
    pending_correction: { label: '待补正', color: 'text-amber-700', bg: 'bg-amber-50' },
    under_review: { label: '复核中', color: 'text-blue-700', bg: 'bg-blue-50' },
    completed: { label: '办结', color: 'text-green-700', bg: 'bg-green-50' }
  };

  let stepIndex = $derived(
    order ? STEPS.findIndex(s => s.key === order!.current_step) : 0
  );

  let canAct = $derived(() => {
    if (!order || order.status === 'completed') return false;
    const role = currentRole.value;
    if (role === 'agent' && order.current_step === 'home_inspection') return true;
    if (role === 'supervisor' && order.current_step === 'hazard_rectification') return true;
    if (role === 'manager' && order.current_step === 'recheck_closure') return true;
    return false;
  });

  async function loadOrder() {
    const id = page.params.id;
    if (!id) return;
    loading = true;
    error = '';
    try {
      const data = await fetchOrder(id);
      order = data;
      activeTab = data.current_step;
      populateForm(data);
    } catch (e: any) {
      error = e.message || '加载工单失败';
    } finally {
      loading = false;
    }
  }

  function populateForm(o: SafetyOrder) {
    if (o.home_inspection) {
      hiInspector = o.home_inspection.inspector || '';
      hiDate = o.home_inspection.inspection_date || '';
      hiResult = o.home_inspection.inspection_result || '';
      hiAnomalies = o.home_inspection.anomalies || '';
    }
    if (o.hazard_rectification) {
      hrLevel = o.hazard_rectification.hazard_level || '';
      hrMeasures = o.hazard_rectification.rectification_measures || '';
      hrDate = o.hazard_rectification.rectification_date || '';
    }
    if (o.recheck_closure) {
      rcResult = o.recheck_closure.recheck_result || '';
      rcDate = o.recheck_closure.recheck_date || '';
    }
  }

  async function handleAction(action: string) {
    if (!order) return;
    actionLoading = true;
    actionError = '';

    const data: ActionData = {
      action,
      role: currentRole.value,
      handler: currentHandler.value,
      version: order.version,
      remark: remark || undefined,
      anomaly_reason: anomalyReason || undefined
    };

    if (order.current_step === 'home_inspection') {
      data.home_inspection = {
        inspector: hiInspector,
        inspection_date: hiDate,
        inspection_result: hiResult,
        anomalies: hiAnomalies
      };
    } else if (order.current_step === 'hazard_rectification') {
      data.hazard_rectification = {
        hazard_level: hrLevel,
        rectification_measures: hrMeasures,
        rectification_date: hrDate
      };
    } else if (order.current_step === 'recheck_closure') {
      data.recheck_closure = {
        recheck_result: rcResult,
        recheck_date: rcDate
      };
    }

    try {
      const updated = await submitAction(order.id, data);
      order = updated;
      populateForm(updated);
      remark = '';
      anomalyReason = '';
    } catch (e: any) {
      actionError = e.message || '操作失败';
    } finally {
      actionLoading = false;
    }
  }

  function formatDate(dateStr: string) {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleString('zh-CN');
  }

  function formatShortDate(dateStr: string) {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('zh-CN');
  }

  const STEP_LABEL_MAP: Record<string, string> = {
    home_inspection: '入户安检',
    hazard_rectification: '隐患整改',
    recheck_closure: '复查关闭'
  };

  $effect(() => {
    loadOrder();
  });
</script>

<div class="space-y-5">
  <!-- Back button & header -->
  <div class="flex items-center gap-3">
    <a href="/" class="p-1.5 text-gray-400 hover:text-gray-600 rounded transition-colors">
      <ArrowLeft class="w-5 h-5" />
    </a>
    {#if order}
      <div class="flex-1">
        <div class="flex items-center gap-2">
          <h1 class="text-lg font-semibold text-gray-800">{order.order_no}</h1>
          <span class="text-xs px-2 py-0.5 rounded {STATUS_CONFIG[order.status]?.bg} {STATUS_CONFIG[order.status]?.color}">
            {STATUS_CONFIG[order.status]?.label}
          </span>
        </div>
        <p class="text-sm text-gray-500 mt-0.5">{order.address}</p>
      </div>
    {:else}
      <h1 class="text-lg font-semibold text-gray-800">工单详情</h1>
    {/if}
  </div>

  {#if loading}
    <div class="flex items-center justify-center py-20 text-gray-400">
      <Loader2 class="w-6 h-6 animate-spin mr-2" />
      加载中...
    </div>
  {:else if error}
    <div class="py-20 text-center text-red-500">{error}</div>
  {:else if order}
    <!-- Status flow bar -->
    <div class="bg-white rounded-lg border border-gray-200 p-5 shadow-sm">
      <div class="flex items-center justify-between">
        {#each STEPS as step, i}
          <div class="flex items-center {i < STEPS.length - 1 ? 'flex-1' : ''}">
            <div class="flex flex-col items-center">
              <div class="w-9 h-9 rounded-full flex items-center justify-center text-sm font-medium transition-all {
                i < stepIndex ? 'bg-green-500 text-white' :
                i === stepIndex ? 'bg-orange-500 text-white ring-4 ring-orange-100' :
                'bg-gray-200 text-gray-500'
              }">
                {#if i < stepIndex}
                  <CheckCircle class="w-5 h-5" />
                {:else}
                  {i + 1}
                {/if}
              </div>
              <span class="mt-1.5 text-xs {i <= stepIndex ? 'text-gray-800 font-medium' : 'text-gray-400'}">
                {step.label}
              </span>
            </div>
            {#if i < STEPS.length - 1}
              <div class="flex-1 mx-3 h-0.5 {i < stepIndex ? 'bg-green-400' : 'bg-gray-200'}"></div>
            {/if}
          </div>
        {/each}
        <div class="flex flex-col items-center ml-6">
          <div class="w-9 h-9 rounded-full flex items-center justify-center text-sm {order.status === 'completed' ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-500'}">
            <CheckCircle class="w-5 h-5" />
          </div>
          <span class="mt-1.5 text-xs {order.status === 'completed' ? 'text-gray-800 font-medium' : 'text-gray-400'}">办结</span>
        </div>
      </div>
    </div>

    <div class="grid grid-cols-3 gap-5">
      <!-- Left: form area (2 cols) -->
      <div class="col-span-2 space-y-4">
        <!-- Step tabs -->
        <div class="bg-white rounded-lg border border-gray-200 shadow-sm">
          <div class="flex border-b border-gray-200">
            {#each STEPS as step}
              <button
                onclick={() => (activeTab = step.key)}
                class="flex-1 py-2.5 text-sm font-medium transition-colors {activeTab === step.key ? 'text-orange-600 border-b-2 border-orange-500' : 'text-gray-500 hover:text-gray-700'}"
              >
                {step.label}
              </button>
            {/each}
          </div>

          <div class="p-5">
            <!-- Home Inspection tab -->
            {#if activeTab === 'home_inspection'}
              <div class="space-y-4">
                <div class="grid grid-cols-2 gap-4">
                  <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">安检员</label>
                    <input
                      type="text"
                      bind:value={hiInspector}
                      disabled={!canAct()}
                      class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm disabled:bg-gray-50 disabled:text-gray-500 focus:ring-2 focus:ring-orange-400 focus:border-orange-400 outline-none"
                    />
                  </div>
                  <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">安检日期</label>
                    <input
                      type="date"
                      bind:value={hiDate}
                      disabled={!canAct()}
                      class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm disabled:bg-gray-50 disabled:text-gray-500 focus:ring-2 focus:ring-orange-400 focus:border-orange-400 outline-none"
                    />
                  </div>
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">安检结果</label>
                  <select
                    bind:value={hiResult}
                    disabled={!canAct()}
                    class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm disabled:bg-gray-50 disabled:text-gray-500 focus:ring-2 focus:ring-orange-400 focus:border-orange-400 outline-none"
                  >
                    <option value="">请选择</option>
                    <option value="qualified">合格</option>
                    <option value="unqualified">不合格</option>
                    <option value="not_home">到访不遇</option>
                  </select>
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">异常情况</label>
                  <textarea
                    bind:value={hiAnomalies}
                    disabled={!canAct()}
                    rows="3"
                    class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm disabled:bg-gray-50 disabled:text-gray-500 focus:ring-2 focus:ring-orange-400 focus:border-orange-400 outline-none resize-none"
                    placeholder="请描述发现的异常情况..."
                  ></textarea>
                </div>
                {#if canAct()}
                  <div class="flex justify-end pt-2">
                    <button
                      onclick={() => handleAction('submit_inspection')}
                      disabled={actionLoading}
                      class="px-5 py-2 bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 text-white text-sm rounded-md transition-colors flex items-center gap-1"
                    >
                      {#if actionLoading}
                        <Loader2 class="w-4 h-4 animate-spin" />
                      {/if}
                      <Save class="w-4 h-4" />
                      提交安检
                    </button>
                  </div>
                {/if}
              </div>

            <!-- Hazard Rectification tab -->
            {:else if activeTab === 'hazard_rectification'}
              <div class="space-y-4">
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">隐患等级</label>
                  <select
                    bind:value={hrLevel}
                    disabled={!canAct()}
                    class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm disabled:bg-gray-50 disabled:text-gray-500 focus:ring-2 focus:ring-orange-400 focus:border-orange-400 outline-none"
                  >
                    <option value="">请选择</option>
                    <option value="low">低风险</option>
                    <option value="medium">中风险</option>
                    <option value="high">高风险</option>
                  </select>
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">整改措施</label>
                  <textarea
                    bind:value={hrMeasures}
                    disabled={!canAct()}
                    rows="3"
                    class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm disabled:bg-gray-50 disabled:text-gray-500 focus:ring-2 focus:ring-orange-400 focus:border-orange-400 outline-none resize-none"
                    placeholder="请填写整改措施..."
                  ></textarea>
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">整改日期</label>
                  <input
                    type="date"
                    bind:value={hrDate}
                    disabled={!canAct()}
                    class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm disabled:bg-gray-50 disabled:text-gray-500 focus:ring-2 focus:ring-orange-400 focus:border-orange-400 outline-none"
                  />
                </div>
                {#if canAct()}
                  <div class="flex justify-end gap-2 pt-2">
                    <button
                      onclick={() => handleAction('reject')}
                      disabled={actionLoading}
                      class="px-4 py-2 bg-red-50 hover:bg-red-100 text-red-600 text-sm rounded-md transition-colors flex items-center gap-1 border border-red-200"
                    >
                      <X class="w-4 h-4" />
                      驳回
                    </button>
                    <button
                      onclick={() => handleAction('approve')}
                      disabled={actionLoading}
                      class="px-5 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 text-white text-sm rounded-md transition-colors flex items-center gap-1"
                    >
                      {#if actionLoading}
                        <Loader2 class="w-4 h-4 animate-spin" />
                      {/if}
                      <CheckCircle class="w-4 h-4" />
                      审核通过
                    </button>
                  </div>
                {/if}
              </div>

            <!-- Recheck Closure tab -->
            {:else if activeTab === 'recheck_closure'}
              <div class="space-y-4">
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">复查结果</label>
                  <select
                    bind:value={rcResult}
                    disabled={!canAct()}
                    class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm disabled:bg-gray-50 disabled:text-gray-500 focus:ring-2 focus:ring-orange-400 focus:border-orange-400 outline-none"
                  >
                    <option value="">请选择</option>
                    <option value="pass">复查通过</option>
                    <option value="fail">复查未通过</option>
                  </select>
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">复查日期</label>
                  <input
                    type="date"
                    bind:value={rcDate}
                    disabled={!canAct()}
                    class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm disabled:bg-gray-50 disabled:text-gray-500 focus:ring-2 focus:ring-orange-400 focus:border-orange-400 outline-none"
                  />
                </div>
                {#if canAct()}
                  <div class="flex justify-end gap-2 pt-2">
                    <button
                      onclick={() => handleAction('return')}
                      disabled={actionLoading}
                      class="px-4 py-2 bg-amber-50 hover:bg-amber-100 text-amber-600 text-sm rounded-md transition-colors flex items-center gap-1 border border-amber-200"
                    >
                      <ArrowLeft class="w-4 h-4" />
                      退回整改
                    </button>
                    <button
                      onclick={() => handleAction('confirm')}
                      disabled={actionLoading}
                      class="px-5 py-2 bg-green-500 hover:bg-green-600 disabled:bg-green-300 text-white text-sm rounded-md transition-colors flex items-center gap-1"
                    >
                      {#if actionLoading}
                        <Loader2 class="w-4 h-4 animate-spin" />
                      {/if}
                      <CheckCircle class="w-4 h-4" />
                      确认办结
                    </button>
                  </div>
                {/if}
              </div>
            {/if}

            <!-- Action error -->
            {#if actionError}
              <div class="mt-4 text-sm text-red-600 bg-red-50 px-3 py-2 rounded-md border border-red-200">
                {actionError}
              </div>
            {/if}
          </div>
        </div>

        <!-- Action form -->
        {#if order.status !== 'completed'}
          <div class="bg-white rounded-lg border border-gray-200 shadow-sm p-5">
            <h3 class="text-sm font-semibold text-gray-800 mb-3">操作备注</h3>
            <div class="space-y-3">
              <div>
                <label class="block text-xs font-medium text-gray-600 mb-1">备注说明</label>
                <textarea
                  bind:value={remark}
                  rows="2"
                  class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-orange-400 focus:border-orange-400 outline-none resize-none"
                  placeholder="可选：填写操作备注..."
                ></textarea>
              </div>
              <div>
                <label class="block text-xs font-medium text-gray-600 mb-1">异常原因</label>
                <textarea
                  bind:value={anomalyReason}
                  rows="2"
                  class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-orange-400 focus:border-orange-400 outline-none resize-none"
                  placeholder="可选：填写异常原因..."
                ></textarea>
              </div>
            </div>
          </div>
        {/if}
      </div>

      <!-- Right: info & timeline -->
      <div class="space-y-4">
        <!-- Order info -->
        <div class="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
          <h3 class="text-sm font-semibold text-gray-800 mb-3">工单信息</h3>
          <dl class="space-y-2 text-sm">
            <div class="flex justify-between">
              <dt class="text-gray-500">工单号</dt>
              <dd class="font-mono text-gray-800">{order.order_no}</dd>
            </div>
            <div class="flex justify-between">
              <dt class="text-gray-500">地址</dt>
              <dd class="text-gray-800 text-right max-w-[160px] truncate" title={order.address}>{order.address}</dd>
            </div>
            <div class="flex justify-between">
              <dt class="text-gray-500">当前步骤</dt>
              <dd class="text-gray-800">{STEP_LABEL_MAP[order.current_step]}</dd>
            </div>
            <div class="flex justify-between">
              <dt class="text-gray-500">当前处理人</dt>
              <dd class="text-gray-800">{order.current_handler}</dd>
            </div>
            <div class="flex justify-between">
              <dt class="text-gray-500">截止日期</dt>
              <dd class="text-gray-800 {order.expiry_status === 'overdue' ? 'text-red-600 font-medium' : order.expiry_status === 'near_expiry' ? 'text-yellow-600' : ''}">
                {formatShortDate(order.deadline)}
              </dd>
            </div>
            <div class="flex justify-between">
              <dt class="text-gray-500">版本</dt>
              <dd class="text-gray-800">v{order.version}</dd>
            </div>
          </dl>
        </div>

        <!-- Timeline -->
        <div class="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
          <h3 class="text-sm font-semibold text-gray-800 mb-3">处理记录</h3>
          {#if order.processing_records.length === 0}
            <p class="text-xs text-gray-400">暂无处理记录</p>
          {:else}
            <div class="space-y-3">
              {#each order.processing_records as record}
                <div class="relative pl-5 pb-3 {record !== order.processing_records[order.processing_records.length - 1] ? 'border-l-2 border-gray-200' : ''}">
                  <div class="absolute left-0 top-0.5 w-2.5 h-2.5 rounded-full bg-orange-400 -translate-x-[4.5px]"></div>
                  <div class="text-xs font-medium text-gray-700">{record.action}</div>
                  <div class="text-xs text-gray-500 mt-0.5">
                    <span class="font-medium">{record.handler}</span> · {STEP_LABEL_MAP[record.step] || record.step}
                  </div>
                  {#if record.remark}
                    <div class="text-xs text-gray-500 mt-0.5">备注: {record.remark}</div>
                  {/if}
                  {#if record.anomaly_reason}
                    <div class="text-xs text-red-500 mt-0.5">异常: {record.anomaly_reason}</div>
                  {/if}
                  <div class="text-xs text-gray-400 mt-0.5">{formatDate(record.timestamp)}</div>
                </div>
              {/each}
            </div>
          {/if}
        </div>
      </div>
    </div>
  {/if}
</div>
