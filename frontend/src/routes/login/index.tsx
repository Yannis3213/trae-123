import { component$, useSignal, $ } from "@builder.io/qwik";
import { type DocumentHead, useNavigate } from "@builder.io/qwik-city";
import { api } from "../../utils/api";
import { setAuth } from "../../stores/auth";

export default component$(() => {
  const username = useSignal("");
  const password = useSignal("");
  const error = useSignal("");
  const loading = useSignal(false);
  const nav = useNavigate();

  const handleSubmit = $(async () => {
    error.value = "";
    if (!username.value || !password.value) {
      error.value = "请输入用户名和密码";
      return;
    }
    loading.value = true;
    try {
      const res = await api.login({ username: username.value, password: password.value });
      setAuth({ token: res.token, role: res.role, username: res.username });
      nav("/");
    } catch (e: any) {
      error.value = e.message || "登录失败";
    } finally {
      loading.value = false;
    }
  });

  return (
    <div class="min-h-screen bg-bg flex items-center justify-center">
      <div class="bg-white rounded-xl shadow-lg p-8 w-full max-w-md">
        <div class="text-center mb-8">
          <div class="text-3xl mb-2">📋</div>
          <h1 class="text-xl font-bold text-stone-800">审核单系统</h1>
          <p class="text-sm text-stone-500 mt-1">家政服务平台 · 月底集中处理</p>
        </div>
        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-stone-700 mb-1">用户名</label>
            <input
              type="text"
              value={username.value}
              onInput$={(_, el) => (username.value = el.value)}
              onKeyDown$={(e) => { if (e.key === "Enter") handleSubmit(); }}
              class="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
              placeholder="请输入用户名"
            />
          </div>
          <div>
            <label class="block text-sm font-medium text-stone-700 mb-1">密码</label>
            <input
              type="password"
              value={password.value}
              onInput$={(_, el) => (password.value = el.value)}
              onKeyDown$={(e) => { if (e.key === "Enter") handleSubmit(); }}
              class="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
              placeholder="请输入密码"
            />
          </div>
          {error.value && (
            <div class="text-sm text-status-red bg-red-50 rounded-lg px-3 py-2">
              {error.value}
            </div>
          )}
          <button
            onClick$={handleSubmit}
            disabled={loading.value}
            class="w-full bg-primary text-white rounded-lg py-2.5 text-sm font-medium hover:bg-primary-dark transition-colors disabled:opacity-50"
          >
            {loading.value ? "登录中..." : "登 录"}
          </button>
        </div>
        <div class="mt-6 text-xs text-stone-400">
          <p class="font-medium mb-1">演示账号：</p>
          <p>dispatcher / demo123 — 派单客服</p>
          <p>supervisor / demo123 — 服务督导</p>
          <p>manager / demo123 — 城市经理</p>
        </div>
      </div>
    </div>
  );
});

export const head: DocumentHead = {
  title: "登录 - 审核单系统",
};
