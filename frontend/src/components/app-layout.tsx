import { component$, Slot, useStore, useVisibleTask$, $ } from '@builder.io/qwik';
import { useNavigate, useLocation } from '@builder.io/qwik-city';
import type { User, UserRole } from '~/types';
import { ROLE_LABELS } from '~/types';
import { api } from '~/utils/api';

interface NavItem {
  path: string;
  label: string;
  icon: string;
  allowedRoles: UserRole[];
}

const NAV_ITEMS: NavItem[] = [
  { path: '/dashboard', label: '工作台统计', icon: '📊', allowedRoles: ['registrar', 'auditor', 'reviewer'] },
  { path: '/orders', label: '旅游订单登记', icon: '📝', allowedRoles: ['registrar', 'auditor', 'reviewer'] },
  { path: '/orders?tab=audit', label: '过程核验', icon: '✅', allowedRoles: ['auditor', 'reviewer'] },
  { path: '/orders?tab=review', label: '复核归档', icon: '📁', allowedRoles: ['reviewer'] },
];

export const AppLayout = component$(() => {
  const nav = useNavigate();
  const location = useLocation();
  const state = useStore<{ user: User | null }>({ user: null });

  useVisibleTask$(() => {
    state.user = api.getCurrentUser();
  });

  const onLogout = $(() => {
    api.logout();
    nav('/login');
  });

  if (!state.user) {
    return <Slot />;
  }

  const currentPath = location.url.pathname;
  const currentQuery = location.url.searchParams;

  const getTabClass = (path: string) => {
    const [base, query] = path.split('?');
    if (currentPath !== base) return 'nav-item';
    if (!query) {
      if (!currentQuery.toString()) return 'nav-item active';
      return 'nav-item';
    }
    const [key, val] = query.split('=');
    if (currentQuery.get(key) === val) return 'nav-item active';
    return 'nav-item';
  };

  const visibleNav = NAV_ITEMS.filter(item => item.allowedRoles.includes(state.user!.role));

  return (
    <div class="app-layout">
      <aside class="app-sidebar">
        <div class="logo">
          旅行社-月底集中处理旅游订单系统
        </div>
        <nav class="nav-menu">
          {visibleNav.map(item => (
            <div
              key={item.path}
              class={getTabClass(item.path)}
              onClick$={() => nav(item.path)}
            >
              <span class="nav-item-icon">{item.icon}</span>
              {item.label}
            </div>
          ))}
        </nav>
      </aside>

      <div class="app-main">
        <header class="app-header">
          <div style="font-size: 15px; font-weight: 600;">
            {visibleNav.find(n => getTabClass(n.path).includes('active'))?.label || '工作台'}
          </div>
          <div class="user-info">
            <div class="user-display">
              <span class="role-tag">{ROLE_LABELS[state.user.role]}</span>
              <span style="margin-left: 10px;">{state.user.display_name}</span>
            </div>
            <button class="btn btn-sm" onClick$={onLogout}>退出</button>
          </div>
        </header>

        <main class="app-content">
          <Slot />
        </main>
      </div>
    </div>
  );
});
