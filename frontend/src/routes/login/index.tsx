import { component$, useStore, $ } from "@builder.io/qwik";
import { type DocumentHead, useNavigate } from "@builder.io/qwik-city";
import { api } from "~/services/api";
import { config } from "~/config";

export default component$(() => {
  const nav = useNavigate();
  const state = useStore({
    username: "",
    password: "",
    loading: false,
    error: "",
  });

  const handleLogin = $(async () => {
    if (!state.username || !state.password) {
      state.error = "请输入用户名和密码";
      return;
    }

    state.loading = true;
    state.error = "";

    try {
      await api.auth.login({
        username: state.username,
        password: state.password,
      });
      await nav("/");
    } catch (e: any) {
      state.error = e.message || "登录失败";
    } finally {
      state.loading = false;
    }
  });

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
        padding: "20px",
      }}
    >
      <div
        style={{
          background: "white",
          borderRadius: "16px",
          padding: "40px",
          width: "100%",
          maxWidth: "420px",
          boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: "32px" }}>
          <div
            style={{
              fontSize: "28px",
              fontWeight: "700",
              color: "#1f2937",
              marginBottom: "8px",
            }}
          >
            展会展商申请系统
          </div>
          <div style={{ fontSize: "14px", color: "#6b7280" }}>
            展会主办方-月底集中处理展商申请系统
          </div>
        </div>

        {state.error && (
          <div class="alert alert-error">{state.error}</div>
        )}

        <div class="form-group">
          <label class="form-label">用户名</label>
          <input
            class="form-input"
            type="text"
            value={state.username}
            onInput$={(e) => {
              state.username = (e.target as HTMLInputElement).value;
            }}
            placeholder="请输入用户名"
            disabled={state.loading}
          />
        </div>

        <div class="form-group">
          <label class="form-label">密码</label>
          <input
            class="form-input"
            type="password"
            value={state.password}
            onInput$={(e) => {
              state.password = (e.target as HTMLInputElement).value;
            }}
            placeholder="请输入密码"
            disabled={state.loading}
            onKeyDown$={(e) => {
              if (e.key === "Enter") {
                handleLogin();
              }
            }}
          />
        </div>

        <button
          class="btn btn-primary"
          style={{ width: "100%", height: "44px", fontSize: "15px" }}
          onClick$={handleLogin}
          disabled={state.loading}
        >
          {state.loading ? "登录中..." : "登 录"}
        </button>

        <div style={{ marginTop: "24px", paddingTop: "20px", borderTop: "1px solid #e5e7eb" }}>
          <div style={{ fontSize: "13px", color: "#6b7280", marginBottom: "12px" }}>
            演示账号（密码均为 123456）：
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 16px", fontSize: "12px", color: "#4b5563", lineHeight: "1.8" }}>
            <div style={{ fontWeight: 600, color: "#1f2937", gridColumn: "1 / -1", marginBottom: "4px" }}>展商登记员（展商服务补齐材料队列）：</div>
            <div>registrar1 李登记员</div>
            <div>registrar2 赵登记员</div>
            <div style={{ fontWeight: 600, color: "#1f2937", gridColumn: "1 / -1", margin: "8px 0 4px" }}>展商审核主管（搭建审核办理队列）：</div>
            <div>supervisor1 王审核主管</div>
            <div>supervisor2 孙审核主管</div>
            <div style={{ fontWeight: 600, color: "#1f2937", gridColumn: "1 / -1", margin: "8px 0 4px" }}>主办方复核负责人（项目负责人收口队列）：</div>
            <div>leader1 张复核负责人</div>
            <div>leader2 周复核负责人</div>
          </div>
          <div style={{ fontSize: "12px", color: "#6b7280", marginTop: "12px", padding: "8px 12px", background: "#f3f4f6", borderRadius: "6px" }}>
            💡 切换账号请退出后重新登录。同一角色不同账号分配的单据不同，按账号精确办理。
          </div>
        </div>
      </div>
    </div>
  );
});

export const head: DocumentHead = {
  title: "登录 - 展会主办方-月底集中处理展商申请系统",
};
