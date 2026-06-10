<script>
  import { goto } from '$app/navigation';
  import { orderApi } from '$lib/api';
  import { userStore, statusColors, warnColors } from '$lib/stores';
  import { onMount, onDestroy } from 'svelte';
  import dayjs from 'dayjs';

  let orders = [];
  let statistics = {};
  let statusOptions = [];
  let changeTypeOptions = [];
  let urgencyOptions = [];
  let warnOptions = [];
  let loading = false;

  let filters = {
    status: '',
    warn_status: '',
    change_type: '',
    urgency: '',
    keyword: '',
    mine: false,
  };

  let selected = new Set();
  let selectedAll = false;

  let showCreateModal = false;
  let showBatchModal = false;
  let batchAction = '';
  let batchComment = '';
  let batchReturnReason = '';
  let batchResults = [];
  let showBatchResult = false;

  let user = null;
  let refreshTimer = null;

  $: userStore.subscribe(u => user = u);

  async function loadData() {
    loading = true;
    try {
      const [listRes, statsRes] = await Promise.all([
        orderApi.list({ ...filters, page: 1, page_size: 50 }),
        orderApi.statistics(),
      ]);
      orders = listRes;
      statistics = statsRes;
    } catch (e) {
      console.error('加载失败', e);
    }
    loading = false;
  }

  async function loadMeta() {
    const [s, ct, u, w] = await Promise.all([
      orderApi.metaStatus(),
      orderApi.metaChangeType(),
      orderApi.metaUrgency(),
      orderApi.metaWarn(),
    ]);
    statusOptions = s;
    changeTypeOptions = ct;
    urgencyOptions = u;
    warnOptions = w;
  }

  async function refreshWarnings() {
    await orderApi.refreshWarnings();
    loadData();
  }

  function toggleSelectAll() {
    if (selectedAll) {
      selected = new Set();
    } else {
      selected = new Set(orders.map(o => o.id));
    }
    selectedAll = !selectedAll;
  }

  function toggleSelect(id) {
    const s = new Set(selected);
    if (s.has(id)) {
      s.delete(id);
    } else {
      s.add(id);
    }
    selected = s;
    selectedAll = s.size === orders.length && orders.length > 0;
  }

  function openBatch(action) {
    batchAction = action;
    batchComment = '';
    batchReturnReason = '';
    showBatchModal = true;
  }

  async function doBatchAction() {
    if (selected.size === 0) return;
    showBatchModal = false;

    const orderIds = Array.from(selected);
    const res = await orderApi.batchAction({
      order_ids: orderIds,
      action: batchAction,
      comment: batchComment,
      return_reason: batchReturnReason,
    });
    batchResults = res;
    showBatchResult = true;
    loadData();
    selected = new Set();
    selectedAll = false;
  }

  function viewDetail(id) {
    goto(`/orders/${id}`);
  }

  function statusColor(status) {
    return statusColors[status] || '#9ca3af';
  }

  function warnColor(warn) {
    return warnColors[warn] || '#22c55e';
  }

  function formatDate(d) {
    if (!d) return '-';
    return dayjs(d).format('YYYY-MM-DD HH:mm');
  }

  onMount(() => {
    loadMeta();
    loadData();
    refreshTimer = setInterval(loadData, 60000);
  });

  onDestroy(() => {
    if (refreshTimer) clearInterval(refreshTimer);
  });

  let newOrder = {
    title: '',
    change_type: 'bom_change',
    urgency: 'normal',
    old_material_code: '',
    old_material_name: '',
    new_material_code: '',
    new_material_name: '',
    change_reason: '',
  };
  let creating = false;

  async function createOrder() {
    creating = true;
    const res = await orderApi.create(newOrder);
    creating = false;
    if (res.success) {
      showCreateModal = false;
      loadData();
    } else {
      alert(res.message);
    }
  }

  const warnGroups = [
    { key: 'overdue', label: '逾期', color: 'bg-red-500' },
    { key: 'near_deadline', label: '临期', color: 'bg-amber-500' },
    { key: 'normal', label: '正常', color: 'bg-green-500' },
  ];

  function filterByWarn(status) {
    if (filters.warn_status === status) {
      filters.warn_status = '';
    } else {
      filters.warn_status = status;
    }
    loadData();
  }

  const batchActions = [
    { action: 'confirm_bom', label: '确认BOM', roles: ['material_officer'] },
    { action: 'check_substitute', label: '核对替代', roles: ['quality_engineer'] },
    { action: 'verify_pilot', label: '完成试产', roles: ['quality_engineer'] },
    { action: 'audit_pass', label: '审核通过', roles: ['auditor'] },
    { action: 'return', label: '批量退回', roles: ['auditor', 'production_manager', 'factory_reviewer'] },
  ];

  function canBatch(action) {
    if (!user) return false;
    const cfg = batchActions.find(a => a.action === action);
    return cfg ? cfg.roles.includes(user.role) : false;
  }
</script>

<div class="page">
  <div class="stats-row">
    <div class="stat-card">
      <div class="stat-value">{statistics.total || 0}</div>
      <div class="stat-label">全部单据</div>
    </div>
    <div class="stat-card warn-overdue">
      <div class="stat-value">{statistics.warn_overdue || 0}</div>
      <div class="stat-label">逾期</div>
    </div>
    <div class="stat-card warn-near">
      <div class="stat-value">{statistics.warn_near_deadline || 0}</div>
      <div class="stat-label">临期</div>
    </div>
    <div class="stat-card warn-normal">
      <div class="stat-value">{statistics.warn_normal || 0}</div>
      <div class="stat-label">正常</div>
    </div>
  </div>

  <div class="warn-groups">
    {#each warnGroups as g}
      <div class="warn-group-card {filters.warn_status === g.key ? 'active' : ''}" on:click={() => filterByWarn(g.key)}>
        <div class="warn-group-header">
          <div class="warn-dot {g.color}"></div>
          <span class="warn-label">{g.label}</span>
          <span class="warn-count">{g.key === 'overdue' ? statistics.warn_overdue : g.key === 'near_deadline' ? statistics.warn_near_deadline : statistics.warn_normal || 0}</span>
        </div>
      </div>
    {/each}
  </div>

  <div class="filters card">
    <div class="filter-row">
      <div class="filter-item">
        <label>状态</label>
        <select bind:value={filters.status} on:change={loadData}>
          <option value="">全部</option>
          {#each statusOptions as opt}
            <option value={opt.value}>{opt.label}</option>
          {/each}
        </select>
      </div>
      <div class="filter-item">
        <label>预警</label>
        <select bind:value={filters.warn_status} on:change={loadData}>
          <option value="">全部</option>
          {#each warnOptions as opt}
            <option value={opt.value}>{opt.label}</option>
          {/each}
        </select>
      </div>
      <div class="filter-item">
        <label>变更类型</label>
        <select bind:value={filters.change_type} on:change={loadData}>
          <option value="">全部</option>
          {#each changeTypeOptions as opt}
            <option value={opt.value}>{opt.label}</option>
          {/each}
        </select>
      </div>
      <div class="filter-item">
        <label>紧急程度</label>
        <select bind:value={filters.urgency} on:change={loadData}>
          <option value="">全部</option>
          {#each urgencyOptions as opt}
            <option value={opt.value}>{opt.label}</option>
          {/each}
        </select>
      </div>
      <div class="filter-item">
        <label>关键词</label>
        <input type="text" bind:value={filters.keyword} placeholder="单号/物料编码/名称" on:keydown={e => e.key === 'Enter' && loadData()} />
      </div>
      <div class="filter-item checkbox-item">
        <input type="checkbox" id="mine" bind:checked={filters.mine} on:change={loadData} />
        <label for="mine">只看我的</label>
      </div>
    </div>
    <div class="filter-actions">
      <button class="btn btn-primary btn-sm" on:click={loadData}>查询</button>
      <button class="btn btn-default btn-sm" on:click={refreshWarnings}>刷新预警</button>
      {#if user && user.role === 'registrar'}
        <button class="btn btn-success btn-sm" on:click={() => showCreateModal = true}>+ 新建变更单</button>
      {/if}
    </div>
  </div>

  {#if selected.size > 0}
    <div class="batch-bar">
      <span>已选择 {selected.size} 项</span>
      <div class="batch-actions">
        {#if canBatch('confirm_bom')}
          <button class="btn btn-primary btn-sm" on:click={() => openBatch('confirm_bom')}>批量确认BOM</button>
        {/if}
        {#if canBatch('check_substitute')}
          <button class="btn btn-primary btn-sm" on:click={() => openBatch('check_substitute')}>批量核对替代</button>
        {/if}
        {#if canBatch('verify_pilot')}
          <button class="btn btn-primary btn-sm" on:click={() => openBatch('verify_pilot')}>批量完成试产</button>
        {/if}
        {#if canBatch('audit_pass')}
          <button class="btn btn-success btn-sm" on:click={() => openBatch('audit_pass')}>批量审核通过</button>
        {/if}
        {#if canBatch('return')}
          <button class="btn btn-danger btn-sm" on:click={() => openBatch('return')}>批量退回</button>
        {/if}
      </div>
    </div>
  {/if}

  <div class="table-card card">
    {#if loading}
      <div class="loading">加载中...</div>
    {:else}
      <table>
        <thead>
          <tr>
            <th style="width: 40px;">
              <input type="checkbox" checked={selectedAll} on:change={toggleSelectAll} />
            </th>
            <th>单号</th>
            <th>标题</th>
            <th>状态</th>
            <th>预警</th>
            <th>变更类型</th>
            <th>紧急度</th>
            <th>原物料</th>
            <th>新物料</th>
            <th>当前处理人</th>
            <th>截止时间</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          {#each orders as order}
            <tr>
              <td>
                <input type="checkbox" checked={selected.has(order.id)} on:change={() => toggleSelect(order.id)} />
              </td>
              <td><span class="order-no">{order.order_no}</span></td>
              <td>{order.title}</td>
              <td>
                <span class="tag" style="background: {statusColor(order.status)}20; color: {statusColor(order.status)};">
                  {order.status_display}
                </span>
              </td>
              <td>
                <span class="tag warn-tag" style="background: {warnColor(order.warn_status)}20; color: {warnColor(order.warn_status)};">
                  {order.warn_status_display}
                </span>
              </td>
              <td>{order.change_type_display}</td>
              <td>{order.urgency_display}</td>
              <td><span class="material-code">{order.old_material_code}</span></td>
              <td><span class="material-code">{order.new_material_code || '-'}</span></td>
              <td>{order.current_handler || '-'}</td>
              <td>{formatDate(order.deadline)}</td>
              <td>
                <button class="btn btn-primary btn-sm" on:click={() => viewDetail(order.id)}>详情</button>
              </td>
            </tr>
          {/each}
          {#if orders.length === 0}
            <tr>
              <td colspan="12" class="empty">暂无数据</td>
            </tr>
          {/if}
        </tbody>
      </table>
    {/if}
  </div>
</div>

{#if showCreateModal}
  <div class="modal-mask" on:click|self={() => showCreateModal = false}>
    <div class="modal-content">
      <div class="modal-header">新建物料变更单</div>
      <div class="modal-body">
        <div class="form-group">
          <label>标题</label>
          <input type="text" bind:value={newOrder.title} placeholder="请输入标题" />
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>变更类型</label>
            <select bind:value={newOrder.change_type}>
              {#each changeTypeOptions as opt}
                <option value={opt.value}>{opt.label}</option>
              {/each}
            </select>
          </div>
          <div class="form-group">
            <label>紧急程度</label>
            <select bind:value={newOrder.urgency}>
              {#each urgencyOptions as opt}
                <option value={opt.value}>{opt.label}</option>
              {/each}
            </select>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>原物料编码</label>
            <input type="text" bind:value={newOrder.old_material_code} />
          </div>
          <div class="form-group">
            <label>原物料名称</label>
            <input type="text" bind:value={newOrder.old_material_name} />
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>新物料编码</label>
            <input type="text" bind:value={newOrder.new_material_code} />
          </div>
          <div class="form-group">
            <label>新物料名称</label>
            <input type="text" bind:value={newOrder.new_material_name} />
          </div>
        </div>
        <div class="form-group">
          <label>变更原因</label>
          <textarea bind:value={newOrder.change_reason} rows="3"></textarea>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-default" on:click={() => showCreateModal = false}>取消</button>
        <button class="btn btn-primary" on:click={createOrder} disabled={creating}>
          {creating ? '创建中...' : '创建'}
        </button>
      </div>
    </div>
  </div>
{/if}

{#if showBatchModal}
  <div class="modal-mask" on:click|self={() => showBatchModal = false}>
    <div class="modal-content">
      <div class="modal-header">
        {batchAction === 'return' ? '批量退回' : '批量操作'}
      </div>
      <div class="modal-body">
        <p>确定对选中的 {selected.size} 项执行此操作吗？</p>
        {#if batchAction === 'return'}
          <div class="form-group">
            <label>退回原因</label>
            <textarea bind:value={batchReturnReason} rows="3" placeholder="请输入退回原因"></textarea>
          </div>
        {/if}
        <div class="form-group">
          <label>备注</label>
          <textarea bind:value={batchComment} rows="2"></textarea>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-default" on:click={() => showBatchModal = false}>取消</button>
        <button class="btn btn-primary" on:click={doBatchAction}>确认</button>
      </div>
    </div>
  </div>
{/if}

{#if showBatchResult}
  <div class="modal-mask" on:click|self={() => showBatchResult = false}>
    <div class="modal-content">
      <div class="modal-header">批量操作结果</div>
      <div class="modal-body">
        <table>
          <thead>
            <tr>
              <th>订单ID</th>
              <th>结果</th>
              <th>说明</th>
            </tr>
          </thead>
          <tbody>
            {#each batchResults as r}
              <tr>
                <td>{r.order_id}</td>
                <td>
                  <span class="tag" style="background: {r.success ? '#22c55e20' : '#ef444420'}; color: {r.success ? '#22c55e' : '#ef4444'};">
                    {r.success ? '成功' : '失败'}
                  </span>
                </td>
                <td>{r.message}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
      <div class="modal-footer">
        <button class="btn btn-primary" on:click={() => showBatchResult = false}>确定</button>
      </div>
    </div>
  </div>
{/if}

<style>
  .page {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  .stats-row {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 16px;
  }
  .stat-card {
    background: white;
    border-radius: 8px;
    padding: 20px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.1);
  }
  .stat-value {
    font-size: 28px;
    font-weight: 700;
    color: #1f2937;
  }
  .stat-label {
    font-size: 13px;
    color: #6b7280;
    margin-top: 4px;
  }
  .warn-overdue .stat-value { color: #ef4444; }
  .warn-near .stat-value { color: #f59e0b; }
  .warn-normal .stat-value { color: #22c55e; }

  .warn-groups {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 16px;
  }
  .warn-group-card {
    background: white;
    border-radius: 8px;
    padding: 16px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    cursor: pointer;
    transition: all 0.2s;
    border: 2px solid transparent;
  }
  .warn-group-card:hover {
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    transform: translateY(-2px);
  }
  .warn-group-card.active {
    border-color: #3b82f6;
    background: #eff6ff;
  }
  .warn-group-header {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .warn-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
  }
  .warn-label {
    font-size: 14px;
    color: #374151;
  }
  .warn-count {
    margin-left: auto;
    font-weight: 600;
    font-size: 16px;
  }
  .bg-red-500 { background: #ef4444; }
  .bg-amber-500 { background: #f59e0b; }
  .bg-green-500 { background: #22c55e; }

  .filters {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .filter-row {
    display: flex;
    gap: 16px;
    flex-wrap: wrap;
    align-items: flex-end;
  }
  .filter-item {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .filter-item label {
    font-size: 12px;
    color: #6b7280;
  }
  .filter-item select,
  .filter-item input {
    padding: 6px 10px;
    border: 1px solid #d1d5db;
    border-radius: 6px;
    font-size: 13px;
    min-width: 140px;
  }
  .checkbox-item {
    flex-direction: row;
    align-items: center;
    gap: 6px;
    padding-bottom: 6px;
  }
  .filter-actions {
    display: flex;
    gap: 10px;
    justify-content: flex-end;
  }

  .batch-bar {
    background: #eff6ff;
    border: 1px solid #bfdbfe;
    border-radius: 8px;
    padding: 10px 16px;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .batch-actions {
    display: flex;
    gap: 8px;
  }

  .table-card {
    padding: 0;
    overflow: hidden;
  }
  .order-no {
    font-family: monospace;
    font-size: 13px;
    color: #3b82f6;
    font-weight: 500;
  }
  .material-code {
    font-family: monospace;
    font-size: 12px;
    color: #6b7280;
  }
  .empty {
    text-align: center;
    color: #9ca3af;
    padding: 40px;
  }
  .loading {
    text-align: center;
    padding: 40px;
    color: #6b7280;
  }
  .modal-body {
    padding: 0;
  }
</style>
