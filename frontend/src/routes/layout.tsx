import { component$, useStore, useTask$, $ } from "@builder.io/qwik";
import { Slot, useNavigate, useLocation } from "@builder.io/qwik-city";
import { api } from "~/services/api";
import { config } from "~/config";
import type { User } from "~/types";

export default component$(() => {
  const nav = useNavigate();
  const loc = useLocation();
  const state = useStore({
    user: null as User | null,
    loading: true,
  });

  useTask$(async () => {
    const storedUser = api.auth.getCurrentUser();
    if (!storedUser) {
      if (loc.url.pathname !== "/login") {
        await nav("/login");
      }
      state.loading = false;
      return;
    }

    try {
      const user = await api.auth.me();
      state.user = user;
    } catch {
      api.auth.logout();
      if (loc.url.pathname !== "/login") {
        await nav("/login");
      }
    } finally {
      state.loading = false;
    }
  });

  const handleLogout = $(async () => {
    api.auth.logout();
    await nav("/login");
  });

  if (state.loading) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100vh",
          fontSize: "14px",
          color: "#6b7280",
        }}
      >
        加载中...
      </div>
    );
  }

  if (loc.url.pathname === "/login") {
    return <Slot />;
  }

  if (!state.user) {
    return null;
  }

  return (
    <div class="page-container">
      <header class="header">
        <div class="header-inner">
          <div class="logo">展会主办方-月底集中处理展商申请系统</div>
          <div class="header-right">
            <span class="role-tag">{state.user.role_name}</span>
            <div class="user-info">
              <div class="user-avatar">{state.user.name.charAt(0)}</div>
              <div>
                <div style={{ fontSize: "14px", fontWeight: "500" }}>
                  {state.user.name}
                </div>
                <div style={{ fontSize: "12px", color: "#6b7280" }}>
                  @{state.user.username}
                </div>
              </div>
            </div>
            <button class="btn btn-outline" onClick$={handleLogout}>
              退出
            </button>
          </div>
        </div>
      </header>

      <main class="main-container">
        <Slot />
      </main>
    </div>
  );
});
