<script>
	import { page } from '$app/stores';
	import { userStore, currentRole, switchRole } from '$lib/store.js';
	import { roleMap } from '$lib/api.js';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';

	let isLoading = true;
	let showUserMenu = false;

	onMount(async () => {
		const token = localStorage.getItem('token');
		if (token) {
			try {
				await userStore.loadUser();
			} catch (e) {
				console.error('加载用户信息失败', e);
			}
		}
		isLoading = false;
	});

	function logout() {
		userStore.logout();
		goto('/login');
	}

	function onChangeRole(e) {
		switchRole(e.target.value);
	}

	$: currentPath = $page.url.pathname;
	$: roles = $userStore?.roles || [];
</script>

<div class="app-layout">
	{#if !isLoading}
		<header class="app-header">
			<div class="header-left">
				<div class="logo">
					<span class="logo-icon">💳</span>
					<span class="logo-text">供应链金融平台</span>
				</div>
				<span class="header-subtitle">月底集中处理融资申请单系统</span>
			</div>
			<div class="header-right">
				{#if $userStore}
					<div class="role-switcher">
						<label class="role-label">当前角色：</label>
						<select class="role-select" value={$currentRole} on:change={onChangeRole}>
							{#each roles as r}
								<option value={r}>{roleMap[r]?.name || r}</option>
							{/each}
						</select>
					</div>
					<div class="user-info" on:click={() => showUserMenu = !showUserMenu}>
						<span class="user-avatar">{$userStore.real_name?.charAt(0) || 'U'}</span>
						<span class="user-name">{$userStore.real_name}</span>
						<span class="user-role">{$currentRole && roleMap[$currentRole]?.name ? roleMap[$currentRole].name : ''}</span>
						<span class="dropdown-arrow">▼</span>
					</div>
					{#if showUserMenu}
						<div class="user-menu" on:click|stopPropagation>
							<div class="menu-info">
								<div class="mi-line"><span class="mi-label">用户名：</span>{$userStore.username}</div>
								<div class="mi-line"><span class="mi-label">姓名：</span>{$userStore.real_name}</div>
								<div class="mi-line"><span class="mi-label">角色：</span>
									{#each roles as r, i}
										{roleMap[r]?.label || r}{i < roles.length - 1 ? '、' : ''}
									{/each}
								</div>
							</div>
							<div class="menu-divider"></div>
							<div class="menu-item" on:click={logout}>退出登录</div>
						</div>
					{/if}
				{/if}
			</div>
		</header>

		<main class="app-main">
			<slot />
		</main>
	{/if}
</div>

<style>
	.app-layout {
		min-height: 100vh;
		background: #f0f2f5;
		display: flex;
		flex-direction: column;
	}

	.app-header {
		height: 64px;
		background: linear-gradient(90deg, #1890ff 0%, #096dd9 100%);
		color: white;
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0 24px;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
		position: relative;
		z-index: 100;
	}

	.header-left {
		display: flex;
		align-items: center;
		gap: 16px;
	}

	.logo {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.logo-icon {
		font-size: 28px;
	}

	.logo-text {
		font-size: 20px;
		font-weight: 600;
	}

	.header-subtitle {
		font-size: 14px;
		opacity: 0.85;
		padding-left: 16px;
		border-left: 1px solid rgba(255, 255, 255, 0.3);
	}

	.header-right {
		display: flex;
		align-items: center;
		gap: 20px;
		position: relative;
	}

	.role-switcher {
		display: flex;
		align-items: center;
		gap: 6px;
		background: rgba(255, 255, 255, 0.12);
		padding: 6px 12px;
		border-radius: 4px;
	}

	.role-label {
		font-size: 13px;
		opacity: 0.9;
	}

	.role-select {
		background: #fff;
		color: #333;
		border: none;
		border-radius: 3px;
		padding: 4px 8px;
		font-size: 13px;
		outline: none;
		cursor: pointer;
	}

	.user-info {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 8px 12px;
		border-radius: 4px;
		cursor: pointer;
		transition: background 0.2s;
	}

	.user-info:hover {
		background: rgba(255, 255, 255, 0.15);
	}

	.user-avatar {
		width: 32px;
		height: 32px;
		border-radius: 50%;
		background: #fff;
		color: #1890ff;
		display: flex;
		align-items: center;
		justify-content: center;
		font-weight: 600;
		font-size: 14px;
	}

	.user-name {
		font-size: 14px;
	}

	.user-role {
		font-size: 12px;
		background: rgba(255, 255, 255, 0.2);
		padding: 2px 8px;
		border-radius: 10px;
	}

	.dropdown-arrow {
		font-size: 10px;
		opacity: 0.8;
	}

	.user-menu {
		position: absolute;
		top: 100%;
		right: 0;
		margin-top: 8px;
		background: white;
		border-radius: 6px;
		box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
		min-width: 220px;
		z-index: 1000;
		color: #333;
		overflow: hidden;
	}

	.menu-info {
		padding: 14px 16px;
		font-size: 13px;
	}

	.mi-line {
		line-height: 1.8;
	}

	.mi-label {
		color: #999;
	}

	.menu-divider {
		height: 1px;
		background: #f0f0f0;
	}

	.menu-item {
		padding: 10px 16px;
		color: #333;
		cursor: pointer;
		transition: background 0.2s;
		font-size: 14px;
	}

	.menu-item:hover {
		background: #f5f5f5;
		color: #1890ff;
	}

	.app-main {
		flex: 1;
		padding: 20px;
	}
</style>
