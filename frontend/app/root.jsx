import { Links, Meta, Outlet, Scripts, ScrollRestoration, useNavigate, useLocation } from "@remix-run/react";
import { useState, useEffect } from "react";
import "./tailwind.css";
import { getCurrentUser, clearToken } from "./utils/api";
import { ROLES, ROLE_NAMES, MODULE_NAMES, MODULES, DEMO_ACCOUNTS } from "./constants";

const ROLE_MODULES = {
  [ROLES.REGISTRAR]: [MODULES.REGISTRATION, MODULES.LEDGER, MODULES.WARNING],
  [ROLES.SUPERVISOR]: [MODULES.VERIFICATION, MODULES.LEDGER, MODULES.WARNING],
  [ROLES.REVIEWER]: [MODULES.ARCHIVING, MODULES.LEDGER, MODULES.WARNING]
};

export function Layout({ children }) {
  const [user, setUser] = useState(null);
  const [showRoleSwitcher, setShowRoleSwitcher] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const u = getCurrentUser();
    setUser(u);
    if (!u && location.pathname !== '/login') {
      navigate('/login');
    }
  }, [location.pathname, navigate]);

  const handleLogout = () => {
    clearToken();
    setUser(null);
    navigate('/login');
  };

  const handleSwitchRole = (account) => {
    clearToken();
    localStorage.setItem('switchTo', JSON.stringify(account));
    navigate('/login');
  };

  if (!user && location.pathname !== '/login') {
    return (
      <html lang="zh-CN">
        <head>
          <meta charSet="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <Meta />
          <Links />
          <title>旁站记录单系统</title>
        </head>
        <body>
          <Outlet />
          <ScrollRestoration />
          <Scripts />
        </body>
      </html>
    );
  }

  if (location.pathname === '/login') {
    return (
      <html lang="zh-CN">
        <head>
          <meta charSet="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <Meta />
          <Links />
          <title>登录 - 旁站记录单系统</title>
        </head>
        <body>
          <Outlet />
          <ScrollRestoration />
          <Scripts />
        </body>
      </html>
    );
  }

  const modules = user ? ROLE_MODULES[user.role] || [] : [];
  const activeModule = modules.find(m => location.pathname.startsWith(`/${m}`)) || MODULES.LEDGER;

  return (
    <html lang="zh-CN">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
        <title>工程监理公司 - 月底集中处理旁站记录单系统</title>
      </head>
      <body>
        <div className="flex h-screen">
          <aside className="w-56 bg-slate-800 text-white flex flex-col">
            <div className="px-4 py-5 border-b border-slate-700">
              <h1 className="text-base font-bold leading-tight">旁站记录单</h1>
              <p className="text-xs text-slate-400 mt-1">月底集中处理系统</p>
            </div>
            <nav className="flex-1 py-2">
              {modules.map(m => (
                <div
                  key={m}
                  onClick={() => navigate(`/${m}`)}
                  className={`px-4 py-2.5 cursor-pointer text-sm transition ${
                    activeModule === m ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  {MODULE_NAMES[m]}
                </div>
              ))}
            </nav>
            <div className="border-t border-slate-700 p-3">
              <div className="text-xs text-slate-400">当前登录</div>
              <div className="text-sm font-medium mt-0.5">{user?.name}</div>
              <div className="text-xs text-slate-400 mt-0.5">{ROLE_NAMES[user?.role]?.split('（')[0]}</div>
              <div className="flex gap-2 mt-3">
                <button
                  className="text-xs px-2 py-1 bg-slate-700 hover:bg-slate-600 rounded"
                  onClick={() => setShowRoleSwitcher(true)}
                >
                  切换角色
                </button>
                <button
                  className="text-xs px-2 py-1 bg-red-700 hover:bg-red-600 rounded"
                  onClick={handleLogout}
                >
                  退出
                </button>
              </div>
            </div>
          </aside>

          <main className="flex-1 overflow-auto">
            {children}
          </main>
        </div>

        {showRoleSwitcher && (
          <div className="modal-overlay" onClick={() => setShowRoleSwitcher(false)}>
            <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 420 }}>
              <div className="modal-header">
                <h3 className="text-base font-semibold">切换角色登录</h3>
                <button className="text-gray-400 hover:text-gray-600 text-xl" onClick={() => setShowRoleSwitcher(false)}>×</button>
              </div>
              <div className="modal-body">
                <p className="text-sm text-gray-500 mb-3">选择一个演示账号快速登录体验不同角色：</p>
                <div className="space-y-2">
                  {DEMO_ACCOUNTS.map(acc => (
                    <div
                      key={acc.username}
                      onClick={() => handleSwitchRole(acc)}
                      className={`p-3 border rounded cursor-pointer hover:border-blue-500 ${
                        user?.role === acc.role ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
                      }`}
                    >
                      <div className="font-medium text-sm">{acc.name}</div>
                      <div className="text-xs text-gray-500 mt-0.5">
                        {ROLE_NAMES[acc.role]} · 账号 {acc.username} / {acc.password}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return <Outlet />;
}
