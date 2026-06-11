<script lang="ts">
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import { currentRole, currentUser, triggerRefresh } from '$lib/stores';
	import { createInspection, uploadAttachment } from '$lib/api';
	import type { TestIndicator } from '$lib/types';

	let loading = false;
	let error = '';
	let toast = '';
	let toastTimer;

	let pondId = '';
	let pondName = '';
	let deadline = '';
	let comment = '';

	let indicators: { name: string; value: string; unit: string; standard: string; is_qualified: boolean }[] = [
		{ name: 'pH值', value: '', unit: '', standard: '6.5-8.5', is_qualified: true },
		{ name: '溶解氧', value: '', unit: 'mg/L', standard: '≥5', is_qualified: true },
		{ name: '氨氮', value: '', unit: 'mg/L', standard: '≤0.2', is_qualified: true },
		{ name: '亚硝酸盐', value: '', unit: 'mg/L', standard: '≤0.1', is_qualified: true }
	];

	let attachments: File[] = [];
	let uploadedAttachmentIds: string[] = [];

	const ponds = [
		{ id: 'A1', name: 'A1-东塘' },
		{ id: 'A2', name: 'A2-西塘' },
		{ id: 'B1', name: 'B1-南塘' },
		{ id: 'B2', name: 'B2-北塘' },
		{ id: 'C1', name: 'C1-中心塘' }
	];

	function showToast(msg: string) {
		toast = msg;
		if (toastTimer) clearTimeout(toastTimer);
		toastTimer = setTimeout(() => (toast = ''), 3000);
	}

	function onPondChange() {
		const pond = ponds.find((p) => p.id === pondId);
		if (pond) {
			pondName = pond.name;
		}
	}

	function onFileChange(e: Event) {
		const target = e.target as HTMLInputElement;
		if (target.files) {
			attachments = [...attachments, ...Array.from(target.files)];
		}
		target.value = '';
	}

	function removeFile(index: number) {
		attachments.splice(index, 1);
	}

	function updateIndicatorValue(index: number, value: string) {
		indicators[index].value = value;
		const ind = indicators[index];
		if (value && ind.standard) {
			const num = parseFloat(value);
			ind.is_qualified = isQualified(num, ind.standard);
		} else {
			ind.is_qualified = true;
		}
	}

	function isQualified(value: number, standard: string): boolean {
		if (standard.includes('-')) {
			const [min, max] = standard.split('-').map(parseFloat);
			return value >= min && value <= max;
		}
		if (standard.startsWith('≥')) {
			return value >= parseFloat(standard.substring(1));
		}
		if (standard.startsWith('≤')) {
			return value <= parseFloat(standard.substring(1));
		}
		if (standard.startsWith('>')) {
			return value > parseFloat(standard.substring(1));
		}
		if (standard.startsWith('<')) {
			return value < parseFloat(standard.substring(1));
		}
		return true;
	}

	async function handleSubmit() {
		if ($currentRole !== 'pond_admin') {
			showToast('只有塘口管理员可以登记检测单');
			return;
		}
		if (!pondId || !pondName) {
			showToast('请选择塘口');
			return;
		}
		if (!deadline) {
			showToast('请选择截止日期');
			return;
		}
		const emptyIndicators = indicators.filter((i) => !i.value.trim());
		if (emptyIndicators.length > 0) {
			showToast('请填写所有检测指标数值');
			return;
		}
		if (attachments.length === 0) {
			showToast('请至少上传1个附件作为证据');
			return;
		}

		loading = true;
		error = '';
		try {
			const today = new Date().toISOString().split('T')[0];
			const tempId = `TMP-${Date.now()}`;

			const uploadedAttachments: { filename: string; file_type: string; file_size: number }[] = [];
			for (const file of attachments) {
				uploadedAttachments.push({
					filename: file.name,
					file_type: file.type || 'application/octet-stream',
					file_size: file.size
				});
			}

			const res = await createInspection({
				pond_id: pondId,
				pond_name: pondName,
				inspector: $currentUser,
				inspector_role: $currentRole,
				deadline,
				comment: comment.trim() || undefined,
				indicators: indicators.map((i) => ({
					name: i.name,
					value: i.value,
					unit: i.unit,
					standard: i.standard,
					is_qualified: i.is_qualified
				})),
				attachments: uploadedAttachments
			});

			showToast('登记成功，检测单已提交至待审核');
			triggerRefresh();
			goto('/inspections');
		} catch (e: any) {
			error = e.message || '登记失败';
		}
		loading = false;
	}

	onMount(() => {
		const today = new Date();
		const defaultDeadline = new Date(today.setDate(today.getDate() + 5)).toISOString().split('T')[0];
		deadline = defaultDeadline;
	});
</script>

{#if toast}
	<div class="fixed top-4 right-4 z-50 bg-accent text-white px-4 py-2 rounded-lg shadow-lg text-sm animate-fade-in">
		{toast}
	</div>
{/if}

<div class="animate-fade-in max-w-4xl mx-auto">
	<div class="flex items-center gap-3 mb-5">
		<a href="/inspections" class="text-gray-400 hover:text-gray-600 text-sm">← 返回列表</a>
		<h1 class="text-xl font-bold text-gray-800">水质检测单登记</h1>
	</div>

	<div class="bg-white rounded-xl shadow-sm p-6 space-y-6">
		<div class="grid grid-cols-2 gap-6">
			<div>
				<label class="text-sm text-gray-600 mb-1.5 block font-medium">塘口 <span class="text-red-500">*</span></label>
				<select
					bind:value={pondId}
					on:change={onPondChange}
					class="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
				>
					<option value="">请选择塘口</option>
					{#each ponds as p}
						<option value={p.id}>{p.name}</option>
					{/each}
				</select>
			</div>
			<div>
				<label class="text-sm text-gray-600 mb-1.5 block font-medium">截止日期 <span class="text-red-500">*</span></label>
				<input
					type="date"
					bind:value={deadline}
					class="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
				/>
			</div>
		</div>

		<div>
			<label class="text-sm text-gray-600 mb-1.5 block font-medium">检测人</label>
			<div class="w-full bg-gray-50 border border-gray-100 rounded-lg px-3 py-2.5 text-sm text-gray-600">
				{$currentUser}
			</div>
		</div>

		<div>
			<label class="text-sm text-gray-600 mb-1.5 block font-medium">登记备注</label>
			<textarea
				bind:value={comment}
				rows="2"
				class="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 resize-none"
				placeholder="请输入登记备注（选填，将作为审计记录保存）"
			></textarea>
		</div>

		<div>
			<label class="text-sm text-gray-600 mb-3 block font-medium">检测指标 <span class="text-red-500">*</span></label>
			<div class="overflow-x-auto">
				<table class="w-full text-sm">
					<thead>
						<tr class="text-gray-500 border-b border-gray-100 bg-gray-50">
							<th class="px-4 py-2.5 text-left font-medium">指标名</th>
							<th class="px-4 py-2.5 text-left font-medium">数值</th>
							<th class="px-4 py-2.5 text-left font-medium">单位</th>
							<th class="px-4 py-2.5 text-left font-medium">标准</th>
							<th class="px-4 py-2.5 text-left font-medium">状态</th>
						</tr>
					</thead>
					<tbody>
						{#each indicators as ind, i}
							<tr class="border-b border-gray-50">
								<td class="px-4 py-2.5 font-medium">{ind.name}</td>
								<td class="px-4 py-2.5">
									<input
										type="number"
										step="0.01"
										value={ind.value}
										on:input={(e) => updateIndicatorValue(i, (e.target as HTMLInputElement).value)}
										placeholder="输入数值"
										class="w-full border border-gray-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-accent"
									/>
								</td>
								<td class="px-4 py-2.5 text-gray-500">{ind.unit || '-'}</td>
								<td class="px-4 py-2.5 text-gray-500">{ind.standard}</td>
								<td class="px-4 py-2.5">
									{#if !ind.value}
										<span class="text-gray-400 text-xs">待填写</span>
									{:else if !ind.is_qualified}
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
		</div>

		<div>
			<div class="flex items-center justify-between mb-3">
				<label class="text-sm text-gray-600 font-medium">附件证据 <span class="text-red-500">*</span></label>
				<label class="cursor-pointer bg-primary text-white px-4 py-1.5 rounded-lg text-sm hover:bg-primary/90 transition-colors">
					+ 上传附件
					<input type="file" multiple class="hidden" on:change={onFileChange} />
				</label>
			</div>
			{#if attachments.length === 0}
				<div class="border-2 border-dashed border-gray-200 rounded-lg p-8 text-center">
					<p class="text-gray-400 text-sm">请上传检测照片、化验单等附件证据（至少1个）</p>
				</div>
			{:else}
				<div class="space-y-2">
					{#each attachments as file, i}
						<div class="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
							<div class="flex items-center gap-3">
								<span class="text-lg">📎</span>
								<div>
									<p class="text-sm font-medium">{file.name}</p>
									<p class="text-xs text-gray-400">{(file.size / 1024).toFixed(1)} KB</p>
								</div>
							</div>
							<button
								on:click={() => removeFile(i)}
								class="text-gray-400 hover:text-red-500 text-sm"
							>删除</button>
						</div>
					{/each}
				</div>
			{/if}
		</div>

		{#if error}
			<div class="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm">{error}</div>
		{/if}

		<div class="flex justify-end gap-3 pt-2">
			<button
				on:click={() => goto('/inspections')}
				class="border border-gray-300 text-gray-600 px-6 py-2.5 rounded-lg text-sm hover:bg-gray-50 transition-colors"
			>取消</button>
			<button
				on:click={handleSubmit}
				disabled={loading}
				class="bg-accent text-white px-8 py-2.5 rounded-lg text-sm font-medium hover:bg-accent/90 transition-colors disabled:opacity-50 flex items-center gap-2"
			>
				{#if loading}
					<span class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
				{/if}
				{loading ? '提交中...' : '提交登记'}
			</button>
		</div>
	</div>
</div>
