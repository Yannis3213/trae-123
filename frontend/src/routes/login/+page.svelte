<script>
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { api, ROLE_LABELS } from '$lib/api';
  import { currentUser } from '$lib/stores';

  let users = [];
  let loading = true;
  let error = '';

  const roleIcons = { TA: 'TA', ADMIN: 'AD', DEAN: 'DN' };
  const roleDescs = {
    TA: '创建预约单、提交复核、处理退回补正',
    ADMIN: '核验过程、补充证据、退回补正或转交复核',
    DEAN: '最终复核、归档或退回，批量处理审核'
  };

  onMount(async () => {
    try {
      users = await api.listUsers();
    } catch (e) {
      error = '无法加载用户列表，请确认后端服务已启动 (端口 8001)';
    }
    loading = false;
  });

  async function loginAs(u) {
    try {
      const user = await api.login(u.username);
      currentUser.login(user);
      goto('/');
    } catch (e) {
      error = e.message;
    }
  }
</script>

<div class="login-page">
  <div class="login-card">
    <h1>高校实验室-月底集中处理实验预约单系统</h1>
    <div class="subtitle">请选择角色登录</div>

    {#if error}
      <div class="alert alert-danger">{error}</div>
    {/if}

    {#if loading}
      <div class="empty-state">加载中...</div>
    {:else if users.length === 0}
      <div class="alert alert-warning">
        暂无用户数据，请先运行演示数据初始化脚本
      </div>
    {:else}
      <div class="role-list">
        {#each users as u}
          <button class="role-btn" on:click={() => loginAs(u)}>
            <div class="role-icon">{roleIcons[u.role] || '?'}</div>
            <div class="role-info">
              <div class="name">{u.name} · {ROLE_LABELS[u.role]}</div>
              <div class="desc">{roleDescs[u.role]}</div>
            </div>
          </button>
        {/each}
      </div>
    {/if}
  </div>
</div>
