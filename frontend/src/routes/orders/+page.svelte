<script>
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { api, STATUS_LABELS, WARNING_LABELS, PRIORITY_LABELS, ROLE_LABELS, formatDate } from '$lib/api.js';
  import { currentUser as userStore } from '$lib/stores';

  $: user = $userStore;
  let orders = [];
  let users = [];
  let allOrders = [];
  let loading = true;
  let error = '';
  let keyword = '';
  let fStatus = '';
  let fOwner = '';
  let fHandler = '';
  let fPriority = '';
  let fWarning = '';
  let tab = 'all';
  let selected = new Set();
  let showCreate = false;
  let batchResult = null;
  let batchLoading = false;

  $: filtered = orders;

  async function load() {
    loading = true;
    error = '';
    const params = {};
    if (keyword) params.keyword = keyword;
    if (fStatus) params.status = fStatus;
    if (fOwner) params.owner_id = fOwner;
    if (fHandler) params.current_handler_id = fHandler;
    if (fPriority) params.priority = fPriority;
    if (fWarning) params.warning = fWarning;
    try {
      orders = await api.listAppointments(params);
      allOrders = orders;
    } catch (e) { error = e.message; }
    loading = false;
  }

  function applyTabFilter(t) {
    tab = t;
    if (t === 'all') { fStatus = ''; }
    else if (t === 'draft') { fStatus = 'DRAFT'; }
    else if (t === 'process') { fStatus = 'PENDING'; }
    else if (t === 'review') { fStatus = 'PENDING'; }
    else if (t === 'archived') { fStatus = 'ARCHIVED'; }
    else if (t === 'returned') { fStatus = 'RETURNED'; }
    load();
  }

  function toggleSelect(id) {
    if (selected.has(id)) selected.delete(id); else selected.add(id);
    selected = selected;
  }

  function selectAll() {
    if (selected.size === orders.length) selected = new Set();
    else selected = new Set(orders.map(o => o.id));
  }

  async function doBatch(action) {
    if (selected.size === 0) return;
    batchLoading = true;
    batchResult = null;
    try {
      const versionMap = {};
      for (const o of orders) { if (selected.has(o.id)) versionMap[o.id] = o.version; }
      batchResult = await api.batchAction({ ids: [...selected], action, version_map: versionMap });
      selected = new Set();
      load();
    } catch (e) { error = e.message; }
    batchLoading = false;
  }

  let newForm = {
    title: '', experiment_name: '', experiment_room: '', student_count: 0,
    course_name: '', teacher_name: '', materials_requested: '',
    safety_confirmed: false, safety_note: '', priority: 'NORMAL'
  };

  async function createOrder() {
    try {
      if (!newForm.title || !newForm.experiment_name) { error = '标题和实验名称必填'; return; }
      await api.createAppointment(newForm);
      showCreate = false;
      newForm = { title: '', experiment_name: '', experiment_room: '', student_count: 0, course_name: '', teacher_name: '', materials_requested: '', safety_confirmed: false, safety_note: '', priority: 'NORMAL' };
      load();
    } catch (e) { error = e.message; }
  }

  onMount(async () => {
    if (!user) { goto('/login'); return; }
    try { users = await api.listUsers(); } catch(_) {}
    const url = new URLSearchParams(window.location.search);
    if (url.get('tab')) applyTabFilter(url.get('tab'));
    else load();
  });

  function canCreate() { return user && (user.role === 'TA' || user.role === 'ADMIN'); }
  function canBatchArchive() { return user && user.role === 'DEAN'; }
</script>

<h1 class="page-title">实验预约单管理</h1>

{#if error}
  <div class="alert alert-danger">{error}</div>
{/if}

{#if batchResult}
  <div class="alert {batchResult.success_count === batchResult.total ? 'alert-success' : 'alert-warning'}">
    批量处理结果：成功 {batchResult.success_count}/{batchResult.total} 条
    <ul>
      {#each batchResult.items as it}
        <li>
        ID#{it.id}：{it.ok ? '✅ ' + it.reason : '❌ ' + it.reason}
        </li>
      {/each}
    </ul>
  </div>
{/if}

<div class="tabs">
  <button class="tab {tab === 'all' ? 'active' : ''}" on:click={() => applyTabFilter('all')}>全部</button>
  <button class="tab {tab === 'draft' ? 'active' : ''}" on:click={() => applyTabFilter('draft')}>📝 草稿</button>
  <button class="tab {tab === 'process' ? 'active' : ''}" on:click={() => applyTabFilter('process')}>🔍 过程核验(待复核)</button>
  <button class="tab {tab === 'review' ? 'active' : ''}" on:click={() => applyTabFilter('review')}>✅ 复核归档(待复核)</button>
  <button class="tab {tab === 'returned' ? 'active' : ''}" on:click={() => applyTabFilter('returned')}>↩️ 退回补正</button>
  <button class="tab {tab === 'archived' ? 'active' : ''}" on:click={() => applyTabFilter('archived')}>📦 已归档</button>
</div>

<div class="card">
  <div class="flex-between" style="margin-bottom: 16px;">
    <div class="filter-bar">
      <div class="form-group">
        <label>关键词</label>
        <input type="text" bind:value={keyword} placeholder="单号/标题" on:change={load} />
      </div>
      <div class="form-group">
        <label>状态</label>
        <select bind:value={fStatus} on:change={load}>
          <option value="">全部</option>
          <option value="DRAFT">草稿</option>
          <option value="PENDING">待复核</option>
          <option value="RETURNED">退回补正</option>
          <option value="ARCHIVED">已归档</option>
        </select>
      </div>
      <div class="form-group">
        <label>责任人(创建人)</label>
        <select bind:value={fOwner} on:change={load}>
          <option value="">全部</option>
          {#each users as u}
            <option value={u.id}>{u.name}({ROLE_LABELS[u.role]})</option>
          {/each}
        </select>
      </div>
      <div class="form-group">
        <label>当前处理人</label>
        <select bind:value={fHandler} on:change={load}>
          <option value="">全部</option>
          {#each users as u}
            <option value={u.id}>{u.name}({ROLE_LABELS[u.role]})</option>
          {/each}
        </select>
      </div>
      <div class="form-group">
        <label>优先级</label>
        <select bind:value={fPriority} on:change={load}>
          <option value="">全部</option>
          <option value="LOW">低</option>
          <option value="NORMAL">中</option>
          <option value="HIGH">高</option>
          <option value="URGENT">紧急</option>
        </select>
      </div>
      <div class="form-group">
        <label>到期预警</label>
        <select bind:value={fWarning} on:change={load}>
          <option value="">全部</option>
          <option value="normal">正常</option>
          <option value="warning">临期</option>
          <option value="overdue">逾期</option>
        </select>
      </div>
      <button class="btn" on:click={load}>🔄 刷新</button>
    </div>
    <div class="flex-gap">
      {#if selected.size > 0}
        <span>已选 {selected.size} 条</span>
        {#if canBatchArchive()}
          <button class="btn btn-success btn-sm" disabled={batchLoading} on:click={() => doBatch('archive_dean')}>批量归档</button>
          <button class="btn btn-warning btn-sm" disabled={batchLoading} on:click={() => doBatch('return_dean')}>批量退回</button>
        {/if}
      {/if}
      {#if canCreate()}
        <button class="btn btn-primary" on:click={() => showCreate = true}>+ 新建预约单</button>
      {/if}
    </div>
  </div>

  {#if loading}
    <div class="empty-state">加载中...</div>
  {:else if orders.length === 0}
    <div class="empty-state">暂无数据</div>
  {:else}
    <table>
      <thead>
        <tr>
          <th style="width:40px"><input type="checkbox" on:change={selectAll} /></th>
          <th>单号</th>
          <th>标题</th>
          <th>实验名称</th>
          <th>状态</th>
          <th>优先级</th>
          <th>预警</th>
          <th>责任人</th>
          <th>当前处理人</th>
          <th>截止时间</th>
          <th>操作</th>
        </tr>
      </thead>
      <tbody>
        {#each orders as o}
          <tr>
            <td><input type="checkbox" checked={selected.has(o.id)} on:change={() => toggleSelect(o.id)} /></td>
            <td><code>{o.order_no}</code></td>
            <td on:click={() => goto(`/orders/${o.id}`)} style="cursor:pointer">{o.title}</td>
            <td>{o.experiment_name}</td>
            <td><span class="badge badge-{o.status.toLowerCase()}">{STATUS_LABELS[o.status]}</span></td>
            <td><span class="badge badge-prio-{o.priority.toLowerCase()}">{PRIORITY_LABELS[o.priority]}</span></td>
            <td>
              {#if o.is_overdue}
                <span class="badge badge-overdue" title="责任人：{o.current_handler_name || o.owner_name}">⚠️ 逾期 · {o.current_handler_name || o.owner_name}</span>
              {:else}
                <span class="badge badge-{o.warning_level}">{WARNING_LABELS[o.warning_level]}</span>
              {/if}
            </td>
            <td>{o.owner_name}</td>
            <td>{o.current_handler_name || '-'}</td>
            <td>{o.deadline ? formatDate(o.deadline) : '-'}</td>
            <td><button class="btn btn-sm" on:click={() => goto(`/orders/${o.id}`)}>查看</button></td>
          </tr>
        {/each}
      </tbody>
    </table>
  {/if}
</div>

{#if showCreate}
  <div class="modal-overlay" on:click|self={() => showCreate = false}>
    <div class="modal">
      <h3>新建实验预约单</h3>
      <div class="form-row">
        <div class="form-group">
          <label>预约单标题 *</label>
          <input type="text" bind:value={newForm.title} placeholder="如：有机化学实验预约" />
        </div>
        <div class="form-group">
          <label>实验名称 *</label>
          <input type="text" bind:value={newForm.experiment_name} />
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>实验室</label>
          <input type="text" bind:value={newForm.experiment_room} />
        </div>
        <div class="form-group">
          <label>课程名称</label>
          <input type="text" bind:value={newForm.course_name} />
        </div>
        <div class="form-group">
          <label>授课教师</label>
          <input type="text" bind:value={newForm.teacher_name} />
        </div>
        <div class="form-group">
          <label>学生人数</label>
          <input type="number" bind:value={newForm.student_count} />
        </div>
      </div>
      <div class="form-row">
        <div class="form-group full">
          <label>耗材申领</label>
          <textarea bind:value={newForm.materials_requested} placeholder="列出所需耗材..." />
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>优先级</label>
          <select bind:value={newForm.priority}>
            <option value="LOW">低</option>
            <option value="NORMAL">中</option>
            <option value="HIGH">高</option>
            <option value="URGENT">紧急</option>
          </select>
        </div>
        <div class="form-group" style="justify-content:center">
          <label class="checkbox-row">
            <input type="checkbox" bind:checked={newForm.safety_confirmed} />
            已完成安全确认
          </label>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group full">
          <label>安全备注</label>
          <textarea bind:value={newForm.safety_note} />
        </div>
      </div>
      <div class="flex-gap" style="justify-content:flex-end">
        <button class="btn" on:click={() => showCreate = false}>取消</button>
        <button class="btn btn-primary" on:click={createOrder}>创建草稿</button>
      </div>
    </div>
  </div>
{/if}
