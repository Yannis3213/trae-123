<script>
  import '../app.css';
  import { page } from '$app/stores';
  import { currentUser } from '$lib/stores';
  import { ROLE_LABELS } from '$lib/api';
  import { goto } from '$app/navigation';

  $: user = $currentUser;
  $: path = $page.url.pathname;

  const navItems = [
    { path: '/', label: '工作台', icon: '🏠' },
    { path: '/orders', label: '预约单登记', icon: '📋' },
    { path: '/orders?tab=process', label: '过程核验', icon: '🔍' },
    { path: '/orders?tab=review', label: '复核归档', icon: '✅' }
  ];

  function isActive(item) {
    if (item.path === '/') return path === '/';
    return path.startsWith('/orders');
  }

  function logout() {
    currentUser.logout();
    goto('/login');
  }
</script>

{#if user}
  <div class="layout">
    <aside class="sidebar">
      <h1>高校实验室<br/>月底集中处理系统</h1>
      {#each navItems as item}
        <a href={item.path} class="nav-item {isActive(item) ? 'active' : ''}">
          {item.icon} &nbsp; {item.label}
        </a>
      {/each}
      <div class="user-box">
        <div class="name">{user.name}</div>
        <div class="role">{ROLE_LABELS[user.role]}</div>
        <button class="logout-btn" on:click={logout}>切换角色/退出</button>
      </div>
    </aside>
    <main class="main">
      <slot />
    </main>
  </div>
{:else}
  <slot />
{/if}
