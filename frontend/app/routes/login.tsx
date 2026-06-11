import { Component, createSignal, Show } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import { login, loginWithDemo, isLoading } from '~/store/auth';
import { DEMO_ACCOUNTS, ROLE_LABELS } from '~/utils/role';
import type { UserRole } from '~/types';

const Login: Component = () => {
  const navigate = useNavigate();
  const [username, setUsername] = createSignal('');
  const [password, setPassword] = createSignal('');
  const [error, setError] = createSignal('');

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    setError('');
    try {
      await login(username(), password());
      navigate('/applications');
    } catch (err: any) {
      setError(err.message || '登录失败');
    }
  };

  const handleDemoLogin = async (role: UserRole) => {
    setError('');
    try {
      await loginWithDemo(role);
      navigate('/applications');
    } catch (err: any) {
      setError(err.message || '登录失败');
    }
  };

  const demoCardStyle = (role: UserRole) => {
    const colors = {
      reimbursement_clerk: { bg: '#e6f7ff', border: '#91d5ff', color: '#1890ff' },
      expense_accountant: { bg: '#f9f0ff', border: '#d3adf7', color: '#722ed1' },
      finance_manager: { bg: '#f6ffed', border: '#b7eb8f', color: '#52c41a' },
    };
    return colors[role];
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        'align-items': 'center',
        'justify-content': 'center',
        background: '#f5f7fa',
        padding: '24px',
      }}
    >
      <div
        style={{
          width: '480px',
          background: '#fff',
          'border-radius': '12px',
          padding: '40px',
          'box-shadow': '0 4px 20px rgba(0,0,0,0.08)',
        }}
      >
        <div style={{ 'text-align': 'center', marginBottom: '32px' }}>
          <div
            style={{
              'font-size': '28px',
              'font-weight': '700',
              color: '#1890ff',
              marginBottom: '8px',
            }}
          >
            费用报销管理系统
          </div>
          <div style={{ color: '#999', 'font-size': '14px' }}>
            Expense Reimbursement Management System
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div class="form-item">
            <label class="form-label">用户名</label>
            <input
              type="text"
              class="form-input"
              placeholder="请输入用户名"
              value={username()}
              onInput={(e) => setUsername(e.target.value)}
            />
          </div>
          <div class="form-item">
            <label class="form-label">密码</label>
            <input
              type="password"
              class="form-input"
              placeholder="请输入密码"
              value={password()}
              onInput={(e) => setPassword(e.target.value)}
            />
          </div>

          <Show when={error()}>
            <div
              style={{
                background: '#fff1f0',
                border: '1px solid #ffa39e',
                color: '#ff4d4f',
                padding: '8px 12px',
                'border-radius': '4px',
                'font-size': '13px',
                marginBottom: '16px',
              }}
            >
              {error()}
            </div>
          </Show>

          <button
            type="submit"
            class="btn btn-primary"
            disabled={isLoading()}
            style={{ width: '100%', height: '40px', 'font-size': '15px', marginBottom: '24px' }}
          >
            {isLoading() ? '登录中...' : '登录'}
          </button>
        </form>

        <div style={{ position: 'relative', marginBottom: '24px' }}>
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              background: '#fff',
              padding: '0 16px',
              color: '#999',
              'font-size': '12px',
            }}
          >
            快捷登录
          </div>
          <div style={{ borderTop: '1px solid #f0f0f0' }}></div>
        </div>

        <div style={{ display: 'grid', gap: '12px' }}>
          {DEMO_ACCOUNTS.map((account) => {
            const style = demoCardStyle(account.role);
            return (
              <button
                type="button"
                onClick={() => handleDemoLogin(account.role)}
                disabled={isLoading()}
                style={{
                  padding: '16px',
                  'border-radius': '8px',
                  border: `1px solid ${style.border}`,
                  background: style.bg,
                  color: style.color,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  display: 'flex',
                  'justify-content': 'space-between',
                  'align-items': 'center',
                  'font-family': 'inherit',
                  width: '100%',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                <div style={{ display: 'flex', 'align-items': 'center', gap: '12px' }}>
                  <div
                    style={{
                      width: '36px',
                      height: '36px',
                      'border-radius': '50%',
                      background: '#fff',
                      display: 'flex',
                      'align-items': 'center',
                      'justify-content': 'center',
                      'font-weight': '600',
                    }}
                  >
                    {account.name.charAt(0)}
                  </div>
                  <div style={{ 'text-align': 'left' }}>
                    <div style={{ 'font-weight': '600', 'font-size': '14px' }}>
                      {account.name}
                    </div>
                    <div style={{ 'font-size': '12px', opacity: 0.8 }}>
                      账号：{account.username} / {account.password}
                    </div>
                  </div>
                </div>
                <div
                  style={{
                    padding: '4px 12px',
                    'border-radius': '20px',
                    'font-size': '13px',
                    'font-weight': '500',
                    background: '#fff',
                  }}
                >
                  {ROLE_LABELS[account.role]}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default Login;
