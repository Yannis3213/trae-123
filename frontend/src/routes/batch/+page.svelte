<script lang="ts">
	import { listApplications, batchProcess } from '$lib/api';
	import { STATUS_LABELS, TEMP_ZONE_LABELS } from '$lib/types';
	import type { Application, BatchResultItem } from '$lib/types';

	let applications: Application[] = [];
	let loading = true;
	let error = '';
	let selectedAction = 'submit';
	let selectedIds: number[] = [];
	let allocateZone = '';
	let returnRemark = '';

	let processing = false;
	let batchResults: BatchResultItem[] = [];
	let showResults = false;

	const actionOptions = [
		{ value: 'submit', label: '批量提交' },
		{ value: 'allocate', label: '批量分配' },
		{ value: 'confirm', label: '批量确认' },
		{ value: 'return', label: '批量退回' },
		{ value: 'correct', label: '批量修正' }
	];

	const statusFilterMap: Record<string, string> = {
		submit: 'draft',
		allocate: 'pending_temp',
		confirm: 'under_review',
		return: 'pending_temp',
		correct: 'pending_correction'
	};

	async function loadData() {
		loading = true;
		error = '';
		selectedIds = [];
		showResults = false;
		batchResults = [];
		try {
			const status = statusFilterMap[selectedAction];
			applications = await listApplications({ status });
		} catch (err: any) {
			error = err.code ? `${err.code}: ${err.message}` : '加载数据失败';
		}
		loading = false;
	}

	function toggleSelect(id: number) {
		if (selectedIds.includes(id)) {
			selectedIds = selectedIds.filter(i => i !== id);
		} else {
			selectedIds = [...selectedIds, id];
		}
		selectedIds = selectedIds;
	}

	function toggleAll() {
		if (selectedIds.length === applications.length) {
			selectedIds = [];
		} else {
			selectedIds = applications.map(a => a.id);
		}
		selectedIds = selectedIds;
	}

	async function handleBatchProcess() {
		if (selectedIds.length === 0) return;
		processing = true;
		error = '';
		showResults = false;
		try {
			const res = await batchProcess(
				selectedIds,
				selectedAction,
				selectedAction === 'return' ? returnRemark : undefined,
				selectedAction === 'allocate' ? allocateZone : undefined
			);
			batchResults = res.results || [];
			showResults = true;
			loadData();
		} catch (err: any) {
			error = err.code ? `${err.code}: ${err.message}` : '批量处理失败';
		}
		processing = false;
	}

	$: successCount = batchResults.filter(r => r.success).length;
	$: failCount = batchResults.filter(r => !r.success).length;

	import { onMount } from 'svelte';
	onMount(() => { loadData(); });
</script>

<svelte:head>
	<title>批量处理 - 冷链物流仓入库单系统</title>
</svelte:head>

<h2 class="page-title">批量处理</h2>

<div class="action-bar">
	<div class="action-left">
		<select bind:value={selectedAction} on:change={loadData}>
			{#each actionOptions as opt}
				<option value={opt.value}>{opt.label}</option>
			{/each}
		</select>
		{#if selectedAction === 'allocate'}
			<select bind:value={allocateZone}>
				<option value="">选择温区</option>
				{#each Object.entries(TEMP_ZONE_LABELS) as [key, label]}
					<option value={key}>{label}</option>
				{/each}
			</select>
		{/if}
		{#if selectedAction === 'return'}
			<input type="text" bind:value={returnRemark} placeholder="退回原因..." />
		{/if}
	</div>
	<button class="btn-primary" on:click={handleBatchProcess} disabled={processing || selectedIds.length === 0}>
		{processing ? '处理中...' : `批量处理 (${selectedIds.length})`}
	</button>
</div>

{#if error}
	<div class="error-msg">{error}</div>
{/if}

{#if showResults}
	<div class="results-card">
		<h3 class="card-title">处理结果</h3>
		<div class="results-summary">
			<span class="success-count">成功: {successCount}</span>
			<span class="fail-count">失败: {failCount}</span>
		</div>
		<table class="data-table">
			<thead><tr><th>单号</th><th>结果</th><th>原因</th></tr></thead>
			<tbody>
				{#each batchResults as r}
					<tr>
						<td>{r.order_no}</td>
						<td>{r.success ? '✅' : '❌'}</td>
						<td>{r.reason || '-'}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
{/if}

{#if loading}
	<div class="loading">加载中...</div>
{:else}
	<div class="table-wrap">
		<table class="data-table">
			<thead>
				<tr>
					<th><input type="checkbox" checked={selectedIds.length === applications.length && applications.length > 0} on:change={toggleAll} /></th>
					<th>单号</th>
					<th>品名</th>
					<th>数量</th>
					<th>预计到期</th>
					<th>状态</th>
				</tr>
			</thead>
			<tbody>
				{#if applications.length === 0}
					<tr><td colspan="6" class="empty">暂无符合条件的入库单</td></tr>
				{/if}
				{#each applications as app}
					<tr>
						<td><input type="checkbox" checked={selectedIds.includes(app.id)} on:change={() => toggleSelect(app.id)} /></td>
						<td>{app.order_no}</td>
						<td>{app.product_name}</td>
						<td>{app.product_count}</td>
						<td>{app.expected_date}</td>
						<td>{STATUS_LABELS[app.status] || app.status}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
{/if}

<style>
	.page-title {
		font-size: 20px;
		font-weight: 600;
		margin-bottom: 20px;
		color: var(--text);
	}
	.action-bar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 20px;
		gap: 12px;
		flex-wrap: wrap;
	}
	.action-left {
		display: flex;
		gap: 10px;
		align-items: center;
		flex-wrap: wrap;
	}
	.action-left select, .action-left input {
		padding: 8px 12px;
		border: 1px solid var(--border);
		border-radius: 6px;
		font-size: 13px;
		background: var(--card-bg);
	}
	.action-left input { width: 200px; }
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
	.error-msg {
		background: #fff5f5;
		color: var(--danger);
		padding: 10px 14px;
		border-radius: 6px;
		margin-bottom: 16px;
		font-size: 13px;
		border: 1px solid #fed7d7;
	}
	.loading { text-align: center; padding: 40px; color: var(--text-light); }
	.results-card {
		background: var(--card-bg);
		border-radius: 8px;
		padding: 20px;
		box-shadow: var(--shadow);
		margin-bottom: 20px;
	}
	.card-title {
		font-size: 16px;
		font-weight: 600;
		margin-bottom: 12px;
		color: var(--text);
	}
	.results-summary {
		display: flex;
		gap: 20px;
		margin-bottom: 12px;
		font-size: 14px;
		font-weight: 500;
	}
	.success-count { color: var(--success); }
	.fail-count { color: var(--danger); }
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
		padding: 10px 14px;
		text-align: left;
		font-weight: 600;
		border-bottom: 2px solid var(--border);
	}
	.data-table td {
		padding: 8px 14px;
		border-bottom: 1px solid var(--border);
	}
	.data-table .empty {
		text-align: center;
		padding: 40px;
		color: var(--text-light);
	}
</style>
