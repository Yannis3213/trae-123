import React from 'react';
import { Button, Space, Tag } from 'antd';
import { UserSwitchOutlined } from '@ant-design/icons';
import { ROLE_LABELS, getUserInfo, setUserInfo } from '../constants';
import type { Role } from '../types';

const ROLE_USER_MAP: Record<Role, { userId: string; userName: string }> = {
  lease_clerk: { userId: 'user_001', userName: '张租赁' },
  maintenance_coordinator: { userId: 'user_002', userName: '李维修' },
  store_manager: { userId: 'user_003', userName: '王经理' },
};

interface RoleSwitcherProps {
  onRoleChange?: (role: Role) => void;
}

const RoleSwitcher: React.FC<RoleSwitcherProps> = ({ onRoleChange }) => {
  const userInfo = getUserInfo();
  const currentRole = userInfo.role as Role;

  const handleSwitch = (role: Role) => {
    const mapping = ROLE_USER_MAP[role];
    setUserInfo({ role, userId: mapping.userId, userName: mapping.userName });
    onRoleChange?.(role);
  };

  return (
    <Space size="middle" style={{ display: 'flex', alignItems: 'center' }}>
      <UserSwitchOutlined style={{ fontSize: 18 }} />
      <span>当前角色：</span>
      {(Object.keys(ROLE_LABELS) as Role[]).map((role) => (
        <Button
          key={role}
          type={currentRole === role ? 'primary' : 'default'}
          size="small"
          onClick={() => handleSwitch(role)}
        >
          {ROLE_LABELS[role]}
        </Button>
      ))}
      <Tag color="blue">
        {userInfo.userName} ({ROLE_LABELS[currentRole]})
      </Tag>
    </Space>
  );
};

export default RoleSwitcher;
