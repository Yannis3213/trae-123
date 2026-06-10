import { A, Outlet, useLocation, useNavigate } from '@solidjs/router';
import { useAuth, STAGE_NAMES, ROLE_NAMES } from './store/auth.jsx';
import { For, Show, createMemo } from 'solid-js';

export default function App(props) {
  const { user, users, logout, switchTo } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const usersByRole = createMemo(() => users().filter(u => u.role !== 'admin'));

  function menuActive(path) {
    if (path === '/') return location.pathname === '/' || location.pathname === '/contracts';
    return location.pathname.startsWith(path);
  }

  return (
    <Show when={user()}>
      <div class="layout">
        <header class="layout-header">
          <div class="logo">
            <div class="logo-icon">⚡</div>
            <span>售电公司 - 月底集中处理售电合同单系统</span>
          </div>
          <div class="user-bar">
            <div class="role-switch" title="角色切换（演示用）">
              <For each={usersByRole()}>
                {u => (
                  <button
                    classList={{ active: user().id === u.id }}
                    onClick={() => switchTo(u.id)}
                    title={`切换为 ${u.real_name}（${ROLE_NAMES[u.role]}）`}
                  >
                    {u.real_name}
                  </button>
                )}
              </For>
            </div>
            <div>
              <span class="text-muted text-sm">当前：</span>
              <span class="text-bold">{user().real_name}</span>
              <span class="tag tag-primary ml-2">{ROLE_NAMES[user().role] || user().role}</span>
            </div>
            <button class="btn btn-default btn-sm" onClick={logout}>退出</button>
          </div>
        </header>
        <div class="layout-body">
          <aside class="layout-sidebar">
            <div class="sidebar-section">业务区</div>
            <A href="/customers" class="sidebar-item" classList={{ active: menuActive('/customers') }}>
              <span class="sidebar-icon">👥</span>用电客户
            </A>
            <A href="/pricing" class="sidebar-item" classList={{ active: menuActive('/pricing') }}>
              <span class="sidebar-icon">📊</span>报价测算
            </A>
            <A href="/" class="sidebar-item" classList={{ active: menuActive('/contracts') || location.pathname === '/' }}>
              <span class="sidebar-icon">📝</span>售电合同单登记
            </A>

            <div class="sidebar-section mt-4">流程办理</div>
            <A href="/batch-result" class="sidebar-item" classList={{ active: menuActive('/batch-result') }}>
              <span class="sidebar-icon">📦</span>批量结果
            </A>
            <A href="/warnings" class="sidebar-item" classList={{ active: menuActive('/warnings') }}>
              <span class="sidebar-icon">⏰</span>到期预警
            </A>
          </aside>
          <main class="layout-main">
            <Outlet />
          </main>
        </div>
      </div>
    </Show>
  );
}
