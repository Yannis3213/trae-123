import React, { useState, useEffect } from 'react';
import { getUser, clearUser, ROLE_LABELS } from '../lib/auth';

export default function AppShell({ children }) {
  const [user, setUserState] = useState(null);
  const [activeNav, setActiveNav] = useState('');

  useEffect(() => {
    const u = getUser();
    if (!u) {
      window.location.href = '/login';
      return;
    }
    setUserState(u);
    const path = window.location.pathname;
    if (path.includes('/records')) setActiveNav('records');
    else setActiveNav('visits');
  }, []);

  const handleLogout = () => {
    clearUser();
    window.location.href = '/login';
  };

  if (!user) return null;

  const navItems = [
    { key: 'visits', label: '📋 就诊单管理', href: '/' },
    { key: 'records', label: '📝 处理记录', href: '/records' }
  ];

  return (
    <div className="app">
      <div className="topbar">
        <h1>🐾 宠物医院 - 月底集中处理宠物就诊单系统</h1>
        <div className="topbar-right">
          <span>👤 {user.name}</span>
          <span className="role-badge">{ROLE_LABELS[user.role]}</span>
          <button className="logout-btn" onClick={handleLogout}>退出登录</button>
        </div>
      </div>
      <div className="main">
        <div className="sidebar">
          {navItems.map(item => (
            <a
              key={item.key}
              href={item.href}
              className={activeNav === item.key ? 'active' : ''}
              onClick={(e) => {
                e.preventDefault();
                setActiveNav(item.key);
                window.history.pushState({}, '', item.href);
                window.location.reload();
              }}
            >
              {item.label}
            </a>
          ))}
        </div>
        <div className="content">{children}</div>
      </div>
    </div>
  );
}
