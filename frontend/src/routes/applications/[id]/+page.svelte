<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { userStore } from '$lib/stores';
	import {
		getApplication, updateApplication, submitApplication,
		allocateApplication, confirmApplication, returnApplication,
		correctApplication, getRecords, getAuditNotes, addAuditNote,
		getExceptions, getAttachments, addAttachment
	} from '$lib/api';
	import {
		STATUS_LABELS, STATUS_COLORS, STEP_LABELS, TEMP_ZONE_LABELS,
		EXPIRY_LABELS, EXPIRY_COLORS, ROLE_LABELS
	} from '$lib/types';
	import type { Application, ProcessingRecord, AuditNote, ExceptionReason, Attachment } from '$lib/types';

	let app: Application | null = null;
	let loading = true;
	let actionError = '';
	let versionConflict = false;

	let records: ProcessingRecord[] = [];
	let auditNotes: AuditNote[] = [];
	let exceptions: ExceptionReason[] = [];
	let attachments: Attachment[] = [];

	let activeTab = 'records';
	let tabLoading = false;
	let recordsLoaded = false;
	let notesLoaded = false;
	let exceptionsLoaded = false;
	let attachmentsLoaded = false;

	let editForm = { product_name: '', product_count: 1, expected_date: '', appointment_time: '' };
	let allocateZone = '';
	let returnNote = '';
	let newNoteContent = '';
	let newAttachName = '';
	let newAttachType = '';

	let submitting = false;
	let allocating = false;
	let returning = false;
	let correcting = false;
	let confirming = false;
	let addingNote = false;
	let addingAttach = false;

	async function loadApp() {
		loading = true;
		actionError = '';
		versionConflict = false;
		try {
			app = await getApplication(Number($page.params.id));
			editForm = {
				product_name: app.product_name,
				product_count: app.product_count,
				expected_date: app.expected_date,
				appointment_time: app.appointment_time
			};
			exceptions = await getExceptions(app.id);
			exceptionsLoaded = true;
			recordsLoaded = false;
			notesLoaded = false;
		} catch (err: any) {
			actionError = err.code ? `${err.code}: ${err.message}` : '加载失败';
		}
		loading = false;
	}

	async function loadTab() {
		tabLoading = true;
		const id = Number($page.params.id);
		try {
			if (activeTab === 'records' && !recordsLoaded) {
				records = await getRecords(id);
				recordsLoaded = true;
			} else if (activeTab === 'notes' && !notesLoaded) {
				auditNotes = await getAuditNotes(id);
				notesLoaded = true;
			} else if (activeTab === 'exceptions' && !exceptionsLoaded) {
				exceptions = await getExceptions(id);
				exceptionsLoaded = true;
			} else if (activeTab === 'attachments' && !attachmentsLoaded) {
				attachments = await getAttachments(id);
				attachmentsLoaded = true;
			}
		} catch (err: any) {
			actionError = err.code ? `${err.code}: ${err.message}` : '加载失败';
		}
		tabLoading = false;
	}

	function handleActionError(err: any) {
		if (err.code === 'VERSION_CONFLICT') {
			versionConflict = true;
		}
		actionError = err.code ? `${err.code}: ${err.message}` : '操作失败';
	}

	async function handleUpdate() {
		actionError = '';
		versionConflict = false;
		try {
			await updateApplication(app!.id, { ...editForm, version: app!.version });
			await loadApp();
		} catch (err: any) {
			handleActionError(err);
		}
	}

	async function handleSubmit() {
		actionError = '';
		versionConflict = false;
		submitting = true;
		try {
			await submitApplication(app!.id, app!.version);
			await loadApp();
		} catch (err: any) {
			handleActionError(err);
		}
		submitting = false;
	}

	async function handleAllocate() {
		actionError = '';
		versionConflict = false;
		allocating = true;
		try {
			await allocateApplication(app!.id, app!.version, allocateZone);
			await loadApp();
		} catch (err: any) {
			handleActionError(err);
		}
		allocating = false;
	}

	async function handleConfirm() {
		actionError = '';
		versionConflict = false;
		confirming = true;
		try {
			await confirmApplication(app!.id, app!.version);
			await loadApp();
		} catch (err: any) {
			handleActionError(err);
		}
		confirming = false;
	}

	async function handleReturn() {
		actionError = '';
		versionConflict = false;
		returning = true;
		try {
			await returnApplication(app!.id, app!.version, returnNote);
			await loadApp();
		} catch (err: any) {
			handleActionError(err);
		}
		returning = false;
	}

	async function handleCorrect() {
		actionError = '';
		versionConflict = false;
		correcting = true;
		try {
			await correctApplication(app!.id, app!.version);
			await loadApp();
		} catch (err: any) {
			handleActionError(err);
		}
		correcting = false;
	}

	async function handleAddNote() {
		actionError = '';
		addingNote = true;
		try {
			const note = await addAuditNote(app!.id, newNoteContent);
			auditNotes = [...auditNotes, note];
			newNoteContent = '';
		} catch (err: any) {
			actionError = err.code ? `${err.code}: ${err.message}` : '添加备注失败';
		}
		addingNote = false;
	}

	async function handleAddAttachment() {
		actionError = '';
		addingAttach = true;
		try {
			const att = await addAttachment(app!.id, newAttachName, newAttachType);
			attachments = [...attachments, att];
			newAttachName = '';
			newAttachType = '';
		} catch (err: any) {
			actionError = err.code ? `${err.code}: ${err.message}` : '添加附件失败';
		}
		addingAttach = false;
	}

	$: role = $userStore?.role || '';
	$: canEditDraft = app?.status === 'draft' && role === 'warehouse_clerk';
	$: canAllocate = app?.status === 'pending_temp' && role === 'temp_supervisor';
	$: canCorrect = app?.status === 'pending_correction' && role === 'warehouse_clerk';
	$: canReview = app?.status === 'under_review' && role === 'warehouse_manager';
	$: isCompleted = app?.status === 'completed';
	$: noAction = app && !canEditDraft && !canAllocate && !canCorrect && !canReview && !isCompleted;

	$: currentHandlerName = (() => {
		if (!app) return '-';
		switch (app.status) {
			case 'draft':
			case 'pending_correction':
				return app.creator_name || '仓管员';
			case 'pending_temp':
				return app.handler_name || '待分配温控主管';
			case 'under_review':
				return '仓储经理';
			case 'completed':
				return '-';
			default:
				return '-';
		}
	})();

	$: currentHandlerRole = (() => {
		if (!app) return '';
		switch (app.status) {
			case 'draft':
			case 'pending_correction':
				return 'warehouse_clerk';
			case 'pending_temp':
				return 'temp_supervisor';
			case 'under_review':
				return 'warehouse_manager';
			default:
				return '';
		}
	})();

	$: isOverdue = app?.expiry_group === 'overdue';

	import { onMount } from 'svelte';
	onMount(() => { loadApp(); });
</script>

<svelte:head>
	<title>入库单详情 - 冷链物流仓入库单系统</title>
</svelte:head>

<button class="btn-back" on:click={() => goto('/applications')}>&larr; 返回列表</button>

{#if loading}
	<div class="loading">加载中...</div>
{:else if app}
	<div class="detail-grid">
		<div class="info-card">
			<h3 class="card-title">入库单信息</h3>
			<div class="info-grid">
				<div class="info-item"><span class="info-label">单号</span><span class="info-value">{app.order_no}</span></div>
				<div class="info-item"><span class="info-label">品名</span><span class="info-value">{#if app.product_name}{app.product_name}{:else}<span class="missing">未填写</span>{/if}</span></div>
				<div class="info-item"><span class="info-label">数量</span><span class="info-value">{#if app.product_count > 0}{app.product_count}{:else}<span class="missing">未填写</span>{/if}</span></div>
				<div class="info-item"><span class="info-label">预计到期</span><span class="info-value">{#if app.expected_date}{app.expected_date}{:else}<span class="missing">未填写</span>{/if}</span></div>
				<div class="info-item"><span class="info-label">预约时间</span><span class="info-value">{app.appointment_time || '-'}</span></div>
				<div class="info-item"><span class="info-label">温区</span><span class="info-value">{TEMP_ZONE_LABELS[app.temperature_zone] || app.temperature_zone || '-'}</span></div>
				<div class="info-item"><span class="info-label">状态</span><span class="info-value"><span class="badge" style="background:{STATUS_COLORS[app.status] || '#999'}">{STATUS_LABELS[app.status] || app.status}</span></span></div>
				<div class="info-item"><span class="info-label">当前步骤</span><span class="info-value">{STEP_LABELS[app.current_step] || app.current_step}</span></div>
				<div class="info-item"><span class="info-label">版本</span><span class="info-value">v{app.version}</span></div>
				<div class="info-item"><span class="info-label">创建人</span><span class="info-value">{app.creator_name || '-'}</span></div>
				<div class="info-item"><span class="info-label">操作人</span><span class="info-value">{app.handler_name || '-'}</span></div>
				{#if app.expiry_group}
					<div class="info-item"><span class="info-label">到期分组</span><span class="info-value"><span class="badge" style="background:{EXPIRY_COLORS[app.expiry_group] || '#999'}">{EXPIRY_LABELS[app.expiry_group] || app.expiry_group}</span></span></div>
				{/if}
			</div>

			<div class="handler-grid">
				<div class="handler-box {isOverdue ? 'overdue' : ''}">
					<div class="handler-label">
						{#if isOverdue}
							⚠️ 逾期责任人
						{:else}
							👤 当前处理人
						{/if}
					</div>
					<div class="handler-name">{currentHandlerName}</div>
					<div class="handler-role">{ROLE_LABELS[currentHandlerRole] || ''}</div>
				</div>
			</div>

			{#if app.correction_note}
				<div class="info-item full" style="margin-top:12px"><span class="info-label">补正说明</span><span class="info-value correction">{app.correction_note}</span></div>
			{/if}
			<div class="info-grid" style="margin-top:12px">
				<div class="info-item"><span class="info-label">创建时间</span><span class="info-value">{app.created_at}</span></div>
				<div class="info-item"><span class="info-label">更新时间</span><span class="info-value">{app.updated_at}</span></div>
			</div>
		</div>

		{#if exceptions.length > 0}
			<div class="info-card exception-card">
				<h3 class="card-title">
					<span class="exception-icon">🚨</span>
					异常原因 ({exceptions.length})
				</h3>
				{#each exceptions as ex, i}
					<div class="exception-item">
						<div class="exception-header">
							<span class="exception-index">#{i + 1}</span>
							<span class="badge small" style="background:#f44336">{ex.reason_type}</span>
							<span class="exception-meta">{ex.operator_name || '-'} · {ex.created_at}</span>
						</div>
						<div class="exception-desc">{ex.description}</div>
					</div>
				{/each}
			</div>
		{/if}

		<div class="action-card">
			<h3 class="card-title">操作面板</h3>

			{#if actionError}
				<div class="error-msg">
					{actionError}
					{#if versionConflict}
						<button class="btn-refresh" on:click={loadApp}>刷新数据</button>
					{/if}
				</div>
			{/if}

			{#if canEditDraft}
				<div class="action-section">
					<h4>编辑入库单</h4>
					<div class="form-row">
						<div class="form-group"><label>品名</label><input type="text" bind:value={editForm.product_name} /></div>
						<div class="form-group"><label>数量</label><input type="number" bind:value={editForm.product_count} min="1" /></div>
					</div>
					<div class="form-row">
						<div class="form-group"><label>预计到期日</label><input type="date" bind:value={editForm.expected_date} /></div>
						<div class="form-group"><label>预约时间</label><input type="datetime-local" bind:value={editForm.appointment_time} /></div>
					</div>
					<div class="btn-group">
						<button class="btn-secondary" on:click={handleUpdate} disabled={submitting}>保存修改</button>
						<button class="btn-primary" on:click={handleSubmit} disabled={submitting}>{submitting ? '提交中...' : '提交审核'}</button>
					</div>
				</div>
			{:else if canAllocate}
				<div class="action-section">
					<h4>温区分配</h4>
					<div class="form-group">
						<label>选择温区</label>
						<select bind:value={allocateZone}>
							<option value="">请选择</option>
							{#each Object.entries(TEMP_ZONE_LABELS) as [key, label]}
								<option value={key}>{label}</option>
							{/each}
						</select>
					</div>
					<div class="btn-group">
						<button class="btn-primary" on:click={handleAllocate} disabled={allocating || !allocateZone}>{allocating ? '分配中...' : '分配温区并推进'}</button>
						<button class="btn-danger" on:click={handleReturn} disabled={returning}>{returning ? '退回中...' : '退回补正'}</button>
					</div>
					{#if !returning}
						<div class="form-group" style="margin-top:12px">
							<label>退回补正说明</label>
							<input type="text" bind:value={returnNote} placeholder="填写退回原因..." />
						</div>
					{/if}
				</div>
			{:else if canCorrect}
				<div class="action-section">
					<h4>修正入库单</h4>
					{#if app.correction_note}
						<div class="correction-note">补正说明: {app.correction_note}</div>
					{/if}
					<div class="form-row">
						<div class="form-group"><label>品名</label><input type="text" bind:value={editForm.product_name} /></div>
						<div class="form-group"><label>数量</label><input type="number" bind:value={editForm.product_count} min="1" /></div>
					</div>
					<div class="form-row">
						<div class="form-group"><label>预计到期日</label><input type="date" bind:value={editForm.expected_date} /></div>
						<div class="form-group"><label>预约时间</label><input type="datetime-local" bind:value={editForm.appointment_time} /></div>
					</div>
					<div class="btn-group">
						<button class="btn-secondary" on:click={handleUpdate} disabled={correcting}>保存修改</button>
						<button class="btn-primary" on:click={handleCorrect} disabled={correcting}>{correcting ? '提交中...' : '修正并重新提交'}</button>
					</div>
				</div>
			{:else if canReview}
				<div class="action-section">
					<h4>复核操作</h4>
					<div class="btn-group">
						<button class="btn-success" on:click={handleConfirm} disabled={confirming}>{confirming ? '处理中...' : '复核通过'}</button>
						<button class="btn-danger" on:click={handleReturn} disabled={returning}>{returning ? '退回中...' : '退回补正'}</button>
					</div>
					<div class="form-group" style="margin-top:12px">
						<label>退回补正说明</label>
						<input type="text" bind:value={returnNote} placeholder="填写退回原因..." />
					</div>
				</div>
			{:else if isCompleted}
				<div class="completed-label">已办结</div>
			{:else if noAction}
				<div class="no-action">当前无操作权限</div>
			{/if}
		</div>
	</div>

	<div class="tabs">
		<button class="tab-btn" class:active={activeTab === 'records'} on:click={() => { activeTab = 'records'; loadTab(); }}>操作记录</button>
		<button class="tab-btn" class:active={activeTab === 'notes'} on:click={() => { activeTab = 'notes'; loadTab(); }}>审计备注</button>
		<button class="tab-btn" class:active={activeTab === 'attachments'} on:click={() => { activeTab = 'attachments'; loadTab(); }}>附件</button>
		<button class="tab-btn" class:active={activeTab === 'exceptions'} on:click={() => { activeTab = 'exceptions'; loadTab(); }}>异常原因</button>
	</div>

	<div class="tab-content">
		{#if tabLoading}
			<div class="loading">加载中...</div>
		{:else if activeTab === 'records'}
			<table class="data-table">
				<thead><tr><th>时间</th><th>操作人</th><th>动作</th><th>状态变更</th><th>备注</th></tr></thead>
				<tbody>
					{#if records.length === 0}<tr><td colspan="5" class="empty">暂无记录</td></tr>{/if}
					{#each records as r}
						<tr>
							<td>{r.created_at}</td>
							<td>{r.operator_name || '-'}</td>
							<td>{r.action}</td>
							<td>{STATUS_LABELS[r.from_status] || r.from_status} → {STATUS_LABELS[r.to_status] || r.to_status}</td>
							<td>{r.remark || '-'}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		{:else if activeTab === 'notes'}
			<div class="note-form">
				<input type="text" bind:value={newNoteContent} placeholder="输入审计备注..." />
				<button class="btn-primary" on:click={handleAddNote} disabled={addingNote || !newNoteContent}>{addingNote ? '添加中...' : '添加'}</button>
			</div>
			<div class="note-list">
				{#if auditNotes.length === 0}<div class="empty">暂无备注</div>{/if}
				{#each auditNotes as n}
					<div class="note-item">
						<div class="note-meta">{n.operator_name || '-'} | {n.created_at}</div>
						<div class="note-content">{n.content}</div>
					</div>
				{/each}
			</div>
		{:else if activeTab === 'attachments'}
			<div class="note-form">
				<input type="text" bind:value={newAttachName} placeholder="文件名" />
				<input type="text" bind:value={newAttachType} placeholder="文件类型" />
				<button class="btn-primary" on:click={handleAddAttachment} disabled={addingAttach || !newAttachName || !newAttachType}>{addingAttach ? '添加中...' : '添加'}</button>
			</div>
			<table class="data-table">
				<thead><tr><th>文件名</th><th>类型</th><th>上传人</th><th>时间</th></tr></thead>
				<tbody>
					{#if attachments.length === 0}<tr><td colspan="4" class="empty">暂无附件</td></tr>{/if}
					{#each attachments as a}
						<tr><td>{a.file_name}</td><td>{a.file_type}</td><td>{a.uploaded_by_name || '-'}</td><td>{a.created_at}</td></tr>
					{/each}
				</tbody>
			</table>
		{:else if activeTab === 'exceptions'}
			{#if exceptions.length === 0}
				<div class="empty">暂无异常原因</div>
			{:else}
				<div class="exception-list">
					{#each exceptions as e, i}
						<div class="exception-row">
							<div class="exception-row-header">
								<span class="exception-index">#{i + 1}</span>
								<span class="badge small" style="background:#f44336">{e.reason_type}</span>
								<span class="exception-operator">{e.operator_name || '-'}</span>
								<span class="exception-time">{e.created_at}</span>
							</div>
							<div class="exception-row-desc">{e.description}</div>
						</div>
					{/each}
				</div>
			{/if}
		{/if}
	</div>
{:else}
	<div class="error-msg">未找到该入库单</div>
{/if}

<style>
	.btn-back {
		background: none;
		border: none;
		color: var(--accent);
		font-size: 14px;
		cursor: pointer;
		margin-bottom: 16px;
		padding: 0;
	}
	.btn-back:hover { text-decoration: underline; }
	.loading { text-align: center; padding: 40px; color: var(--text-light); }
	.error-msg {
		background: #fff5f5;
		color: var(--danger);
		padding: 10px 14px;
		border-radius: 6px;
		margin-bottom: 16px;
		font-size: 13px;
		border: 1px solid #fed7d7;
		display: flex;
		align-items: center;
		justify-content: space-between;
	}
	.btn-refresh {
		padding: 4px 12px;
		background: var(--accent);
		color: white;
		border: none;
		border-radius: 4px;
		cursor: pointer;
		font-size: 12px;
	}
	.btn-refresh:hover { background: var(--primary-light); }
	.detail-grid {
		display: flex;
		flex-direction: column;
		gap: 20px;
	}
	.info-card, .action-card {
		background: var(--card-bg);
		border-radius: 8px;
		padding: 20px 24px;
		box-shadow: var(--shadow);
	}
	.card-title {
		font-size: 16px;
		font-weight: 600;
		color: var(--text);
		margin-bottom: 16px;
		padding-bottom: 10px;
		border-bottom: 1px solid var(--border);
	}
	.info-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
		gap: 12px 24px;
	}
	.info-item { display: flex; flex-direction: column; gap: 2px; }
	.info-item.full { grid-column: 1 / -1; }
	.info-label { font-size: 12px; color: var(--text-light); }
	.info-value { font-size: 14px; color: var(--text); font-weight: 500; }
	.correction { color: var(--danger); font-weight: 400; }
	.badge {
		display: inline-block;
		padding: 3px 10px;
		border-radius: 12px;
		color: white;
		font-size: 12px;
		font-weight: 500;
	}
	.badge.small { padding: 2px 8px; font-size: 11px; }
	.exception-item {
		padding: 10px 0;
		border-bottom: 1px solid var(--border);
		display: flex;
		align-items: center;
		gap: 10px;
		flex-wrap: wrap;
	}
	.exception-desc { font-size: 13px; color: var(--text); }
	.exception-meta { font-size: 12px; color: var(--text-light); }
	.action-section {
		padding: 12px 0;
	}
	.action-section h4 {
		font-size: 14px;
		font-weight: 600;
		margin-bottom: 12px;
		color: var(--primary);
	}
	.form-row {
		display: flex;
		gap: 12px;
		margin-bottom: 8px;
	}
	.form-group {
		flex: 1;
		margin-bottom: 10px;
	}
	.form-group label {
		display: block;
		margin-bottom: 4px;
		font-size: 12px;
		font-weight: 500;
		color: var(--text);
	}
	.form-group input, .form-group select {
		width: 100%;
		padding: 8px 10px;
		border: 1px solid var(--border);
		border-radius: 6px;
		font-size: 13px;
	}
	.form-group input:focus, .form-group select:focus {
		outline: none;
		border-color: var(--accent);
	}
	.btn-group {
		display: flex;
		gap: 10px;
		margin-top: 12px;
		flex-wrap: wrap;
	}
	.btn-primary {
		padding: 8px 20px;
		background: var(--primary);
		color: white;
		border: none;
		border-radius: 6px;
		font-size: 13px;
		cursor: pointer;
	}
	.btn-primary:hover:not(:disabled) { background: var(--primary-light); }
	.btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
	.btn-secondary {
		padding: 8px 20px;
		background: var(--card-bg);
		color: var(--text);
		border: 1px solid var(--border);
		border-radius: 6px;
		font-size: 13px;
		cursor: pointer;
	}
	.btn-secondary:hover:not(:disabled) { background: #f7fafc; }
	.btn-secondary:disabled { opacity: 0.6; cursor: not-allowed; }
	.btn-success {
		padding: 8px 20px;
		background: var(--success);
		color: white;
		border: none;
		border-radius: 6px;
		font-size: 13px;
		cursor: pointer;
	}
	.btn-success:hover:not(:disabled) { background: #43a047; }
	.btn-success:disabled { opacity: 0.6; cursor: not-allowed; }
	.btn-danger {
		padding: 8px 20px;
		background: var(--danger);
		color: white;
		border: none;
		border-radius: 6px;
		font-size: 13px;
		cursor: pointer;
	}
	.btn-danger:hover:not(:disabled) { background: #e53935; }
	.btn-danger:disabled { opacity: 0.6; cursor: not-allowed; }
	.correction-note {
		background: #fff8e1;
		padding: 10px 14px;
		border-radius: 6px;
		font-size: 13px;
		color: #e65100;
		margin-bottom: 12px;
		border: 1px solid #ffe0b2;
	}
	.completed-label {
		text-align: center;
		padding: 20px;
		font-size: 16px;
		font-weight: 600;
		color: var(--success);
	}
	.no-action {
		text-align: center;
		padding: 20px;
		font-size: 14px;
		color: var(--text-light);
	}
	.tabs {
		display: flex;
		gap: 2px;
		margin-top: 24px;
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
		transition: all 0.2s;
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
	.data-table .empty {
		text-align: center;
		padding: 30px;
		color: var(--text-light);
	}
	.note-form {
		display: flex;
		gap: 8px;
		margin-bottom: 16px;
	}
	.note-form input {
		flex: 1;
		padding: 8px 10px;
		border: 1px solid var(--border);
		border-radius: 6px;
		font-size: 13px;
	}
	.note-form input:focus { outline: none; border-color: var(--accent); }
	.note-list { display: flex; flex-direction: column; gap: 8px; }
	.note-item {
		padding: 10px;
		background: #f7fafc;
		border-radius: 6px;
	}
	.note-meta { font-size: 12px; color: var(--text-light); margin-bottom: 4px; }
	.note-content { font-size: 13px; color: var(--text); }
	.empty { text-align: center; padding: 30px; color: var(--text-light); }
	.missing {
		color: var(--danger);
		font-style: italic;
		font-weight: 500;
	}
	.handler-grid {
		display: grid;
		grid-template-columns: 1fr;
		gap: 12px;
		margin-top: 16px;
		padding-top: 16px;
		border-top: 1px solid var(--border);
	}
	.handler-box {
		background: linear-gradient(135deg, #e3f2fd, #bbdefb);
		border-radius: 8px;
		padding: 16px 20px;
		display: flex;
		flex-direction: column;
		gap: 4px;
		border-left: 4px solid var(--primary);
	}
	.handler-box.overdue {
		background: linear-gradient(135deg, #ffebee, #ffcdd2);
		border-left-color: var(--danger);
	}
	.handler-label {
		font-size: 12px;
		color: var(--text-light);
		font-weight: 500;
	}
	.handler-name {
		font-size: 18px;
		font-weight: 600;
		color: var(--text);
	}
	.handler-box.overdue .handler-name {
		color: var(--danger);
	}
	.handler-role {
		font-size: 12px;
		color: var(--text-light);
	}
	.exception-card {
		border-left: 4px solid var(--danger);
		background: #fff8f8;
	}
	.exception-icon {
		margin-right: 6px;
	}
	.exception-card .card-title {
		color: var(--danger);
	}
	.exception-item {
		padding: 12px 0;
		border-bottom: 1px solid var(--border);
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	.exception-item:last-child { border-bottom: none; }
	.exception-header {
		display: flex;
		align-items: center;
		gap: 10px;
		flex-wrap: wrap;
	}
	.exception-index {
		font-size: 12px;
		color: var(--danger);
		font-weight: 600;
	}
	.exception-meta {
		font-size: 12px;
		color: var(--text-light);
		margin-left: auto;
	}
	.exception-desc {
		font-size: 13px;
		color: var(--text);
		padding-left: 2px;
	}
	.exception-list {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}
	.exception-row {
		background: #fff8f8;
		border-radius: 8px;
		padding: 12px 16px;
		border-left: 3px solid var(--danger);
	}
	.exception-row-header {
		display: flex;
		align-items: center;
		gap: 10px;
		margin-bottom: 6px;
		flex-wrap: wrap;
	}
	.exception-operator {
		font-size: 12px;
		color: var(--text);
		font-weight: 500;
	}
	.exception-time {
		font-size: 12px;
		color: var(--text-light);
		margin-left: auto;
	}
	.exception-row-desc {
		font-size: 13px;
		color: var(--text);
		padding-left: 2px;
	}
</style>
