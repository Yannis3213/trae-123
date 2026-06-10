import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useNavigate,
  useLocation,
} from "@remix-run/react";
import type { LinksFunction } from "@remix-run/node";
import { useState, useEffect } from "react";
import {
  ClipboardList,
  Zap,
  AlertTriangle,
  FilePlus,
  Clock,
  FileText,
  LogOut,
  ChevronDown,
  LayoutDashboard,
} from "lucide-react";
import { getCurrentUser, logout, setCurrentUser, clearCurrentUser, AuthContext } from "./utils/auth";
import type { User, UserRole } from "./utils/types";
import { ROLE_LABELS } from "./utils/types";
import { login as loginApi } from "./utils/auth";
import stylesheet from "./styles/tailwind.css?url";

export const links: LinksFunction = () => [
  { rel: "stylesheet", href: stylesheet },
];

const DEMO_USERS: Record<UserRole, { username: string; password: string }> = {
  duty_officer: { username: "user_001", password: "user_001" },
  maintenance_engineer: { username: "user_002", password: "user_002" },
  operations_manager: { username: "user_003", password: "user_003" },
};

const NAV_ITEMS = [
  { to: "/", label: "设备巡检单列表", icon: ClipboardList },
  { to: "/charging-pile-inspection", label: "充电桩巡检", icon: Zap },
  { to: "/fault-report", label: "故障上报", icon: AlertTriangle },
  { to: "/inspection/new", label: "设备巡检单登记", icon: FilePlus },
  { to: "/expiry-queue", label: "到期预警队列", icon: Clock },
  { to: "/audit-trail", label: "审计轨迹", icon: FileText },
];

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" className="h-full">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body className="h-full bg-gray-50 text-gray-900">
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [roleDropdownOpen, setRoleDropdownOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const stored = getCurrentUser();
    if (stored) {
      setUser(stored);
    } else if (location.pathname !== "/login") {
      navigate("/login");
    }
  }, []);

  const handleLogout = () => {
    logout();
    setUser(null);
    navigate("/login");
  };

  const switchRole = async (role: UserRole) => {
    const demo = DEMO_USERS[role];
    try {
      clearCurrentUser();
      const newUser = await loginApi(demo.username, demo.password);
      setUser(newUser);
      setRoleDropdownOpen(false);
    } catch {
      const fallback: User = {
        id: demo.username,
        name: ROLE_LABELS[role],
        role,
      };
      setCurrentUser(fallback, "demo-token");
      setUser(fallback);
      setRoleDropdownOpen(false);
    }
  };

  const handleLogin = async (username: string, password: string) => {
    try {
      const loggedInUser = await loginApi(username, password);
      setUser(loggedInUser);
      navigate("/");
    } catch {
      const fallback: User = {
        id: username,
        name: username,
        role: username.includes("maintenance")
          ? "maintenance_engineer" as UserRole
          : username.includes("operations")
          ? "operations_manager" as UserRole
          : "duty_officer" as UserRole,
      };
      setCurrentUser(fallback, "demo-token");
      setUser(fallback);
      navigate("/");
    }
  };

  if (!user) {
    return (
      <AuthContext.Provider value={{ user, setUser, switchRole }}>
        <LoginRoute onLogin={handleLogin} />
      </AuthContext.Provider>
    );
  }

  const currentPath = location.pathname;

  return (
    <AuthContext.Provider value={{ user, setUser, switchRole }}>
      <div className="flex h-full">
        <aside className="w-60 bg-[#1e293b] text-white flex flex-col flex-shrink-0">
          <div className="p-4 border-b border-slate-600">
            <LayoutDashboard className="inline-block mr-2" size={20} />
            <span className="font-semibold text-sm">巡检管理系统</span>
          </div>
          <nav className="flex-1 py-2">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive =
                item.to === "/"
                  ? currentPath === "/"
                  : currentPath.startsWith(item.to);
              return (
                <a
                  key={item.to}
                  href={item.to}
                  className={`flex items-center px-4 py-3 text-sm transition-colors ${
                    isActive
                      ? "bg-emerald-accent/20 text-emerald-accent border-r-2 border-emerald-accent"
                      : "text-gray-300 hover:bg-slate-700 hover:text-white"
                  }`}
                >
                  <Icon size={18} className="mr-3" />
                  {item.label}
                </a>
              );
            })}
          </nav>
          <div className="p-4 border-t border-slate-600">
            <button
              onClick={handleLogout}
              className="flex items-center text-sm text-gray-400 hover:text-white w-full"
            >
              <LogOut size={16} className="mr-2" />
              退出登录
            </button>
          </div>
        </aside>

        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-6 flex-shrink-0">
            <h1 className="text-base font-semibold text-gray-800">
              新能源汽车充电站-月底集中处理设备巡检单系统
            </h1>
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-500">
                {user.name}
              </span>
              <div className="relative">
                <button
                  onClick={() => setRoleDropdownOpen(!roleDropdownOpen)}
                  className="flex items-center gap-1 text-sm bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-lg transition-colors"
                >
                  {ROLE_LABELS[user.role]}
                  <ChevronDown size={14} />
                </button>
                {roleDropdownOpen && (
                  <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 min-w-[160px]">
                    {(Object.keys(ROLE_LABELS) as UserRole[]).map((role) => (
                      <button
                        key={role}
                        onClick={() => switchRole(role)}
                        className={`block w-full text-left px-4 py-2 text-sm hover:bg-gray-50 ${
                          user.role === role ? "text-emerald-accent font-medium" : "text-gray-700"
                        }`}
                      >
                        {ROLE_LABELS[role]}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </header>

          <main className="flex-1 overflow-auto p-6">
            <Outlet />
          </main>
        </div>
      </div>
    </AuthContext.Provider>
  );
}

function LoginRoute({ onLogin }: { onLogin: (username: string, password: string) => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const navigate = useNavigate();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onLogin(username, password);
  };

  const quickLogin = (role: UserRole) => {
    const demo = DEMO_USERS[role];
    setUsername(demo.username);
    setPassword(demo.password);
    onLogin(demo.username, demo.password);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-lg p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-xl font-bold text-gray-800 mb-2">
            新能源汽车充电站
          </h1>
          <p className="text-sm text-gray-500">
            月底集中处理设备巡检单系统
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              用户名
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-accent focus:border-transparent"
              placeholder="请输入用户名"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              密码
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-accent focus:border-transparent"
              placeholder="请输入密码"
            />
          </div>
          <button
            type="submit"
            className="w-full bg-emerald-accent text-white py-2.5 rounded-lg text-sm font-medium hover:bg-emerald-600 transition-colors"
          >
            登录
          </button>
        </form>

        <div className="mt-6">
          <p className="text-xs text-gray-400 text-center mb-3">快速登录（演示）</p>
          <div className="flex gap-2">
            {(Object.keys(DEMO_USERS) as UserRole[]).map((role) => (
              <button
                key={role}
                onClick={() => quickLogin(role)}
                className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 py-2 rounded-lg text-xs font-medium transition-colors"
              >
                {ROLE_LABELS[role]}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
