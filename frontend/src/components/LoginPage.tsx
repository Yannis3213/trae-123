import { createSignal, Show, For } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import { api, setCurrentUser, ROLE_LABELS } from '../lib/api';

export default function LoginPage() {
  const navigate = useNavigate();
  const [username, setUsername] = createSignal('');
  const [password, setPassword] = createSignal('');
  const [error, setError] = createSignal('');
  const [loading, setLoading] = createSignal(false);

  const demoAccounts = [
    { username: 'director', password: '123456', role: '合作社主任' },
    { username: 'technician', password: '123456', role: '农技员' },
    { username: 'fieldmanager', password: '123456', role: '田间管理员' },
  ];

  const login = async (e: Event) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const result: any = await api.auth.login(username(), password());
      setCurrentUser(result);
      navigate('/');
    } catch (err: any) {
      setError(err.message || '登录失败');
    } finally {
      setLoading(false);
    }
  };

  const quickLogin = async (account: typeof demoAccounts[0]) => {
    setUsername(account.username);
    setPassword(account.password);
    setError('');
    setLoading(true);
    try {
      const result: any = await api.auth.login(account.username, account.password);
      setCurrentUser(result);
      navigate('/');
    } catch (err: any) {
      setError(err.message || '登录失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div class="min-h-screen bg-gradient-to-br from-primary-50 to-primary-100 flex items-center justify-center p-4">
      <div class="w-full max-w-md">
        <div class="text-center mb-8">
          <h1 class="text-3xl font-bold text-primary-800">🌾 农业合作社</h1>
          <p class="text-primary-600 mt-2">月底集中处理种植任务系统</p>
        </div>

        <div class="card p-6">
          <form onSubmit={login}>
            <div class="mb-4">
              <label class="block text-sm font-medium text-gray-700 mb-1">用户名</label>
              <input
                type="text"
                class="input"
                value={username()}
                onInput={(e) => setUsername(e.currentTarget.value)}
                placeholder="请输入用户名"
              />
            </div>
            <div class="mb-4">
              <label class="block text-sm font-medium text-gray-700 mb-1">密码</label>
              <input
                type="password"
                class="input"
                value={password()}
                onInput={(e) => setPassword(e.currentTarget.value)}
                placeholder="请输入密码"
              />
            </div>

            <Show when={error()}>
              <div class="mb-4 p-3 bg-danger-50 text-danger-600 text-sm rounded-lg">
                {error()}
              </div>
            </Show>

            <button
              type="submit"
              class="btn-primary w-full"
              disabled={loading()}
            >
              {loading() ? '登录中...' : '登录'}
            </button>
          </form>

          <div class="mt-6 pt-6 border-t border-gray-200">
            <p class="text-xs text-gray-500 mb-3">演示账号（点击快速登录）：</p>
            <div class="space-y-2">
              <For each={demoAccounts}>
                {(account) => (
                  <button
                    class="w-full text-left px-3 py-2 rounded-lg border border-gray-200 hover:bg-primary-50 text-sm transition-colors"
                    onClick={() => quickLogin(account)}
                    disabled={loading()}
                  >
                    <span class="font-medium">{account.role}</span>
                    <span class="text-gray-400 ml-2">{account.username} / {account.password}</span>
                  </button>
                )}
              </For>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
