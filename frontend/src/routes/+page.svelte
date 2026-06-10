<script lang="ts">
	import { userStore } from '$lib/stores';
	import { login } from '$lib/api';
	import { goto } from '$app/navigation';

	let username = '';
	let password = '';
	let error = '';
	let loading = false;

	async function handleLogin() {
		error = '';
		loading = true;
		try {
			const user = await login(username, password);
			userStore.set(user);
			goto('/applications');
		} catch (err: any) {
			error = err.code ? `${err.code}: ${err.message}` : '登录失败，请检查用户名和密码';
		}
		loading = false;
	}

	$: if ($userStore) {
		goto('/applications');
	}
</script>

<svelte:head>
	<title>登录 - 冷链物流仓入库单系统</title>
</svelte:head>

<div class="login-container">
	<div class="login-card">
		<h2 class="login-title">冷链物流仓-月底集中处理冷链入库单系统</h2>
		<p class="login-subtitle">请登录以继续</p>

		{#if error}
			<div class="error-msg">{error}</div>
		{/if}

		<form on:submit|preventDefault={handleLogin}>
			<div class="form-group">
				<label for="username">用户名</label>
				<input id="username" type="text" bind:value={username} placeholder="请输入用户名" required />
			</div>
			<div class="form-group">
				<label for="password">密码</label>
				<input id="password" type="password" bind:value={password} placeholder="请输入密码" required />
			</div>
			<button type="submit" class="btn-login" disabled={loading}>
				{loading ? '登录中...' : '登 录'}
			</button>
		</form>

		<div class="demo-accounts">
			<p class="demo-title">演示账号</p>
			<div class="demo-item">
				<span class="demo-role">仓管员张三</span>
				<span class="demo-cred">warehouse_clerk / clerk123</span>
			</div>
			<div class="demo-item">
				<span class="demo-role">温控主管李四</span>
				<span class="demo-cred">temp_supervisor / temp123</span>
			</div>
			<div class="demo-item">
				<span class="demo-role">仓储经理王五</span>
				<span class="demo-cred">warehouse_manager / manager123</span>
			</div>
		</div>
	</div>
</div>

<style>
	.login-container {
		min-height: 100vh;
		display: flex;
		align-items: center;
		justify-content: center;
		background: linear-gradient(135deg, #1a365d 0%, #2b6cb0 100%);
	}
	.login-card {
		background: var(--card-bg);
		border-radius: 12px;
		padding: 40px;
		width: 100%;
		max-width: 420px;
		box-shadow: 0 20px 60px rgba(0,0,0,0.3);
	}
	.login-title {
		font-size: 20px;
		font-weight: 700;
		color: var(--primary);
		text-align: center;
		margin-bottom: 4px;
	}
	.login-subtitle {
		text-align: center;
		color: var(--text-light);
		margin-bottom: 28px;
		font-size: 14px;
	}
	.error-msg {
		background: #fff5f5;
		color: var(--danger);
		padding: 10px 14px;
		border-radius: 6px;
		margin-bottom: 16px;
		font-size: 13px;
		border: 1px solid #fed7d7;
	}
	.form-group {
		margin-bottom: 16px;
	}
	.form-group label {
		display: block;
		margin-bottom: 6px;
		font-size: 13px;
		font-weight: 500;
		color: var(--text);
	}
	.form-group input {
		width: 100%;
		padding: 10px 12px;
		border: 1px solid var(--border);
		border-radius: 6px;
		font-size: 14px;
		transition: border-color 0.2s;
	}
	.form-group input:focus {
		outline: none;
		border-color: var(--accent);
		box-shadow: 0 0 0 3px rgba(49,130,206,0.15);
	}
	.btn-login {
		width: 100%;
		padding: 12px;
		background: var(--primary);
		color: white;
		border: none;
		border-radius: 6px;
		font-size: 15px;
		font-weight: 600;
		cursor: pointer;
		transition: background 0.2s;
		margin-top: 4px;
	}
	.btn-login:hover:not(:disabled) {
		background: var(--primary-light);
	}
	.btn-login:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}
	.demo-accounts {
		margin-top: 24px;
		padding-top: 20px;
		border-top: 1px solid var(--border);
	}
	.demo-title {
		font-size: 13px;
		color: var(--text-light);
		margin-bottom: 10px;
	}
	.demo-item {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 6px 0;
		font-size: 13px;
	}
	.demo-role {
		color: var(--text);
		font-weight: 500;
	}
	.demo-cred {
		color: var(--text-light);
		font-family: monospace;
		font-size: 12px;
	}
</style>
