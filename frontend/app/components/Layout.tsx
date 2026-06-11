import { NavLink, useNavigate } from "@remix-run/react";
import type { UserRole } from "~/utils/auth";
import { getCurrentUser, logout, ROLE_LABELS, demoLogin } from "~/utils/auth";

const MENU_ITEMS = [
  { path: "/dashboard", label: "适当性记录队列", icon: "📋" },
  { path: "/batch", label: "批量处理", icon: "⚡" },
  { path: "/expiry", label: "到期预警", icon: "⏰" },
  { path: "/stats", label: "统计", icon: "📊" },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const user = getCurrentUser();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const handleRoleSwitch = async (role: UserRole) => {
    try {
      await demoLogin(role);
      window.location.reload();
    } catch {
      alert("切换角色失败");
    }
  };

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      <aside style={sidebarStyle}>
        <div style={logoStyle}>
          <div style={logoIconStyle}>🏛</div>
          <div style={logoTextStyle}>
            <div style={logoTitleStyle}>适当性记录系统</div>
            <div style={logoSubStyle}>证券营业部管理</div>
          </div>
        </div>

        <nav style={navStyle}>
          {MENU_ITEMS.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              style={({ isActive }) => ({
                ...navItemStyle,
                ...(isActive ? navItemActiveStyle : {}),
              })}
            >
              <span style={{ fontSize: 16 }}>{item.icon}</span>
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div style={sidebarFooterStyle}>
          {user && (
            <>
              <div style={userInfoStyle}>
                <div style={userAvatarStyle}>
                  {user.name.charAt(0)}
                </div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{user.name}</div>
                  <div style={{ fontSize: 12, color: "var(--gray-400)" }}>
                    {ROLE_LABELS[user.role]}
                  </div>
                </div>
              </div>
              <div style={roleSwitchStyle}>
                <div style={{ fontSize: 11, color: "var(--gray-400)", marginBottom: 6 }}>
                  切换角色（演示）
                </div>
                <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                  {(["financial_advisor", "compliance_officer", "branch_manager"] as UserRole[]).map(
                    (role) => (
                      <button
                        key={role}
                        onClick={() => handleRoleSwitch(role)}
                        style={{
                          ...roleBtnStyle,
                          ...(user.role === role ? roleBtnActiveStyle : {}),
                        }}
                      >
                        {ROLE_LABELS[role]}
                      </button>
                    )
                  )}
                </div>
              </div>
              <button onClick={handleLogout} style={logoutBtnStyle}>
                退出登录
              </button>
            </>
          )}
        </div>
      </aside>

      <main style={mainStyle}>
        {children}
      </main>
    </div>
  );
}

const sidebarStyle: React.CSSProperties = {
  width: 240,
  minWidth: 240,
  background: "#fff",
  borderRight: "1px solid var(--gray-200)",
  display: "flex",
  flexDirection: "column",
  boxShadow: "var(--shadow-sm)",
};

const logoStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  padding: "20px 16px",
  borderBottom: "1px solid var(--gray-200)",
};

const logoIconStyle: React.CSSProperties = {
  width: 36,
  height: 36,
  background: "var(--primary)",
  borderRadius: 8,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 20,
};

const logoTextStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
};

const logoTitleStyle: React.CSSProperties = {
  fontWeight: 700,
  fontSize: 15,
  color: "var(--gray-800)",
  lineHeight: 1.2,
};

const logoSubStyle: React.CSSProperties = {
  fontSize: 11,
  color: "var(--gray-400)",
  lineHeight: 1.2,
};

const navStyle: React.CSSProperties = {
  flex: 1,
  padding: "12px 8px",
  display: "flex",
  flexDirection: "column",
  gap: 2,
};

const navItemStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  padding: "10px 12px",
  borderRadius: "var(--radius)",
  color: "var(--gray-600)",
  fontWeight: 500,
  fontSize: 14,
  textDecoration: "none",
  transition: "all 0.15s ease",
};

const navItemActiveStyle: React.CSSProperties = {
  background: "var(--primary-light)",
  color: "var(--primary)",
  fontWeight: 600,
};

const sidebarFooterStyle: React.CSSProperties = {
  padding: 16,
  borderTop: "1px solid var(--gray-200)",
};

const userInfoStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  marginBottom: 12,
};

const userAvatarStyle: React.CSSProperties = {
  width: 32,
  height: 32,
  borderRadius: "50%",
  background: "var(--primary)",
  color: "#fff",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontWeight: 600,
  fontSize: 14,
};

const roleSwitchStyle: React.CSSProperties = {
  marginBottom: 12,
};

const roleBtnStyle: React.CSSProperties = {
  padding: "3px 8px",
  fontSize: 11,
  borderRadius: 4,
  border: "1px solid var(--gray-300)",
  background: "#fff",
  color: "var(--gray-600)",
  cursor: "pointer",
};

const roleBtnActiveStyle: React.CSSProperties = {
  background: "var(--primary)",
  color: "#fff",
  borderColor: "var(--primary)",
};

const logoutBtnStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 0",
  border: "1px solid var(--gray-300)",
  borderRadius: "var(--radius)",
  background: "#fff",
  color: "var(--gray-600)",
  fontSize: 13,
  cursor: "pointer",
};

const mainStyle: React.CSSProperties = {
  flex: 1,
  overflow: "auto",
  padding: 24,
  background: "var(--gray-50)",
};
