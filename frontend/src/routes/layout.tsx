import { $, component$, useSignal, useVisibleTask$ } from '@builder.io/qwik';
import { RouterOutlet, Link, useLocation } from '@builder.io/qwik-city';
import {
  ROLE_LABELS,
  ROLE_USERS,
  type User,
  type UserRole,
} from '~/utils/types';
import {
  getCurrentRole,
  getCurrentUser,
  setCurrentUser,
} from '~/utils/auth';

export default component$(() => {
  const loc = useLocation();
  const currentRole = useSignal<UserRole>('inspector');
  const currentUser = useSignal<User | null>(null);
  const roleDropdownOpen = useSignal(false);
  const userDropdownOpen = useSignal(false);

  useVisibleTask$(() => {
    currentRole.value = getCurrentRole();
    currentUser.value = getCurrentUser();
  });

  const navItems = [
    { label: '电站巡检', href: '/', active: loc.url.pathname === '/' },
    { label: '缺陷上报', href: '/defects', active: false },
    { label: '消缺验收', href: '/acceptance', active: false },
  ];

  const roleOptions: UserRole[] = ['inspector', 'engineer', 'manager', 'admin'];

  const handleRoleChange = $((role: UserRole) => {
    const user = ROLE_USERS[role][0];
    setCurrentUser(user);
    currentRole.value = role;
    currentUser.value = user;
    roleDropdownOpen.value = false;
    userDropdownOpen.value = false;
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  });

  const handleUserChange = $((user: User) => {
    setCurrentUser(user);
    currentRole.value = user.role;
    currentUser.value = user;
    userDropdownOpen.value = false;
    roleDropdownOpen.value = false;
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  });

  return (
    <div class="min-h-screen bg-gray-50">
      <header class="bg-white border-b border-gray-200 shadow-sm">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div class="flex justify-between items-center h-16">
            <div class="flex items-center space-x-8">
              <div class="flex-shrink-0">
                <span class="text-xl font-bold text-blue-600">电站巡检管理系统</span>
              </div>
              <nav class="hidden md:flex space-x-4">
                {navItems.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    class={[
                      'px-3 py-2 rounded-md text-sm font-medium transition-colors',
                      item.active
                        ? 'bg-blue-50 text-blue-700'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50',
                    ].join(' ')}
                  >
                    {item.label}
                  </Link>
                ))}
              </nav>
            </div>

            <div class="flex items-center space-x-4">
              <div class="relative">
                <button
                  onClick$={() => {
                    roleDropdownOpen.value = !roleDropdownOpen.value;
                    userDropdownOpen.value = false;
                  }}
                  class="flex items-center px-3 py-2 text-sm font-medium text-gray-700 bg-gray-50 rounded-md hover:bg-gray-100 transition-colors"
                >
                  <span class="mr-2">角色：</span>
                  <span class="font-semibold text-blue-600">
                    {ROLE_LABELS[currentRole.value]}
                  </span>
                  <svg class="ml-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {roleDropdownOpen.value && (
                  <div class="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-50 border border-gray-200">
                    {roleOptions.map((role) => (
                      <button
                        key={role}
                        onClick$={() => handleRoleChange(role)}
                        class={[
                          'block w-full text-left px-4 py-2 text-sm',
                          currentRole.value === role
                            ? 'bg-blue-50 text-blue-700'
                            : 'text-gray-700 hover:bg-gray-50',
                        ].join(' ')}
                      >
                        {ROLE_LABELS[role]}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div class="relative">
                <button
                  onClick$={() => {
                    userDropdownOpen.value = !userDropdownOpen.value;
                    roleDropdownOpen.value = false;
                  }}
                  class="flex items-center px-3 py-2 text-sm font-medium text-gray-700 bg-blue-50 rounded-md hover:bg-blue-100 transition-colors"
                >
                  <div class="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs mr-2">
                    {currentUser.value?.name?.charAt(0) || '?'}
                  </div>
                  <span>{currentUser.value?.name || '未登录'}</span>
                  <svg class="ml-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {userDropdownOpen.value && (
                  <div class="absolute right-0 mt-2 w-64 bg-white rounded-md shadow-lg py-1 z-50 border border-gray-200">
                    <div class="px-4 py-2 text-xs font-semibold text-gray-500 uppercase border-b">
                      {ROLE_LABELS[currentRole.value]} 账号
                    </div>
                    {ROLE_USERS[currentRole.value].map((user) => (
                      <button
                        key={user.id}
                        onClick$={() => handleUserChange(user)}
                        class={[
                          'block w-full text-left px-4 py-2 text-sm',
                          currentUser.value?.id === user.id
                            ? 'bg-blue-50 text-blue-700'
                            : 'text-gray-700 hover:bg-gray-50',
                        ].join(' ')}
                      >
                        <div class="font-medium">{user.name}</div>
                        <div class="text-xs text-gray-500">
                          {user.username} · {user.region}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      <main class="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        <RouterOutlet />
      </main>
    </div>
  );
});
