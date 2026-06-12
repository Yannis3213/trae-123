import { useAuth } from '../components/AuthProvider';
import { ROLE_LABELS, type Role } from '../utils/api';

export default function Login() {
  const { login, switchTo } = useAuth();

  const demoAccounts: { role: Role; username: string; icon: string }[] = [
    { role: 'registrar', username: 'registrar', icon: '📝' },
    { role: 'reviewer', username: 'reviewer', icon: '🔍' },
    { role: 'director', username: 'director', icon: '✅' },
  ];

  const handleLogin = async (username: string, role: Role) => {
    try {
      await login(username);
    } catch {
      await switchTo(role);
    }
    window.location.href = '/';
  };

  return (
    <div class="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #1a2332 0%, #2a3a52 50%, #1a2332 100%)' }}>
      <div class="w-full max-w-md">
        <div class="text-center mb-8">
          <h1 class="text-3xl font-bold text-[var(--color-accent)] mb-2">公关传播团队</h1>
          <p class="text-gray-400 text-sm">月底集中处理传播计划单系统</p>
        </div>

        <div class="card p-6" style={{ background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(10px)' }}>
          <h2 class="text-lg font-semibold text-[var(--color-primary)] mb-4 text-center">选择演示账号登录</h2>
          <div class="space-y-3">
            {demoAccounts.map((acc) => (
              <button
                class="w-full flex items-center gap-4 p-4 rounded-lg border border-gray-200 hover:border-[var(--color-accent)] hover:shadow-md transition-all group"
                onClick={() => handleLogin(acc.username, acc.role)}
              >
                <span class="text-2xl">{acc.icon}</span>
                <div class="text-left flex-1">
                  <div class="font-semibold text-[var(--color-primary)] group-hover:text-[var(--color-accent)]">
                    {ROLE_LABELS[acc.role]}
                  </div>
                  <div class="text-xs text-gray-500">账号：{acc.username}</div>
                </div>
                <svg class="w-5 h-5 text-gray-300 group-hover:text-[var(--color-accent)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            ))}
          </div>
        </div>

        <div class="text-center mt-6 text-gray-500 text-xs">
          演示系统 · 支持角色切换 · 数据存储于本地 SQLite
        </div>
      </div>
    </div>
  );
}
