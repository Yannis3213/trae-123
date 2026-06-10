'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { api, setCurrentUserId, getCurrentUserId } from '../lib/api';
import type { User } from '../lib/types';

export default function HeaderBar() {
  const pathname = usePathname();
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userId, setUserId] = useState<string>(getCurrentUserId());

  const loadUser = async () => {
    const me = await api.me();
    if (me.ok && me.data) setCurrentUser(me.data);
  };

  useEffect(() => {
    api.listUsers().then(r => {
      if (r.ok && r.data) {
        setUsers(r.data);
        const chosen = r.data.find(u => u.id === getCurrentUserId()) || r.data[0];
        if (chosen) {
          setCurrentUserId(chosen.id);
          setUserId(chosen.id);
        }
      }
    });
    loadUser();
  }, []);

  const handleSwitch = (id: string) => {
    setCurrentUserId(id);
    setUserId(id);
    // ====== 关键修复：派发全局事件通知所有页面刷新 ======
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('hotel:user-switched', { detail: { userId: id } }));
    }
    setTimeout(() => {
      loadUser();
      router.refresh();
    }, 30);
  };

  const isHome = pathname === '/';
  const isNew = pathname === '/new';
  const isBatch = pathname === '/batch';

  return (
    <header className="app-header">
      <div>
        <div className="app-title">🏨 酒店集团-月底集中处理住客订单系统</div>
        <div className="app-sub">
          <nav style={{ display: 'inline-flex', gap: 16, marginTop: 2 }}>
            <Link href="/" style={{ color: isHome ? '#fff' : 'rgba(255,255,255,0.75)', textDecoration: isHome ? 'underline' : 'none' }}>
              住客订单列表
            </Link>
            <Link href="/new" style={{ color: isNew ? '#fff' : 'rgba(255,255,255,0.75)', textDecoration: isNew ? 'underline' : 'none' }}>
              + 住客订单登记
            </Link>
            <Link href="/batch" style={{ color: isBatch ? '#fff' : 'rgba(255,255,255,0.75)', textDecoration: isBatch ? 'underline' : 'none' }}>
              批量处理 / 到期预警
            </Link>
          </nav>
        </div>
      </div>
      <div className="user-bar">
        <select
          className="role-select"
          value={userId}
          onChange={e => handleSwitch(e.target.value)}
          title="切换当前登录角色（前端演示用）"
        >
          {users.map(u => (
            <option key={u.id} value={u.id}>
              {u.role_label} - {u.display_name}
            </option>
          ))}
        </select>
        {currentUser && (
          <div className="user-display">
            👤 {currentUser.display_name}
            <span style={{ opacity: 0.7, marginLeft: 6 }}>[{currentUser.role_label}]</span>
          </div>
        )}
      </div>
    </header>
  );
}
