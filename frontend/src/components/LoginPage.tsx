import React, { useState } from 'react';
import { api, type User, type DictItem } from '../lib/api';

interface Props {
  onLogin: (u: User) => void;
  dict: {
    roles: DictItem[];
    statuses: DictItem[];
  } | null;
}

const DEMO_USERS: { username: string; name: string; role: string }[] = [
  { username: 'clerk_wang', name: '王店员', role: 'store_clerk' },
  { username: 'clerk_li', name: '李店员', role: 'store_clerk' },
  { username: 'pharmacist_zhang', name: '张药师', role: 'pharmacist' },
  { username: 'pharmacist_chen', name: '陈药师', role: 'pharmacist' },
  { username: 'manager_zhao', name: '赵经理', role: 'area_manager' }
];

const LoginPage: React.FC<Props> = ({ onLogin }) => {
  const [username, setUsername] = useState('clerk_wang');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) { setError('请选择或输入账号'); return; }
    setSubmitting(true);
    setError('');
    const r = await api.login(username.trim());
    setSubmitting(false);
    if (r.code === 0 && r.data) {
      onLogin(r.data);
    } else {
      setError(r.message || '登录失败');
    }
  };

  const roleOf = (uname: string) => DEMO_USERS.find(u => u.username === uname)?.role || '';

  return (
    <div className="login-wrap">
      <div className="login-box">
        <h2>连锁药房处方订单系统</h2>
        <p className="subtitle">月底集中处理 · 异常拦截 · 审计追溯</p>
        <form onSubmit={handleSubmit}>
          <label>选择演示账号</label>
          <select value={username} onChange={e => setUsername(e.target.value)}>
            {DEMO_USERS.map(u => (
              <option key={u.username} value={u.username}>
                {u.name}（{u.role === 'store_clerk' ? '门店店员' : u.role === 'pharmacist' ? '执业药师' : '区域经理'}）
              </option>
            ))}
          </select>

          <label>用户名（可手动输入）</label>
          <input type="text" value={username} onChange={e => setUsername(e.target.value)} placeholder="请输入用户名" />

          {error && <div className="alert error" style={{ marginTop: 14 }}>{error}</div>}
          <button className="btn btn-login" disabled={submitting} type="submit">
            {submitting ? '登录中...' : '进入系统'}
          </button>
        </form>

        <div className="demo-accounts">
          <strong>演示账号说明：</strong><br />
          <b style={{ color: '#1e40af' }}>门店店员</b>（{roleOf('clerk_wang') === 'store_clerk' ? '建单' : ''}）：clerk_wang / clerk_li<br />
          <b style={{ color: '#5b21b6' }}>执业药师</b>（推进 / 核验）：pharmacist_zhang / pharmacist_chen<br />
          <b style={{ color: '#9d174d' }}>区域经理</b>（复核 / 归档）：manager_zhao
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
