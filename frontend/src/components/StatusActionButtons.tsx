import React, { useState } from 'react';
import { Button, Space, Popconfirm, message, Tooltip } from 'antd';
import { 
  SendOutlined, 
  EditOutlined, 
  SaveOutlined,
  RollbackOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  AuditOutlined,
  TeamOutlined,
  PhoneOutlined,
  FolderOutlined
} from '@ant-design/icons';
import { caseApi } from '../utils/api';
import { STATUS_BUTTONS } from '../utils/constants';
import { useAuth } from '../contexts/AuthContext';
import type { LegalCase, UserRole } from '../../types';

interface StatusActionButtonsProps {
  caseItem: LegalCase;
  mode?: 'view' | 'edit';
  hasUnsavedChanges?: boolean;
  onSave?: () => Promise<void>;
  onActionSuccess?: () => void;
  onEditClick?: () => void;
  onCancel?: () => void;
}

const ACTION_ICON_MAP: Record<string, React.ReactNode> = {
  submit: <SendOutlined />,
  resubmit: <SendOutlined />,
  review: <AuditOutlined />,
  assign: <TeamOutlined />,
  start_followup: <PhoneOutlined />,
  complete: <CheckCircleOutlined />,
  archive: <FolderOutlined />,
  return: <RollbackOutlined />,
};

export default function StatusActionButtons({
  caseItem,
  mode = 'view',
  hasUnsavedChanges = false,
  onSave,
  onActionSuccess,
  onEditClick,
  onCancel,
}: StatusActionButtonsProps) {
  const [loading, setLoading] = useState<string | null>(null);
  const { user } = useAuth();

  const handleAction = async (action: string, buttonLabel: string) => {
    setLoading(action);
    try {
      if (action === 'save' && onSave) {
        await onSave();
        message.success('保存成功');
      } else {
        await caseApi.action(caseItem.id, { action, version: caseItem.version });
        message.success(`${buttonLabel}成功`);
      }
      onActionSuccess?.();
    } catch (error: any) {
      message.error(error.message || error.response?.data?.message || `${buttonLabel}失败`);
    } finally {
      setLoading(null);
    }
  };

  const currentRole = user?.role as UserRole | undefined;
  const availableButtons = STATUS_BUTTONS.filter(btn => {
    if (btn.status !== caseItem.status) return false;
    if (btn.roles && currentRole && !btn.roles.includes(currentRole)) return false;
    return true;
  });

  const isEditable = ['draft', 'pending_submit', 'returned'].includes(caseItem.status);

  if (mode === 'edit') {
    return (
      <Space>
        <Button
          onClick={onCancel}
          icon={<RollbackOutlined />}
          disabled={loading !== null}
        >
          取消
        </Button>
        <Button
          loading={loading === 'save'}
          onClick={() => handleAction('save', '保存')}
          icon={<SaveOutlined />}
          type="primary"
        >
          保存
        </Button>
        {caseItem.status === 'pending_submit' && (
          <Popconfirm
            title="确定提交该案件吗？"
            onConfirm={() => handleAction('submit', '提交')}
            okText="确定"
            cancelText="取消"
            disabled={loading !== null}
          >
            <Button
              loading={loading === 'submit'}
              icon={<SendOutlined />}
              type="primary"
              disabled={hasUnsavedChanges}
            >
              <Tooltip title={hasUnsavedChanges ? '请先保存修改后再提交' : ''}>
                提交
              </Tooltip>
            </Button>
          </Popconfirm>
        )}
        {caseItem.status === 'returned' && (
          <Popconfirm
            title="确定重新提交该案件吗？"
            onConfirm={() => handleAction('resubmit', '重新提交')}
            okText="确定"
            cancelText="取消"
            disabled={loading !== null}
          >
            <Button
              loading={loading === 'resubmit'}
              icon={<SendOutlined />}
              type="primary"
              disabled={hasUnsavedChanges}
            >
              <Tooltip title={hasUnsavedChanges ? '请先保存修改后再提交' : ''}>
                重新提交
              </Tooltip>
            </Button>
          </Popconfirm>
        )}
      </Space>
    );
  }

  return (
    <Space>
      {isEditable && onEditClick && (
        <Button
          icon={<EditOutlined />}
          onClick={onEditClick}
        >
          编辑
        </Button>
      )}
      {availableButtons.map(btn => (
        <Popconfirm
          key={btn.action}
          title={`确定${btn.label}该案件吗？`}
          onConfirm={() => handleAction(btn.action, btn.label)}
          okText="确定"
          cancelText="取消"
          disabled={loading !== null}
        >
          <Button
            type={btn.type}
            loading={loading === btn.action}
            icon={ACTION_ICON_MAP[btn.action]}
            danger={btn.action === 'return'}
          >
            {btn.label}
          </Button>
        </Popconfirm>
      ))}
      {availableButtons.length === 0 && !isEditable && (
        <Tooltip title="当前状态下无可操作按钮">
          <Button icon={<CheckCircleOutlined />} type="text" disabled>
            已处理
          </Button>
        </Tooltip>
      )}
    </Space>
  );
}
