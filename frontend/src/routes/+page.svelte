<script>
	import { onMount } from 'svelte';
	import { currentRole } from '$lib/stores';
	import { fetchStats, fetchOverdueQueue } from '$lib/api';
	import type { Stats, Inspection, OverdueType, OverdueItem } from '$lib/types';

	let stats: Stats | null = null;
	let overdueItems: OverdueItem[] = [];
	let loading = true;
	let error = '';
	let activeFilter: OverdueType | 'all' = 'all';

	const statCards = [
		{ key: 'pending_review', label: '待审核', icon: '⏳', color: 'bg-status-pending', textColor: 'text-status-pending' },
		{ key: 'approved', label: '审核通过', icon: '✅', color: 'bg-status-approved', textColor: 'text-status-approved' },
		{ key: 'synced', label: '已同步', icon: '🔄', color: 'bg-status-synced', textColor: 'text-status-synced' },
		{ key: 'overdue', label: '逾期', icon: '⚠️', color: 'bg-status-overdue', textColor: 'text-status-overdue' }
	];

	async function loadData() {
		loading = true;
		error = '';
		try {
			const [statsRes, overdueRes] = await Promise.all([
				fetchStats($currentRole),
				fetchOverdueQueue({ role: $currentRole })
			]);
			stats = statsRes.data;
			overdueItems = overdueRes.data;
		} catch (e) {
			error = e.message || '加载数据失败';
		}
		loading = false;
	}

	function filterItems(items, filter) {
		if (filter === 'all') return items;
		return items.filter((i) => i.overdue_type === filter);
	}

	function overdueRowClass(type) {
		if (type === 'overdue') return 'bg-red-50';
		if (type === 'approaching') return 'bg-orange-50';
		return 'bg-white';
	}

	function overdueLabel(type) {
		if (type === 'overdue') return '逾期';
		if (type === 'approaching') return '临期';
		return '正常';
	}

	function overdueBadgeClass(type) {
		if (type === 'overdue') return 'status-overdue';
		if (type === 'approaching') return 'status-approaching';
		return 'status-synced';
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

	$: filteredItems = filterItems(overdueItems, activeFilter);
	$: currentRole;
	$: if ($currentRole) loadData();

	onMount(loadData);
</script>

{#if loading}
	<div class="flex items-center justify-center h-64">
		<div class="flex flex-col items-center gap-3">
			<div class="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin"></div>
			<p class="text-sm text-gray-500">加载中...</p>
		</div>
	</div>
{:else if error}
	<div class="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm">{error}</div>
{:else}
	<div class="animate-fade-in">
		<div class="grid grid-cols-4 gap-5 mb-6">
			{#each statCards as card}
				<div class="bg-white rounded-xl shadow-sm p-5 flex items-center gap-4">
					<div class="{card.color} w-12 h-12 rounded-lg flex items-center justify-center text-xl text-white">
						{card.icon}
					</div>
					<div>
						<p class="text-sm text-gray-500">{card.label}</p>
						<p class="text-2xl font-bold {card.textColor}">
							{stats ? stats[card.key] : 0}
						</p>
					</div>
				</div>
			{/each}
		</div>

		<div class="bg-white rounded-xl shadow-sm">
			<div class="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
				<h2 class="text-base font-semibold text-gray-800">到期预警队列</h2>
				<div class="flex gap-2">
					{#each [
						{ key: 'all', label: '全部' },
						{ key: 'normal', label: '正常' },
						{ key: 'approaching', label: '临期' },
						{ key: 'overdue', label: '逾期' }
					] as tab}
						<button
							on:click={() => (activeFilter = tab.key)}
							class="px-3 py-1 rounded-md text-sm transition-colors {activeFilter === tab.key
								? 'bg-primary text-white'
								: 'bg-gray-100 text-gray-600 hover:bg-gray-200'}"
						>
							{tab.label}
						</button>
					{/each}
				</div>
			</div>

			{#if filteredItems.length === 0}
				<div class="py-12 text-center text-gray-400 text-sm">暂无数据</div>
			{:else}
				<div class="overflow-x-auto">
					<table class="w-full text-sm">
						<thead>
							<tr class="text-gray-500 border-b border-gray-100">
								<th class="px-6 py-3 text-left font-medium">单号</th>
								<th class="px-6 py-3 text-left font-medium">塘口</th>
								<th class="px-6 py-3 text-left font-medium">当前处理人</th>
								<th class="px-6 py-3 text-left font-medium">截止日期</th>
								<th class="px-6 py-3 text-left font-medium">状态</th>
								<th class="px-6 py-3 text-left font-medium">到期</th>
							</tr>
						</thead>
						<tbody>
							{#each filteredItems as item}
								<tr class="border-b border-gray-50 {overdueRowClass(item.overdue_type)}">
									<td class="px-6 py-3">
										<a href="/inspections/{item.inspection.id}" class="text-primary hover:underline">{item.inspection.id}</a>
									</td>
									<td class="px-6 py-3">{item.inspection.pond_name}</td>
									<td class="px-6 py-3">{item.inspection.current_handler}</td>
									<td class="px-6 py-3 text-gray-500">{item.inspection.deadline}</td>
									<td class="px-6 py-3">
										<span class="px-2 py-0.5 rounded-md text-xs font-medium status-{item.inspection.status}">
											{statusLabel(item.inspection.status)}
										</span>
									</td>
									<td class="px-6 py-3">
										<span class="px-2 py-0.5 rounded-md text-xs font-medium {overdueBadgeClass(item.overdue_type)}">
											{overdueLabel(item.overdue_type)}
										</span>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{/if}
		</div>
	</div>
{/if}
