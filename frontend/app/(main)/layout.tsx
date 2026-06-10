'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { getUser, clearAuth, User } from '@/lib/api';
import Link from 'next/link';

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const u = getUser();
    if (!u) {
      router.push('/login');
    } else {
      setUser(u);
    }
  }, [router]);

  const handleLogout = () => {
    clearAuth();
    router.push('/login');
  };

  if (!mounted || !user) {
    return <div style={{ padding: '40px', textAlign: 'center' }}>加载中...</div>;
  }

  const menuItems = getMenuItems(user.role);

  return (
    <div>
      <div className="navbar">
        <div className="navbar-brand">🏦 银行网点 · 月底集中处理开户申请</div>
        <div className="navbar-user">
          <span className="role-badge">{user.role}</span>
          <span>{user.real_name}</span>
          <span style={{ fontSize: '12px', opacity: 0.8 }}>{user.branch}</span>
          <button onClick={handleLogout}>退出</button>
        </div>
      </div>
      <div className="sidebar-layout">
        <div className="sidebar">
          {menuItems.map((item) => (
            <Link
              key={item.path}
              href={item.path}
              className={`sidebar-menu-item ${
                pathname === item.path || pathname?.startsWith(item.path + '/') ? 'active' : ''
              }`}
            >
              {item.icon} {item.label}
            </Link>
          ))}
          <div style={{ padding: '16px 20px', borderTop: '1px solid #e2e8f0', marginTop: '16px' }}>
            <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '8px' }}>演示账号</div>
            <Link href="/login" className="btn btn-sm" style={{ fontSize: '12px', width: '100%' }}>
              切换角色登录
            </Link>
          </div>
        </div>
        <div className="main-content">{children}</div>
      </div>
    </div>
  );
}

function getMenuItems(role: string) {
  const items = [
    { path: '/dashboard', label: '工作台', icon: '📊' },
    { path: '/applications', label: '开户申请列表', icon: '📋' },
    { path: '/applications/overdue', label: '到期预警', icon: '⏰' },
  ];
  if (role === '运营主管' || role === '支行行长') {
    items.push({ path: '/batch', label: '批量处理', icon: '📦' });
  }
  return items;
}
