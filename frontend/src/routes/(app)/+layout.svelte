<script>
  import { goto, page } from '$app/stores';
  import { userStore } from '$lib/stores';
  import { authApi } from '$lib/api';
  import { onMount } from 'svelte';

  let user = null;
  let loading = true;

  async function checkAuth() {
    loading = true;
    try {
      const res = await authApi.me();
      if (res.success && res.user) {
        userStore.set(res.user);
        user = res.user;
      } else {
        goto('/');
      }
    } catch (e) {
      console.error('Auth check failed:', e);
      goto('/');
    }
    loading = false;
  }

  async function handleLogout() {
    try {
      await authApi.logout();
    } catch (e) {
      console.error('Logout failed:', e);
    }
    userStore.set(null);
    user = null;
    goto('/');
  }

  const menuItems = [
    { path: '/orders', name: '物料变更单', icon: '📋' },
  ];

  onMount(checkAuth);

  $: userStore.subscribe(u => user = u);

  function isActive(path) {
    if (!$page) return false;
    const p = $page.url.pathname;
    return p === path || p.startsWith(path + '/');
  }
</script>

{#if loading}
  <div class="loading">加载中...</div>
{:else if user}
  <div class="layout">
    <aside class="sidebar">
      <div class="logo">
        <div class="logo-icon">⚙️</div>
        <div class="logo-text">
          <div class="logo-title">物料变更系统</div>
          <div class="logo-sub">电子元器件工厂</div>
        </div>
      </div>
      <nav class="menu">
        {#each menuItems as item}
          <a class="menu-item {isActive(item.path) ? 'active' : ''}" href={item.path}>
            <span class="menu-icon">{item.icon}</span>
            <span class="menu-text">{item.name}</span>
          </a>
        {/each}
      </nav>
    </aside>

    <div class="main">
      <header class="header">
        <div class="header-left">
          <slot name="page-title" />
        </div>
        <div class="header-right">
          <div class="user-info">
            <span class="user-name">{user.real_name}</span>
            <span class="user-role">{user.role_display}</span>
          </div>
          <button class="btn btn-default btn-sm" on:click={handleLogout}>退出</button>
        </div>
      </header>
      <div class="content">
        <slot />
      </div>
    </div>
  </div>
{:else}
  <div class="loading">加载中...</div>
{/if}

<style>
  .layout {
    display: flex;
    min-height: 100vh;
  }
  .sidebar {
    width: 220px;
    background: #1f2937;
    color: white;
    display: flex;
    flex-direction: column;
    flex-shrink: 0;
  }
  .logo {
    padding: 20px 16px;
    display: flex;
    align-items: center;
    gap: 10px;
    border-bottom: 1px solid #374151;
  }
  .logo-icon {
    font-size: 28px;
  }
  .logo-title {
    font-size: 16px;
    font-weight: 600;
  }
  .logo-sub {
    font-size: 11px;
    color: #9ca3af;
  }
  .menu {
    padding: 12px 0;
    flex: 1;
  }
  .menu-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 20px;
    color: #d1d5db;
    text-decoration: none;
    font-size: 14px;
    transition: all 0.2s;
  }
  .menu-item:hover {
    background: #374151;
    color: white;
  }
  .menu-item.active {
    background: #3b82f6;
    color: white;
  }
  .menu-icon {
    font-size: 16px;
  }
  .main {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    min-width: 0;
  }
  .header {
    background: white;
    padding: 14px 24px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-bottom: 1px solid #e5e7eb;
    height: 60px;
    flex-shrink: 0;
  }
  .header-right {
    display: flex;
    align-items: center;
    gap: 16px;
  }
  .user-info {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
  }
  .user-name {
    font-size: 14px;
    font-weight: 500;
  }
  .user-role {
    font-size: 12px;
    color: #6b7280;
  }
  .content {
    flex: 1;
    padding: 20px 24px;
    overflow: auto;
  }
  .loading {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
    color: #6b7280;
    font-size: 14px;
  }
</style>
