import { useState } from "react";
import { useNavigate } from "@remix-run/react";
import { login } from "~/utils/auth";

export default function LoginPage() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await login(username, password);
      navigate("/dashboard");
    } catch (err: any) {
      setError(err.message || "登录失败，请检查用户名和密码");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={pageStyle}>
      <div style={containerStyle}>
        <div style={headerStyle}>
          <div style={iconStyle}>🏛</div>
          <h1 style={titleStyle}>证券营业部-月底集中处理适当性记录系统</h1>
          <p style={subtitleStyle}>适当性记录管理平台</p>
        </div>

        <form onSubmit={handleSubmit} style={formStyle}>
          {error && <div className="alert alert-error">{error}</div>}

          <div className="form-group">
            <label>用户名</label>
            <input
              type="text"
              className="form-control"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="请输入用户名"
              required
            />
          </div>

          <div className="form-group">
            <label>密码</label>
            <input
              type="password"
              className="form-control"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="请输入密码"
              required
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary btn-lg"
            style={{ width: "100%", marginTop: 8 }}
            disabled={loading}
          >
            {loading ? "登录中..." : "登 录"}
          </button>
        </form>

        <div style={demoStyle}>
          <div style={demoTitleStyle}>演示账号</div>
          <div style={demoListStyle}>
            <div style={demoItemStyle}>
              <span className="badge badge-blue">理财顾问</span>
              <span className="text-sm text-muted">advisor1 / password123</span>
            </div>
            <div style={demoItemStyle}>
              <span className="badge badge-orange">合规专员</span>
              <span className="text-sm text-muted">compliance1 / password123</span>
            </div>
            <div style={demoItemStyle}>
              <span className="badge badge-green">营业部经理</span>
              <span className="text-sm text-muted">manager1 / password123</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const pageStyle: React.CSSProperties = {
  minHeight: "100vh",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "linear-gradient(135deg, #1a56db 0%, #3b82f6 50%, #60a5fa 100%)",
};

const containerStyle: React.CSSProperties = {
  width: 420,
  background: "#fff",
  borderRadius: 16,
  boxShadow: "0 20px 60px rgba(0,0,0,0.15)",
  overflow: "hidden",
};

const headerStyle: React.CSSProperties = {
  textAlign: "center",
  padding: "36px 32px 24px",
  background: "var(--gray-50)",
  borderBottom: "1px solid var(--gray-200)",
};

const iconStyle: React.CSSProperties = {
  width: 56,
  height: 56,
  margin: "0 auto 16px",
  background: "var(--primary)",
  borderRadius: 14,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 28,
};

const titleStyle: React.CSSProperties = {
  fontSize: 18,
  fontWeight: 700,
  color: "var(--gray-800)",
  marginBottom: 4,
  lineHeight: 1.4,
};

const subtitleStyle: React.CSSProperties = {
  fontSize: 13,
  color: "var(--gray-500)",
};

const formStyle: React.CSSProperties = {
  padding: "28px 32px 20px",
};

const demoStyle: React.CSSProperties = {
  padding: "16px 32px 24px",
  background: "var(--gray-50)",
  borderTop: "1px solid var(--gray-200)",
};

const demoTitleStyle: React.CSSProperties = {
  fontSize: 12,
  color: "var(--gray-500)",
  marginBottom: 10,
  fontWeight: 500,
};

const demoListStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 6,
};

const demoItemStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
};
