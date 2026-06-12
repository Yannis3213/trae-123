<script>
	import { onMount, onDestroy } from 'svelte';
	import { goto } from '$app/navigation';
	import { userStore } from '$lib/store.js';
	import { api, statusMap, warningLevelMap, verifyStatusMap, formatMoney, formatDate, roleMap } from '$lib/api.js';

	let loading = false;
	let statistics = null;
	let applications = [];
	let total = 0;
	let page = 1;
	let pageSize = 10;
	let selectedIds = new Set();
	
	let filterStatus = '';
	let filterClueNo = '';
	let filterCustomer = '';

	let selectedRole = '';
	let availableRoles = [];

	let showBatchModal = false;
	let batchAction = '';
	let batchComment = '';
	let batchLoading = false;
	let batchResults = [];

	let refreshInterval;

	onMount(async () => {
		const token = localStorage.getItem('token');
		if (!token) {
			goto('/login');
			return;
		}

		await loadUser();
		await loadData();
		
		refreshInterval = setInterval(() => {
			loadData();
		}, 30000);
	});

	onDestroy(() => {
		if (refreshInterval) {
			clearInterval(refreshInterval);
		}
	});

	async function loadUser() {
		const user = await userStore.loadUser();
		if (user && user.roles) {
			availableRoles = user.roles;
			selectedRole = user.roles[0];
		}
	}

	async function loadData() {
		loading = true;
		try {
			const [statsRes, appsRes] = await Promise.all([
				api.getStatistics(),
				api.getApplications({
					status: filterStatus,
					clue_no: filterClueNo,
					customer_name: filterCustomer,
					page,
					page_size: pageSize
				})
			]);

			if (statsRes.success) statistics = statsRes.data;
			if (appsRes.success) {
				applications = appsRes.data.list;
				total = appsRes.data.total;
			}
		} catch (e) {
			console.error('加载数据失败', e);
		} finally {
			loading = false;
		}
	}

	function handleSearch() {
		page = 1;
		loadData();
	}

	function handleReset() {
		filterStatus = '';
		filterClueNo = '';
		filterCustomer = '';
		page = 1;
		loadData();
	}

	function toggleSelect(id) {
		const newSet = new Set(selectedIds);
		if (newSet.has(id)) {
			newSet.delete(id);
		} else {
			newSet.add(id);
		}
		selectedIds = newSet;
	}

	function toggleSelectAll() {
		if (selectedIds.size === applications.length) {
			selectedIds = new Set();
		} else {
			selectedIds = new Set(applications.map(a => a.id));
		}
	}

	function goToDetail(id) {
		goto(`/applications/${id}`);
	}

	function openBatchModal(action) {
		if (selectedIds.size === 0) {
			alert('请先选择要处理的申请单');
			return;
		}
		batchAction = action;
		batchComment = '';
		batchResults = [];
		showBatchModal = true;
	}

	async function handleBatchProcess() {
		if (!batchComment && batchAction === 'reject') {
			alert('请输入退回原因');
			return;
		}

		batchLoading = true;
		try {
			const versionMap = {};
			applications.forEach(app => {
				if (selectedIds.has(app.id)) {
					versionMap[app.id] = app.version;
				}
			});

			const res = await api.batchProcess({
				ids: Array.from(selectedIds),
				action: batchAction,
				comment: batchComment,
				version_map: versionMap
			});

			if (res.success) {
				batchResults = res.data;
				await loadData();
				selectedIds = new Set();
			}
		} catch (e) {
			alert(e.message || '批量处理失败');
		} finally {
			batchLoading = false;
		}
	}

	function closeBatchModal() {
		showBatchModal = false;
		batchResults = [];
	}

	function getStatCards() {
		if (!statistics) return [];
		return [
			{ key: 'total', label: '全部申请', value: statistics.total, color: '#1890ff' },
			{ key: 'pending_verify', label: '待核验', value: statistics.pending_verify, color: '#faad14' },
			{ key: 'verify_failed', label: '核验失败', value: statistics.verify_failed, color: '#ff4d4f' },
			{ key: 'verify_completed', label: '核验完成', value: statistics.verify_completed, color: '#52c41a' },
			{ key: 'pending_review', label: '待复核', value: statistics.pending_review, color: '#722ed1' },
			{ key: 'overdue', label: '已逾期', value: statistics.overdue, color: '#ff4d4f' }
		];
	}

	function canBatchPass() {
		return $userStore?.roles?.includes('auditor');
	}

	function canBatchReject() {
		return $userStore?.roles?.includes('auditor');
	}

	function canBatchArchive() {
		return $userStore?.roles?.includes('reviewer');
	}

	function totalPages() {
		return Math.ceil(total / pageSize);
	}

	function changePage(p) {
		if (p < 1 || p > totalPages()) return;
		page = p;
		loadData();
	}
</script>

<div class="home-page">
	<div class="role-switcher">
		<span class="role-label">当前角色：</span>
		<div class="role-tabs">
			{#each availableRoles as role}
				<button 
					class="role-tab {selectedRole === role ? 'active' : ''}"
					on:click={() => { selectedRole = role; loadData(); }}
				>
					{roleMap[role]?.name || role}
					<span class="role-fullname">（{roleMap[role]?.label || role}）</span>
				</button>
			{/each}
		</div>
	</div>

	<div class="stats-cards">
		{#each getStatCards() as card}
			<div class="stat-card" style="border-left-color: {card.color}">
				<div class="stat-label">{card.label}</div>
				<div class="stat-value" style="color: {card.color}">{card.value}</div>
			</div>
		{/each}
	</div>

	<div class="content-card">
		<div class="card-header">
			<h3>融资申请单台账</h3>
			<div class="header-actions">
				{#if canBatchPass()}
					<button class="btn btn-primary" on:click={() => openBatchModal('pass')} disabled={selectedIds.size === 0}>
						批量通过
					</button>
				{/if}
				{#if canBatchReject()}
					<button class="btn btn-warning" on:click={() => openBatchModal('reject')} disabled={selectedIds.size === 0}>
						批量退回
					</button>
				{/if}
				{#if canBatchArchive()}
					<button class="btn btn-success" on:click={() => openBatchModal('archive')} disabled={selectedIds.size === 0}>
						批量归档
					</button>
				{/if}
			</div>
		</div>

		<div class="filter-bar">
			<div class="filter-item">
				<label>状态：</label>
				<select bind:value={filterStatus}>
					<option value="">全部</option>
					<option value="pending_verify">待核验</option>
					<option value="verify_failed">核验失败</option>
					<option value="verify_completed">核验完成</option>
					<option value="pending_correction">待补正</option>
					<option value="overdue">已逾期</option>
					<option value="verify_passed">待复核</option>
					<option value="archived">已归档</option>
				</select>
			</div>
			<div class="filter-item">
				<label>线索号：</label>
				<input type="text" bind:value={filterClueNo} placeholder="请输入线索号" />
			</div>
			<div class="filter-item">
				<label>客户名称：</label>
				<input type="text" bind:value={filterCustomer} placeholder="请输入客户名称" />
			</div>
			<div class="filter-actions">
				<button class="btn btn-primary" on:click={handleSearch}>查询</button>
				<button class="btn" on:click={handleReset}>重置</button>
			</div>
		</div>

		<div class="table-container">
			{#if loading}
				<div class="loading">加载中...</div>
			{:else}
				<table class="data-table">
					<thead>
						<tr>
							<th style="width: 40px;">
								<input 
									type="checkbox" 
									checked={selectedIds.size > 0 && selectedIds.size === applications.length}
									on:change={toggleSelectAll}
								/>
							</th>
							<th>申请单号</th>
							<th>客户名称</th>
							<th>融资金额</th>
							<th>状态</th>
							<th>当前节点</th>
							<th>当前处理人</th>
							<th>预警等级</th>
							<th>发票核验</th>
							<th>放款确认</th>
							<th>创建时间</th>
							<th style="width: 100px;">操作</th>
						</tr>
					</thead>
					<tbody>
						{#if applications.length === 0}
							<tr>
								<td colspan="12" class="empty-row">暂无数据</td>
							</tr>
						{/if}
						{#each applications as app}
							<tr class={selectedIds.has(app.id) ? 'selected' : ''}>
								<td>
									<input 
										type="checkbox" 
										checked={selectedIds.has(app.id)}
										on:change={() => toggleSelect(app.id)}
									/>
								</td>
								<td>
									<a class="link" on:click={() => goToDetail(app.id)}>{app.application_no}</a>
									{#if app.clue_no}
										<div class="sub-text">线索：{app.clue_no}</div>
									{/if}
								</td>
								<td>{app.customer_name}</td>
								<td class="amount">¥{formatMoney(app.finance_amount)}</td>
								<td>
									<span class="status-tag" style="background: {statusMap[app.status]?.color + '20'}; color: {statusMap[app.status]?.color}">
										{statusMap[app.status]?.label || app.status}
									</span>
								</td>
								<td>{app.current_node}</td>
								<td>{app.current_handler_name || '-'}</td>
								<td>
									{#if app.warning_level}
										<span class="warning-tag" style="background: {warningLevelMap[app.warning_level]?.color + '20'}; color: {warningLevelMap[app.warning_level]?.color}">
											{warningLevelMap[app.warning_level]?.label}
										</span>
									{:else}-{/if}
								</td>
								<td>
									<span class="verify-tag" style="background: {verifyStatusMap[app.invoice_verify_status]?.color + '20'}; color: {verifyStatusMap[app.invoice_verify_status]?.color}">
										{verifyStatusMap[app.invoice_verify_status]?.label}
									</span>
								</td>
								<td>
									<span class="verify-tag" style="background: {verifyStatusMap[app.loan_confirm_status]?.color + '20'}; color: {verifyStatusMap[app.loan_confirm_status]?.color}">
										{verifyStatusMap[app.loan_confirm_status]?.label}
									</span>
								</td>
								<td class="time">{formatDate(app.created_at)}</td>
								<td>
									<button class="link-btn" on:click={() => goToDetail(app.id)}>详情</button>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			{/if}
		</div>

		<div class="pagination">
			<span class="total-text">共 {total} 条记录</span>
			<div class="page-buttons">
				<button on:click={() => changePage(1)} disabled={page === 1}>首页</button>
				<button on:click={() => changePage(page - 1)} disabled={page === 1}>上一页</button>
				<span class="page-info">{page} / {totalPages() || 1}</span>
				<button on:click={() => changePage(page + 1)} disabled={page >= totalPages()}>下一页</button>
				<button on:click={() => changePage(totalPages())} disabled={page >= totalPages()}>末页</button>
			</div>
		</div>
	</div>

	{#if showBatchModal}
		<div class="modal-overlay" on:click={closeBatchModal}>
			<div class="modal" on:click|stopPropagation>
				<div class="modal-header">
					<h3>批量处理</h3>
					<button class="close-btn" on:click={closeBatchModal}>×</button>
				</div>
				<div class="modal-body">
					{#if batchResults.length === 0}
						<p>已选择 <strong>{selectedIds.size}</strong> 条申请单进行批量处理</p>
						<p>操作：<strong>{batchAction === 'pass' ? '核验通过' : batchAction === 'reject' ? '退回补正' : '复核归档'}</strong></p>
						{#if batchAction === 'reject'}
							<div class="form-group">
								<label>退回原因：</label>
								<textarea bind:value={batchComment} rows="3" placeholder="请输入退回原因"></textarea>
							</div>
						{:else}
							<div class="form-group">
								<label>备注：</label>
								<textarea bind:value={batchComment} rows="3" placeholder="请输入备注（选填）"></textarea>
							</div>
						{/if}
						<div class="warning-tip">
							⚠️ 系统将逐条校验，越权、状态冲突、版本冲突等异常申请单将被拦截，不会整批放行。
						</div>
					{:else}
						<h4>处理结果</h4>
						<div class="batch-results">
							{#each batchResults as result}
								<div class="result-item {result.success ? 'success' : 'error'}">
									<span class="result-no">{result.application_no || result.id}</span>
									<span class="result-status">{result.success ? '✓ 成功' : '✗ 失败'}</span>
									<span class="result-msg">{result.message}</span>
								</div>
							{/each}
						</div>
					{/if}
				</div>
				<div class="modal-footer">
					<button class="btn" on:click={closeBatchModal}>
						{batchResults.length > 0 ? '关闭' : '取消'}
					</button>
					{#if batchResults.length === 0}
						<button class="btn btn-primary" on:click={handleBatchProcess} disabled={batchLoading}>
							{batchLoading ? '处理中...' : '确认处理'}
						</button>
					{/if}
				</div>
			</div>
		</div>
	{/if}
</div>

<style>
	.home-page {
		max-width: 1400px;
		margin: 0 auto;
	}

	.role-switcher {
		background: white;
		padding: 16px 20px;
		border-radius: 8px;
		margin-bottom: 16px;
		display: flex;
		align-items: center;
		gap: 16px;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
	}

	.role-label {
		font-size: 14px;
		color: #666;
		font-weight: 500;
	}

	.role-tabs {
		display: flex;
		gap: 8px;
	}

	.role-tab {
		padding: 8px 16px;
		border: 1px solid #d9d9d9;
		background: white;
		border-radius: 4px;
		cursor: pointer;
		font-size: 13px;
		transition: all 0.2s;
		display: flex;
		align-items: center;
		gap: 4px;
	}

	.role-tab:hover {
		border-color: #1890ff;
		color: #1890ff;
	}

	.role-tab.active {
		background: #1890ff;
		border-color: #1890ff;
		color: white;
	}

	.role-fullname {
		font-size: 11px;
		opacity: 0.8;
	}

	.stats-cards {
		display: grid;
		grid-template-columns: repeat(6, 1fr);
		gap: 16px;
		margin-bottom: 16px;
	}

	.stat-card {
		background: white;
		padding: 20px;
		border-radius: 8px;
		border-left: 4px solid;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
	}

	.stat-label {
		font-size: 14px;
		color: #666;
		margin-bottom: 8px;
	}

	.stat-value {
		font-size: 28px;
		font-weight: 600;
	}

	.content-card {
		background: white;
		border-radius: 8px;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
		overflow: hidden;
	}

	.card-header {
		padding: 16px 20px;
		border-bottom: 1px solid #f0f0f0;
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.card-header h3 {
		margin: 0;
		font-size: 16px;
		color: #333;
	}

	.header-actions {
		display: flex;
		gap: 8px;
	}

	.filter-bar {
		padding: 16px 20px;
		background: #fafafa;
		border-bottom: 1px solid #f0f0f0;
		display: flex;
		gap: 16px;
		align-items: flex-end;
		flex-wrap: wrap;
	}

	.filter-item {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.filter-item label {
		font-size: 13px;
		color: #666;
	}

	.filter-item input,
	.filter-item select {
		padding: 6px 10px;
		border: 1px solid #d9d9d9;
		border-radius: 4px;
		font-size: 13px;
		min-width: 160px;
	}

	.filter-actions {
		display: flex;
		gap: 8px;
	}

	.btn {
		padding: 6px 16px;
		border: 1px solid #d9d9d9;
		background: white;
		border-radius: 4px;
		cursor: pointer;
		font-size: 13px;
		transition: all 0.2s;
	}

	.btn:hover:not(:disabled) {
		border-color: #1890ff;
		color: #1890ff;
	}

	.btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.btn-primary {
		background: #1890ff;
		border-color: #1890ff;
		color: white;
	}

	.btn-primary:hover:not(:disabled) {
		background: #40a9ff;
		border-color: #40a9ff;
		color: white;
	}

	.btn-warning {
		background: #faad14;
		border-color: #faad14;
		color: white;
	}

	.btn-warning:hover:not(:disabled) {
		background: #ffc53d;
		border-color: #ffc53d;
		color: white;
	}

	.btn-success {
		background: #52c41a;
		border-color: #52c41a;
		color: white;
	}

	.btn-success:hover:not(:disabled) {
		background: #73d13d;
		border-color: #73d13d;
		color: white;
	}

	.table-container {
		padding: 0 20px;
		overflow-x: auto;
	}

	.loading {
		text-align: center;
		padding: 40px;
		color: #999;
	}

	.data-table {
		width: 100%;
		border-collapse: collapse;
		font-size: 13px;
	}

	.data-table th,
	.data-table td {
		padding: 12px 8px;
		text-align: left;
		border-bottom: 1px solid #f0f0f0;
	}

	.data-table th {
		background: #fafafa;
		font-weight: 600;
		color: #333;
	}

	.data-table tbody tr:hover {
		background: #f5f5f5;
	}

	.data-table tbody tr.selected {
		background: #e6f7ff;
	}

	.empty-row {
		text-align: center;
		color: #999;
		padding: 40px !important;
	}

	.link {
		color: #1890ff;
		cursor: pointer;
		text-decoration: none;
	}

	.link:hover {
		text-decoration: underline;
	}

	.sub-text {
		font-size: 11px;
		color: #999;
		margin-top: 2px;
	}

	.amount {
		font-weight: 500;
		color: #333;
	}

	.time {
		color: #999;
		font-size: 12px;
	}

	.status-tag,
	.warning-tag,
	.verify-tag {
		display: inline-block;
		padding: 2px 8px;
		border-radius: 10px;
		font-size: 11px;
	}

	.link-btn {
		background: none;
		border: none;
		color: #1890ff;
		cursor: pointer;
		padding: 4px;
		font-size: 13px;
	}

	.link-btn:hover {
		text-decoration: underline;
	}

	.pagination {
		padding: 16px 20px;
		display: flex;
		justify-content: space-between;
		align-items: center;
		border-top: 1px solid #f0f0f0;
	}

	.total-text {
		font-size: 13px;
		color: #666;
	}

	.page-buttons {
		display: flex;
		gap: 4px;
		align-items: center;
	}

	.page-buttons button {
		padding: 4px 10px;
		border: 1px solid #d9d9d9;
		background: white;
		border-radius: 4px;
		cursor: pointer;
		font-size: 12px;
	}

	.page-buttons button:hover:not(:disabled) {
		border-color: #1890ff;
		color: #1890ff;
	}

	.page-buttons button:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.page-info {
		font-size: 13px;
		color: #666;
		padding: 0 8px;
	}

	.modal-overlay {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: rgba(0, 0, 0, 0.5);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 1000;
	}

	.modal {
		background: white;
		border-radius: 8px;
		width: 90%;
		max-width: 500px;
		max-height: 80vh;
		display: flex;
		flex-direction: column;
	}

	.modal-header {
		padding: 16px 20px;
		border-bottom: 1px solid #f0f0f0;
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.modal-header h3 {
		margin: 0;
		font-size: 16px;
	}

	.close-btn {
		background: none;
		border: none;
		font-size: 24px;
		cursor: pointer;
		color: #999;
		line-height: 1;
	}

	.close-btn:hover {
		color: #333;
	}

	.modal-body {
		padding: 20px;
		overflow-y: auto;
		flex: 1;
	}

	.modal-body p {
		margin: 0 0 12px 0;
		font-size: 14px;
		color: #333;
	}

	.form-group {
		margin-bottom: 16px;
	}

	.form-group label {
		display: block;
		margin-bottom: 6px;
		font-size: 13px;
		color: #666;
	}

	.form-group textarea {
		width: 100%;
		padding: 8px 12px;
		border: 1px solid #d9d9d9;
		border-radius: 4px;
		font-size: 13px;
		resize: vertical;
		box-sizing: border-box;
		font-family: inherit;
	}

	.warning-tip {
		background: #fffbe6;
		border: 1px solid #ffe58f;
		color: #d48806;
		padding: 10px 12px;
		border-radius: 4px;
		font-size: 12px;
	}

	.batch-results {
		max-height: 300px;
		overflow-y: auto;
	}

	.result-item {
		padding: 10px 12px;
		border-radius: 4px;
		margin-bottom: 8px;
		display: grid;
		grid-template-columns: auto auto 1fr;
		gap: 12px;
		align-items: center;
		font-size: 13px;
	}

	.result-item.success {
		background: #f6ffed;
		border: 1px solid #b7eb8f;
	}

	.result-item.error {
		background: #fff2f0;
		border: 1px solid #ffccc7;
	}

	.result-no {
		font-weight: 500;
	}

	.result-status {
		font-weight: 500;
	}

	.result-item.success .result-status {
		color: #52c41a;
	}

	.result-item.error .result-status {
		color: #ff4d4f;
	}

	.result-msg {
		color: #666;
	}

	.modal-footer {
		padding: 12px 20px;
		border-top: 1px solid #f0f0f0;
		display: flex;
		justify-content: flex-end;
		gap: 8px;
	}

	@media (max-width: 1200px) {
		.stats-cards {
			grid-template-columns: repeat(3, 1fr);
		}
	}

	@media (max-width: 768px) {
		.stats-cards {
			grid-template-columns: repeat(2, 1fr);
		}
	}
</style>
