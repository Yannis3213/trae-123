<script>
	import { currentRole, currentUser } from '$lib/stores';
	import { page } from '$app/stores';

	const roles = [
		{ key: 'pond_admin', label: '塘口管理员', icon: '🐟' },
		{ key: 'quality_engineer', label: '水质工程师', icon: '🔬' },
		{ key: 'base_director', label: '基地负责人', icon: '🏛️' }
	];

	const navItems = [
		{ href: '/', label: '工作台', icon: '📊' },
		{ href: '/inspections', label: '检测单列表', icon: '📋' },
		{ href: '/inspections/new', label: '登记检测单', icon: '➕', roleRequired: 'pond_admin' }
	];

	function switchRole(key) {
		$currentRole = key;
	}

	$: currentPath = $page.url.pathname;
	$: isNavActive = (href) => {
		if (href === '/') return currentPath === '/';
		return currentPath.startsWith(href);
	};
	$: visibleNavItems = navItems.filter(
		(item) => !item.roleRequired || item.roleRequired === $currentRole
	);
</script>

<div class="flex h-screen overflow-hidden">
	<aside class="w-56 bg-primary text-white flex flex-col shrink-0">
		<div class="px-6 py-5 border-b border-white/10">
			<h1 class="text-lg font-bold tracking-wide">水质检测管理</h1>
			<p class="text-xs text-white/50 mt-1">水产养殖基地</p>
		</div>
		<nav class="flex-1 py-4">
			{#each visibleNavItems as item}
				<a
					href={item.href}
					class="flex items-center gap-3 px-6 py-3 text-sm transition-colors {isNavActive(item.href)
						? 'bg-white/15 text-white font-medium'
						: 'text-white/70 hover:bg-white/10 hover:text-white'}"
				>
					<span class="text-base">{item.icon}</span>
					<span>{item.label}</span>
				</a>
			{/each}
		</nav>
		<div class="px-6 py-4 border-t border-white/10">
			<div class="flex items-center gap-2">
				<div class="w-8 h-8 rounded-full bg-accent/30 flex items-center justify-center text-xs font-bold">
					{$currentUser[0]}
				</div>
				<div>
					<p class="text-sm font-medium">{$currentUser}</p>
					<p class="text-xs text-white/50">
						{roles.find((r) => r.key === $currentRole)?.label}
					</p>
				</div>
			</div>
		</div>
	</aside>

	<div class="flex-1 flex flex-col overflow-hidden">
		<header class="bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-4 shrink-0">
			<div class="flex gap-1 bg-gray-100 rounded-lg p-1">
				{#each roles as role}
					<button
						on:click={() => switchRole(role.key)}
						class="px-4 py-1.5 rounded-md text-sm transition-all {$currentRole === role.key
							? 'bg-accent text-white font-medium shadow-sm'
							: 'text-gray-600 hover:text-gray-800'}"
					>
						<span class="mr-1">{role.icon}</span>
						{role.label}
					</button>
				{/each}
			</div>
		</header>

		<main class="flex-1 overflow-auto p-6 bg-gray-50">
			<slot />
		</main>
	</div>
</div>
