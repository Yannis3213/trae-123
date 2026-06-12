<script>
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { currentRole } from '$lib/store.js';
	import { 
		api, statusMap, nodeMap, warningLevelMap, verifyStatusMap, 
		exceptionTypeMap, formatMoney, formatDate, roleMap,
		loanStatusMap, evidenceTypeMap, actionMap, getSeverityClass
	} from '$lib/api.js';

	let loading = true;
	let detail = null;
	let processAction = '';
	let processComment = '';
	let processCorrectionNote = '';
	let processExceptionReason = '';
	let processInvoiceStatus = '';
	let processLoanStatus = '';
	let processModal = false;
	let processing = false;

	let activeTab = 'info';
	let evidenceUpdates = [];

	let lastLoadId = '';

	onMount(async () => {
		const token = localStorage.getItem('token');
		if (!token) {
			goto('/login');
			return;
		}

		await loadDetail();
	});

	$: if ($page.params.id && $currentRole && !loading) {
		const key = `${$page.params.id}|${$currentRole}`;
		if (key !== lastLoadId) {
			loadDetail();
		}
	}

	async function loadDetail() {
		loading = true;
		try {
			const id = $page.params.id;
			lastLoadId = `${id}|${$currentRole}`;
			const res = await api.getApplication(id);
			if (res.success) {
				detail = res.data;
				initEvidenceUpdates();
			}
		} catch (e) {
			console.error('加载详情失败', e);
			alert(e.message || '加载详情失败');
		} finally {
			loading = false;
		}
	}

	function initEvidenceUpdates() {
		if (detail && detail.evidence_requirements) {
			evidenceUpdates = detail.evidence_requirements.map(er => ({
				id: er.id,
				evidence_type: er.evidence_type,
				evidence_name: er.evidence_name,
				provided: er.provided,
				attachment_id: er.attachment_id,
				remark: er.remark || ''
			}));
		}
	}

	function goBack() {
		goto('/');
	}

	function openProcessModal(action) {
		processAction = action;
		processComment = '';
		processCorrectionNote = '';
		processExceptionReason = '';
		processInvoiceStatus = '';
		processLoanStatus = '';
		processModal = true;

		if (action === 'reject') {
			processInvoiceStatus = 'failed';
		} else if (action === 'pass') {
			processInvoiceStatus = 'passed';
		} else if (action === 'archive') {
			processLoanStatus = 'confirmed';
		}
	}

	function closeProcessModal() {
		processModal = false;
		processing = false;
	}

	async function doProcess() {
		if (!detail) return;
		processing = true;
		try {
			const req = {
				action: processAction,
				comment: processComment || undefined,
				version: detail.application.version,
			};
			if (processCorrectionNote) req.correction_note = processCorrectionNote;
			if (processExceptionReason) req.exception_reason = processExceptionReason;
			if (processInvoiceStatus) req.invoice_status = processInvoiceStatus;
			if (processLoanStatus) req.loan_status = processLoanStatus;

			if (processAction === 'resubmit' || processAction === 'submit') {
				req.evidence_updates = evidenceUpdates
					.filter(er => er.provided !== detail.evidence_requirements.find(d => d.id === er.id)?.provided || er.remark)
					.map(er => ({
						id: er.id,
						evidence_type: er.evidence_type,
						evidence_name: er.evidence_name,
						provided: !!er.provided,
						attachment_id: er.attachment_id || undefined,
						remark: er.remark || undefined
					}));
			}

			const res = await api.processApplication(detail.application.id, req);
			if (res.success) {
				alert(`处理成功！已执行：${actionMap[processAction]?.label || processAction}`);
				closeProcessModal();
				await loadDetail();
			} else {
				alert(`处理失败：${res.message}`);
			}
		} catch (e) {
			alert(`处理失败：${e.message}`);
		} finally {
			processing = false;
		}
	}

	function actionLabel(action) {
		return actionMap[action]?.label || action;
	}

	function actionColor(action) {
		return actionMap[action]?.color || '#999';
	}

	function toggleEvidence(id) {
		evidenceUpdates = evidenceUpdates.map(er => 
			er.id === id ? { ...er, provided: !er.provided } : er
		);
	}

	$: app = detail?.application;
	$: isPendingCorrection = app?.status === 'pending_correction';
	$: isRegister = $currentRole === 'register';
</script>

<div class="detail-page">
	<div class="top-bar">
		<button class="back-btn" on:click={goBack}>← 返回列表</button>
		<div class="top-title">
			{#if app}
				<span class="app-no">{app.application_no}</span>
				<span class="status-tag" style="background: {statusMap[app.status]?.color || '#999'}33; color: {statusMap[app.status]?.color || '#333'}; border: 1px solid {statusMap[app.status]?.color || '#ccc'}">
					{statusMap[app.status]?.label || app.status}
				</span>
				{#if app.warning_level}
					<span class="wl-tag" style="background: {warningLevelMap[app.warning_level]?.color}22; color: {warningLevelMap[app.warning_level]?.color}; border: 1px solid {warningLevelMap[app.warning_level]?.color}">
						{warningLevelMap[app.warning_level]?.label}
					</span>
				{/if}
			{/if}
		</div>
		<div class="top-actions">
			{#if detail && detail.can_process}
				{#each detail.allowed_actions as act}
					<button 
						class="process-btn" 
						style="background: {actionColor(act)}"
						on:click={() => openProcessModal(act)}
					>
						{actionLabel(act)}
					</button>
				{/each}
			{/if}
		</div>
	</div>

	{#if loading}
		<div class="loading"><div class="spinner"></div>加载中...</div>
	{:else if !detail}
		<div class="empty">申请单不存在</div>
	{:else}
		<div class="tabs">
			<button 
				class="tab {activeTab === 'info' ? 'active' : ''}" 
				on:click={() => activeTab = 'info'}
			>基本信息</button>
			<button 
				class="tab {activeTab === 'records' ? 'active' : ''}" 
				on:click={() => activeTab = 'records'}
			>处理流程（时间线）</button>
			<button 
				class="tab {activeTab === 'evidence' ? 'active' : ''}" 
				on:click={() => activeTab = 'evidence'}
			>证据要求（{detail.evidence_requirements.length}）</button>
			<button 
				class="tab {activeTab === 'exception' ? 'active' : ''}" 
				on:click={() => activeTab = 'exception'}
			>异常原因（{detail.exceptions.length}）</button>
			<button 
				class="tab {activeTab === 'notes' ? 'active' : ''}" 
				on:click={() => activeTab = 'notes'}
			>审计备注（{detail.audit_notes.length}）</button>
		</div>

		<div class="tab-content">
			{#if activeTab === 'info'}
				<div class="info-grid">
					<div class="info-card">
						<h3 class="card-title">📋 申请信息</h3>
						<div class="info-row"><span class="label">申请单号：</span><span class="value">{app.application_no}</span></div>
						<div class="info-row"><span class="label">融资线索：</span><span class="value">{app.clue_no || '-'}</span></div>
						<div class="info-row"><span class="label">客户名称：</span><span class="value">{app.customer_name}</span></div>
						<div class="info-row"><span class="label">融资金额：</span><span class="value money">¥{formatMoney(app.finance_amount)}</span></div>
						<div class="info-row"><span class="label">发票张数：</span><span class="value">{app.invoice_count} 张</span></div>
						<div class="info-row"><span class="label">补正次数：</span><span class="value {app.correction_count > 0 ? 'warn' : ''}">{app.correction_count} 次</span></div>
						<div class="info-row"><span class="label">备注：</span><span class="value">{app.remark || '-'}</span></div>
					</div>
					<div class="info-card">
						<h3 class="card-title">🔄 状态流转</h3>
						<div class="info-row"><span class="label">当前状态：</span><span class="value" style="color: {statusMap[app.status]?.color}">{statusMap[app.status]?.label}</span></div>
						<div class="info-row"><span class="label">当前节点：</span><span class="value">{nodeMap[app.current_node]?.label || app.current_node}</span></div>
						<div class="info-row"><span class="label">当前处理人：</span><span class="value">{app.current_handler_name || '无'}</span></div>
						<div class="info-row"><span class="label">节点期限：</span><span class="value">{formatDate(app.node_deadline)}</span></div>
						<div class="info-row"><span class="label">创建人：</span><span class="value">{app.created_by_name || '-'}</span></div>
						<div class="info-row"><span class="label">创建时间：</span><span class="value">{formatDate(app.created_at)}</span></div>
						<div class="info-row"><span class="label">更新时间：</span><span class="value">{formatDate(app.updated_at)}</span></div>
						<div class="info-row"><span class="label">当前版本：</span><span class="value">v{app.version}</span></div>
					</div>
					<div class="info-card">
						<h3 class="card-title">🧾 核验状态</h3>
						<div class="info-row big-row">
							<span class="label">发票核验：</span>
							<span class="status-chip" style="background: {verifyStatusMap[app.invoice_verify_status]?.color}22; color: {verifyStatusMap[app.invoice_verify_status]?.color}; border: 1px solid {verifyStatusMap[app.invoice_verify_status]?.color}">
								{verifyStatusMap[app.invoice_verify_status]?.label}
							</span>
						</div>
						<div class="info-row big-row">
							<span class="label">放款确认：</span>
							<span class="status-chip" style="background: {loanStatusMap[app.loan_confirm_status]?.color}22; color: {loanStatusMap[app.loan_confirm_status]?.color}; border: 1px solid {loanStatusMap[app.loan_confirm_status]?.color}">
								{loanStatusMap[app.loan_confirm_status]?.label}
							</span>
						</div>
						<div class="status-note">
							<p>📌 筛选说明：</p>
							<p>• "待核验" = 发票核验状态：待核验（pending）</p>
							<p>• "核验失败" = 发票核验状态：未通过（failed）</p>
							<p>• "核验完成" = 发票核验状态：已通过（passed）</p>
						</div>
					</div>
					<div class="info-card">
						<h3 class="card-title">📎 附件材料（{detail.attachments.length}）</h3>
						{#if detail.attachments.length === 0}
							<div class="empty-small">暂无附件</div>
						{:else}
							{#each detail.attachments as att}
								<div class="att-row">
									<span class="att-icon">📄</span>
									<span class="att-name">{att.file_name}</span>
									<span class="att-type">{evidenceTypeMap[att.evidence_type]?.label || att.evidence_type}</span>
									<span class="att-user">{att.uploaded_by_name}</span>
								</div>
							{/each}
						{/if}
					</div>
				</div>
			{:else if activeTab === 'records'}
				<div class="timeline">
					{#each detail.records as rec, i}
						<div class="tl-item">
							<div class="tl-left">
								<div class="tl-dot" style="background: {actionColor(rec.action)}"></div>
								{#if i < detail.records.length - 1}
									<div class="tl-line"></div>
								{/if}
							</div>
							<div class="tl-right">
								<div class="tl-head">
									<span class="tl-action" style="color: {actionColor(rec.action)}">{rec.action_name || rec.action}</span>
									<span class="tl-time">{formatDate(rec.created_at)}</span>
								</div>
								<div class="tl-meta">
									<span class="tl-user">👤 {rec.handler_name || rec.handler}</span>
									<span class="tl-role">
										🎭 {rec.acting_role ? roleMap[rec.acting_role]?.name : roleMap[rec.handler_role]?.name}
										{#if rec.acting_role && rec.acting_role !== rec.handler_role}
											（实际：{roleMap[rec.handler_role]?.label || rec.handler_role}）
										{/if}
									</span>
								</div>
								{#if rec.comment}
									<div class="tl-comment">💬 {rec.comment}</div>
								{/if}
								{#if rec.correction_note}
									<div class="tl-correction">🔧 补正要求：{rec.correction_note}</div>
								{/if}
								<div class="tl-detail">
									{#if rec.from_status || rec.to_status}
										<div class="td-row">
											<span class="td-label">状态：</span>
											<span class="td-val">
												{rec.from_status ? statusMap[rec.from_status]?.label : '-'}
												→ 
												{statusMap[rec.to_status]?.label}
											</span>
										</div>
									{/if}
									{#if rec.from_node || rec.to_node}
										<div class="td-row">
											<span class="td-label">节点：</span>
											<span class="td-val">
												{rec.from_node ? nodeMap[rec.from_node]?.label : '-'}
												→
												{rec.to_node ? nodeMap[rec.to_node]?.label : '-'}
											</span>
										</div>
									{/if}
									{#if rec.invoice_status_before || rec.invoice_status_after}
										<div class="td-row">
											<span class="td-label">发票核验：</span>
											<span class="td-val">
												{rec.invoice_status_before ? verifyStatusMap[rec.invoice_status_before]?.label : '-'}
												→
												{rec.invoice_status_after ? verifyStatusMap[rec.invoice_status_after]?.label : '-'}
											</span>
										</div>
									{/if}
									{#if rec.loan_status_before || rec.loan_status_after}
										<div class="td-row">
											<span class="td-label">放款确认：</span>
											<span class="td-val">
												{rec.loan_status_before ? loanStatusMap[rec.loan_status_before]?.label : '-'}
												→
												{rec.loan_status_after ? loanStatusMap[rec.loan_status_after]?.label : '-'}
											</span>
										</div>
									{/if}
									{#if rec.evidence_required || rec.evidence_provided}
										<div class="td-row">
											<span class="td-label">证据：</span>
											<span class="td-val">
												要求: {rec.evidence_required || '-'}
												<br>
												提供: {rec.evidence_provided || '-'}
											</span>
										</div>
									{/if}
									{#if rec.version_before || rec.version_after}
										<div class="td-row version">
											<span class="td-label">版本：</span>
											<span class="td-val">
												v{rec.version_before || '-'}
												→
												v{rec.version_after}
											</span>
										</div>
									{/if}
								</div>
							</div>
						</div>
					{/each}
				</div>
			{:else if activeTab === 'evidence'}
				<div class="evidence-section">
					<div class="ev-header">
						<h3>证据要求清单</h3>
						<p>绿色=已提供，红色=缺失，退回补正/重新提交时可在此更新证据</p>
					</div>
					{#if evidenceUpdates.length === 0}
						<div class="empty-small">暂无证据要求</div>
					{:else}
						<table class="table evidence-table">
							<thead>
								<tr>
									<th style="width:60px">状态</th>
									<th>证据类型</th>
									<th>证据名称</th>
									<th>要求角色</th>
									<th>附件</th>
									<th>要求时间</th>
									<th>备注</th>
									{#if isPendingCorrection && isRegister}
										<th style="width:80px">操作</th>
									{/if}
								</tr>
							</thead>
							<tbody>
								{#each evidenceUpdates as er}
									<tr class="evidence-row {er.provided ? 'provided' : 'missing'}">
										<td>
											<span class="status-dot" style="background: {er.provided ? '#52c41a' : '#ff4d4f'}"></span>
											{er.provided ? '已提供' : '缺失'}
										</td>
										<td>{evidenceTypeMap[er.evidence_type]?.label || er.evidence_type}</td>
										<td>{er.evidence_name}</td>
										<td>{er.required_by_role ? roleMap[er.required_by_role]?.name || er.required_by_role : '-'}</td>
										<td>{er.attachment_id ? '✅ 关联附件' : '-'}</td>
										<td>{formatDate(er.required_at)}</td>
										<td>
											{#if isPendingCorrection && isRegister}
												<input 
													class="remark-input" 
													bind:value={er.remark} 
													placeholder="补正说明..."
												/>
											{:else}
												{er.remark || '-'}
											{/if}
										</td>
										{#if isPendingCorrection && isRegister}
											<td>
												<label class="toggle-provided">
													<input type="checkbox" bind:checked={er.provided} on:change={() => toggleEvidence(er.id)} />
													<span>{er.provided ? '已提供' : '未提供'}</span>
												</label>
											</td>
										{/if}
									</tr>
								{/each}
							</tbody>
						</table>
					{/if}
				</div>
			{:else if activeTab === 'exception'}
				<div class="exception-section">
					{#if detail.exceptions.length === 0}
						<div class="empty-small">暂无异常记录</div>
					{:else}
						{#each detail.exceptions as exc}
							<div class="exception-card {getSeverityClass(exc.severity)}">
								<div class="exc-head">
									<span class="exc-type" style="color: {exceptionTypeMap[exc.exception_type]?.color}">
										⚠ {exceptionTypeMap[exc.exception_type]?.label || exc.exception_type}
									</span>
									<span class="exc-time">{formatDate(exc.created_at)}</span>
									{#if exc.resolved}
										<span class="exc-resolved">✅ 已解决</span>
									{:else}
										<span class="exc-unresolved">❌ 待解决</span>
									{/if}
								</div>
								<div class="exc-reason">原因：{exc.reason}</div>
								<div class="exc-meta">
									<span>来源角色：{exc.source_role ? roleMap[exc.source_role]?.name || exc.source_role : '-'}</span>
									{#if exc.resolved}
										<span>解决人：{exc.resolved_by_role ? roleMap[exc.resolved_by_role]?.name : ''} / {exc.resolved || '-'}</span>
										{#if exc.resolved_note}
											<span>解决说明：{exc.resolved_note}</span>
										{/if}
										<span>解决时间：{formatDate(exc.resolved_at)}</span>
									{/if}
								</div>
							</div>
						{/each}
					{/if}
				</div>
			{:else if activeTab === 'notes'}
				<div class="notes-section">
					{#if detail.audit_notes.length === 0}
						<div class="empty-small">暂无审计备注</div>
					{:else}
						{#each detail.audit_notes as note}
							<div class="note-card">
								<div class="note-head">
									<span class="note-type">{note.note_type === 'exception' ? '🔴 异常' : '📝 通用'}</span>
									<span class="note-user">{note.created_by_name || note.created_by}</span>
									{#if note.created_by_role}
										<span class="note-role">{roleMap[note.created_by_role]?.name || note.created_by_role}</span>
									{/if}
									<span class="note-time">{formatDate(note.created_at)}</span>
								</div>
								<div class="note-body">{note.note}</div>
							</div>
						{/each}
					{/if}
				</div>
			{/if}
		</div>
	{/if}
</div>

{#if processModal}
	<div class="modal-overlay" on:click={closeProcessModal}>
		<div class="modal" on:click|stopPropagation>
			<div class="modal-header">
				<span class="modal-title">{actionLabel(processAction)} - {app?.application_no}</span>
				<span class="modal-close" on:click={closeProcessModal}>✕</span>
			</div>
			<div class="modal-body">
				<div class="form-group">
					<label>处理意见/备注 <span class="required">*</span></label>
					<textarea 
						class="form-textarea" 
						bind:value={processComment} 
						rows="3"
						placeholder="请输入处理意见或备注...">
					</textarea>
				</div>

				{#if ['reject', 'return'].includes(processAction)}
					<div class="form-group">
						<label>补正要求说明 <span class="required">*</span></label>
						<textarea 
							class="form-textarea" 
							bind:value={processCorrectionNote} 
							rows="3"
							placeholder="请详细说明需要补正的内容...">
						</textarea>
					</div>
					<div class="form-group">
						<label>异常原因描述 <span class="required">*</span></label>
						<textarea 
							class="form-textarea" 
							bind:value={processExceptionReason} 
							rows="2"
							placeholder="请描述问题原因，会同步到异常原因和审计备注...">
						</textarea>
					</div>
				{/if}

				{#if processAction === 'resubmit' && evidenceUpdates.length > 0}
					<div class="form-group">
						<label>更新证据提供状态</label>
						<div class="ev-resubmit-list">
							{#each evidenceUpdates as er}
								<label class="ev-item">
									<input type="checkbox" bind:checked={er.provided} />
									<span class="ev-name">{er.evidence_name}</span>
									<span class="ev-type">（{evidenceTypeMap[er.evidence_type]?.label || er.evidence_type}）</span>
								</label>
							{/each}
						</div>
					</div>
				{/if}

				{#if ['pass', 'reject'].includes(processAction)}
					<div class="form-group">
						<label>发票核验状态</label>
						<select class="form-input" bind:value={processInvoiceStatus}>
							<option value="pending">待核验</option>
							<option value="passed">已通过</option>
							<option value="failed">未通过</option>
						</select>
					</div>
				{/if}

				{#if processAction === 'archive'}
					<div class="form-group">
						<label>放款确认状态</label>
						<select class="form-input" bind:value={processLoanStatus}>
							<option value="pending">待确认</option>
							<option value="confirmed">已放款</option>
							<option value="rejected">已拒绝</option>
						</select>
					</div>
				{/if}

				<div class="form-warning">
					⚠ 提交后将自动变更版本号（v{app?.version} → v{(app?.version || 0) + 1}），
					系统将拦截状态冲突、旧版本提交、越权操作等异常。
				</div>
			</div>
			<div class="modal-footer">
				<button class="btn-secondary" on:click={closeProcessModal} disabled={processing}>取消</button>
				<button 
					class="btn-primary" 
					style="background: {actionColor(processAction)}"
					on:click={doProcess} 
					disabled={processing || !processComment}>
					{processing ? '处理中...' : `确认${actionLabel(processAction)}`}
				</button>
			</div>
		</div>
	</div>
{/if}

<style>
	.detail-page {
		max-width: 1400px;
		margin: 0 auto;
	}
	.top-bar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 16px;
		background: white;
		padding: 14px 20px;
		border-radius: 6px;
		box-shadow: 0 1px 3px rgba(0,0,0,0.08);
	}
	.back-btn {
		padding: 6px 14px;
		background: #f5f5f5;
		border: 1px solid #ddd;
		border-radius: 4px;
		cursor: pointer;
		color: #666;
		font-size: 13px;
	}
	.back-btn:hover { background: #ebebeb; }
	.top-title {
		display: flex;
		align-items: center;
		gap: 12px;
		flex: 1;
		padding: 0 20px;
	}
	.app-no { font-size: 18px; font-weight: 600; color: #333; }
	.status-tag, .wl-tag {
		padding: 3px 10px;
		border-radius: 10px;
		font-size: 12px;
	}
	.top-actions {
		display: flex;
		gap: 8px;
	}
	.process-btn {
		padding: 7px 16px;
		color: white;
		border: none;
		border-radius: 4px;
		cursor: pointer;
		font-size: 13px;
		font-weight: 500;
		filter: brightness(1);
		transition: all 0.2s;
	}
	.process-btn:hover { filter: brightness(1.1); transform: translateY(-1px); }

	.loading, .empty {
		text-align: center;
		padding: 60px;
		color: #999;
	}
	.spinner {
		width: 30px; height: 30px;
		border: 3px solid #eee;
		border-top-color: #1890ff;
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
		margin: 0 auto 10px;
	}
	@keyframes spin { to { transform: rotate(360deg); } }

	.tabs {
		display: flex;
		gap: 4px;
		background: white;
		padding: 0 10px;
		border-bottom: 2px solid #f0f0f0;
		border-radius: 6px 6px 0 0;
	}
	.tab {
		padding: 12px 20px;
		background: none;
		border: none;
		cursor: pointer;
		color: #666;
		font-size: 14px;
		border-bottom: 2px solid transparent;
		margin-bottom: -2px;
		transition: all 0.2s;
	}
	.tab:hover { color: #1890ff; }
	.tab.active {
		color: #1890ff;
		font-weight: 600;
		border-bottom-color: #1890ff;
	}
	.tab-content {
		background: white;
		padding: 24px;
		border-radius: 0 0 6px 6px;
		box-shadow: 0 1px 3px rgba(0,0,0,0.08);
	}

	.info-grid {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 16px;
	}
	.info-card {
		background: #fafafa;
		padding: 18px;
		border-radius: 6px;
		border: 1px solid #f0f0f0;
	}
	.card-title {
		margin: 0 0 14px;
		font-size: 15px;
		color: #333;
		border-bottom: 1px solid #eee;
		padding-bottom: 8px;
	}
	.info-row {
		display: flex;
		padding: 6px 0;
		font-size: 13px;
	}
	.info-row.big-row { padding: 10px 0; }
	.label {
		width: 110px;
		color: #888;
		flex-shrink: 0;
	}
	.value { color: #333; flex: 1; word-break: break-all; }
	.value.money { color: #d4380d; font-weight: 600; font-size: 15px; }
	.value.warn { color: #d46b08; font-weight: 600; }
	.status-chip {
		padding: 3px 10px;
		border-radius: 10px;
		font-size: 12px;
	}
	.status-note {
		margin-top: 12px;
		padding: 10px;
		background: #f6ffed;
		border: 1px solid #b7eb8f;
		border-radius: 4px;
		font-size: 12px;
		color: #389e0d;
		line-height: 1.8;
	}
	.status-note p { margin: 0; }

	.att-row {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 8px;
		background: white;
		border-radius: 4px;
		margin-bottom: 6px;
		font-size: 13px;
	}
	.att-name { flex: 1; color: #333; }
	.att-type {
		background: #e6f7ff;
		color: #1890ff;
		padding: 2px 8px;
		border-radius: 3px;
		font-size: 11px;
	}
	.att-user { color: #999; font-size: 12px; }
	.empty-small {
		color: #bbb;
		text-align: center;
		padding: 20px;
		font-size: 13px;
	}

	.timeline { padding: 4px 0 4px 4px; }
	.tl-item { display: flex; gap: 16px; }
	.tl-left {
		width: 20px;
		display: flex;
		flex-direction: column;
		align-items: center;
	}
	.tl-dot {
		width: 14px; height: 14px;
		border-radius: 50%;
		border: 3px solid white;
		box-shadow: 0 0 0 2px #f0f0f0;
		flex-shrink: 0;
		margin-top: 4px;
	}
	.tl-line {
		width: 2px;
		background: #f0f0f0;
		flex: 1;
		margin: 6px 0;
		min-height: 40px;
	}
	.tl-right {
		flex: 1;
		background: #fafafa;
		padding: 14px 16px;
		border-radius: 6px;
		border: 1px solid #f0f0f0;
		margin-bottom: 14px;
	}
	.tl-head {
		display: flex;
		justify-content: space-between;
		margin-bottom: 6px;
	}
	.tl-action { font-weight: 600; font-size: 15px; }
	.tl-time { color: #999; font-size: 12px; }
	.tl-meta {
		display: flex;
		gap: 16px;
		font-size: 12px;
		color: #888;
		margin-bottom: 10px;
		padding-bottom: 8px;
		border-bottom: 1px dashed #eee;
	}
	.tl-comment {
		padding: 8px 10px;
		background: #e6f7ff;
		border-left: 3px solid #1890ff;
		border-radius: 4px;
		margin-bottom: 8px;
		font-size: 13px;
		color: #0050b3;
	}
	.tl-correction {
		padding: 8px 10px;
		background: #fff7e6;
		border-left: 3px solid #faad14;
		border-radius: 4px;
		margin-bottom: 8px;
		font-size: 13px;
		color: #ad6800;
	}
	.tl-detail {
		font-size: 12px;
		color: #555;
		line-height: 1.9;
	}
	.td-label { color: #999; display: inline-block; min-width: 80px; }
	.td-val.version { font-family: monospace; color: #722ed1; }

	.evidence-section .ev-header {
		margin-bottom: 16px;
		padding-bottom: 10px;
		border-bottom: 1px solid #f0f0f0;
	}
	.ev-header h3 { margin: 0 0 6px; color: #333; }
	.ev-header p { margin: 0; color: #999; font-size: 12px; }
	.evidence-table {
		width: 100%;
		font-size: 13px;
	}
	.evidence-row.missing { background: #fff1f0; }
	.evidence-row.provided { background: #f6ffed; }
	.status-dot {
		display: inline-block;
		width: 8px; height: 8px;
		border-radius: 50%;
		margin-right: 6px;
	}
	.remark-input {
		width: 100%;
		padding: 4px 6px;
		border: 1px solid #d9d9d9;
		border-radius: 3px;
		font-size: 12px;
	}
	.toggle-provided {
		display: flex;
		align-items: center;
		gap: 4px;
		font-size: 12px;
		cursor: pointer;
	}

	.exception-card {
		padding: 14px 16px;
		border-radius: 6px;
		border: 1px solid;
		margin-bottom: 12px;
	}
	.exc-head {
		display: flex;
		gap: 12px;
		align-items: center;
		margin-bottom: 8px;
	}
	.exc-type { font-weight: 600; font-size: 14px; }
	.exc-time { color: #888; font-size: 12px; flex: 1; }
	.exc-resolved {
		background: #52c41a22;
		color: #52c41a;
		padding: 2px 8px;
		border-radius: 3px;
		font-size: 12px;
	}
	.exc-unresolved {
		background: #ff4d4f22;
		color: #ff4d4f;
		padding: 2px 8px;
		border-radius: 3px;
		font-size: 12px;
	}
	.exc-reason { font-size: 13px; margin-bottom: 8px; line-height: 1.6; }
	.exc-meta {
		display: flex;
		flex-wrap: wrap;
		gap: 16px;
		font-size: 12px;
		color: #888;
	}

	.note-card {
		background: #fafafa;
		padding: 14px;
		border-radius: 6px;
		border-left: 4px solid #1890ff;
		margin-bottom: 10px;
	}
	.note-head {
		display: flex;
		gap: 12px;
		font-size: 12px;
		color: #888;
		margin-bottom: 8px;
	}
	.note-type {
		font-weight: 600;
		font-size: 13px;
		color: #1890ff;
	}
	.note-body { font-size: 13px; color: #333; line-height: 1.6; }

	.modal-overlay {
		position: fixed;
		inset: 0;
		background: rgba(0,0,0,0.5);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 9999;
	}
	.modal {
		background: white;
		border-radius: 8px;
		width: 560px;
		max-width: 92vw;
		max-height: 85vh;
		overflow-y: auto;
		box-shadow: 0 10px 40px rgba(0,0,0,0.3);
	}
	.modal-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 16px 20px;
		border-bottom: 1px solid #f0f0f0;
	}
	.modal-title { font-weight: 600; font-size: 16px; color: #333; }
	.modal-close {
		cursor: pointer;
		color: #999;
		font-size: 18px;
		padding: 4px;
	}
	.modal-body { padding: 20px; }
	.form-group {
		margin-bottom: 14px;
	}
	.form-group label {
		display: block;
		margin-bottom: 6px;
		font-size: 13px;
		color: #555;
		font-weight: 500;
	}
	.form-group .required { color: #ff4d4f; }
	.form-input, .form-textarea {
		width: 100%;
		padding: 8px 10px;
		border: 1px solid #d9d9d9;
		border-radius: 4px;
		font-size: 13px;
		outline: none;
		transition: border 0.2s;
		box-sizing: border-box;
		font-family: inherit;
	}
	.form-input:focus, .form-textarea:focus { border-color: #1890ff; }
	.form-warning {
		background: #fffbe6;
		border: 1px solid #ffe58f;
		color: #874d00;
		padding: 10px 12px;
		border-radius: 4px;
		font-size: 12px;
		line-height: 1.6;
		margin-top: 16px;
	}
	.ev-resubmit-list {
		background: #fafafa;
		padding: 10px;
		border-radius: 4px;
		max-height: 180px;
		overflow-y: auto;
	}
	.ev-item {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 6px 4px;
		font-size: 13px;
		cursor: pointer;
	}
	.ev-name { font-weight: 500; }
	.ev-type { color: #999; font-size: 12px; }
	.modal-footer {
		display: flex;
		justify-content: flex-end;
		gap: 10px;
		padding: 14px 20px;
		border-top: 1px solid #f0f0f0;
	}
	.btn-secondary, .btn-primary {
		padding: 8px 18px;
		border-radius: 4px;
		cursor: pointer;
		font-size: 13px;
		border: none;
		transition: all 0.2s;
	}
	.btn-secondary {
		background: #f5f5f5;
		color: #666;
		border: 1px solid #ddd;
	}
	.btn-secondary:hover { background: #ebebeb; }
	.btn-primary {
		color: white;
		font-weight: 500;
	}
	.btn-primary:disabled, .btn-secondary:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}
</style>
