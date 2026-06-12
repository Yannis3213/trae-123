<script>
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { userStore } from '$lib/store.js';
	import { api, statusMap, nodeMap, warningLevelMap, verifyStatusMap, exceptionTypeMap, formatMoney, formatDate, roleMap } from '$lib/api.js';

	let loading = true;
	let detail = null;
	let processAction = '';
	let processComment = '';
	let processModal = false;
	let processing = false;

	let activeTab = 'info';

	onMount(async () => {
		const token = localStorage.getItem('token');
		if (!token) {
			goto('/login');
			return;
		}

		await loadDetail();
	});

	async function loadDetail() {
		loading = true;
		try {
			const id = $page.params.id;
			const res = await api.getApplication(id);
			if (res.success) {
				detail = res.data;
			}
		} catch (e) {
			console.error('加载详情失败', e);
			alert(e.message || '加载详情失败');
		} finally {
			loading = false;
		}
	}

	function goBack() {
		goto('/');
	}

	function openProcessModal(action) {
		processAction = action;
		processComment = '';
		processModal = true;
	}

	async function handleProcess() {
		if (!processComment && (processAction === 'reject' || processAction === 'return')) {
			alert('请输入退回原因');
			return;
		}

		processing = true;
		try {
			const res = await api.processApplication(detail.application.id, {
				action: processAction,
				comment: processComment,
				version: detail.application.version,
				exception_reason: processComment
			});

			if (res.success) {
				detail = res.data;
				processModal = false;
			}
		} catch (e) {
			alert(e.message || '处理失败');
		} finally {
			processing = false;
		}
	}

	function getActionLabel(action) {
		const map = {
			pass: '核验通过',
			reject: '退回补正',
			resubmit: '重新提交',
			archive: '复核归档',
			return: '退回',
			note: '添加备注'
		};
		return map[action] || action;
	}

	function getNodeOrder(node) {
		return nodeMap[node]?.order || 0;
	}

	function getTimelineNodes() {
		if (!detail || !detail.records) return [];
		return detail.records.map((r, i) => ({
			...r,
			index: i
		}));
	}

	function getUnresolvedExceptions() {
		if (!detail || !detail.exceptions) return [];
		return detail.exceptions.filter(e => !e.resolved);
	}

	function getResolvedExceptions() {
		if (!detail || !detail.exceptions) return [];
		return detail.exceptions.filter(e => e.resolved);
	}
</script>

<div class="detail-page">
	{#if loading}
		<div class="loading">加载中...</div>
	{:else if detail}
		<div class="detail-header">
			<button class="back-btn" on:click={goBack}>← 返回列表</button>
			<div class="header-info">
				<h2>{detail.application.application_no}</h2>
				<span class="status-tag" style="background: {statusMap[detail.application.status]?.color + '20'}; color: {statusMap[detail.application.status]?.color}">
					{statusMap[detail.application.status]?.label}
				</span>
				{#if detail.application.warning_level}
					<span class="warning-tag" style="background: {warningLevelMap[detail.application.warning_level]?.color + '20'}; color: {warningLevelMap[detail.application.warning_level]?.color}">
						{warningLevelMap[detail.application.warning_level]?.label}
					</span>
				{/if}
			</div>
			<div class="header-actions">
				{#if detail.can_process && detail.allowed_actions.includes('pass')}
					<button class="btn btn-success" on:click={() => openProcessModal('pass')}>核验通过</button>
				{/if}
				{#if detail.can_process && detail.allowed_actions.includes('reject')}
					<button class="btn btn-warning" on:click={() => openProcessModal('reject')}>退回补正</button>
				{/if}
				{#if detail.can_process && detail.allowed_actions.includes('resubmit')}
					<button class="btn btn-primary" on:click={() => openProcessModal('resubmit')}>重新提交</button>
				{/if}
				{#if detail.can_process && detail.allowed_actions.includes('archive')}
					<button class="btn btn-success" on:click={() => openProcessModal('archive')}>复核归档</button>
				{/if}
				{#if detail.can_process && detail.allowed_actions.includes('return')}
					<button class="btn btn-warning" on:click={() => openProcessModal('return')}>退回</button>
				{/if}
				{#if detail.can_process && detail.allowed_actions.includes('note')}
					<button class="btn" on:click={() => openProcessModal('note')}>添加备注</button>
				{/if}
			</div>
		</div>

		<div class="tabs">
			<button class="tab {activeTab === 'info' ? 'active' : ''}" on:click={() => activeTab = 'info'}>基本信息</button>
			<button class="tab {activeTab === 'process' ? 'active' : ''}" on:click={() => activeTab = 'process'}>
				处理流程
				<span class="tab-count">{detail.records?.length || 0}</span>
			</button>
			<button class="tab {activeTab === 'evidence' ? 'active' : ''}" on:click={() => activeTab = 'evidence'}>
				证据材料
				<span class="tab-count">{detail.attachments?.length || 0}</span>
			</button>
			<button class="tab {activeTab === 'exception' ? 'active' : ''}" on:click={() => activeTab = 'exception'}>
				异常原因
				<span class="tab-count exception">{getUnresolvedExceptions().length}</span>
			</button>
		</div>

		<div class="tab-content">
			{#if activeTab === 'info'}
				<div class="info-section">
					<div class="info-card">
						<h3>融资申请信息</h3>
						<div class="info-grid">
							<div class="info-item">
								<label>申请单号</label>
								<span>{detail.application.application_no}</span>
							</div>
							<div class="info-item">
								<label>关联线索</label>
								<span>{detail.application.clue_no || '-'}</span>
							</div>
							<div class="info-item">
								<label>客户名称</label>
								<span>{detail.application.customer_name}</span>
							</div>
							<div class="info-item">
								<label>融资金额</label>
								<span class="amount">¥{formatMoney(detail.application.finance_amount)}</span>
							</div>
							<div class="info-item">
								<label>发票数量</label>
								<span>{detail.application.invoice_count} 张</span>
							</div>
							<div class="info-item">
								<label>当前状态</label>
								<span class="status-tag" style="background: {statusMap[detail.application.status]?.color + '20'}; color: {statusMap[detail.application.status]?.color}">
									{statusMap[detail.application.status]?.label}
								</span>
							</div>
							<div class="info-item">
								<label>当前节点</label>
								<span>{detail.application.current_node}</span>
							</div>
							<div class="info-item">
								<label>当前处理人</label>
								<span>{detail.application.current_handler_name || '-'}</span>
							</div>
							<div class="info-item">
								<label>节点截止时间</label>
								<span class={detail.application.warning_level === 'overdue' ? 'overdue-text' : ''}>
									{formatDate(detail.application.node_deadline)}
								</span>
							</div>
							<div class="info-item">
								<label>当前版本</label>
								<span>v{detail.application.version}</span>
							</div>
						</div>
					</div>

					<div class="info-card">
						<h3>核验状态</h3>
						<div class="verify-stats">
							<div class="verify-item">
								<div class="verify-label">发票核验</div>
								<div class="verify-value" style="color: {verifyStatusMap[detail.application.invoice_verify_status]?.color}">
									{verifyStatusMap[detail.application.invoice_verify_status]?.label}
								</div>
							</div>
							<div class="verify-item">
								<div class="verify-label">放款确认</div>
								<div class="verify-value" style="color: {verifyStatusMap[detail.application.loan_confirm_status]?.color}">
									{verifyStatusMap[detail.application.loan_confirm_status]?.label}
								</div>
							</div>
						</div>
					</div>

					<div class="info-card">
						<h3>创建信息</h3>
						<div class="info-grid">
							<div class="info-item">
								<label>创建人</label>
								<span>{detail.application.created_by_name || '-'}</span>
							</div>
							<div class="info-item">
								<label>创建时间</label>
								<span>{formatDate(detail.application.created_at)}</span>
							</div>
							<div class="info-item">
								<label>更新时间</label>
								<span>{formatDate(detail.application.updated_at)}</span>
							</div>
							<div class="info-item full-width">
								<label>备注</label>
								<span>{detail.application.remark || '-'}</span>
							</div>
						</div>
					</div>

					{#if getUnresolvedExceptions().length > 0}
						<div class="info-card exception-card">
							<h3>⚠️ 待处理异常</h3>
							<div class="exception-list">
								{#each getUnresolvedExceptions() as exc}
									<div class="exception-item">
										<span class="exception-type" style="background: {exceptionTypeMap[exc.exception_type]?.color + '20'}; color: {exceptionTypeMap[exc.exception_type]?.color}">
											{exceptionTypeMap[exc.exception_type]?.label || exc.exception_type}
										</span>
										<span class="exception-reason">{exc.reason}</span>
										<span class="exception-time">{formatDate(exc.created_at)}</span>
									</div>
								{/each}
							</div>
						</div>
					{/if}
				</div>
			{:else if activeTab === 'process'}
				<div class="timeline-section">
					<div class="timeline">
						{#each getTimelineNodes() as record, index}
							<div class="timeline-item {index === detail.records.length - 1 ? 'last' : ''}">
								<div class="timeline-dot"></div>
								<div class="timeline-line"></div>
								<div class="timeline-content">
									<div class="timeline-header">
										<span class="action-name">{record.action_name || record.action}</span>
										<span class="time">{formatDate(record.created_at)}</span>
									</div>
									<div class="timeline-info">
										<span class="handler">处理人：{record.handler_name}</span>
										<span class="role">（{record.handler_role_name || record.handler_role}）</span>
									</div>
									{#if record.from_status && record.to_status}
										<div class="status-change">
											状态变更：
											<span class="old-status">{statusMap[record.from_status]?.label || record.from_status}</span>
											<span class="arrow">→</span>
											<span class="new-status">{statusMap[record.to_status]?.label || record.to_status}</span>
										</div>
									{/if}
									{#if record.comment}
										<div class="comment">
											<span class="comment-label">处理意见：</span>
											<span class="comment-text">{record.comment}</span>
										</div>
									{/if}
									{#if record.version_before !== undefined && record.version_after !== undefined}
										<div class="version-info">
											版本：v{record.version_before} → v{record.version_after}
										</div>
									{/if}
								</div>
							</div>
						{/each}
					</div>
				</div>
			{:else if activeTab === 'evidence'}
				<div class="evidence-section">
					{#if detail.attachments?.length > 0}
						<div class="attachments-grid">
							{#each detail.attachments as att}
								<div class="attachment-card">
									<div class="att-icon">📄</div>
									<div class="att-info">
										<div class="att-name">{att.file_name}</div>
										<div class="att-meta">
											<span class="evidence-type">{att.evidence_type}</span>
											<span class="uploader">{att.uploaded_by_name}</span>
										</div>
										<div class="att-time">{formatDate(att.uploaded_at)}</div>
									</div>
								</div>
							{/each}
						</div>
					{:else}
						<div class="empty">暂无证据材料</div>
					{/if}
				</div>
			{:else if activeTab === 'exception'}
				<div class="exception-section">
					<h3>未解决异常</h3>
					{#if getUnresolvedExceptions().length > 0}
						<div class="exception-cards">
							{#each getUnresolvedExceptions() as exc}
								<div class="exception-card unresolved">
									<div class="exc-header">
										<span class="exc-type" style="background: {exceptionTypeMap[exc.exception_type]?.color + '20'}; color: {exceptionTypeMap[exc.exception_type]?.color}">
											{exceptionTypeMap[exc.exception_type]?.label || exc.exception_type}
										</span>
										<span class="exc-severity severity-{exc.severity}">{exc.severity === 'error' ? '严重' : '警告'}</span>
									</div>
									<div class="exc-reason">{exc.reason}</div>
									<div class="exc-footer">
										<span>创建时间：{formatDate(exc.created_at)}</span>
										<span class="exc-status">未解决</span>
									</div>
								</div>
							{/each}
						</div>
					{:else}
						<div class="empty">暂无未解决异常</div>
					{/if}

					{#if getResolvedExceptions().length > 0}
						<h3 style="margin-top: 24px;">已解决异常</h3>
						<div class="exception-cards">
							{#each getResolvedExceptions() as exc}
								<div class="exception-card resolved">
									<div class="exc-header">
										<span class="exc-type" style="background: {exceptionTypeMap[exc.exception_type]?.color + '20'}; color: {exceptionTypeMap[exc.exception_type]?.color}">
											{exceptionTypeMap[exc.exception_type]?.label || exc.exception_type}
										</span>
										<span class="exc-status resolved">已解决</span>
									</div>
									<div class="exc-reason">{exc.reason}</div>
									<div class="exc-footer">
										<span>解决人：{exc.resolved_by || '-'}</span>
										<span>解决时间：{formatDate(exc.resolved_at)}</span>
									</div>
								</div>
							{/each}
						</div>
					{/if}
				</div>
			{/if}
		</div>
	{/if}

	{#if processModal}
		<div class="modal-overlay" on:click={() => processModal = false}>
			<div class="modal" on:click|stopPropagation>
				<div class="modal-header">
					<h3>{getActionLabel(processAction)}</h3>
					<button class="close-btn" on:click={() => processModal = false}>×</button>
				</div>
				<div class="modal-body">
					<p>当前状态：<strong>{statusMap[detail?.application?.status]?.label}</strong></p>
					<p>当前版本：<strong>v{detail?.application?.version}</strong></p>
					<p>操作将更新版本号并记录处理日志。</p>
					
					<div class="form-group">
						<label>
							{processAction === 'reject' || processAction === 'return' ? '退回原因' : '处理意见'}
							{processAction === 'reject' || processAction === 'return' ? '（必填）' : '（选填）'}
						</label>
						<textarea bind:value={processComment} rows="4" placeholder="请输入..."></textarea>
					</div>

					{#if processAction === 'reject'}
						<div class="warning-tip">
							⚠️ 退回后申请单状态将变为"待补正"，由登记员补正材料后重新提交。
							系统将自动记录异常原因并同步到页面和接口。
						</div>
					{/if}
					{#if processAction === 'archive'}
						<div class="warning-tip">
							⚠️ 归档后申请单将进入终态，无法再进行修改。
						</div>
					{/if}
				</div>
				<div class="modal-footer">
					<button class="btn" on:click={() => processModal = false} disabled={processing}>取消</button>
					<button class="btn btn-primary" on:click={handleProcess} disabled={processing}>
						{processing ? '处理中...' : '确认提交'}
					</button>
				</div>
			</div>
		</div>
	{/if}
</div>

<style>
	.detail-page {
		max-width: 1200px;
		margin: 0 auto;
	}

	.loading {
		text-align: center;
		padding: 60px;
		color: #999;
	}

	.detail-header {
		background: white;
		padding: 20px 24px;
		border-radius: 8px;
		margin-bottom: 16px;
		display: flex;
		align-items: center;
		gap: 16px;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
	}

	.back-btn {
		background: none;
		border: none;
		color: #1890ff;
		cursor: pointer;
		font-size: 14px;
		padding: 4px 8px;
	}

	.back-btn:hover {
		text-decoration: underline;
	}

	.header-info {
		flex: 1;
		display: flex;
		align-items: center;
		gap: 12px;
	}

	.header-info h2 {
		margin: 0;
		font-size: 20px;
		color: #333;
	}

	.status-tag,
	.warning-tag {
		display: inline-block;
		padding: 4px 12px;
		border-radius: 12px;
		font-size: 12px;
	}

	.header-actions {
		display: flex;
		gap: 8px;
	}

	.btn {
		padding: 8px 16px;
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

	.tabs {
		background: white;
		border-radius: 8px 8px 0 0;
		padding: 0 24px;
		display: flex;
		gap: 0;
		border-bottom: 1px solid #f0f0f0;
	}

	.tab {
		padding: 14px 20px;
		background: none;
		border: none;
		border-bottom: 2px solid transparent;
		cursor: pointer;
		font-size: 14px;
		color: #666;
		display: flex;
		align-items: center;
		gap: 6px;
		transition: all 0.2s;
	}

	.tab:hover {
		color: #1890ff;
	}

	.tab.active {
		color: #1890ff;
		border-bottom-color: #1890ff;
		font-weight: 500;
	}

	.tab-count {
		background: #f0f0f0;
		color: #999;
		padding: 1px 7px;
		border-radius: 10px;
		font-size: 11px;
	}

	.tab-count.exception {
		background: #fff2f0;
		color: #ff4d4f;
	}

	.tab-content {
		background: white;
		border-radius: 0 0 8px 8px;
		padding: 24px;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
	}

	.info-section {
		display: flex;
		flex-direction: column;
		gap: 20px;
	}

	.info-card {
		border: 1px solid #f0f0f0;
		border-radius: 6px;
		padding: 20px;
	}

	.info-card h3 {
		margin: 0 0 16px 0;
		font-size: 15px;
		color: #333;
		padding-bottom: 10px;
		border-bottom: 1px solid #f0f0f0;
	}

	.info-grid {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 16px;
	}

	.info-item {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.info-item.full-width {
		grid-column: span 4;
	}

	.info-item label {
		font-size: 12px;
		color: #999;
	}

	.info-item span {
		font-size: 14px;
		color: #333;
	}

	.amount {
		font-weight: 600;
		color: #f5222d !important;
		font-size: 16px !important;
	}

	.overdue-text {
		color: #ff4d4f !important;
		font-weight: 500;
	}

	.verify-stats {
		display: flex;
		gap: 40px;
	}

	.verify-item {
		text-align: center;
	}

	.verify-label {
		font-size: 13px;
		color: #999;
		margin-bottom: 6px;
	}

	.verify-value {
		font-size: 20px;
		font-weight: 600;
	}

	.exception-card {
		border-color: #ffccc7;
		background: #fffbfb;
	}

	.exception-card h3 {
		color: #ff4d4f;
		border-bottom-color: #ffccc7;
	}

	.exception-list {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	.exception-item {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 10px 12px;
		background: white;
		border-radius: 4px;
		border: 1px solid #fff1f0;
	}

	.exception-type {
		padding: 2px 8px;
		border-radius: 10px;
		font-size: 11px;
		flex-shrink: 0;
	}

	.exception-reason {
		flex: 1;
		font-size: 13px;
		color: #333;
	}

	.exception-time {
		font-size: 12px;
		color: #999;
		flex-shrink: 0;
	}

	.timeline-section {
		padding: 20px 0;
	}

	.timeline {
		position: relative;
		padding-left: 30px;
	}

	.timeline-item {
		position: relative;
		padding-bottom: 24px;
	}

	.timeline-item.last {
		padding-bottom: 0;
	}

	.timeline-dot {
		position: absolute;
		left: -23px;
		top: 4px;
		width: 12px;
		height: 12px;
		border-radius: 50%;
		background: #1890ff;
		border: 2px solid white;
		box-shadow: 0 0 0 2px #1890ff;
		z-index: 1;
	}

	.timeline-item:last-child .timeline-dot {
		background: #52c41a;
		box-shadow: 0 0 0 2px #52c41a;
	}

	.timeline-line {
		position: absolute;
		left: -18px;
		top: 16px;
		width: 2px;
		height: calc(100% - 16px);
		background: #e8e8e8;
	}

	.timeline-item.last .timeline-line {
		display: none;
	}

	.timeline-content {
		background: #fafafa;
		padding: 14px 18px;
		border-radius: 6px;
		border: 1px solid #f0f0f0;
	}

	.timeline-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 8px;
	}

	.action-name {
		font-weight: 600;
		color: #333;
		font-size: 14px;
	}

	.time {
		font-size: 12px;
		color: #999;
	}

	.timeline-info {
		font-size: 13px;
		color: #666;
		margin-bottom: 6px;
	}

	.handler {
		color: #333;
	}

	.role {
		color: #999;
	}

	.status-change {
		font-size: 13px;
		color: #666;
		margin-bottom: 6px;
	}

	.old-status {
		color: #999;
	}

	.arrow {
		margin: 0 6px;
		color: #bfbfbf;
	}

	.new-status {
		color: #1890ff;
		font-weight: 500;
	}

	.comment {
		font-size: 13px;
		color: #666;
		background: white;
		padding: 8px 12px;
		border-radius: 4px;
		margin-top: 8px;
	}

	.comment-label {
		color: #999;
	}

	.comment-text {
		color: #333;
	}

	.version-info {
		font-size: 11px;
		color: #bfbfbf;
		margin-top: 8px;
	}

	.evidence-section {
		min-height: 200px;
	}

	.attachments-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
		gap: 16px;
	}

	.attachment-card {
		display: flex;
		gap: 12px;
		padding: 14px;
		border: 1px solid #f0f0f0;
		border-radius: 6px;
		transition: all 0.2s;
	}

	.attachment-card:hover {
		border-color: #1890ff;
		box-shadow: 0 2px 8px rgba(24, 144, 255, 0.15);
	}

	.att-icon {
		font-size: 32px;
		flex-shrink: 0;
	}

	.att-info {
		flex: 1;
		min-width: 0;
	}

	.att-name {
		font-size: 13px;
		color: #333;
		margin-bottom: 4px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.att-meta {
		display: flex;
		gap: 8px;
		margin-bottom: 4px;
	}

	.evidence-type {
		font-size: 11px;
		color: #1890ff;
		background: #e6f7ff;
		padding: 1px 6px;
		border-radius: 3px;
	}

	.uploader {
		font-size: 11px;
		color: #999;
	}

	.att-time {
		font-size: 11px;
		color: #bfbfbf;
	}

	.empty {
		text-align: center;
		padding: 40px;
		color: #999;
	}

	.exception-section h3 {
		margin: 0 0 16px 0;
		font-size: 15px;
		color: #333;
	}

	.exception-cards {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.exception-card {
		padding: 16px;
		border-radius: 6px;
		border: 1px solid #f0f0f0;
	}

	.exception-card.unresolved {
		border-color: #ffccc7;
		background: #fffbfb;
	}

	.exception-card.resolved {
		border-color: #b7eb8f;
		background: #fcffe6;
		opacity: 0.8;
	}

	.exc-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 10px;
	}

	.exc-type {
		padding: 2px 10px;
		border-radius: 10px;
		font-size: 12px;
	}

	.exc-severity {
		font-size: 11px;
		padding: 1px 8px;
		border-radius: 10px;
	}

	.severity-error {
		background: #fff2f0;
		color: #ff4d4f;
	}

	.severity-warning {
		background: #fffbe6;
		color: #faad14;
	}

	.exc-reason {
		font-size: 14px;
		color: #333;
		margin-bottom: 10px;
		line-height: 1.6;
	}

	.exc-footer {
		display: flex;
		justify-content: space-between;
		font-size: 12px;
		color: #999;
	}

	.exc-status {
		font-weight: 500;
	}

	.exc-status.resolved {
		color: #52c41a;
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
		margin-bottom: 8px;
		font-size: 13px;
		color: #666;
	}

	.form-group textarea {
		width: 100%;
		padding: 10px 12px;
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
		line-height: 1.6;
	}

	.modal-footer {
		padding: 12px 20px;
		border-top: 1px solid #f0f0f0;
		display: flex;
		justify-content: flex-end;
		gap: 8px;
	}
</style>
