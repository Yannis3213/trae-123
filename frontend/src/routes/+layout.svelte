<script lang="ts">
  import '../app.css';
  import { currentRole, currentHandler, setRole, ROLE_LABELS, type Role } from '$lib/stores.svelte';
  import { Shield, BarChart3, ListChecks, ChevronDown } from 'lucide-svelte';
  import { page } from '$app/state';

  let showRoleMenu = $state(false);

  const roles: Role[] = ['agent', 'supervisor', 'manager'];

  function handleRoleChange(role: Role) {
    setRole(role);
    showRoleMenu = false;
  }

  function handleClickOutside(e: MouseEvent) {
    const target = e.target as HTMLElement;
    if (!target.closest('.role-dropdown')) {
      showRoleMenu = false;
    }
  }
</script>

<svelte:window onclick={handleClickOutside} />

<div class="min-h-screen bg-gray-50">
  <header class="bg-[#1E293B] text-white shadow-lg sticky top-0 z-50">
    <div class="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
      <div class="flex items-center gap-3">
        <Shield class="w-6 h-6 text-orange-400" />
        <h1 class="text-base font-semibold tracking-wide">燃气服务公司-月底集中处理安检工单系统</h1>
      </div>

      <nav class="flex items-center gap-1">
        <a
          href="/"
          class="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-colors {page.url.pathname === '/' ? 'bg-white/15 text-white' : 'text-gray-300 hover:bg-white/10 hover:text-white'}"
        >
          <ListChecks class="w-4 h-4" />
          工单列表
        </a>
        <a
          href="/stats"
          class="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-colors {page.url.pathname === '/stats' ? 'bg-white/15 text-white' : 'text-gray-300 hover:bg-white/10 hover:text-white'}"
        >
          <BarChart3 class="w-4 h-4" />
          统计面板
        </a>

        <div class="w-px h-6 bg-white/20 mx-2"></div>

        <div class="relative role-dropdown">
          <button
            onclick={() => (showRoleMenu = !showRoleMenu)}
            class="flex items-center gap-2 px-3 py-1.5 rounded-md text-sm bg-orange-500 hover:bg-orange-600 transition-colors font-medium"
          >
            {ROLE_LABELS[currentRole.value]}
            <ChevronDown class="w-3.5 h-3.5 transition-transform {showRoleMenu ? 'rotate-180' : ''}" />
          </button>

          {#if showRoleMenu}
            <div class="absolute right-0 top-full mt-1 w-40 bg-white rounded-lg shadow-xl border border-gray-200 py-1 z-50">
              {#each roles as role}
                <button
                  onclick={() => handleRoleChange(role)}
                  class="w-full text-left px-3 py-2 text-sm transition-colors {currentRole.value === role ? 'bg-orange-50 text-orange-600 font-medium' : 'text-gray-700 hover:bg-gray-50'}"
                >
                  {ROLE_LABELS[role]}
                  {#if currentRole.value === role}
                    <span class="float-right text-orange-500">✓</span>
                  {/if}
                </button>
              {/each}
            </div>
          {/if}
        </div>

        <span class="text-xs text-gray-400 ml-2">{currentHandler.value}</span>
      </nav>
    </div>
  </header>

  <main class="max-w-7xl mx-auto px-4 py-6">
    {@render children()}
  </main>
</div>
