import React, { useEffect, useState } from 'react';
import {
  DashboardOutlined,
  FileTextOutlined,
  FormOutlined,
  UserSwitchOutlined,
  PhoneOutlined,
  AuditOutlined,
  BarChartOutlined,
} from '@ant-design/icons';
import { getUser, getRoleMenuItems } from '../utils/auth';
import type { User } from '../../types';

const iconMap: Record<string, React.ReactNode> = {
  DashboardOutlined: <DashboardOutlined />,
  FileTextOutlined: <FileTextOutlined />,
  FormOutlined: <FormOutlined />,
  UserSwitchOutlined: <UserSwitchOutlined />,
  PhoneOutlined: <PhoneOutlined />,
  AuditOutlined: <AuditOutlined />,
  BarChartOutlined: <BarChartOutlined />,
};

const Sidebar: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [activeKey, setActiveKey] = useState('');

  useEffect(() => {
    const currentUser = getUser();
    setUser(currentUser);

    const pathname = window.location.pathname;
    if (pathname === '/dashboard') {
      setActiveKey('dashboard');
    } else if (pathname.startsWith('/cases')) {
      setActiveKey('cases');
    } else if (pathname.startsWith('/queue/registration')) {
      setActiveKey('queue-registration');
    } else if (pathname.startsWith('/queue/assignment')) {
      setActiveKey('queue-assignment');
    } else if (pathname.startsWith('/queue/followup')) {
      setActiveKey('queue-followup');
    } else if (pathname.startsWith('/queue/review')) {
      setActiveKey('queue-review');
    } else if (pathname.startsWith('/statistics')) {
      setActiveKey('statistics');
    }
  }, []);

  if (!user) {
    return null;
  }

  const menuItems = getRoleMenuItems(user.role);

  return (
    <aside className="sidebar">
      <div className="logo">
        法律服务管理系统
      </div>
      <nav className="menu">
        {menuItems.map((item) => (
          <a
            key={item.key}
            href={item.path}
            className={`menu-item ${activeKey === item.key ? 'active' : ''}`}
          >
            {iconMap[item.icon]}
            <span>{item.label}</span>
          </a>
        ))}
      </nav>
    </aside>
  );
};

export default Sidebar;
