import { createSignal, Show } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/utils';
import type { Role } from '@/types';
import { RoleLabel } from '@/types';

const demoAccounts = [
  { role: 'doctor' as Role, username: 'doctor1', password: '123456', label: '口腔医生' },
  { role: 'consultant' as Role, username: 'consultant1', password: '123456', label: '前台顾问' },
  { role: 'dean' as Role, username: 'dean1', password: '123456', label: '门店院长' },
];

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const { toast, show } = useToast();
  const [role, setRole] = useState<Role>('doctor');
  const [username, setUsername] = useState('doctor1');
  const [password, setPassword] = useState('123456');
  const [loading, setLoading] = useState(false);

  const handleRoleChange = (e: Event) => {
    const v = (e.target as HTMLSelectElement).value as Role;
    setRole(v);
    const acc = demoAccounts.find((a) => a.role === v);
    if (acc) {
      setUsername(acc.username);
      setPassword(acc.password);
    }
  };

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    if (!username || !password) {
      show('error', '请输入账号和密码');
      return;
    }
    setLoading(true);
    try {
      await login(role, username, password);
      show('success', '登录成功');
      setTimeout(() => navigate('/plans'), 300);
    } catch (err: any) {
      show('error', err.message || '登录失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        width: '100%',
        height: '100vh',
        display: 'flex',
        align: 'center',
        'justify-content': 'center',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      }}
    >
      <div
        style={{
          background: '#fff',
          padding: '40px 48px',
          'border-radius': '12px',
          width: '420px',
          'box-shadow': '0 10px 40px rgba(0,0,0,0.15)',
        }}
      >
        <h1
          style={{
            'text-align': 'center',
            'font-size': '20px',
            color: '#333',
            'margin-bottom': '8px',
          }}
        >
          口腔连锁门诊
        </h1>
        <h2
          style={{
            'text-align': 'center',
            'font-size': '16px',
            color: '#666',
            'margin-bottom': '32px',
            'font-weight': 'normal',
          }}
        >
          月底集中处理治疗计划单系统
        </h2>
        <form onSubmit={handleSubmit}>
          <div class="form-item">
            <label class="form-label">选择角色</label>
            <select
              class="form-select"
              value={role}
              onChange={handleRoleChange}
            >
              {Object.entries(RoleLabel).map(([k, v]) => (
                <option value={k}>{v}</option>
              ))}
            </select>
          </div>
          <div class="form-item">
            <label class="form-label">账号</label>
            <input
              class="form-input"
              type="text"
              value={username}
              onInput={(e) => setUsername((e.target as HTMLInputElement).value)}
              placeholder="请输入账号"
            />
          </div>
          <div class="form-item">
            <label class="form-label">密码</label>
            <input
              class="form-input"
              type="password"
              value={password}
              onInput={(e) => setPassword((e.target as HTMLInputElement).value)}
              placeholder="请输入密码"
            />
          </div>
          <button
            type="submit"
            class="btn btn-primary"
            style={{ width: '100%', height: '42px', 'margin-top': '8px' }}
            disabled={loading()}
          >
            {loading() ? '登录中...' : '登 录'}
          </button>
        </form>

        <div
          style={{
            'margin-top': '24px',
            padding: '12px',
            background: '#f5f7fa',
            'border-radius': '6px',
            'font-size': '12px',
            color: '#666',
          }}
        >
          <div style={{ 'font-weight': '600', 'margin-bottom': '8px' }}>
            演示账号：
          </div>
          {demoAccounts.map((acc) => (
            <div style={{ 'margin-bottom': '4px' }}>
              {acc.label}：{acc.username} / {acc.password}
            </div>
          ))}
        </div>
      </div>

      <Show when={toast()}>
        <div class={`toast toast-${toast()!.type}`}>{toast()!.message}</div>
      </Show>
    </div>
  );
}
