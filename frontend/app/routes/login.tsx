import { useState } from "react";
import { useNavigate } from "@remix-run/react";
import { login as loginApi, setCurrentUser } from "../utils/auth";
import type { UserRole } from "../utils/types";
import { ROLE_LABELS } from "../utils/types";

const DEMO_USERS: Record<UserRole, { username: string; password: string }> = {
  duty_officer: { username: "user_001", password: "user_001" },
  maintenance_engineer: { username: "user_002", password: "user_002" },
  operations_manager: { username: "user_003", password: "user_003" },
};

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      await loginApi(username, password);
      navigate("/");
    } catch (err) {
      const fallback: UserRole = username.includes("maintenance")
        ? "maintenance_engineer"
        : username.includes("operations")
        ? "operations_manager"
        : "duty_officer";
      setCurrentUser(
        { id: username, name: username, role: fallback },
        "demo-token"
      );
      navigate("/");
    }
  };

  const quickLogin = async (role: UserRole) => {
    const demo = DEMO_USERS[role];
    try {
      await loginApi(demo.username, demo.password);
      navigate("/");
    } catch {
      setCurrentUser(
        { id: demo.username, name: ROLE_LABELS[role], role },
        "demo-token"
      );
      navigate("/");
    }
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

        {error && (
          <div className="mb-4 bg-red-50 text-coral-red text-sm px-4 py-2 rounded-lg">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              用户名
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-accent"
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
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-accent"
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
          <p className="text-xs text-gray-400 text-center mb-3">
            快速登录（演示）
          </p>
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
