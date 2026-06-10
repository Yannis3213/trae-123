<script>
  import { goto } from '$app/navigation';
  import { userStore } from '$lib/stores';
  import { authApi } from '$lib/api';
  import { onMount } from 'svelte';

  let username = 'registrar';
  let password = '123456';
  let loading = false;
  let errorMsg = '';

  onMount(async () => {
    const res = await authApi.me();
    if (res.success && res.user) {
      goto('/orders');
    }
  });

  async function handleLogin() {
    loading = true;
    errorMsg = '';
    try {
      const res = await authApi.login(username, password);
      if (res.success) {
        userStore.set(res.user);
        goto('/orders');
      } else {
        errorMsg = res.message;
      }
    } catch (e) {
      errorMsg = '登录失败，请检查后端服务是否启动';
    }
    loading = false;
  }

  async function quickLogin(user) {
    username = user;
    password = '123456';
  }

  const demoUsers = [
    { username: 'registrar', name: '张登记', role: '物料变更登记员' },
    { username: 'material', name: '李物料', role: '物料员' },
    { username: 'quality', name: '王品质', role: '品质工程师' },
    { username: 'auditor', name: '赵主管', role: '物料变更审核主管' },
    { username: 'pm', name: '钱经理', role: '生产经理' },
    { username: 'factory', name: '孙复核', role: '电子元器件工厂复核负责人' },
  ];
</script>

<div class="login-page">
  <div class="login-box">
    <h1>电子元器件工厂</h1>
    <h2>月底集中处理物料变更单系统</h2>

    {#if errorMsg}
      <div class="error-msg">{errorMsg}</div>
    {/if}

    <div class="form-group">
      <label>用户名</label>
      <input type="text" bind:value={username} placeholder="请输入用户名" />
    </div>
    <div class="form-group">
      <label>密码</label>
      <input type="password" bind:value={password} placeholder="请输入密码" />
    </div>
    <button class="btn btn-primary login-btn" on:click={handleLogin} disabled={loading}>
      {loading ? '登录中...' : '登录'}
    </button>

    <div class="demo-users">
      <p class="demo-title">快速登录（演示账号，密码均为 123456）</p>
      <div class="user-grid">
        {#each demoUsers as user}
          <button class="btn btn-default btn-sm" on:click={() => quickLogin(user.username)}>
            {user.name}
            <span class="role-tag">{user.role}</span>
          </button>
        {/each}
      </div>
    </div>
  </div>
</div>

<style>
  .login-page {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  }
  .login-box {
    background: white;
    padding: 40px;
    border-radius: 12px;
    box-shadow: 0 20px 60px rgba(0,0,0,0.3);
    width: 420px;
  }
  h1 {
    font-size: 22px;
    color: #1f2937;
    text-align: center;
    margin-bottom: 8px;
  }
  h2 {
    font-size: 16px;
    color: #6b7280;
    text-align: center;
    margin-bottom: 28px;
    font-weight: normal;
  }
  .error-msg {
    background: #fef2f2;
    color: #dc2626;
    padding: 10px 12px;
    border-radius: 6px;
    margin-bottom: 16px;
    font-size: 14px;
  }
  .login-btn {
    width: 100%;
    padding: 10px;
    font-size: 16px;
    margin-top: 8px;
  }
  .demo-users {
    margin-top: 28px;
    padding-top: 20px;
    border-top: 1px solid #e5e7eb;
  }
  .demo-title {
    font-size: 13px;
    color: #6b7280;
    margin-bottom: 12px;
    text-align: center;
  }
  .user-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }
  .user-grid button {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    padding: 8px;
    text-align: center;
  }
  .role-tag {
    font-size: 11px;
    color: #9ca3af;
  }
</style>
