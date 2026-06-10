import React from 'react';
import { Modal, Radio, Button, Space } from 'antd';
import { useAuth } from '../contexts/AuthContext';
import type { Role } from '../types';

interface Props {
  open: boolean;
  onClose: () => void;
}

const ROLE_OPTIONS: { label: string; value: Role; desc: string }[] = [
  { label: '运营专员', value: 'ops_specialist', desc: '维护入口数据，提交商品刊登、库存同步、订单履约' },
  { label: '仓配主管', value: 'warehouse_manager', desc: '核对过程数据，审核/退回商品刊登和库存同步' },
  { label: '店铺负责人', value: 'shop_owner', desc: '确认最终结果，审核/退回订单履约' },
];

function RoleSwitcher({ open, onClose }: Props) {
  const { user, switchRole } = useAuth();
  const [selected, setSelected] = React.useState<Role>(user?.role || 'ops_specialist');

  React.useEffect(() => {
    if (open && user) {
      setSelected(user.role);
    }
  }, [open, user]);

  const handleConfirm = async () => {
    await switchRole(selected);
    onClose();
  };

  return (
    <Modal
      title="切换身份"
      open={open}
      onCancel={onClose}
      footer={
        <Space>
          <Button onClick={onClose}>取消</Button>
          <Button type="primary" onClick={handleConfirm}>
            确认切换
          </Button>
        </Space>
      }
    >
      <Radio.Group
        value={selected}
        onChange={(e) => setSelected(e.target.value)}
        style={{ width: '100%' }}
      >
        <Space direction="vertical" style={{ width: '100%' }}>
          {ROLE_OPTIONS.map((opt) => (
            <Radio
              key={opt.value}
              value={opt.value}
              style={{
                display: 'block',
                padding: '12px 16px',
                border: '1px solid #e8e8e8',
                borderRadius: 8,
                marginBottom: 8,
                height: 'auto',
                lineHeight: 1.5,
              }}
            >
              <div style={{ fontWeight: 600, color: '#262626' }}>{opt.label}</div>
              <div style={{ color: '#8c8c8c', fontSize: 13, marginTop: 4, marginLeft: 22 }}>
                {opt.desc}
              </div>
            </Radio>
          ))}
        </Space>
      </Radio.Group>
    </Modal>
  );
}

export default RoleSwitcher;
