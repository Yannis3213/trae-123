<script>
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { api, STATUS_LABELS, WARNING_LABELS, ROLE_LABELS, formatDate } from '$lib/api.js';
  import { currentUser as userStore } from '$lib/stores';

  $: user = $userStore;
  let stats = null;
  let recent = [];
  let loading = true;
  let error = '';

  onMount(async () => {
    if (!user) { goto('/login'); return; }
    try {
      stats = await api.getStats();
      recent = await api.listAppointments({});
      recent = recent.slice(0, 6);
    } catch (e) { error = e.message; }
    loading = false;
  });
</script>

{#if loading}
  <div class="empty-state">加载中...</div>
{:else}
  <h1 class="page-title">工作台</h1>
  <p class="page-subtitle">当前角色：<b>{ROLE_LABELS[user?.role]}</b> · {user?.name}</p>

  {#if error}
    <div class="alert alert-danger">{error}</div>
  {/if}

  <div class="stats-grid">
    <div class="stat-card">
      <div class="label">预约单总数</div>
      <div class="value">{stats?.total || 0}</div>
    </div>
    <div class="stat-card">
      <div class="label">草稿</div>
      <div class="value">{stats?.by_status?.DRAFT || 0}</div>
    </div>
    <div class="stat-card">
      <div class="label">待复核</div>
      <div class="value">{stats?.by_status?.PENDING || 0}</div>
    </div>
    <div class="stat-card">
      <div class="label">已归档</div>
      <div class="value">{stats?.by_status?.ARCHIVED || 0}</div>
    </div>
    <div class="stat-card">
      <div class="label">退回补正</div>
      <div class="value">{stats?.by_status?.RETURNED || 0}</div>
    </div>
    <div class="stat-card">
      <div class="label">临期预警</div>
      <div class="value" style="color: var(--warning)">{stats?.by_warning?.warning || 0}</div>
    </div>
    <div class="stat-card">
      <div class="label">已逾期</div>
      <div class="value" style="color: var(--danger)">{stats?.by_warning?.overdue || 0}</div>
    </div>
  </div>

  <div class="card">
    <div class="section-header">
      <h3>最近预约单</h3>
      <button class="btn btn-primary btn-sm" on:click={() => goto('/orders')}>查看全部 →</button>
    </div>
    {#if recent.length === 0}
      <div class="empty-state">暂无预约单</div>
    {:else}
      <table>
        <thead>
          <tr>
            <th>单号</th>
            <th>标题</th>
            <th>状态</th>
            <th>预警</th>
            <th>当前处理人</th>
            <th>截止时间</th>
          </tr>
        </thead>
        <tbody>
          {#each recent as o}
            <tr on:click={() => goto(`/orders/${o.id}`)} style="cursor:pointer">
              <td><code>{o.order_no}</code></td>
              <td>{o.title}</td>
              <td><span class="badge badge-{o.status.toLowerCase()}">{STATUS_LABELS[o.status]}</span></td>
              <td><span class="badge badge-{o.warning_level}">{WARNING_LABELS[o.warning_level]}</span></td>
              <td>{o.current_handler_name || '-'}</td>
              <td>{o.deadline ? formatDate(o.deadline) : '-'}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    {/if}
  </div>
{/if}
