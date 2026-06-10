import { component$, useStore, $ } from '@builder.io/qwik';
import { useNavigate } from '@builder.io/qwik-city';
import { api } from '~/utils/api';
import type { LoginRequest } from '~/types';

export default component$(() => {
  const nav = useNavigate();
  const form = useStore<LoginRequest & { error?: string; loading: boolean }>({
    username: '',
    password: '',
    error: undefined,
    loading: false,
  });

  const onSubmit = $(async (e: SubmitEvent) => {
    e.preventDefault();
    form.error = undefined;
    form.loading = true;

    try {
      await api.login(form.username, form.password);
      nav('/dashboard');
    } catch (err: any) {
      form.error = err?.error || '登录失败';
    } finally {
      form.loading = false;
    }
  });

  const demoAccounts = [
    { username: 'registrar', label: '旅游登记员', desc: '发起/补正订单' },
    { username: 'auditor', label: '旅游审核主管', desc: '审核订单' },
    { username: 'reviewer', label: '旅行社复核负责人', desc: '复核归档' },
  ];

  const useDemo = $((username: string) => {
    form.username = username;
    form.password = '123456';
  });

  return (
    <div class="login-page">
      <div class="login-card">
        <h2 class="login-title">旅行社-月底集中处理旅游订单系统</h2>
        <p class="login-subtitle">请登录以继续</p>

        {form.error && <div class="alert alert-error">{form.error}</div>}

        <form onSubmit$={onSubmit}>
          <div class="form-group">
            <label class="form-label">用户名</label>
            <input
              type="text"
              class="form-input"
              value={form.username}
              onInput$={(e: any) => (form.username = e.target.value)}
              placeholder="请输入用户名"
              required
            />
          </div>
          <div class="form-group">
            <label class="form-label">密码</label>
            <input
              type="password"
              class="form-input"
              value={form.password}
              onInput$={(e: any) => (form.password = e.target.value)}
              placeholder="请输入密码"
              required
            />
          </div>
          <button type="submit" class="btn btn-primary" style="width:100%;" disabled={form.loading}>
            {form.loading ? '登录中...' : '登 录'}
          </button>
        </form>

        <div style="margin-top: 24px; padding-top: 20px; border-top: 1px solid var(--border);">
          <p style="font-size: 13px; color: var(--text-secondary); margin-bottom: 10px;">演示账号（密码均为 123456）：</p>
          <div style="display: flex; flex-direction: column; gap: 8px;">
            {demoAccounts.map(acc => (
              <div
                key={acc.username}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '8px 12px',
                  background: '#f8fafc',
                  borderRadius: 6,
                  cursor: 'pointer',
                  fontSize: 13,
                }}
                onClick$={() => useDemo(acc.username)}
              >
                <span>
                  <strong>{acc.label}</strong>
                  <span style={{ color: 'var(--text-secondary)', marginLeft: 8 }}>{acc.desc}</span>
                </span>
                <span style={{ color: 'var(--primary)' }}>使用</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
});
