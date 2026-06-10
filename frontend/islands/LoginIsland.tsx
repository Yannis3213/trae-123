import { useState, useEffect } from "preact/hooks";
import { useSignal } from "@preact/signals";
import { login, isLoggedIn, currentUser } from "../utils/store.ts";
import { ROLE_LABELS, UserRole } from "../utils/types.ts";

const DEMO_ACCOUNTS = [
  { username: "registrar1", password: "registrar123", name: "张登记员", role: "registrar" as UserRole, desc: "朝阳店" },
  { username: "registrar2", password: "registrar123", name: "李采购员", role: "registrar" as UserRole, desc: "海淀店" },
  { username: "supervisor1", password: "supervisor123", name: "王主管", role: "supervisor" as UserRole, desc: "朝阳店" },
  { username: "supervisor2", password: "supervisor123", name: "赵门店经理", role: "supervisor" as UserRole, desc: "海淀店" },
  { username: "reviewer1", password: "reviewer123", name: "陈区域督导", role: "reviewer" as UserRole, desc: "区域总部" },
];

export default function LoginIsland() {
  const username = useSignal("");
  const password = useSignal("");
  const error = useSignal("");
  const loading = useSignal(false);
  const [redirected, setRedirected] = useState(false);

  useEffect(() => {
    if (isLoggedIn.value && !redirected) {
      setRedirected(true);
      window.location.href = "/";
    }
  }, [isLoggedIn.value, redirected]);

  async function handleSubmit(e: Event) {
    e.preventDefault();
    error.value = "";
    loading.value = true;
    try {
      await login(username.value, password.value);
      window.location.href = "/";
    } catch (err: any) {
      error.value = err.message || "登录失败";
    } finally {
      loading.value = false;
    }
  }

  function quickLogin(u: string, p: string) {
    username.value = u;
    password.value = p;
    handleSubmit(new Event("submit") as any);
  }

  return (
    <div class="login-page">
      <div class="login-card">
        <div class="login-header">
          <h1>🥬 生鲜采购单管理系统</h1>
          <p class="login-subtitle">生鲜超市月底集中处理生鲜采购单</p>
        </div>

        <form onSubmit={handleSubmit} class="login-form">
          <div class="form-group">
            <label>账号</label>
            <input
              type="text"
              value={username}
              onInput={(e: any) => (username.value = e.target.value)}
              placeholder="请输入账号"
              required
            />
          </div>
          <div class="form-group">
            <label>密码</label>
            <input
              type="password"
              value={password}
              onInput={(e: any) => (password.value = e.target.value)}
              placeholder="请输入密码"
              required
            />
          </div>
          {error.value && <div class="error-msg">{error.value}</div>}
          <button type="submit" class="btn-primary" disabled={loading.value}>
            {loading.value ? "登录中..." : "登 录"}
          </button>
        </form>

        <div class="demo-accounts">
          <h4>🎯 演示账号（点击快速登录）</h4>
          <div class="demo-grid">
            {DEMO_ACCOUNTS.map(acc => (
              <div
                key={acc.username}
                class="demo-account-card"
                onClick={() => quickLogin(acc.username, acc.password)}
              >
                <div class="demo-name">{acc.name}</div>
                <div class="demo-role">{ROLE_LABELS[acc.role]}</div>
                <div class="demo-store">{acc.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
