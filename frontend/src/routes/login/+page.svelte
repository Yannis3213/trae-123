<script>
	import { goto } from '$app/navigation';
	import { userStore } from '$lib/store.js';
	import { onMount } from 'svelte';

	let username = '';
	let password = '';
	let loading = false;
	let error = '';

	const demoUsers = [
		{ username: 'register01', name: '张登记（融资申请登记员）' },
		{ username: 'auditor01', name: '李审核（融资申请审核主管）' },
		{ username: 'reviewer01', name: '王复核（供应链金融平台复核负责人）' },
		{ username: 'admin', name: '系统管理员（全角色）' }
	];

	onMount(() => {
		const token = localStorage.getItem('token');
		if (token) {
			goto('/');
		}
	});

	async function handleLogin() {
		if (!username || !password) {
			error = '请输入用户名和密码';
			return;
		}

		loading = true;
		error = '';

		try {
			await userStore.login(username, password);
			goto('/');
		} catch (e) {
			error = e.message || '登录失败';
		} finally {
			loading = false;
		}
	}

	function quickLogin(u) {
		username = u.username;
		password = '123456';
	}

	function handleKeydown(e) {
		if (e.key === 'Enter') {
			handleLogin();
		}
	}
</script>

<div class="login-page">
	<div class="login-container">
		<div class="login-left">
			<div class="login-brand">
				<div class="brand-icon">💳</div>
				<h1>供应链金融平台</h1>
				<p>月底集中处理融资申请单系统</p>
			</div>
			<div class="login-features">
				<div class="feature-item">
					<span class="feature-icon">🔒</span>
					<span>严格的角色权限控制</span>
				</div>
				<div class="feature-item">
					<span class="feature-icon">📋</span>
					<span>完整的处理流程跟踪</span>
				</div>
				<div class="feature-item">
					<span class="feature-icon">⚠️</span>
					<span>智能异常拦截预警</span>
				</div>
				<div class="feature-item">
					<span class="feature-icon">⏱️</span>
					<span>到期预警与逾期管理</span>
				</div>
			</div>
		</div>
		<div class="login-right">
			<div class="login-form-container">
				<h2>系统登录</h2>
				<p class="form-subtitle">请输入您的账号信息</p>
				
				{#if error}
					<div class="error-box">{error}</div>
				{/if}

				<div class="form-group">
					<label>用户名</label>
					<input 
						type="text" 
						bind:value={username} 
						placeholder="请输入用户名"
						on:keydown={handleKeydown}
					/>
				</div>

				<div class="form-group">
					<label>密码</label>
					<input 
						type="password" 
						bind:value={password} 
						placeholder="请输入密码"
						on:keydown={handleKeydown}
					/>
				</div>

				<button 
					class="login-btn" 
					on:click={handleLogin}
					disabled={loading}
				>
					{loading ? '登录中...' : '登 录'}
				</button>

				<div class="demo-users">
					<p class="demo-title">演示账号（点击快速填入）：</p>
					<div class="demo-list">
						{#each demoUsers as u}
							<button class="demo-btn" on:click={() => quickLogin(u)}>
								{u.name}
							</button>
						{/each}
					</div>
					<p class="demo-hint">默认密码：123456</p>
				</div>
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
		background: linear-gradient(135deg, #1890ff 0%, #096dd9 50%, #0050b3 100%);
		padding: 20px;
	}

	.login-container {
		width: 100%;
		max-width: 960px;
		display: flex;
		background: white;
		border-radius: 12px;
		overflow: hidden;
		box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
	}

	.login-left {
		flex: 1;
		background: linear-gradient(135deg, #1890ff 0%, #096dd9 100%);
		color: white;
		padding: 48px 40px;
		display: flex;
		flex-direction: column;
		justify-content: space-between;
	}

	.login-brand {
		text-align: center;
	}

	.brand-icon {
		font-size: 64px;
		margin-bottom: 16px;
	}

	.login-brand h1 {
		font-size: 28px;
		margin: 0 0 8px 0;
	}

	.login-brand p {
		font-size: 14px;
		opacity: 0.85;
		margin: 0;
	}

	.login-features {
		display: flex;
		flex-direction: column;
		gap: 16px;
	}

	.feature-item {
		display: flex;
		align-items: center;
		gap: 12px;
		font-size: 14px;
	}

	.feature-icon {
		font-size: 20px;
	}

	.login-right {
		flex: 1;
		padding: 48px 40px;
		display: flex;
		align-items: center;
	}

	.login-form-container {
		width: 100%;
	}

	.login-form-container h2 {
		font-size: 24px;
		margin: 0 0 8px 0;
		color: #333;
	}

	.form-subtitle {
		color: #999;
		font-size: 14px;
		margin: 0 0 24px 0;
	}

	.error-box {
		background: #fff2f0;
		border: 1px solid #ffccc7;
		color: #ff4d4f;
		padding: 10px 12px;
		border-radius: 4px;
		margin-bottom: 16px;
		font-size: 13px;
	}

	.form-group {
		margin-bottom: 20px;
	}

	.form-group label {
		display: block;
		margin-bottom: 8px;
		font-size: 14px;
		color: #333;
		font-weight: 500;
	}

	.form-group input {
		width: 100%;
		padding: 12px 16px;
		border: 1px solid #d9d9d9;
		border-radius: 6px;
		font-size: 14px;
		transition: all 0.2s;
		box-sizing: border-box;
	}

	.form-group input:focus {
		outline: none;
		border-color: #1890ff;
		box-shadow: 0 0 0 2px rgba(24, 144, 255, 0.2);
	}

	.login-btn {
		width: 100%;
		padding: 12px;
		background: linear-gradient(90deg, #1890ff 0%, #096dd9 100%);
		color: white;
		border: none;
		border-radius: 6px;
		font-size: 16px;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.2s;
	}

	.login-btn:hover:not(:disabled) {
		opacity: 0.9;
		transform: translateY(-1px);
	}

	.login-btn:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.demo-users {
		margin-top: 24px;
		padding-top: 20px;
		border-top: 1px solid #f0f0f0;
	}

	.demo-title {
		font-size: 13px;
		color: #666;
		margin: 0 0 12px 0;
	}

	.demo-list {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}

	.demo-btn {
		padding: 6px 12px;
		font-size: 12px;
		background: #f5f5f5;
		border: 1px solid #d9d9d9;
		border-radius: 4px;
		cursor: pointer;
		transition: all 0.2s;
		color: #333;
	}

	.demo-btn:hover {
		background: #e6f7ff;
		border-color: #91d5ff;
		color: #1890ff;
	}

	.demo-hint {
		font-size: 12px;
		color: #999;
		margin: 12px 0 0 0;
	}
</style>
