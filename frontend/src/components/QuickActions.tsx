import React, { useEffect, useState } from 'react';
import {
  PlusOutlined,
  FormOutlined,
  UserSwitchOutlined,
  PhoneOutlined,
  AuditOutlined,
  FileSearchOutlined,
} from '@ant-design/icons';
import { getUser, getRoleMenuItems } from '../utils/auth';
import type { User } from '../../types';

const QuickActions: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    setUser(getUser());
  }, []);

  if (!user) {
    return null;
  }

  const allActions = [
    { key: 'create', label: '新建咨询单', path: '/cases/new', icon: <PlusOutlined />, roles: ['registrar', 'supervisor', 'director'] },
    { key: 'registration', label: '立案待办', path: '/queue/registration', icon: <FormOutlined />, roles: ['registrar', 'supervisor', 'director'] },
    { key: 'assignment', label: '分案待办', path: '/queue/assignment', icon: <UserSwitchOutlined />, roles: ['supervisor', 'director'] },
    { key: 'followup', label: '跟进待办', path: '/queue/followup', icon: <PhoneOutlined />, roles: ['assistant', 'lawyer', 'supervisor', 'director'] },
    { key: 'review', label: '审核待办', path: '/queue/review', icon: <AuditOutlined />, roles: ['reviewer', 'director'] },
    { key: 'statistics', label: '统计分析', path: '/statistics', icon: <FileSearchOutlined />, roles: ['supervisor', 'reviewer', 'director'] },
  ];

  const actions = allActions.filter(action => action.roles.includes(user.role));

  return (
    <div className="quick-actions">
      <h3>快捷操作</h3>
      <div className="action-grid">
        {actions.map((action) => (
          <a key={action.key} href={action.path} className="action-btn">
            {action.icon}
            <span>{action.label}</span>
          </a>
        ))}
      </div>
    </div>
  );
};

export default QuickActions;
