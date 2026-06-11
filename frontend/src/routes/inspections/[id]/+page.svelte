<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { currentRole, currentUser, triggerRefresh, refreshTrigger } from '$lib/stores';
	import { fetchInspectionDetail, processInspection, uploadAttachment } from '$lib/api';
	import type { InspectionDetail, Action, ProcessNode } from '$lib/types';

	let detail: InspectionDetail | null = null;
	let loading = true;
	let error = '';
	let toast = '';
	let toastTimer: any;

	let showRejectDialog = false;
	let exceptionReason = '';
	let processComment = '';
	let correctionAttachments: File[] = [];

	function showToast(msg: string) {
		toast = msg;
		if (toastTimer) clearTimeout(toastTimer);
		toastTimer = setTimeout(() => (toast = ''), 3000);
	}

	async function loadData() {
		loading = true;
		error = '';
		try {
			const id = $page.params.id;
			const res = await fetchInspectionDetail(id);
			detail = res.data;
		} catch (e: any) {
			error = e.message || '加载失败';
		}
		loading = false;
	}

	async function handleProcess(action: Action) {
		if (!detail) return;
		if (action === 'reject' && !showRejectDialog) {
			showRejectDialog = true;
			return;
		}
		if (action === 'reject' && !exceptionReason.trim()) {
			showToast('请填写异常原因');
			return;
		}
		if (action === 'correct' && correctionAttachments.length === 0 && detail.attachments.length === 0) {
			showToast('补正时请上传补充材料作为附件证据');
			return;
		}
		try {
			const reqAttachments = action === 'correct' && correctionAttachments.length > 0
				? correctionAttachments.map(f => ({
					filename: f.name,
					file_type: f.type || 'application/octet-stream',
					file_size: f.size
				}))
				: undefined;

			await processInspection(detail.inspection.id, {
				action,
				operator: $currentUser,
				operator_role: $currentRole,
				comment: processComment || undefined,
				exception_reason: action === 'reject' ? exceptionReason : undefined,
				version: detail.inspection.version,
				attachments: reqAttachments
			});
			showRejectDialog = false;
			exceptionReason = '';
			processComment = '';
			correctionAttachments = [];
			showToast('操作成功');
			triggerRefresh();
			loadData();
		} catch (e: any) {
			showToast(e.message || '操作失败');
		}
	}

	async function handleUpload(e: Event) {
		if (!detail) return;
		const target = e.target as HTMLInputElement;
		const file = target.files?.[0];
		if (!file) return;
		try {
			await uploadAttachment(detail.inspection.id, file.name, file.type, file.size, $currentUser);
			showToast('上传成功');
			loadData();
		} catch (e: any) {
			showToast(e.message || '上传失败');
		}
		target.value = '';
	}

	function statusLabel(s: string) {
		const m: Record<string, string> = {
			pending_review: '待审核',
			under_review: '审核中',
			approved: '审核通过',
			pending_correction: '待补正',
			synced: '已同步'
		};
		return m[s] || s;
	}

	function actionLabel(a: string) {
		const m: Record<string, string> = {
			submit: '提交审核',
			approve: '通过',
			reject: '退回',
			correct: '补正提交',
			confirm_sync: '确认同步'
		};
		return m[a] || a;
	}

	function roleLabel(r: string) {
		const m: Record<string, string> = {
			pond_admin: '塘口管理员',
			quality_engineer: '水质工程师',
			base_director: '基地负责人'
		};
		return m[r] || r;
	}

	function nodeStatusLabel(s: string) {
		const m: Record<string, string> = {
			completed: '已完成',
			active: '进行中',
			pending: '待处理',
			rejected: '已退回'
		};
		return m[s] || s;
	}

	function getAvailableActions(): Action[] {
		if (!detail) return [];
		const role = $currentRole;
		const status = detail.inspection.status;
		const actions: Action[] = [];
		if (role === 'quality_engineer' && status === 'pending_review') actions.push('approve', 'reject');
		if (role === 'pond_admin' && status === 'pending_correction') actions.push('correct');
		if (role === 'base_director' && status === 'approved') actions.push('confirm_sync', 'reject');
		return actions;
	}

	function computeOverdueType(deadline: string): string {
		const now = new Date();
		now.setHours(0, 0, 0, 0);
		const dl = new Date(deadline + 'T00:00:00');
		const diff = (dl.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
		if (diff < 0) return 'overdue';
		if (diff <= 3) return 'approaching';
		return 'normal';
	}

	function isNodeCompleted(node: ProcessNode): boolean {
		return node.status === 'completed';
	}

	function isNodeCurrent(node: ProcessNode): boolean {
		return node.status === 'active' || node.status === 'rejected';
	}

	onMount(() => {
		loadData();
		const unsubscribe = refreshTrigger.subscribe(() => {
			loadData();
		});
		return unsubscribe;
	});
</script>

{#if toast}
	<div class="fixed top-4 right-4 z-50 bg-accent text-white px-4 py-2 rounded-lg shadow-lg text-sm animate-fade-in z-[60]">
		{toast}
	</div>
{/if}

{#if loading}
	<div class="flex items-center justify-center h-64">
		<div class="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin"></div>
	</div>
{:else if error}
	<div class="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm">{error}</div>
{:else if detail}
	<div class="animate-fade-in space-y-5">
		<div class="flex items-center gap-3 mb-2">
			<a href="/inspections" class="text-gray-400 hover:text-gray-600 text-sm">← 返回列表</a>
		</div>

		<div class="bg-white rounded-xl shadow-sm p-6">
			<div class="flex items-center justify-between mb-4">
				<h2 class="text-lg font-bold text-gray-800">检测单 {detail.inspection.id}</h2>
				<div class="flex items-center gap-3">
					<span class="px-3 py-1 rounded-md text-sm font-medium status-{detail.inspection.status}">
						{statusLabel(detail.inspection.status)}
					</span>
					{@const ot = computeOverdueType(detail.inspection.deadline)}
					<span class="px-3 py-1 rounded-md text-sm font-medium {ot === 'overdue' ? 'status-overdue' : ot === 'approaching' ? 'status-approaching' : 'status-synced'}">
						{ot === 'overdue' ? '逾期' : ot === 'approaching' ? '临期' : '正常'}
					</span>
				</div>
			</div>
			<div class="grid grid-cols-4 gap-6 text-sm">
				<div>
					<p class="text-gray-500 mb-1">单号</p>
					<p class="font-medium">{detail.inspection.id}</p>
				</div>
				<div>
					<p class="text-gray-500 mb-1">塘口</p>
					<p class="font-medium">{detail.inspection.pond_name}</p>
				</div>
				<div>
					<p class="text-gray-500 mb-1">截止日期</p>
					<p class="font-medium">{detail.inspection.deadline}</p>
				</div>
				<div>
					<p class="text-gray-500 mb-1">当前处理人</p>
					<p class="font-medium">{detail.inspection.current_handler} ({roleLabel(detail.inspection.current_handler_role)})</p>
				</div>
			</div>
		</div>

		<div class="bg-white rounded-xl shadow-sm p-6">
			<h3 class="text-base font-semibold text-gray-800 mb-6">处理流程</h3>
			<div class="flex items-center justify-between relative">
				<div class="absolute top-5 left-[calc(16.67%)] right-[calc(16.67%)] h-0.5 bg-gray-200"></div>
				{#each detail.process_flow as node}
					<div class="flex flex-col items-center relative z-10" style="width: {100 / detail.process_flow.length}%">
						<div class="relative">
							{#if isNodeCompleted(node)}
								<div class="w-10 h-10 rounded-full bg-status-synced flex items-center justify-center text-white text-lg">
									✓
								</div>
							{:else if node.status === 'active'}
								<div class="relative">
									<div class="absolute inset-0 w-10 h-10 rounded-full bg-accent/30 animate-pulse-ring"></div>
									<div class="w-10 h-10 rounded-full bg-accent flex items-center justify-center text-white text-sm font-bold relative z-10">
										{node.step}
									</div>
								</div>
							{:else if node.status === 'rejected'}
								<div class="w-10 h-10 rounded-full bg-status-overdue flex items-center justify-center text-white text-sm font-bold">
									✗
								</div>
							{:else}
								<div class="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-gray-400 text-sm font-bold">
									{node.step}
								</div>
							{/if}
						</div>
						<p class="mt-3 text-sm font-medium {node.status === 'active' ? 'text-accent' : isNodeCompleted(node) ? 'text-status-synced' : node.status === 'rejected' ? 'text-status-overdue' : 'text-gray-400'}">
							{node.title}
						</p>
						{#if node.operator}
							<p class="text-xs text-gray-500 mt-1">{node.operator}</p>
						{/if}
						{#if node.time}
							<p class="text-xs text-gray-400 mt-0.5">{node.time}</p>
						{/if}
						<p class="text-xs mt-1 {node.status === 'rejected' ? 'text-status-overdue font-medium' : node.status === 'active' ? 'text-accent font-medium' : 'text-gray-400'}">
							{nodeStatusLabel(node.status)}
						</p>
					</div>
				{/each}
			</div>
		</div>

		<div class="bg-white rounded-xl shadow-sm p-6">
			<h3 class="text-base font-semibold text-gray-800 mb-4">检测指标</h3>
			<table class="w-full text-sm">
				<thead>
					<tr class="text-gray-500 border-b border-gray-100">
						<th class="pb-2 text-left font-medium">指标名</th>
						<th class="pb-2 text-left font-medium">数值</th>
						<th class="pb-2 text-left font-medium">单位</th>
						<th class="pb-2 text-left font-medium">标准</th>
						<th class="pb-2 text-left font-medium">状态</th>
					</tr>
				</thead>
				<tbody>
					{#each detail.indicators as ind}
						<tr class="border-b border-gray-50">
							<td class="py-3">{ind.name}</td>
							<td class="py-3 font-medium {!ind.is_qualified ? 'text-status-overdue' : ''}">{ind.value}</td>
							<td class="py-3 text-gray-500">{ind.unit || '-'}</td>
							<td class="py-3 text-gray-500">{ind.standard}</td>
							<td class="py-3">
								{#if !ind.is_qualified}
									<span class="px-2 py-0.5 rounded-md text-xs font-medium bg-status-overdue/15 text-status-overdue">异常</span>
								{:else}
									<span class="px-2 py-0.5 rounded-md text-xs font-medium bg-status-synced/15 text-status-synced">正常</span>
								{/if}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>

		<div class="bg-white rounded-xl shadow-sm p-6">
			<div class="flex items-center justify-between mb-4">
				<h3 class="text-base font-semibold text-gray-800">附件</h3>
				<label class="cursor-pointer bg-primary text-white px-4 py-1.5 rounded-lg text-sm hover:bg-primary/90 transition-colors">
					上传附件
					<input type="file" class="hidden" on:change={handleUpload} />
				</label>
			</div>
			{#if detail.attachments.length === 0}
				<p class="text-sm text-gray-400 py-4 text-center">暂无附件</p>
			{:else}
				<div class="space-y-2">
					{#each detail.attachments as att}
						<div class="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
							<div class="flex items-center gap-3">
								<span class="text-lg">📎</span>
								<div>
									<p class="text-sm font-medium">{att.filename}</p>
									<p class="text-xs text-gray-400">{att.uploaded_by} · {att.uploaded_at}</p>
								</div>
							</div>
							<span class="text-xs text-gray-400">{att.file_type}</span>
						</div>
					{/each}
				</div>
			{/if}
		</div>

		{#if detail.exception_reasons.length > 0}
			<div class="bg-white rounded-xl shadow-sm p-6">
				<h3 class="text-base font-semibold text-gray-800 mb-4">异常原因记录</h3>
				<div class="space-y-2">
					{#each detail.exception_reasons as er}
						<div class="flex items-start gap-3 p-3 rounded-lg bg-orange-50">
							<span class="text-sm mt-0.5">⚠️</span>
							<div class="flex-1">
								<p class="text-sm text-gray-700">{er.reason}</p>
								<p class="text-xs text-gray-400 mt-1">{er.created_at}</p>
							</div>
						</div>
					{/each}
				</div>
			</div>
		{/if}

		{#if getAvailableActions().length > 0}
			<div class="bg-white rounded-xl shadow-sm p-6">
				<h3 class="text-base font-semibold text-gray-800 mb-4">办理</h3>

				{#if detail && detail.inspection.status === 'pending_correction'}
					<div class="mb-4">
						<div class="flex items-center justify-between mb-2">
							<label class="text-sm text-gray-500 font-medium">补充材料 <span class="text-red-500">*</span></label>
							<label class="cursor-pointer bg-primary text-white px-3 py-1 rounded-md text-sm hover:bg-primary/90 transition-colors">
								+ 上传补正材料
								<input
									type="file"
									multiple
									class="hidden"
									on:change={(e) => {
										const target = e.target as HTMLInputElement;
										if (target.files) {
											correctionAttachments = [...correctionAttachments, ...Array.from(target.files)];
										}
										target.value = '';
									}}
								/>
							</label>
						</div>
						{#if correctionAttachments.length === 0}
							<div class="border-2 border-dashed border-gray-200 rounded-lg p-4 text-center">
								<p class="text-gray-400 text-xs">请上传补正材料（检测照片、化验单等）</p>
							</div>
						{:else}
							<div class="space-y-2">
								{#each correctionAttachments as file, i}
									<div class="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
										<div class="flex items-center gap-2">
											<span class="text-sm">📎</span>
											<div>
												<p class="text-xs font-medium">{file.name}</p>
												<p class="text-xs text-gray-400">{(file.size / 1024).toFixed(1)} KB</p>
											</div>
										</div>
										<button
											on:click={() => correctionAttachments.splice(i, 1)}
											class="text-gray-400 hover:text-red-500 text-xs"
										>删除</button>
									</div>
								{/each}
							</div>
						{/if}
					</div>
				{/if}

				<div class="mb-4">
					<label class="text-sm text-gray-500 mb-1 block">办理意见</label>
					<textarea
						bind:value={processComment}
						rows="2"
						class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 resize-none"
						placeholder="请输入办理意见（选填）"
					></textarea>
				</div>
				<div class="flex gap-3">
					{#each getAvailableActions() as action}
						<button
							on:click={() => handleProcess(action)}
							class="px-5 py-2 rounded-lg text-sm font-medium transition-colors {action === 'reject'
								? 'bg-status-overdue text-white hover:bg-status-overdue/90'
								: action === 'confirm_sync'
									? 'bg-status-synced text-white hover:bg-status-synced/90'
									: 'bg-accent text-white hover:bg-accent/90'}"
						>
							{actionLabel(action)}
						</button>
					{/each}
				</div>
			</div>
		{/if}

		{#if showRejectDialog}
			<div class="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
				<div class="fixed inset-0" on:click={() => (showRejectDialog = false)}></div>
				<div class="bg-white rounded-xl shadow-xl w-[440px] relative z-10 animate-fade-in">
					<div class="px-6 py-4 border-b border-gray-100">
						<h3 class="font-semibold text-gray-800">填写异常原因</h3>
					</div>
					<div class="p-6">
						<textarea
							bind:value={exceptionReason}
							rows="4"
							class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 resize-none"
							placeholder="请填写退回的异常原因（必填）"
						></textarea>
					</div>
					<div class="px-6 py-4 border-t border-gray-100 flex gap-3 justify-end">
						<button
							on:click={() => (showRejectDialog = false)}
							class="border border-gray-300 text-gray-600 px-4 py-2 rounded-lg text-sm hover:bg-gray-50"
						>取消</button>
						<button
							on:click={() => handleProcess('reject')}
							class="bg-status-overdue text-white px-5 py-2 rounded-lg text-sm hover:bg-status-overdue/90"
						>确认退回</button>
					</div>
				</div>
			</div>
		{/if}

		<div class="bg-white rounded-xl shadow-sm p-6">
			<h3 class="text-base font-semibold text-gray-800 mb-4">审计轨迹</h3>
			{#if detail.audit_trail.length === 0}
				<p class="text-sm text-gray-400 text-center py-4">暂无记录</p>
			{:else}
				<div class="relative pl-6">
					<div class="absolute left-2 top-2 bottom-2 w-0.5 bg-gray-200"></div>
					{#each detail.audit_trail as record}
						<div class="relative mb-5 last:mb-0">
							<div class="absolute -left-4 top-1 w-4 h-4 rounded-full bg-primary border-2 border-white"></div>
							<div class="ml-4">
								<div class="flex items-center gap-2 mb-1">
									<span class="px-2 py-0.5 rounded-md text-xs font-medium bg-primary/10 text-primary">
										{roleLabel(record.operator_role)}
									</span>
									<span class="text-sm font-medium">{record.operator}</span>
									<span class="text-sm text-gray-500">{actionLabel(record.action)}</span>
								</div>
								{#if record.comment}
									<p class="text-sm text-gray-600 ml-1">{record.comment}</p>
								{/if}
								<p class="text-xs text-gray-400 mt-1">{record.created_at}</p>
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</div>
	</div>
{/if}
