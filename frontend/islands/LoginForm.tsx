import { useState } from "preact/hooks";
import { api } from "../utils/api.ts";
import { setToken, setUser, showToast, ROLE_LABELS } from "../utils/helpers.ts";

export default function LoginForm() {
  const [username, setUsername] = useState("registrar");
  const [password, setPassword] = useState("123456");
  const [loading, setLoading] = useState(false);
  const [selectedRole, setSelectedRole] = useState("registrar");

  const roleAccounts = [
    { role: "registrar", username: "registrar", password: "123456", name: "直播选品登记员" },
    { role: "auditor", username: "auditor", password: "123456", name: "直播选品审核主管" },
    { role: "reviewer", username: "reviewer", password: "123456", name: "直播电商团队复核负责人" },
  ];

  const handleRoleSelect = (role: string) => {
    const account = roleAccounts.find((a) => a.role === role);
    if (account) {
      setSelectedRole(role);
      setUsername(account.username);
      setPassword(account.password);
    }
  };

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    setLoading(true);

    try {
      const result = await api.login(username, password);
      setToken(result.token);
      setUser(result.user);
      showToast("登录成功", "success");
      setTimeout(() => {
        window.location.href = "/";
      }, 500);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "登录失败", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-blue-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <div className="text-center mb-8">
            <div className="mx-auto h-16 w-16 bg-primary-100 rounded-full flex items-center justify-center mb-4">
              <svg className="h-8 w-8 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900">直播选品单管理系统</h2>
            <p className="mt-2 text-sm text-gray-600">月底集中处理直播选品单</p>
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-3">
              快速选择角色演示
            </label>
            <div className="grid grid-cols-3 gap-2">
              {roleAccounts.map((account) => (
                <button
                  key={account.role}
                  type="button"
                  onClick={() => handleRoleSelect(account.role)}
                  className={`px-3 py-2 text-xs rounded-lg border-2 transition-all ${
                    selectedRole === account.role
                      ? "border-primary-500 bg-primary-50 text-primary-700"
                      : "border-gray-200 hover:border-gray-300 text-gray-600"
                  }`}
                >
                  <div className="font-medium">{account.name}</div>
                  <div className="text-gray-500 mt-1">{account.username}</div>
                </button>
              ))}
            </div>
          </div>

          <form className="space-y-5" onSubmit={handleSubmit}>
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-1">
                用户名
              </label>
              <input
                id="username"
                name="username"
                type="text"
                required
                value={username}
                onChange={(e) => setUsername((e.target as HTMLInputElement).value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
                placeholder="请输入用户名"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                密码
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword((e.target as HTMLInputElement).value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
                placeholder="请输入密码"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "登录中..." : "登 录"}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-gray-100">
            <p className="text-center text-xs text-gray-500">
              演示账号: registrar / auditor / reviewer
              <br />
              密码均为: 123456
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
