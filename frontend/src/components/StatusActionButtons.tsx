import React, { useState } from 'react';
import { Button, Space, Popconfirm, message, Tooltip } from 'antd';
import { 
  SendOutlined, 
  EditOutlined, 
  SaveOutlined,
  RollbackOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined
} from '@ant-design/icons';
import { caseApi } from '../utils/api';
import { STATUS_BUTTONS } from '../utils/constants';
import type { LegalCase } from '../../types';

interface StatusActionButtonsProps {
  caseItem: LegalCase;
  mode?: 'view' | 'edit';
  hasUnsavedChanges?: boolean;
  onSave?: () => Promise<void>;
  onActionSuccess?: () => void;
  onEditClick?: () => void;
  onCancel?: () => void;
}

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

  const handleAction = async (action: string, buttonLabel: string) => {
    setLoading(action);
    try {
      if (action === 'save' && onSave) {
        await onSave();
        message.success('保存成功');
      } else {
        await caseApi.action(caseItem.id, { 
          action, 
          version: caseItem.version 
        });
        message.success(`${buttonLabel}成功`);
      }
      onActionSuccess?.();
    } catch (error: any) {
      message.error(error.response?.data?.message || `${buttonLabel}失败`);
    } finally {
      setLoading(null);
    }
  };

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
      {STATUS_BUTTONS.filter(btn => btn.status === caseItem.status).map(btn => (
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
            icon={btn.action === 'submit' || btn.action === 'resubmit' ? <SendOutlined /> : undefined}
          >
            {btn.label}
          </Button>
        </Popconfirm>
      ))}
      {!isEditable && !STATUS_BUTTONS.some(btn => btn.status === caseItem.status) && (
        <Tooltip title="当前状态下无可操作按钮">
          <Button icon={<CheckCircleOutlined />} type="text" disabled>
            已处理
          </Button>
        </Tooltip>
      )}
    </Space>
  );
}
