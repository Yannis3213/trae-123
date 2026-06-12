import { component$, useSignal, $, useVisibleTask$, Slot } from "@builder.io/qwik";
import { Link, useLocation } from "@builder.io/qwik-city";
import { loadAuthFromStorage, getAuth, clearAuth, ROLE_LABELS, type UserRole } from "../stores/auth";

export default component$(() => {
  const collapsed = useSignal(false);
  const authData = useSignal(getAuth());

  const loc = useLocation();

  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(() => {
    loadAuthFromStorage();
    authData.value = getAuth();
  });

  const navItems = [
    { href: "/", label: "审核单列表", icon: "📋" },
    { href: "/batch", label: "批量处理", icon: "⚡" },
    { href: "/expiry", label: "到期预警", icon: "⏰" },
  ];

  const isActive = (href: string) => {
    if (href === "/") return loc.url.pathname === "/";
    return loc.url.pathname.startsWith(href);
  };

  const handleLogout = $(() => {
    clearAuth();
    window.location.href = "/login";
  });

  if (loc.url.pathname === "/login") {
    return <Slot />;
  }

  if (!authData.value) {
    if (typeof window !== "undefined") {
      window.location.href = "/login";
    }
    return <div class="flex items-center justify-center h-screen">跳转登录中...</div>;
  }

  const role = authData.value.role as UserRole;

  return (
    <div class="flex h-screen overflow-hidden">
      <aside
        class={`bg-white border-r border-stone-200 flex flex-col transition-all duration-200 ${
          collapsed.value ? "w-16" : "w-56"
        }`}
      >
        <div class="h-14 flex items-center justify-between px-4 border-b border-stone-200">
          {!collapsed.value && (
            <span class="text-primary font-bold text-sm truncate">审核单系统</span>
          )}
          <button
            onClick$={() => (collapsed.value = !collapsed.value)}
            class="text-stone-400 hover:text-primary p-1 rounded"
          >
            {collapsed.value ? "▶" : "◀"}
          </button>
        </div>
        <nav class="flex-1 p-2 space-y-1">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              class={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm transition-all no-underline ${
                isActive(item.href)
                  ? "bg-primary text-white"
                  : "text-stone-600 hover:bg-stone-100 hover:text-primary"
              }`}
            >
              <span class="text-base">{item.icon}</span>
              {!collapsed.value && <span>{item.label}</span>}
            </Link>
          ))}
        </nav>
        <div class="border-t border-stone-200 p-3">
          {!collapsed.value && (
            <div class="text-xs text-stone-500 mb-2">
              <div class="font-medium text-stone-700">{authData.value.username}</div>
              <div>{ROLE_LABELS[role]}</div>
            </div>
          )}
          <button
            onClick$={handleLogout}
            class="w-full text-xs text-stone-400 hover:text-status-red transition-colors py-1"
          >
            {collapsed.value ? "🚪" : "退出登录"}
          </button>
        </div>
      </aside>
      <main class="flex-1 overflow-auto">
        <Slot />
      </main>
    </div>
  );
});
