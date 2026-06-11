<script lang="ts">
  import { fetchOrder, submitAction, fetchStats } from '$lib/api';
  import { currentRole, currentHandler, triggerListRefresh, listRefreshSignal } from '$lib/stores.svelte';
  import type { SafetyOrder, Step, ActionData } from '$lib/types';
  import { page } from '$app/state';
  import {
    ArrowLeft, CheckCircle, Loader2, X, Save, ImagePlus, Paperclip, CalendarClock, Plus
  } from 'lucide-svelte';

  let order = $state<SafetyOrder | null>(null);
  let loading = $state(true);
  let error = $state('');
  let actionError = $state('');
  let actionLoading = $state(false);
  let activeTab = $state<Step>('home_inspection');
  let successToast = $state('');
  let showSuccess = $state(false);

  let remark = $state('');
  let anomalyReason = $state('');

  let hiPhotos = $state<string[]>([]);
  let hrPhotos = $state<string[]>([]);
  let rcPhotos = $state<string[]>([]);

  let hiInspector = $state('');
  let hiDate = $state('');
  let hiResult = $state('');
  let hiAnomalies = $state('');

  let hrLevel = $state('');
  let hrMeasures = $state('');
  let hrDate = $state('');

  let rcResult = $state('');
  let rcDate = $state('');

  function addPhoto(type: 'hi' | 'hr' | 'rc') {
    const timestamp = Date.now();
    const filename = `安检照片_${timestamp}_${Math.floor(Math.random() * 1000)}.jpg`;
    if (type === 'hi') hiPhotos = [...hiPhotos, filename];
    if (type === 'hr') hrPhotos = [...hrPhotos, filename];
    if (type === 'rc') rcPhotos = [...rcPhotos, filename];
  }

  function removePhoto(type: 'hi' | 'hr' | 'rc', index: number) {
    if (type === 'hi') hiPhotos = hiPhotos.filter((_, i) => i !== index);
    if (type === 'hr') hrPhotos = hrPhotos.filter((_, i) => i !== index);
    if (type === 'rc') rcPhotos = rcPhotos.filter((_, i) => i !== index);
  }

  function canSubmitInspection(): boolean {
    return !!(hiInspector.trim() && hiDate && hiResult.trim());
  }

  function canApprove(): boolean {
    if (!hrLevel.trim() || !hrMeasures.trim() || !hrDate) return false;
    return true;
  }

  function canConfirm(): boolean {
    if (!rcResult.trim() || !rcDate) return false;
    return true;
  }

  function canRejectReturn(action: string): boolean {
    if (action === 'reject' || action === 'return') {
      return !!anomalyReason.trim();
    }
    return true;
  }

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
      if (o.home_inspection.evidence_photos?.length) {
        hiPhotos = [...o.home_inspection.evidence_photos];
      }
    }
    if (o.hazard_rectification) {
      hrLevel = o.hazard_rectification.hazard_level || '';
      hrMeasures = o.hazard_rectification.rectification_measures || '';
      hrDate = o.hazard_rectification.rectification_date || '';
      if (o.hazard_rectification.evidence_photos?.length) {
        hrPhotos = [...o.hazard_rectification.evidence_photos];
      }
    }
    if (o.recheck_closure) {
      rcResult = o.recheck_closure.recheck_result || '';
      rcDate = o.recheck_closure.recheck_date || '';
      if (o.recheck_closure.evidence_photos?.length) {
        rcPhotos = [...o.recheck_closure.evidence_photos];
      }
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
        anomalies: hiAnomalies,
        evidence_photos: hiPhotos.length > 0 ? [...hiPhotos] : undefined
      };
    } else if (order.current_step === 'hazard_rectification') {
      data.hazard_rectification = {
        hazard_level: hrLevel,
        rectification_measures: hrMeasures,
        rectification_date: hrDate,
        evidence_photos: hrPhotos.length > 0 ? [...hrPhotos] : undefined
      };
    } else if (order.current_step === 'recheck_closure') {
      data.recheck_closure = {
        recheck_result: rcResult,
        recheck_date: rcDate,
        evidence_photos: rcPhotos.length > 0 ? [...rcPhotos] : undefined
      };
    }

    try {
      const updated = await submitAction(order.id, data);
      order = updated;
      activeTab = updated.current_step;
      populateForm(updated);
      remark = '';
      anomalyReason = '';

      successToast = '操作成功！数据已同步刷新。';
      showSuccess = true;
      setTimeout(() => { showSuccess = false; }, 3000);

      triggerListRefresh();
      await fetchStats().catch(() => {});

      const refreshedOrder = await fetchOrder(order.id);
      order = refreshedOrder;
      populateForm(refreshedOrder);
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

  function daysUntilDeadline(dateStr: string): number {
    if (!dateStr) return 999;
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const deadline = new Date(dateStr);
    deadline.setHours(0, 0, 0, 0);
    return Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  }

  function getExpiryText(dateStr: string, status: string): string {
    const days = daysUntilDeadline(dateStr);
    if (status === 'overdue') return `已逾期 ${Math.abs(days)} 天`;
    if (status === 'near_expiry') return `剩余 ${days} 天`;
    return `剩余 ${days} 天`;
  }

  function getStepAttachments(step: string) {
    if (!order?.attachments) return [];
    return order.attachments.filter(a => a.step === step);
  }

  function getErrorType(err: string): 'auth' | 'version' | 'expiry' | 'validation' | 'other' {
    if (!err) return 'other';
    if (err.includes('越权') || err.includes('不匹配')) return 'auth';
    if (err.includes('版本冲突') || err.includes('已被他人处理')) return 'version';
    if (err.includes('逾期') || err.includes('延期')) return 'expiry';
    if (err.includes('请填写') || err.includes('请选择') || err.includes('必须填写') || err.includes('尚未提交') || err.includes('尚未完成')) return 'validation';
    return 'other';
  }

  const actionErrorType = $derived(() => getErrorType(actionError));

  let lastId = $state<string>('');
  let lastListSig = $state(0);

  $effect(() => {
    const id = page.params.id;
    const sig = listRefreshSignal.value;
    if (id !== lastId || sig !== lastListSig) {
      lastId = id || '';
      lastListSig = sig;
      loadOrder();
    }
  });
</script>

<div class="space-y-5">
  {#if showSuccess}
    <div class="fixed top-4 right-4 z-50 animate-in fade-in slide-in-from-right-4">
      <div class="bg-green-500 text-white px-4 py-2.5 rounded-lg shadow-lg flex items-center gap-2">
        <CheckCircle class="w-5 h-5" />
        <span class="text-sm font-medium">{successToast}</span>
      </div>
    </div>
  {/if}

  <!-- Back button & header -->
  <div class="flex items-center gap-3">
    <a href="/" class="p-1.5 text-gray-400 hover:text-gray-600 rounded transition-colors">
      <ArrowLeft class="w-5 h-5" />
    </a>
    {#if order}
      <div class="flex-1">
        <div class="flex items-center gap-2 flex-wrap">
          <h1 class="text-lg font-semibold text-gray-800">{order.order_no}</h1>
          <span class="text-xs px-2 py-0.5 rounded {STATUS_CONFIG[order.status]?.bg} {STATUS_CONFIG[order.status]?.color}">
            {STATUS_CONFIG[order.status]?.label}
          </span>
          <span class="text-xs px-2 py-0.5 rounded flex items-center gap-1 {
            order.expiry_status === 'overdue' ? 'bg-red-100 text-red-700' :
            order.expiry_status === 'near_expiry' ? 'bg-yellow-100 text-yellow-700' :
            'bg-green-100 text-green-700'
          }">
            <CalendarClock class="w-3 h-3" />
            {getExpiryText(order.deadline, order.expiry_status)}
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
                    <label class="block text-sm font-medium text-gray-700 mb-1">安检员 <span class="text-red-500">*</span></label>
                    <input
                      type="text"
                      bind:value={hiInspector}
                      disabled={!canAct()}
                      class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm disabled:bg-gray-50 disabled:text-gray-500 focus:ring-2 focus:ring-orange-400 focus:border-orange-400 outline-none"
                    />
                  </div>
                  <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">安检日期 <span class="text-red-500">*</span></label>
                    <input
                      type="date"
                      bind:value={hiDate}
                      disabled={!canAct()}
                      class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm disabled:bg-gray-50 disabled:text-gray-500 focus:ring-2 focus:ring-orange-400 focus:border-orange-400 outline-none"
                    />
                  </div>
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">安检结果 <span class="text-red-500">*</span></label>
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

                <!-- 证据上传 -->
                <div class="border border-dashed border-gray-200 rounded-lg p-4 bg-gray-50">
                  <div class="flex items-center justify-between mb-3">
                    <label class="block text-sm font-medium text-gray-700 flex items-center gap-1.5">
                      <ImagePlus class="w-4 h-4 text-gray-500" />
                      证据上传
                    </label>
                    <span class="text-xs text-gray-500">
                      已添加 <span class="font-medium text-orange-600">{hiPhotos.length}</span> 张
                    </span>
                  </div>
                  {#if hiPhotos.length > 0}
                    <div class="flex flex-wrap gap-2 mb-3">
                      {#each hiPhotos as photo, i}
                        <span class="inline-flex items-center gap-1 px-2.5 py-1 bg-white border border-gray-200 rounded-md text-xs text-gray-700 shadow-sm">
                          <Paperclip class="w-3 h-3 text-gray-400" />
                          <span class="max-w-[160px] truncate">{photo}</span>
                          {#if canAct()}
                            <button
                              onclick={() => removePhoto('hi', i)}
                              class="ml-1 text-gray-400 hover:text-red-500 transition-colors"
                            >
                              <X class="w-3 h-3" />
                            </button>
                          {/if}
                        </span>
                      {/each}
                    </div>
                  {/if}
                  {#if canAct()}
                    <button
                      onclick={() => addPhoto('hi')}
                      class="px-3 py-1.5 text-xs bg-white border border-gray-300 rounded-md text-gray-600 hover:bg-orange-50 hover:border-orange-400 hover:text-orange-600 transition-colors flex items-center gap-1"
                    >
                      <Plus class="w-3 h-3" />
                      添加证据照片
                    </button>
                  {/if}
                </div>

                <!-- 已上传附件 -->
                {#if getStepAttachments('home_inspection').length > 0}
                  <div class="border border-gray-200 rounded-lg p-4">
                    <label class="block text-sm font-medium text-gray-700 mb-3 flex items-center gap-1.5">
                      <Paperclip class="w-4 h-4 text-gray-500" />
                      已上传附件
                    </label>
                    <div class="space-y-2">
                      {#each getStepAttachments('home_inspection') as att}
                        <div class="flex items-center justify-between px-3 py-2 bg-gray-50 rounded-md">
                          <div class="flex items-center gap-2 min-w-0">
                            <Paperclip class="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                            <span class="text-xs text-gray-700 truncate">{att.file_name}</span>
                            <span class="text-xs text-gray-400 flex-shrink-0">({att.file_type})</span>
                          </div>
                          <span class="text-xs text-gray-400 flex-shrink-0 ml-2">{formatShortDate(att.created_at)}</span>
                        </div>
                      {/each}
                    </div>
                  </div>
                {/if}

                {#if canAct()}
                  <div class="flex justify-end pt-2">
                    <button
                      onclick={() => handleAction('submit_inspection')}
                      disabled={actionLoading || !canSubmitInspection()}
                      class="px-5 py-2 bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 disabled:cursor-not-allowed text-white text-sm rounded-md transition-colors flex items-center gap-1"
                      title={!canSubmitInspection() ? '请填写所有必填项' : ''}
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
                  <label class="block text-sm font-medium text-gray-700 mb-1">隐患等级 <span class="text-red-500">*</span></label>
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
                  <label class="block text-sm font-medium text-gray-700 mb-1">整改措施 <span class="text-red-500">*</span></label>
                  <textarea
                    bind:value={hrMeasures}
                    disabled={!canAct()}
                    rows="3"
                    class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm disabled:bg-gray-50 disabled:text-gray-500 focus:ring-2 focus:ring-orange-400 focus:border-orange-400 outline-none resize-none"
                    placeholder="请填写整改措施..."
                  ></textarea>
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">整改日期 <span class="text-red-500">*</span></label>
                  <input
                    type="date"
                    bind:value={hrDate}
                    disabled={!canAct()}
                    class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm disabled:bg-gray-50 disabled:text-gray-500 focus:ring-2 focus:ring-orange-400 focus:border-orange-400 outline-none"
                  />
                </div>

                <!-- 证据上传 -->
                <div class="border border-dashed border-gray-200 rounded-lg p-4 bg-gray-50">
                  <div class="flex items-center justify-between mb-3">
                    <label class="block text-sm font-medium text-gray-700 flex items-center gap-1.5">
                      <ImagePlus class="w-4 h-4 text-gray-500" />
                      证据上传
                    </label>
                    <span class="text-xs text-gray-500">
                      已添加 <span class="font-medium text-orange-600">{hrPhotos.length}</span> 张
                    </span>
                  </div>
                  {#if hrPhotos.length > 0}
                    <div class="flex flex-wrap gap-2 mb-3">
                      {#each hrPhotos as photo, i}
                        <span class="inline-flex items-center gap-1 px-2.5 py-1 bg-white border border-gray-200 rounded-md text-xs text-gray-700 shadow-sm">
                          <Paperclip class="w-3 h-3 text-gray-400" />
                          <span class="max-w-[160px] truncate">{photo}</span>
                          {#if canAct()}
                            <button
                              onclick={() => removePhoto('hr', i)}
                              class="ml-1 text-gray-400 hover:text-red-500 transition-colors"
                            >
                              <X class="w-3 h-3" />
                            </button>
                          {/if}
                        </span>
                      {/each}
                    </div>
                  {/if}
                  {#if canAct()}
                    <button
                      onclick={() => addPhoto('hr')}
                      class="px-3 py-1.5 text-xs bg-white border border-gray-300 rounded-md text-gray-600 hover:bg-orange-50 hover:border-orange-400 hover:text-orange-600 transition-colors flex items-center gap-1"
                    >
                      <Plus class="w-3 h-3" />
                      添加证据照片
                    </button>
                  {/if}
                </div>

                <!-- 已上传附件 -->
                {#if getStepAttachments('hazard_rectification').length > 0}
                  <div class="border border-gray-200 rounded-lg p-4">
                    <label class="block text-sm font-medium text-gray-700 mb-3 flex items-center gap-1.5">
                      <Paperclip class="w-4 h-4 text-gray-500" />
                      已上传附件
                    </label>
                    <div class="space-y-2">
                      {#each getStepAttachments('hazard_rectification') as att}
                        <div class="flex items-center justify-between px-3 py-2 bg-gray-50 rounded-md">
                          <div class="flex items-center gap-2 min-w-0">
                            <Paperclip class="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                            <span class="text-xs text-gray-700 truncate">{att.file_name}</span>
                            <span class="text-xs text-gray-400 flex-shrink-0">({att.file_type})</span>
                          </div>
                          <span class="text-xs text-gray-400 flex-shrink-0 ml-2">{formatShortDate(att.created_at)}</span>
                        </div>
                      {/each}
                    </div>
                  </div>
                {/if}

                {#if canAct()}
                  <div class="flex justify-end gap-2 pt-2">
                    <button
                      onclick={() => handleAction('reject')}
                      disabled={actionLoading || !canRejectReturn('reject')}
                      class="px-4 py-2 bg-red-50 hover:bg-red-100 disabled:bg-gray-100 disabled:text-gray-400 disabled:border-gray-200 disabled:cursor-not-allowed text-red-600 text-sm rounded-md transition-colors flex items-center gap-1 border border-red-200"
                      title={!canRejectReturn('reject') ? '请填写异常原因' : ''}
                    >
                      <X class="w-4 h-4" />
                      驳回
                    </button>
                    <button
                      onclick={() => handleAction('approve')}
                      disabled={actionLoading || !canApprove()}
                      class="px-5 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 disabled:cursor-not-allowed text-white text-sm rounded-md transition-colors flex items-center gap-1"
                      title={!canApprove() ? '请填写所有必填项' : ''}
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
                  <label class="block text-sm font-medium text-gray-700 mb-1">复查结果 <span class="text-red-500">*</span></label>
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
                  <label class="block text-sm font-medium text-gray-700 mb-1">复查日期 <span class="text-red-500">*</span></label>
                  <input
                    type="date"
                    bind:value={rcDate}
                    disabled={!canAct()}
                    class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm disabled:bg-gray-50 disabled:text-gray-500 focus:ring-2 focus:ring-orange-400 focus:border-orange-400 outline-none"
                  />
                </div>

                <!-- 证据上传 -->
                <div class="border border-dashed border-gray-200 rounded-lg p-4 bg-gray-50">
                  <div class="flex items-center justify-between mb-3">
                    <label class="block text-sm font-medium text-gray-700 flex items-center gap-1.5">
                      <ImagePlus class="w-4 h-4 text-gray-500" />
                      证据上传
                    </label>
                    <span class="text-xs text-gray-500">
                      已添加 <span class="font-medium text-orange-600">{rcPhotos.length}</span> 张
                    </span>
                  </div>
                  {#if rcPhotos.length > 0}
                    <div class="flex flex-wrap gap-2 mb-3">
                      {#each rcPhotos as photo, i}
                        <span class="inline-flex items-center gap-1 px-2.5 py-1 bg-white border border-gray-200 rounded-md text-xs text-gray-700 shadow-sm">
                          <Paperclip class="w-3 h-3 text-gray-400" />
                          <span class="max-w-[160px] truncate">{photo}</span>
                          {#if canAct()}
                            <button
                              onclick={() => removePhoto('rc', i)}
                              class="ml-1 text-gray-400 hover:text-red-500 transition-colors"
                            >
                              <X class="w-3 h-3" />
                            </button>
                          {/if}
                        </span>
                      {/each}
                    </div>
                  {/if}
                  {#if canAct()}
                    <button
                      onclick={() => addPhoto('rc')}
                      class="px-3 py-1.5 text-xs bg-white border border-gray-300 rounded-md text-gray-600 hover:bg-orange-50 hover:border-orange-400 hover:text-orange-600 transition-colors flex items-center gap-1"
                    >
                      <Plus class="w-3 h-3" />
                      添加证据照片
                    </button>
                  {/if}
                </div>

                <!-- 已上传附件 -->
                {#if getStepAttachments('recheck_closure').length > 0}
                  <div class="border border-gray-200 rounded-lg p-4">
                    <label class="block text-sm font-medium text-gray-700 mb-3 flex items-center gap-1.5">
                      <Paperclip class="w-4 h-4 text-gray-500" />
                      已上传附件
                    </label>
                    <div class="space-y-2">
                      {#each getStepAttachments('recheck_closure') as att}
                        <div class="flex items-center justify-between px-3 py-2 bg-gray-50 rounded-md">
                          <div class="flex items-center gap-2 min-w-0">
                            <Paperclip class="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                            <span class="text-xs text-gray-700 truncate">{att.file_name}</span>
                            <span class="text-xs text-gray-400 flex-shrink-0">({att.file_type})</span>
                          </div>
                          <span class="text-xs text-gray-400 flex-shrink-0 ml-2">{formatShortDate(att.created_at)}</span>
                        </div>
                      {/each}
                    </div>
                  </div>
                {/if}

                {#if canAct()}
                  <div class="flex justify-end gap-2 pt-2">
                    <button
                      onclick={() => handleAction('return')}
                      disabled={actionLoading || !canRejectReturn('return')}
                      class="px-4 py-2 bg-amber-50 hover:bg-amber-100 disabled:bg-gray-100 disabled:text-gray-400 disabled:border-gray-200 disabled:cursor-not-allowed text-amber-600 text-sm rounded-md transition-colors flex items-center gap-1 border border-amber-200"
                      title={!canRejectReturn('return') ? '请填写异常原因' : ''}
                    >
                      <ArrowLeft class="w-4 h-4" />
                      退回整改
                    </button>
                    <button
                      onclick={() => handleAction('confirm')}
                      disabled={actionLoading || !canConfirm()}
                      class="px-5 py-2 bg-green-500 hover:bg-green-600 disabled:bg-green-300 disabled:cursor-not-allowed text-white text-sm rounded-md transition-colors flex items-center gap-1"
                      title={!canConfirm() ? '请填写所有必填项' : ''}
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
              <div class="mt-4 rounded-md border p-3 text-sm {
                actionErrorType() === 'auth' ? 'bg-purple-50 border-purple-200 text-purple-700' :
                actionErrorType() === 'version' ? 'bg-amber-50 border-amber-200 text-amber-700' :
                actionErrorType() === 'expiry' ? 'bg-red-50 border-red-200 text-red-700' :
                actionErrorType() === 'validation' ? 'bg-blue-50 border-blue-200 text-blue-700' :
                'bg-red-50 border-red-200 text-red-600'
              }">
                <div class="font-medium mb-1">
                  {actionErrorType() === 'auth' ? '🔒 权限问题' :
                   actionErrorType() === 'version' ? '⚠️ 版本冲突' :
                   actionErrorType() === 'expiry' ? '⏰ 到期拦截' :
                   actionErrorType() === 'validation' ? '📝 表单校验' :
                   '❌ 操作失败'}
                </div>
                <div>{actionError}</div>
                {#if actionErrorType() === 'version'}
                  <button on:click={loadOrder} class="mt-2 text-xs text-amber-600 underline hover:text-amber-800">
                    点击刷新工单后重试
                  </button>
                {/if}
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
                <label class="block text-xs font-medium text-gray-600 mb-1">
                  异常原因
                  {#if order.current_step === 'hazard_rectification' || order.current_step === 'recheck_closure'}
                    <span class="text-red-500 ml-0.5" title="驳回/退回时必填">*</span>
                  {/if}
                </label>
                <textarea
                  bind:value={anomalyReason}
                  rows="2"
                  class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-orange-400 focus:border-orange-400 outline-none resize-none"
                  placeholder={order.current_step === 'hazard_rectification' || order.current_step === 'recheck_closure' ? '驳回/退回时必填，请填写异常原因...' : '可选：填写异常原因...'}
                ></textarea>
                {#if (order.current_step === 'hazard_rectification' || order.current_step === 'recheck_closure') && !anomalyReason.trim()}
                  <p class="mt-1 text-xs text-amber-600">
                    提示：执行{order.current_step === 'hazard_rectification' ? '驳回' : '退回'}操作时，异常原因为必填项
                  </p>
                {/if}
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
            <div class="py-1">
              <div class="flex justify-between items-center mb-1">
                <dt class="text-gray-500">截止日期</dt>
                <dd class="text-gray-800 {order.expiry_status === 'overdue' ? 'text-red-600 font-medium' : order.expiry_status === 'near_expiry' ? 'text-yellow-600 font-medium' : ''}">
                  {formatShortDate(order.deadline)}
                </dd>
              </div>
              <div class="flex items-center justify-end gap-1">
                <span class="text-xs px-2 py-0.5 rounded flex items-center gap-1 {
                  order.expiry_status === 'overdue' ? 'bg-red-100 text-red-700' :
                  order.expiry_status === 'near_expiry' ? 'bg-yellow-100 text-yellow-700' :
                  'bg-green-100 text-green-700'
                }">
                  <CalendarClock class="w-3 h-3" />
                  {getExpiryText(order.deadline, order.expiry_status)}
                </span>
              </div>
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
