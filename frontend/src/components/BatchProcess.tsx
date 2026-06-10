import React, { useState } from 'react';
import { Modal, Table, Tag, message } from 'antd';
import { CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
import { batchProcess } from '../api/application';
import { getUserInfo } from '../constants';
import type { BatchResult, Role } from '../types';

interface BatchProcessProps {
  selectedIds: string[];
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const BatchProcess: React.FC<BatchProcessProps> = ({ selectedIds, open, onClose, onSuccess }) => {
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [results, setResults] = useState<BatchResult[]>([]);
  const [resultOpen, setResultOpen] = useState(false);

  const userInfo = getUserInfo();
  const currentRole = userInfo.role as Role;

  const getAction = (): string => {
    switch (currentRole) {
      case 'lease_clerk': return 'correct';
      case 'maintenance_coordinator': return 'verify_pass';
      case 'store_manager': return 'confirm';
      default: return 'correct';
    }
  };

  const handleConfirm = async () => {
    setConfirmLoading(true);
    try {
      const res = await batchProcess({
        application_ids: selectedIds,
        action: getAction(),
      });
      setResults(res);
      setResultOpen(true);
      onClose();
      onSuccess();
    } catch {
      message.error('批量操作失败');
    } finally {
      setConfirmLoading(false);
    }
  };

  const successCount = results.filter((r) => r.success).length;
  const failCount = results.filter((r) => !r.success).length;

  return (
    <>
      <Modal
        title="批量处理确认"
        open={open}
        onOk={handleConfirm}
        onCancel={onClose}
        confirmLoading={confirmLoading}
      >
        <p>确定对选中的 <strong>{selectedIds.length}</strong> 条申请执行批量操作吗？</p>
      </Modal>

      <Modal
        title="批量处理结果"
        open={resultOpen}
        onOk={() => setResultOpen(false)}
        onCancel={() => setResultOpen(false)}
        width={700}
        footer={null}
      >
        <div style={{ marginBottom: 16 }}>
          <Tag color="green" icon={<CheckCircleOutlined />}>成功 {successCount} 条</Tag>
          <Tag color="red" icon={<CloseCircleOutlined />}>失败 {failCount} 条</Tag>
        </div>
        <Table
          rowKey="application_id"
          dataSource={results}
          pagination={false}
          size="small"
          columns={[
            { title: '申请编号', dataIndex: 'application_no', key: 'application_no' },
            {
              title: '结果',
              dataIndex: 'success',
              key: 'success',
              width: 80,
              render: (v: boolean) =>
                v ? (
                  <Tag color="green" icon={<CheckCircleOutlined />}>成功</Tag>
                ) : (
                  <Tag color="red" icon={<CloseCircleOutlined />}>失败</Tag>
                ),
            },
            {
              title: '原因',
              dataIndex: 'reason',
              key: 'reason',
              render: (v: string) => v || '-',
            },
          ]}
        />
      </Modal>
    </>
  );
};

export default BatchProcess;
