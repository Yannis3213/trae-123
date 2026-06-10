<script lang="ts">
	import { userStore } from '$lib/stores';
	import { getCurrentUser, switchRole } from '$lib/api';
	import { ROLE_LABELS } from '$lib/types';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { onMount } from 'svelte';

	let switching = false;

	const roles = [
		{ value: 'warehouse_clerk', label: '仓管员' },
		{ value: 'temp_supervisor', label: '温控主管' },
		{ value: 'warehouse_manager', label: '仓储经理' }
	];

	async function handleSwitchRole(role: string) {
		switching = true;
		try {
			const updated = await switchRole(role);
			userStore.set(updated);
		} catch (err: any) {
			console.error('切换角色失败:', err);
		}
		switching = false;
	}

	async function init() {
		const saved = localStorage.getItem('coldchain_user');
		if (saved) {
			try {
				const user = await getCurrentUser();
				userStore.set(user);
			} catch {
				userStore.set(null);
				localStorage.removeItem('coldchain_user');
			}
		}
	}

	function handleLogout() {
		userStore.set(null);
		goto('/');
	}

	$: currentUser = $userStore;
	$: roleLabel = currentUser ? (ROLE_LABELS[currentUser.role] || currentUser.role) : '';
	$: currentPath = $page.url.pathname;

	onMount(() => { init(); });
</script>

<svelte:head>
	<title>冷链物流仓-月底集中处理冷链入库单系统</title>
</svelte:head>

{#if currentUser}
	<header class="header">
		<div class="header-inner">
			<div class="header-left">
				<h1 class="header-title" on:click={() => goto('/applications')}>冷链物流仓-月底集中处理冷链入库单系统</h1>
				<nav class="nav">
					<a href="/applications" class:active={currentPath.startsWith('/applications')}>入库单列表</a>
					<a href="/batch" class:active={currentPath === '/batch'}>批量处理</a>
					<a href="/warnings" class:active={currentPath === '/warnings'}>到期预警</a>
				</nav>
			</div>
			<div class="header-right">
				<span class="user-info">{currentUser.display_name} ({roleLabel})</span>
				<select
					class="role-select"
					value={currentUser.role}
					on:change={(e) => handleSwitchRole(e.target.value)}
					disabled={switching}
				>
					{#each roles as r}
						<option value={r.value}>{r.label}</option>
					{/each}
				</select>
				<button class="btn-logout" on:click={handleLogout}>退出</button>
			</div>
		</div>
	</header>
	<main class="main-content">
		<slot />
	</main>
{:else}
	<main class="main-content">
		<slot />
	</main>
{/if}

<style>
	:global(*) {
		margin: 0;
		padding: 0;
		box-sizing: border-box;
	}
	:global(body) {
		font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
		background: #f5f7fa;
		color: #333;
	}
	:global(:root) {
		--primary: #1a365d;
		--primary-light: #2b6cb0;
		--accent: #3182ce;
		--success: #4caf50;
		--warning: #ff9800;
		--danger: #f44336;
		--gray: #9e9e9e;
		--purple: #9c27b0;
		--bg: #f5f7fa;
		--card-bg: #ffffff;
		--border: #e2e8f0;
		--text: #333333;
		--text-light: #718096;
		--shadow: 0 1px 3px rgba(0,0,0,0.1), 0 1px 2px rgba(0,0,0,0.06);
		--shadow-md: 0 4px 6px rgba(0,0,0,0.07), 0 2px 4px rgba(0,0,0,0.06);
	}
	.header {
		background: var(--primary);
		color: white;
		box-shadow: var(--shadow-md);
		position: sticky;
		top: 0;
		z-index: 100;
	}
	.header-inner {
		max-width: 1400px;
		margin: 0 auto;
		padding: 0 24px;
		height: 60px;
		display: flex;
		align-items: center;
		justify-content: space-between;
	}
	.header-left {
		display: flex;
		align-items: center;
		gap: 32px;
	}
	.header-title {
		font-size: 18px;
		font-weight: 600;
		cursor: pointer;
		white-space: nowrap;
	}
	.nav {
		display: flex;
		gap: 4px;
	}
	.nav a {
		color: rgba(255,255,255,0.8);
		text-decoration: none;
		padding: 8px 16px;
		border-radius: 6px;
		font-size: 14px;
		transition: all 0.2s;
	}
	.nav a:hover {
		color: white;
		background: rgba(255,255,255,0.15);
	}
	.nav a.active {
		color: white;
		background: rgba(255,255,255,0.2);
	}
	.header-right {
		display: flex;
		align-items: center;
		gap: 12px;
	}
	.user-info {
		font-size: 14px;
		color: rgba(255,255,255,0.9);
	}
	.role-select {
		padding: 4px 8px;
		border-radius: 4px;
		border: 1px solid rgba(255,255,255,0.3);
		background: rgba(255,255,255,0.1);
		color: white;
		font-size: 13px;
		cursor: pointer;
	}
	.role-select option {
		color: #333;
		background: white;
	}
	.btn-logout {
		padding: 6px 16px;
		border-radius: 4px;
		border: 1px solid rgba(255,255,255,0.4);
		background: transparent;
		color: white;
		font-size: 13px;
		cursor: pointer;
		transition: all 0.2s;
	}
	.btn-logout:hover {
		background: rgba(255,255,255,0.15);
	}
	.main-content {
		max-width: 1400px;
		margin: 0 auto;
		padding: 24px;
	}
</style>
