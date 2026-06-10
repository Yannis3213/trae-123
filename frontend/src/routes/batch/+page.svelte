<script lang="ts">
	import { listApplications, batchProcess } from '$lib/api';
	import { STATUS_LABELS, TEMP_ZONE_LABELS, STATUS_COLORS, ROLE_LABELS } from '$lib/types';
	import type { Application, BatchResultItem } from '$lib/types';
	import { goto } from '$app/navigation';

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

	function correctionAction(r: BatchResultItem): { label: string; href?: string; tip?: string } {
		switch (r.error_code) {
			case 'OVERDUE_CHECK_PASS':
				return { label: '前往详情页推进', href: `/applications/${r.id}` };
			case 'CROSS_ROLE':
				return { label: '切换责任人账号', tip: '该单据指定了其他处理人，请切换到对应角色/账号' };
			case 'ROLE_FORBIDDEN':
				return { label: '切换角色', tip: '当前角色无法处理该状态，请切换角色' };
			case 'EVIDENCE_MISSING':
				return { label: '前往详情页补正', href: `/applications/${r.id}` };
			case 'VERSION_CONFLICT':
				return { label: '刷新详情页', href: `/applications/${r.id}` };
			case 'NOT_FOUND':
				return { label: '返回列表查看' };
			case 'DUPLICATE_SUBMIT':
				return { label: '查看办结单', href: `/applications/${r.id}` };
			case 'STATUS_CONFLICT':
				return { label: '查看单据状态', href: `/applications/${r.id}` };
			default:
				return { label: '查看详情', href: `/applications/${r.id}` };
		}
	}

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
			<span class="success-count">✅ 成功: {successCount}</span>
			<span class="fail-count">❌ 失败: {failCount}</span>
		</div>
		<div class="result-list">
			{#each batchResults as r, i}
				{@const action = correctionAction(r)}
				<div class="result-item {r.success ? 'success' : 'fail'}">
					<div class="result-header">
						<span class="result-index">#{i + 1}</span>
						<span class="result-order">{r.order_no}</span>
						<span class="badge small" style="background:{r.success ? '#4caf50' : '#f44336'}">{r.success ? '成功' : '失败'}</span>
						{#if r.error_code}
							<span class="badge small error-code" style="background:{r.success ? '#388e3c' : '#ff9800'}">{r.error_code}</span>
						{/if}
					</div>
					{#if r.reason}
						<div class="result-reason">{r.reason}</div>
					{/if}
					<div class="result-footer">
						{#if action.href}
							<button class="btn-correction" on:click={() => goto(action.href!)}>{action.label}</button>
						{:else if action.label}
							<span class="btn-correction disabled" title={action.tip}>⚠️ {action.label}</span>
						{/if}
						<button class="btn-refresh" on:click={loadData}>🔄 刷新列表</button>
					</div>
				</div>
			{/each}
		</div>
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
					<th>当前处理人</th>
				</tr>
			</thead>
			<tbody>
				{#if applications.length === 0}
					<tr><td colspan="7" class="empty">暂无符合条件的入库单</td></tr>
				{/if}
				{#each applications as app}
					<tr>
						<td><input type="checkbox" checked={selectedIds.includes(app.id)} on:change={() => toggleSelect(app.id)} /></td>
						<td>{app.order_no}</td>
						<td>{app.product_name}</td>
						<td>{app.product_count}</td>
						<td>{app.expected_date}</td>
						<td><span class="badge small" style="background:{STATUS_COLORS[app.status] || '#999'}">{STATUS_LABELS[app.status] || app.status}</span></td>
						<td>
							{#if app.status === 'draft' || app.status === 'pending_correction'}
								{app.creator_name || '-'}
							{:else if app.status === 'pending_temp'}
								{app.handler_name || '待分配'}
							{:else if app.status === 'under_review'}
								仓储经理
							{:else}
								-
							{/if}
						</td>
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
	.badge {
		display: inline-block;
		padding: 3px 10px;
		border-radius: 12px;
		color: white;
		font-size: 12px;
		font-weight: 500;
	}
	.badge.small { padding: 2px 8px; font-size: 11px; }
	.result-list {
		display: flex;
		flex-direction: column;
		gap: 10px;
		margin-top: 12px;
	}
	.result-item {
		border-radius: 8px;
		padding: 12px 16px;
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.result-item.success {
		background: #f1f8e9;
		border-left: 4px solid #4caf50;
	}
	.result-item.fail {
		background: #fff8f8;
		border-left: 4px solid #f44336;
	}
	.result-header {
		display: flex;
		align-items: center;
		gap: 10px;
		flex-wrap: wrap;
	}
	.result-index {
		font-size: 12px;
		color: var(--text-light);
		font-weight: 600;
	}
	.result-order {
		font-size: 14px;
		font-weight: 600;
		color: var(--text);
	}
	.error-code {
		font-family: monospace;
		letter-spacing: 0.5px;
	}
	.result-reason {
		font-size: 13px;
		color: var(--text);
		padding-left: 2px;
		line-height: 1.5;
	}
	.result-footer {
		display: flex;
		align-items: center;
		gap: 10px;
		margin-top: 6px;
		flex-wrap: wrap;
	}
	.btn-correction {
		display: inline-block;
		padding: 5px 14px;
		border-radius: 6px;
		border: 1px solid var(--primary);
		background: white;
		color: var(--primary);
		font-size: 12px;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.15s;
	}
	.btn-correction:hover:not(.disabled) {
		background: var(--primary);
		color: white;
	}
	.btn-correction.disabled {
		border-color: #ff9800;
		color: #e65100;
		cursor: help;
		background: #fff3e0;
	}
	.btn-refresh {
		display: inline-block;
		padding: 5px 14px;
		border-radius: 6px;
		border: 1px solid #888;
		background: white;
		color: #555;
		font-size: 12px;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.15s;
	}
	.btn-refresh:hover {
		background: #f5f5f5;
	}
</style>
