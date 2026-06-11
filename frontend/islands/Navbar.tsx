import { useState, useEffect } from "preact/hooks";
import { api } from "../utils/api.ts";
import { getUser, clearAuth, getRoleLabel, ROLE_LABELS, showToast } from "../utils/helpers.ts";

export default function Navbar() {
  const [user, setUser] = useState<{ username: string; role: string; name: string } | null>(null);
  const [showRoleMenu, setShowRoleMenu] = useState(false);
  const [activePage, setActivePage] = useState("");

  useEffect(() => {
    const currentUser = getUser();
    setUser(currentUser);
    setActivePage(window.location.pathname);
  }, []);

  const handleLogout = () => {
    clearAuth();
    window.location.href = "/login";
  };

  const handleSwitchRole = async (role: string) => {
    const roleUserMap: Record<string, { username: string; password: string }> = {
      registrar: { username: "registrar", password: "123456" },
      auditor: { username: "auditor", password: "123456" },
      reviewer: { username: "reviewer", password: "123456" },
    };

    const roleInfo = roleUserMap[role];
    if (!roleInfo) return;

    try {
      const result = await api.login(roleInfo.username, roleInfo.password);
      localStorage.setItem("token", result.token);
      localStorage.setItem("user", JSON.stringify(result.user));
      setUser(result.user);
      setShowRoleMenu(false);
      window.location.reload();
    } catch (error) {
      showToast(error instanceof Error ? error.message : "切换角色失败", "error");
    }
  };

  if (!user) return null;

  return (
    <nav className="bg-white shadow-sm border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <div className="flex-shrink-0 flex items-center">
              <svg className="h-8 w-8 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
              </svg>
              <span className="ml-2 text-lg font-semibold text-gray-900">直播选品单管理系统</span>
            </div>
            <div className="hidden sm:ml-8 sm:flex sm:space-x-4">
              <a
                href="/"
                className={`inline-flex items-center px-3 py-2 text-sm font-medium rounded-md ${
                  activePage === "/" || activePage.startsWith("/orders/")
                    ? "text-primary-600 bg-primary-50"
                    : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                }`}
              >
                <svg className="mr-2 h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                选品单列表
              </a>
              <a
                href="/overdue-queue"
                className={`inline-flex items-center px-3 py-2 text-sm font-medium rounded-md ${
                  activePage === "/overdue-queue"
                    ? "text-primary-600 bg-primary-50"
                    : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                }`}
              >
                <svg className="mr-2 h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                到期预警
              </a>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <div className="relative">
              <button
                onClick={() => setShowRoleMenu(!showRoleMenu)}
                className="flex items-center px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
              >
                <svg className="mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                </svg>
                切换角色
                <svg className="ml-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {showRoleMenu && (
                <div className="absolute right-0 mt-2 w-72 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
                  <div className="py-2">
                    <div className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      选择角色演示
                    </div>
                    {Object.entries(ROLE_LABELS).map(([role, label]) => (
                      <button
                        key={role}
                        onClick={() => handleSwitchRole(role)}
                        className={`w-full px-4 py-3 text-left hover:bg-gray-50 flex items-center justify-between ${
                          user.role === role ? "bg-primary-50 text-primary-700" : ""
                        }`}
                      >
                        <div>
                          <div className="text-sm font-medium">{label}</div>
                          <div className="text-xs text-gray-500">账号: {role}</div>
                        </div>
                        {user.role === role && (
                          <svg className="h-5 w-5 text-primary-600" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center">
              <div className="flex items-center">
                <div className="h-8 w-8 rounded-full bg-primary-100 flex items-center justify-center">
                  <span className="text-primary-700 font-medium text-sm">
                    {user.name ? user.name.charAt(0) : user.username.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="ml-3 hidden sm:block">
                  <div className="text-sm font-medium text-gray-700">{user.name || user.username}</div>
                  <div className="text-xs text-gray-500">{getRoleLabel(user.role)}</div>
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="ml-4 px-3 py-2 text-sm text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
              >
                退出登录
              </button>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}
