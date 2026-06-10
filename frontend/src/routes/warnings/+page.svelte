<script lang="ts">
	import { getExpiryWarnings, getExceptions, batchAdvanceOverdue } from '$lib/api';
	import { STATUS_LABELS, EXPIRY_LABELS, STATUS_COLORS, ROLE_LABELS } from '$lib/types';
	import type { Application, ExceptionReason, BatchResultItem } from '$lib/types';
	import { goto } from '$app/navigation';

	let warnings: Record<string, Application[]> = { normal: [], near_expiry: [], overdue: [] };
	let loading = true;
	let error = '';
	let activeSection = 'overdue';

	let exceptionMap: Record<number, ExceptionReason[]> = {};
	let showingExceptions: number | null = null;

	let selectedOverdueIds: number[] = [];
	let advancing = false;
	let advanceResults: BatchResultItem[] = [];
	let showAdvanceResults = false;

	async function loadData() {
		loading = true;
		error = '';
		try {
			warnings = await getExpiryWarnings();
		} catch (err: any) {
			error = err.code ? `${err.code}: ${err.message}` : '加载数据失败';
		}
		loading = false;
	}

	async function loadExceptions(appId: number) {
		if (showingExceptions === appId) {
			showingExceptions = null;
			return;
		}
		if (!exceptionMap[appId]) {
			try {
				exceptionMap[appId] = await getExceptions(appId);
			} catch {
				exceptionMap[appId] = [];
			}
		}
		showingExceptions = appId;
	}

	function toggleOverdue(id: number) {
		if (selectedOverdueIds.includes(id)) {
			selectedOverdueIds = selectedOverdueIds.filter(i => i !== id);
		} else {
			selectedOverdueIds = [...selectedOverdueIds, id];
		}
		selectedOverdueIds = selectedOverdueIds;
	}

	function toggleAllOverdue() {
		const overdue = warnings.overdue || [];
		if (selectedOverdueIds.length === overdue.length) {
			selectedOverdueIds = [];
		} else {
			selectedOverdueIds = overdue.map(a => a.id);
		}
		selectedOverdueIds = selectedOverdueIds;
	}

	async function handleBatchAdvance() {
		if (selectedOverdueIds.length === 0) return;
		advancing = true;
		error = '';
		showAdvanceResults = false;
		try {
			const res = await batchAdvanceOverdue(selectedOverdueIds);
			advanceResults = res.results || [];
			showAdvanceResults = true;
			loadData();
		} catch (err: any) {
			error = err.code ? `${err.code}: ${err.message}` : '批量推进失败';
		}
		advancing = false;
	}

	$: successCount = advanceResults.filter(r => r.success).length;
	$: failCount = advanceResults.filter(r => !r.success).length;

	$: normalApps = warnings.normal || [];
	$: nearExpiryApps = warnings.near_expiry || [];
	$: overdueApps = warnings.overdue || [];

	const sectionConfig = [
		{ key: 'normal', label: '正常', color: '#4caf50', apps: [] as Application[] },
		{ key: 'near_expiry', label: '临期', color: '#ff9800', apps: [] as Application[] },
		{ key: 'overdue', label: '逾期', color: '#f44336', apps: [] as Application[] }
	];

	import { onMount } from 'svelte';
	onMount(() => { loadData(); });
</script>

<svelte:head>
	<title>到期预警 - 冷链物流仓入库单系统</title>
</svelte:head>

<h2 class="page-title">到期预警</h2>

{#if error}
	<div class="error-msg">{error}</div>
{/if}

{#if showAdvanceResults}
	<div class="results-card">
		<h3 class="card-title">批量推进结果</h3>
		<div class="results-summary">
			<span class="success-count">✅ 成功: {successCount}</span>
			<span class="fail-count">❌ 失败: {failCount}</span>
		</div>
		<div class="result-list">
			{#each advanceResults as r, i}
				<div class="result-item {r.success ? 'success' : 'fail'}">
					<div class="result-header">
						<span class="result-index">#{i + 1}</span>
						<span class="result-order">{r.order_no}</span>
						<span class="badge small" style="background:{r.success ? '#4caf50' : '#f44336'}">{r.success ? '成功' : '失败'}</span>
						{#if r.error_code}
							<span class="badge small error-code" style="background:#ff9800">{r.error_code}</span>
						{/if}
					</div>
					{#if !r.success && r.reason}
						<div class="result-reason">{r.reason}</div>
					{/if}
				</div>
			{/each}
		</div>
	</div>
{/if}

{#if loading}
	<div class="loading">加载中...</div>
{:else}
	<div class="tabs">
		<button class="tab-btn" class:active={activeSection === 'normal'} on:click={() => activeSection = 'normal'}>正常 ({normalApps.length})</button>
		<button class="tab-btn" class:active={activeSection === 'near_expiry'} on:click={() => activeSection = 'near_expiry'}>临期 ({nearExpiryApps.length})</button>
		<button class="tab-btn" class:active={activeSection === 'overdue'} on:click={() => activeSection = 'overdue'}>逾期 ({overdueApps.length})</button>
	</div>

	<div class="tab-content">
		{#if activeSection === 'normal'}
			<div class="section-header" style="border-left-color: #4caf50">
				<h3>正常</h3>
			</div>
			{#if normalApps.length === 0}
				<div class="empty">暂无正常入库单</div>
			{:else}
				<table class="data-table">
					<thead><tr><th>单号</th><th>品名</th><th>数量</th><th>预计到期</th><th>状态</th><th>当前处理人</th></tr></thead>
					<tbody>
						{#each normalApps as app}
							<tr class="clickable" on:click={() => goto(`/applications/${app.id}`)}>
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
			{/if}
		{/if}

		{#if activeSection === 'near_expiry'}
			<div class="section-header" style="border-left-color: #ff9800">
				<h3>临期</h3>
			</div>
			{#if nearExpiryApps.length === 0}
				<div class="empty">暂无临期入库单</div>
			{:else}
				<table class="data-table">
					<thead><tr><th>单号</th><th>品名</th><th>数量</th><th>预计到期</th><th>状态</th><th>临期责任人</th><th>操作</th></tr></thead>
					<tbody>
						{#each nearExpiryApps as app}
							<tr>
								<td>{app.order_no}</td>
								<td>{app.product_name}</td>
								<td>{app.product_count}</td>
								<td>{app.expected_date}</td>
								<td><span class="badge small" style="background:{STATUS_COLORS[app.status] || '#999'}">{STATUS_LABELS[app.status] || app.status}</span></td>
								<td class="responsible">
									{#if app.status === 'draft' || app.status === 'pending_correction'}
										<span class="resp-name">{app.creator_name || '-'}</span>
										<span class="resp-role">仓管员</span>
									{:else if app.status === 'pending_temp'}
										<span class="resp-name">{app.handler_name || '待分配'}</span>
										<span class="resp-role">温控主管</span>
									{:else if app.status === 'under_review'}
										<span class="resp-name">仓储经理</span>
										<span class="resp-role">仓储经理</span>
									{:else}
										-
									{/if}
								</td>
								<td>
									<button class="btn-link" on:click={() => goto(`/applications/${app.id}`)}>补正动作</button>
									<button class="btn-link" on:click={() => loadExceptions(app.id)}>查看异常原因</button>
								</td>
							</tr>
							{#if showingExceptions === app.id && exceptionMap[app.id]}
								{#each exceptionMap[app.id] as ex}
									<tr class="sub-row">
										<td colspan="7">
											<span class="badge small" style="background:#f44336">{ex.reason_type}</span>
											{ex.description}
											<span class="meta">{ex.operator_name || '-'} | {ex.created_at}</span>
										</td>
									</tr>
								{/each}
							{/if}
						{/each}
					</tbody>
				</table>
			{/if}
		{/if}

		{#if activeSection === 'overdue'}
			<div class="section-header overdue-header" style="border-left-color: #f44336">
				<h3>🚨 逾期</h3>
				<span class="overdue-tip">以下单据已逾期，请立即推进或退回补正</span>
			</div>
			{#if overdueApps.length > 0}
				<div class="batch-bar">
					<label class="checkbox-label">
						<input type="checkbox" checked={selectedOverdueIds.length === overdueApps.length && overdueApps.length > 0} on:change={toggleAllOverdue} />
						全选
					</label>
					<button class="btn-danger" on:click={handleBatchAdvance} disabled={advancing || selectedOverdueIds.length === 0}>
						{advancing ? '推进中...' : `批量推进 (${selectedOverdueIds.length})`}
					</button>
				</div>
			{/if}
			{#if overdueApps.length === 0}
				<div class="empty">暂无逾期入库单</div>
			{:else}
				<table class="data-table overdue-table">
					<thead><tr><th></th><th>单号</th><th>品名</th><th>数量</th><th>预计到期</th><th>状态</th><th>⚠️ 逾期责任人</th><th>操作</th></tr></thead>
					<tbody>
						{#each overdueApps as app}
							<tr class="overdue-row">
								<td><input type="checkbox" checked={selectedOverdueIds.includes(app.id)} on:change={() => toggleOverdue(app.id)} /></td>
								<td class="order-no">{app.order_no}</td>
								<td>{app.product_name}</td>
								<td>{app.product_count}</td>
								<td class="expired-date">{app.expected_date}</td>
								<td><span class="badge small" style="background:{STATUS_COLORS[app.status] || '#999'}">{STATUS_LABELS[app.status] || app.status}</span></td>
								<td class="responsible overdue-resp">
									{#if app.status === 'draft' || app.status === 'pending_correction'}
										<span class="resp-name">{app.creator_name || '-'}</span>
										<span class="resp-role">{ROLE_LABELS.warehouse_clerk}</span>
									{:else if app.status === 'pending_temp'}
										<span class="resp-name">{app.handler_name || '待分配'}</span>
										<span class="resp-role">{ROLE_LABELS.temp_supervisor}</span>
									{:else if app.status === 'under_review'}
										<span class="resp-name">仓储经理</span>
										<span class="resp-role">{ROLE_LABELS.warehouse_manager}</span>
									{:else}
										-
									{/if}
								</td>
								<td>
									<button class="btn-link" on:click={() => goto(`/applications/${app.id}`)}>补正动作</button>
									<button class="btn-link" on:click={() => loadExceptions(app.id)}>查看异常原因</button>
								</td>
							</tr>
							{#if showingExceptions === app.id && exceptionMap[app.id]}
								{#each exceptionMap[app.id] as ex}
									<tr class="sub-row">
										<td colspan="8">
											<span class="badge small" style="background:#f44336">{ex.reason_type}</span>
											{ex.description}
											<span class="meta">{ex.operator_name || '-'} | {ex.created_at}</span>
										</td>
									</tr>
								{/each}
							{/if}
						{/each}
					</tbody>
				</table>
			{/if}
		{/if}
	</div>
{/if}

<style>
	.page-title {
		font-size: 20px;
		font-weight: 600;
		margin-bottom: 20px;
		color: var(--text);
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
	.tabs {
		display: flex;
		gap: 2px;
		border-bottom: 2px solid var(--border);
	}
	.tab-btn {
		padding: 10px 20px;
		background: none;
		border: none;
		font-size: 14px;
		color: var(--text-light);
		cursor: pointer;
		border-bottom: 2px solid transparent;
		margin-bottom: -2px;
	}
	.tab-btn:hover { color: var(--text); }
	.tab-btn.active {
		color: var(--primary);
		border-bottom-color: var(--primary);
		font-weight: 600;
	}
	.tab-content {
		background: var(--card-bg);
		border-radius: 0 0 8px 8px;
		padding: 20px;
		box-shadow: var(--shadow);
	}
	.section-header {
		border-left: 4px solid;
		padding-left: 12px;
		margin-bottom: 16px;
	}
	.section-header h3 {
		font-size: 16px;
		font-weight: 600;
		color: var(--text);
	}
	.data-table {
		width: 100%;
		border-collapse: collapse;
		font-size: 13px;
	}
	.data-table th {
		background: #f7fafc;
		padding: 10px 12px;
		text-align: left;
		font-weight: 600;
		border-bottom: 2px solid var(--border);
	}
	.data-table td {
		padding: 8px 12px;
		border-bottom: 1px solid var(--border);
	}
	.data-table tr.clickable { cursor: pointer; }
	.data-table tr.clickable:hover { background: #f0f7ff; }
	.data-table tr.sub-row td {
		background: #fef5f5;
		padding: 6px 12px;
		font-size: 12px;
		color: #666;
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
	.meta { font-size: 11px; color: var(--text-light); margin-left: 8px; }
	.btn-link {
		background: none;
		border: none;
		color: var(--accent);
		cursor: pointer;
		font-size: 12px;
		text-decoration: underline;
		margin-right: 8px;
	}
	.btn-link:hover { color: var(--primary); }
	.btn-danger {
		padding: 8px 20px;
		background: var(--danger);
		color: white;
		border: none;
		border-radius: 6px;
		font-size: 14px;
		cursor: pointer;
	}
	.btn-danger:hover:not(:disabled) { background: #e53935; }
	.btn-danger:disabled { opacity: 0.6; cursor: not-allowed; }
	.batch-bar {
		display: flex;
		align-items: center;
		gap: 16px;
		margin-bottom: 16px;
	}
	.checkbox-label {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: 13px;
		cursor: pointer;
	}
	.empty { text-align: center; padding: 40px; color: var(--text-light); }
	.badge {
		display: inline-block;
		padding: 3px 10px;
		border-radius: 12px;
		color: white;
		font-size: 12px;
		font-weight: 500;
	}
	.badge.small { padding: 2px 8px; font-size: 11px; }
	.responsible {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}
	.resp-name {
		font-size: 13px;
		font-weight: 600;
		color: var(--text);
	}
	.resp-role {
		font-size: 11px;
		color: var(--text-light);
	}
	.overdue-resp .resp-name {
		color: var(--danger);
	}
	.overdue-header {
		display: flex;
		align-items: center;
		gap: 16px;
	}
	.overdue-header h3 {
		color: var(--danger);
	}
	.overdue-tip {
		font-size: 12px;
		color: var(--danger);
		font-weight: 500;
		background: #ffebee;
		padding: 4px 10px;
		border-radius: 12px;
	}
	.overdue-table {
		background: #fff8f8;
	}
	.overdue-row {
		background: #fff8f8;
	}
	.overdue-row:hover {
		background: #fff0f0 !important;
	}
	.overdue-row .order-no {
		font-weight: 600;
	}
	.overdue-row .expired-date {
		color: var(--danger);
		font-weight: 600;
	}
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
</style>
