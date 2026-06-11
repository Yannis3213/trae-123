import { createSignal, Show, For } from 'solid-js';
import { useNavigate, useLocation } from '@solidjs/router';
import { getCurrentUser, setCurrentUser, ROLE_LABELS, api } from '../lib/api';

export default function Layout(props: { children: any }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = createSignal(getCurrentUser());

  const logout = () => {
    setCurrentUser(null);
    setUser(null);
    navigate('/login');
  };

  const navItems = () => {
    const role = user()?.role;
    const items = [
      { path: '/', label: '种植任务', icon: '📋' },
      { path: '/overdue', label: '到期预警', icon: '⏰' },
    ];
    if (role === 'cooperative_director' || role === 'agricultural_technician') {
      items.push({ path: '/audit', label: '审计轨迹', icon: '📝' });
    }
    return items;
  };

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  return (
    <div class="min-h-screen flex">
      <aside class="w-64 bg-primary-800 text-white flex flex-col shrink-0">
        <div class="p-4 border-b border-primary-700">
          <h1 class="text-lg font-bold">🌾 农业合作社</h1>
          <p class="text-primary-200 text-xs mt-1">月底集中处理种植任务</p>
        </div>

        <nav class="flex-1 py-4">
          <For each={navItems()}>
            {(item) => (
              <a
                href={item.path}
                class={`flex items-center px-4 py-3 text-sm transition-colors ${
                  isActive(item.path)
                    ? 'bg-primary-700 text-white font-medium'
                    : 'text-primary-100 hover:bg-primary-700/50'
                }`}
                onClick={(e) => {
                  e.preventDefault();
                  navigate(item.path);
                }}
              >
                <span class="mr-3">{item.icon}</span>
                {item.label}
              </a>
            )}
          </For>
        </nav>

        <Show when={user()}>
          <div class="p-4 border-t border-primary-700">
            <div class="flex items-center gap-3">
              <div class="w-8 h-8 rounded-full bg-primary-600 flex items-center justify-center text-sm font-medium">
                {user()!.displayName[0]}
              </div>
              <div class="flex-1 min-w-0">
                <p class="text-sm font-medium truncate">{user()!.displayName}</p>
                <p class="text-xs text-primary-200">{ROLE_LABELS[user()!.role]}</p>
              </div>
              <button
                onClick={logout}
                class="text-primary-200 hover:text-white text-xs"
                title="退出登录"
              >
                退出
              </button>
            </div>
          </div>
        </Show>
      </aside>

      <main class="flex-1 overflow-auto">
        {props.children}
      </main>
    </div>
  );
}
