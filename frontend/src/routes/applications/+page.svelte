<script lang="ts">
	import { userStore } from '$lib/stores';
	import { listApplications, createApplication, getStatsSummary } from '$lib/api';
	import { STATUS_LABELS, STATUS_COLORS, EXPIRY_LABELS, EXPIRY_COLORS, TEMP_ZONE_LABELS, STEP_LABELS } from '$lib/types';
	import type { Application } from '$lib/types';
	import { goto } from '$app/navigation';

	let applications: Application[] = [];
	let stats: { by_status: Record<string, number>; by_expiry_group: Record<string, number>; total: number } | null = null;
	let loading = true;
	let error = '';

	let filterStatus = '';
	let filterExpiry = '';
	let searchQuery = '';

	let showCreateModal = false;
	let createForm = {
		product_name: '',
		product_count: 1,
		expected_date: '',
		appointment_time: ''
	};
	let creating = false;
	let createError = '';

	async function loadData() {
		loading = true;
		error = '';
		try {
			const params: any = {};
			if (filterStatus) params.status = filterStatus;
			if (filterExpiry) params.expiry_group = filterExpiry;
			if (searchQuery) params.search = searchQuery;
			applications = await listApplications(Object.keys(params).length > 0 ? params : undefined);
		} catch (err: any) {
			error = err.code ? `${err.code}: ${err.message}` : '加载数据失败';
		}
		loading = false;
	}

	async function loadStats() {
		try {
			stats = await getStatsSummary();
		} catch {}
	}

	async function handleCreate() {
		createError = '';
		creating = true;
		try {
			await createApplication(createForm);
			showCreateModal = false;
			createForm = { product_name: '', product_count: 1, expected_date: '', appointment_time: '' };
			loadData();
			loadStats();
		} catch (err: any) {
			createError = err.code ? `${err.code}: ${err.message}` : '创建失败';
		}
		creating = false;
	}

	function getStatusLabel(s: string) { return STATUS_LABELS[s] || s; }
	function getStatusColor(s: string) { return STATUS_COLORS[s] || '#999'; }
	function getExpiryLabel(e: string) { return EXPIRY_LABELS[e] || e; }
	function getExpiryColor(e: string) { return EXPIRY_COLORS[e] || '#999'; }
	function getTempZoneLabel(t: string) { return TEMP_ZONE_LABELS[t] || t || '-'; }
	function getStepLabel(s: string) { return STEP_LABELS[s] || s; }

	$: if (filterStatus || filterExpiry || searchQuery) {
		loadData();
	}

	import { onMount } from 'svelte';
	onMount(() => {
		loadData();
		loadStats();
	});
</script>

<svelte:head>
	<title>入库单列表 - 冷链物流仓入库单系统</title>
</svelte:head>

<div class="stats-row">
	{#each Object.entries(STATUS_LABELS) as [key, label]}
		<div class="stat-card" style="border-left: 4px solid {getStatusColor(key)}">
			<div class="stat-value">{stats?.by_status?.[key] || 0}</div>
			<div class="stat-label">{label}</div>
		</div>
	{/each}
</div>

<div class="filter-bar">
	<div class="filter-left">
		<select bind:value={filterStatus}>
			<option value="">全部状态</option>
			{#each Object.entries(STATUS_LABELS) as [key, label]}
				<option value={key}>{label}</option>
			{/each}
		</select>
		<select bind:value={filterExpiry}>
			<option value="">全部到期分组</option>
			{#each Object.entries(EXPIRY_LABELS) as [key, label]}
				<option value={key}>{label}</option>
			{/each}
		</select>
		<input
			type="text"
			placeholder="搜索单号或品名..."
			bind:value={searchQuery}
			on:keydown={(e) => { if (e.key === 'Enter') loadData(); }}
		/>
	</div>
	{#if $userStore?.role === 'warehouse_clerk'}
		<button class="btn-primary" on:click={() => showCreateModal = true}>新建入库单</button>
	{/if}
</div>

{#if error}
	<div class="error-msg">{error}</div>
{/if}

{#if loading}
	<div class="loading">加载中...</div>
{:else}
	<div class="table-wrap">
		<table class="data-table">
			<thead>
				<tr>
					<th>单号</th>
					<th>品名</th>
					<th>数量</th>
					<th>预计到期</th>
					<th>温区</th>
					<th>状态</th>
					<th>当前步骤</th>
					<th>到期分组</th>
					<th>创建人</th>
					<th>操作人</th>
					<th>操作</th>
				</tr>
			</thead>
			<tbody>
				{#if applications.length === 0}
					<tr><td colspan="11" class="empty">暂无数据</td></tr>
				{/if}
				{#each applications as app}
					<tr class="clickable" on:click={() => goto(`/applications/${app.id}`)}>
						<td>{app.order_no}</td>
						<td>{app.product_name}</td>
						<td>{app.product_count}</td>
						<td>{app.expected_date}</td>
						<td>{getTempZoneLabel(app.temperature_zone)}</td>
						<td><span class="badge" style="background:{getStatusColor(app.status)}">{getStatusLabel(app.status)}</span></td>
						<td>{getStepLabel(app.current_step)}</td>
						<td>{#if app.expiry_group}<span class="badge" style="background:{getExpiryColor(app.expiry_group)}">{getExpiryLabel(app.expiry_group)}</span>{:else}-{/if}</td>
						<td>{app.creator_name || '-'}</td>
						<td>{app.handler_name || '-'}</td>
						<td><button class="btn-link" on:click|stopPropagation={() => goto(`/applications/${app.id}`)}>查看详情</button></td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
{/if}

{#if showCreateModal}
	<div class="modal-overlay" on:click={() => showCreateModal = false}>
		<div class="modal" on:click|stopPropagation>
			<h3 class="modal-title">新建入库单</h3>
			{#if createError}
				<div class="error-msg">{createError}</div>
			{/if}
			<div class="form-group">
				<label>品名</label>
				<input type="text" bind:value={createForm.product_name} required />
			</div>
			<div class="form-group">
				<label>数量</label>
				<input type="number" bind:value={createForm.product_count} min="1" required />
			</div>
			<div class="form-group">
				<label>预计到期日</label>
				<input type="date" bind:value={createForm.expected_date} required />
			</div>
			<div class="form-group">
				<label>预约时间</label>
				<input type="datetime-local" bind:value={createForm.appointment_time} required />
			</div>
			<div class="modal-actions">
				<button class="btn-secondary" on:click={() => showCreateModal = false}>取消</button>
				<button class="btn-primary" on:click={handleCreate} disabled={creating}>
					{creating ? '创建中...' : '创建'}
				</button>
			</div>
		</div>
	</div>
{/if}

<style>
	.stats-row {
		display: flex;
		gap: 16px;
		margin-bottom: 24px;
		flex-wrap: wrap;
	}
	.stat-card {
		flex: 1;
		min-width: 140px;
		background: var(--card-bg);
		border-radius: 8px;
		padding: 16px 20px;
		box-shadow: var(--shadow);
	}
	.stat-value {
		font-size: 28px;
		font-weight: 700;
		color: var(--text);
	}
	.stat-label {
		font-size: 13px;
		color: var(--text-light);
		margin-top: 4px;
	}
	.filter-bar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 20px;
		gap: 12px;
		flex-wrap: wrap;
	}
	.filter-left {
		display: flex;
		gap: 10px;
		flex-wrap: wrap;
	}
	.filter-left select,
	.filter-left input {
		padding: 8px 12px;
		border: 1px solid var(--border);
		border-radius: 6px;
		font-size: 13px;
		background: var(--card-bg);
	}
	.filter-left input {
		width: 200px;
	}
	.btn-primary {
		padding: 8px 20px;
		background: var(--primary);
		color: white;
		border: none;
		border-radius: 6px;
		font-size: 14px;
		cursor: pointer;
		white-space: nowrap;
	}
	.btn-primary:hover:not(:disabled) { background: var(--primary-light); }
	.btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
	.btn-secondary {
		padding: 8px 20px;
		background: var(--card-bg);
		color: var(--text);
		border: 1px solid var(--border);
		border-radius: 6px;
		font-size: 14px;
		cursor: pointer;
	}
	.btn-secondary:hover { background: #f7fafc; }
	.error-msg {
		background: #fff5f5;
		color: var(--danger);
		padding: 10px 14px;
		border-radius: 6px;
		margin-bottom: 16px;
		font-size: 13px;
		border: 1px solid #fed7d7;
	}
	.loading {
		text-align: center;
		padding: 40px;
		color: var(--text-light);
	}
	.table-wrap {
		overflow-x: auto;
		background: var(--card-bg);
		border-radius: 8px;
		box-shadow: var(--shadow);
	}
	.data-table {
		width: 100%;
		border-collapse: collapse;
		font-size: 13px;
	}
	.data-table th {
		background: #f7fafc;
		padding: 12px 14px;
		text-align: left;
		font-weight: 600;
		color: var(--text);
		border-bottom: 2px solid var(--border);
		white-space: nowrap;
	}
	.data-table td {
		padding: 10px 14px;
		border-bottom: 1px solid var(--border);
		color: var(--text);
	}
	.data-table tr.clickable:hover {
		background: #f0f7ff;
		cursor: pointer;
	}
	.data-table .empty {
		text-align: center;
		padding: 40px;
		color: var(--text-light);
	}
	.badge {
		display: inline-block;
		padding: 3px 10px;
		border-radius: 12px;
		color: white;
		font-size: 12px;
		font-weight: 500;
		white-space: nowrap;
	}
	.btn-link {
		background: none;
		border: none;
		color: var(--accent);
		cursor: pointer;
		font-size: 13px;
		text-decoration: underline;
	}
	.btn-link:hover { color: var(--primary); }
	.modal-overlay {
		position: fixed;
		inset: 0;
		background: rgba(0,0,0,0.5);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 200;
	}
	.modal {
		background: var(--card-bg);
		border-radius: 10px;
		padding: 28px;
		width: 100%;
		max-width: 460px;
		box-shadow: 0 20px 60px rgba(0,0,0,0.2);
	}
	.modal-title {
		font-size: 18px;
		font-weight: 600;
		margin-bottom: 20px;
		color: var(--text);
	}
	.form-group {
		margin-bottom: 14px;
	}
	.form-group label {
		display: block;
		margin-bottom: 5px;
		font-size: 13px;
		font-weight: 500;
		color: var(--text);
	}
	.form-group input {
		width: 100%;
		padding: 8px 10px;
		border: 1px solid var(--border);
		border-radius: 6px;
		font-size: 14px;
	}
	.form-group input:focus {
		outline: none;
		border-color: var(--accent);
	}
	.modal-actions {
		display: flex;
		justify-content: flex-end;
		gap: 10px;
		margin-top: 20px;
	}
</style>
