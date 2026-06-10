import { useEffect } from "preact/hooks";
import { Head } from "$fresh/runtime.ts";
import { useSignal } from "@preact/signals";
import { restoreAuth, currentUser, isLoggedIn, logout } from "../utils/store.ts";
import { ROLE_LABELS } from "../utils/types.ts";

export default function Layout({ Component, url, route }: any) {
  const initialized = useSignal(false);

  useEffect(() => {
    if (!initialized.value) {
      restoreAuth();
      initialized.value = true;
    }
  }, []);

  const isLoginPage = url.pathname === "/login";
  const user = currentUser.value;

  if (isLoginPage) {
    return (
      <>
        <Head>
          <title>生鲜采购单管理系统</title>
          <link rel="stylesheet" href="/styles.css" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        </Head>
        <Component />
      </>
    );
  }

  if (!isLoggedIn.value && typeof window !== "undefined") {
    if (!window.location.pathname.startsWith("/login")) {
      window.location.href = "/login";
    }
  }

  return (
    <>
      <Head>
        <title>生鲜采购单管理系统</title>
        <link rel="stylesheet" href="/styles.css" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      </Head>
      <div class="app-container">
        {user && (
          <header class="app-header">
            <div class="header-left">
              <span class="logo">🥬 生鲜采购单管理系统</span>
              <span class="subtitle">生鲜超市-月底集中处理生鲜采购单系统</span>
            </div>
            <nav class="header-nav">
              <a href="/" class={url.pathname === "/" ? "nav-active" : ""}>
                📋 采购单列表
              </a>
              <a href="/create" class={url.pathname === "/create" ? "nav-active" : ""}>
                ➕ 新建采购单
              </a>
              <a href="/batch" class={url.pathname === "/batch" ? "nav-active" : ""}>
                📦 批量处理
              </a>
            </nav>
            <div class="header-right">
              <div class="user-info">
                <span class="user-name">{user.full_name}</span>
                <span class="user-role" style="background: #e0e7ff; color: #4338ca;">
                  {ROLE_LABELS[user.role]}
                </span>
                {user.store && <span class="user-store">🏬 {user.store}</span>}
              </div>
              <button
                class="btn-logout"
                onClick={() => {
                  logout();
                  window.location.href = "/login";
                }}
              >
                退出
              </button>
            </div>
          </header>
        )}
        <main class="app-main">
          <Component />
        </main>
      </div>
    </>
  );
}
