<script>
	import { onMount } from 'svelte';
	import { currentRole, currentUser, selectedInspections, batchResults } from '$lib/stores';
	import { fetchInspections, batchProcess } from '$lib/api';
	import type { Inspection, Status, OverdueType } from '$lib/types';

	let items: Inspection[] = [];
	let loading = true;
	let error = '';
	let page = 1;
	let pageSize = 10;
	let total = 0;
	let toast = '';
	let toastTimer;

	let filterStatus = '';
	let filterPond = '';
	let filterDateFrom = '';
	let filterDateTo = '';
	let showBatchModal = false;

	function showToast(msg) {
		toast = msg;
		if (toastTimer) clearTimeout(toastTimer);
		toastTimer = setTimeout(() => (toast = ''), 3000);
	}

	async function loadData() {
		loading = true;
		error = '';
		try {
			const res = await fetchInspections({
				status: filterStatus || undefined,
				pond_id: filterPond || undefined,
				date_from: filterDateFrom || undefined,
				date_to: filterDateTo || undefined,
				role: $currentRole,
				page,
				page_size: pageSize
			});
			items = res.data.items;
			total = res.data.pagination.total;
		} catch (e) {
			error = e.message || '加载失败';
		}
		loading = false;
	}

	function toggleSelect(id) {
		const s = new Set($selectedInspections);
		if (s.has(id)) s.delete(id);
		else s.add(id);
		$selectedInspections = s;
	}

	function toggleAll() {
		if ($selectedInspections.size === items.length) {
			$selectedInspections = new Set();
		} else {
			$selectedInspections = new Set(items.map((i) => i.id));
		}
	}

	async function handleBatch(action) {
		const selected = items.filter((i) => $selectedInspections.has(i.id));
		if (selected.length === 0) return;
		try {
			const res = await batchProcess({
				ids: selected.map((i) => i.id),
				action,
				operator: $currentUser,
				operator_role: $currentRole,
				comment: ''
			});
			$batchResults = res.data;
			showBatchModal = true;
			$selectedInspections = new Set();
			loadData();
		} catch (e) {
			showToast(e.message || '批量操作失败');
		}
	}

	function statusLabel(s) {
		const m = {
			pending_review: '待审核',
			under_review: '审核中',
			approved: '审核通过',
			pending_correction: '待补正',
			synced: '已同步'
		};
		return m[s] || s;
	}

	function computeOverdueType(deadline) {
		const now = new Date();
		now.setHours(0, 0, 0, 0);
		const dl = new Date(deadline + 'T00:00:00');
		const diff = (dl - now) / (1000 * 60 * 60 * 24);
		if (diff < 0) return 'overdue';
		if (diff <= 3) return 'approaching';
		return 'normal';
	}

	function overdueLabel(t) {
		const m = { normal: '正常', approaching: '临期', overdue: '逾期' };
		return m[t] || t;
	}

	function overdueBadgeClass(t) {
		if (t === 'overdue') return 'status-overdue';
		if (t === 'approaching') return 'status-approaching';
		return 'status-synced';
	}

	$: totalPages = Math.ceil(total / pageSize);
	$: currentRole;
	$: if ($currentRole) {
		page = 1;
		$selectedInspections = new Set();
		loadData();
	}

	onMount(loadData);
</script>

{#if toast}
	<div class="fixed top-4 right-4 z-50 bg-red-500 text-white px-4 py-2 rounded-lg shadow-lg text-sm animate-fade-in">
		{toast}
	</div>
{/if}

<div class="animate-fade-in">
	<div class="bg-white rounded-xl shadow-sm p-5 mb-5">
		<div class="flex items-end gap-4 flex-wrap">
			<div class="flex flex-col gap-1">
				<label class="text-xs text-gray-500">状态</label>
				<select
					bind:value={filterStatus}
					class="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
				>
					<option value="">全部</option>
					<option value="pending_review">待审核</option>
					<option value="under_review">审核中</option>
					<option value="approved">审核通过</option>
					<option value="pending_correction">待补正</option>
					<option value="synced">已同步</option>
				</select>
			</div>
			<div class="flex flex-col gap-1">
				<label class="text-xs text-gray-500">塘口</label>
				<input
					type="text"
					bind:value={filterPond}
					placeholder="塘口编号"
					class="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 w-36"
				/>
			</div>
			<div class="flex flex-col gap-1">
				<label class="text-xs text-gray-500">开始日期</label>
				<input
					type="date"
					bind:value={filterDateFrom}
					class="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
				/>
			</div>
			<div class="flex flex-col gap-1">
				<label class="text-xs text-gray-500">结束日期</label>
				<input
					type="date"
					bind:value={filterDateTo}
					class="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
				/>
			</div>
			<button
				on:click={() => { page = 1; loadData(); }}
				class="bg-primary text-white px-5 py-2 rounded-lg text-sm hover:bg-primary/90 transition-colors"
			>
				搜索
			</button>
		</div>
	</div>

	<div class="bg-white rounded-xl shadow-sm">
		{#if loading}
			<div class="flex items-center justify-center py-20">
				<div class="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin"></div>
			</div>
		{:else if error}
			<div class="p-6 text-red-600 text-sm">{error}</div>
		{:else if items.length === 0}
			<div class="py-12 text-center text-gray-400 text-sm">暂无数据</div>
		{:else}
			<div class="overflow-x-auto">
				<table class="w-full text-sm">
					<thead>
						<tr class="text-gray-500 border-b border-gray-100">
							<th class="px-6 py-3 text-left">
								<input
									type="checkbox"
									on:change={toggleAll}
									checked={$selectedInspections.size === items.length && items.length > 0}
									class="rounded border-gray-300 text-accent focus:ring-accent"
								/>
							</th>
							<th class="px-6 py-3 text-left font-medium">单号</th>
							<th class="px-6 py-3 text-left font-medium">塘口</th>
							<th class="px-6 py-3 text-left font-medium">状态</th>
							<th class="px-6 py-3 text-left font-medium">当前处理人</th>
							<th class="px-6 py-3 text-left font-medium">截止日期</th>
							<th class="px-6 py-3 text-left font-medium">到期</th>
							<th class="px-6 py-3 text-left font-medium">操作</th>
						</tr>
					</thead>
					<tbody>
						{#each items as item}
							{@const ot = computeOverdueType(item.deadline)}
							<tr class="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
								<td class="px-6 py-3">
									<input
										type="checkbox"
										checked={$selectedInspections.has(item.id)}
										on:change={() => toggleSelect(item.id)}
										class="rounded border-gray-300 text-accent focus:ring-accent"
									/>
								</td>
								<td class="px-6 py-3">
									<a href="/inspections/{item.id}" class="text-primary hover:underline">{item.id}</a>
								</td>
								<td class="px-6 py-3">{item.pond_name}</td>
								<td class="px-6 py-3">
									<span class="px-2 py-0.5 rounded-md text-xs font-medium status-{item.status}">
										{statusLabel(item.status)}
									</span>
								</td>
								<td class="px-6 py-3">{item.current_handler}</td>
								<td class="px-6 py-3 text-gray-500">{item.deadline}</td>
								<td class="px-6 py-3">
									<span class="px-2 py-0.5 rounded-md text-xs font-medium {overdueBadgeClass(ot)}">
										{overdueLabel(ot)}
									</span>
								</td>
								<td class="px-6 py-3">
									<a
										href="/inspections/{item.id}"
										class="text-accent hover:text-accent/80 text-xs"
									>查看详情</a>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>

			<div class="px-6 py-4 flex items-center justify-between border-t border-gray-100">
				<p class="text-sm text-gray-500">共 {total} 条</p>
				<div class="flex items-center gap-2">
					<button
						on:click={() => { if (page > 1) { page--; loadData(); } }}
						disabled={page <= 1}
						class="px-3 py-1 rounded-md text-sm border border-gray-200 disabled:opacity-40 hover:bg-gray-50"
					>上一页</button>
					<span class="text-sm text-gray-600">{page} / {totalPages || 1}</span>
					<button
						on:click={() => { if (page < totalPages) { page++; loadData(); } }}
						disabled={page >= totalPages}
						class="px-3 py-1 rounded-md text-sm border border-gray-200 disabled:opacity-40 hover:bg-gray-50"
					>下一页</button>
				</div>
			</div>
		{/if}
	</div>
</div>

{#if $selectedInspections.size > 0}
	<div class="fixed bottom-0 left-56 right-0 bg-white/80 backdrop-blur-lg border-t border-gray-200 px-6 py-3 flex items-center justify-between animate-slide-up z-40">
		<span class="text-sm text-gray-600">已选中 <span class="font-bold text-primary">{$selectedInspections.size}</span> 项</span>
		<div class="flex gap-3">
			{#if $currentRole === 'quality_engineer'}
				<button
					on:click={() => handleBatch('approve')}
					class="bg-accent text-white px-5 py-2 rounded-lg text-sm hover:bg-accent/90 transition-colors"
				>
					批量通过
				</button>
				<button
					on:click={() => handleBatch('reject')}
					class="bg-status-overdue text-white px-5 py-2 rounded-lg text-sm hover:bg-status-overdue/90 transition-colors"
				>
					批量退回
				</button>
			{/if}
			{#if $currentRole === 'base_director'}
				<button
					on:click={() => handleBatch('confirm_sync')}
					class="bg-status-synced text-white px-5 py-2 rounded-lg text-sm hover:bg-status-synced/90 transition-colors"
				>
					批量确认同步
				</button>
				<button
					on:click={() => handleBatch('reject')}
					class="bg-status-overdue text-white px-5 py-2 rounded-lg text-sm hover:bg-status-overdue/90 transition-colors"
				>
					批量退回
				</button>
			{/if}
			<button
				on:click={() => ($selectedInspections = new Set())}
				class="border border-gray-300 text-gray-600 px-4 py-2 rounded-lg text-sm hover:bg-gray-50"
			>
				取消
			</button>
		</div>
	</div>
{/if}

{#if showBatchModal}
	<div class="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
		<div class="fixed inset-0" on:click={() => (showBatchModal = false)}></div>
		<div class="bg-white rounded-xl shadow-xl w-[520px] max-h-[70vh] flex flex-col relative z-10 animate-fade-in">
			<div class="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
				<h3 class="font-semibold text-gray-800">批量处理结果</h3>
				<button on:click={() => (showBatchModal = false)} class="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
			</div>
			<div class="overflow-auto flex-1 p-6">
				<table class="w-full text-sm">
					<thead>
						<tr class="text-gray-500 border-b">
							<th class="pb-2 text-left font-medium">单号</th>
							<th class="pb-2 text-left font-medium">结果</th>
							<th class="pb-2 text-left font-medium">原因</th>
						</tr>
					</thead>
					<tbody>
						{#each $batchResults as r}
							<tr class="border-b border-gray-50">
								<td class="py-2">{r.id}</td>
								<td class="py-2">
									{#if r.success}
										<span class="text-status-synced font-medium">✓ 成功</span>
									{:else}
										<span class="text-status-overdue font-medium">✗ 失败</span>
									{/if}
								</td>
								<td class="py-2 text-gray-500">{r.message || '-'}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
			<div class="px-6 py-4 border-t border-gray-100">
				<button
					on:click={() => (showBatchModal = false)}
					class="w-full bg-primary text-white py-2 rounded-lg text-sm hover:bg-primary/90"
				>关闭</button>
			</div>
		</div>
	</div>
{/if}
