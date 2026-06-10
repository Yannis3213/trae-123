import React, { useState, useMemo } from 'react';
import { Modal, Table, Tag, message, Space, Radio } from 'antd';
import { CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
import { batchProcess } from '../api/application';
import { getUserInfo, STATUS_LABELS, STATUS_COLORS, ACTION_LABELS } from '../constants';
import type { BatchResult, Role, Application } from '../types';

interface BatchProcessProps {
  selectedIds: string[];
  selectedRecords: Application[];
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const BatchProcess: React.FC<BatchProcessProps> = ({ selectedIds, selectedRecords, open, onClose, onSuccess }) => {
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [results, setResults] = useState<BatchResult[]>([]);
  const [resultOpen, setResultOpen] = useState(false);
  const [action, setAction] = useState<string>('');

  const userInfo = getUserInfo();
  const currentRole = userInfo.role as Role;

  const availableActions = useMemo(() => {
    switch (currentRole) {
      case 'lease_clerk':
        return [{ value: 'correct', label: ACTION_LABELS.correct }];
      case 'maintenance_coordinator':
        return [
          { value: 'verify_pass', label: ACTION_LABELS.verify_pass },
          { value: 'verify_fail', label: ACTION_LABELS.verify_fail },
        ];
      case 'store_manager':
        return [{ value: 'confirm', label: ACTION_LABELS.confirm }];
      default:
        return [];
    }
  }, [currentRole]);

  React.useEffect(() => {
    if (open && availableActions.length > 0 && !action) {
      setAction(availableActions[0].value);
    }
  }, [open, availableActions, action]);

  const handleConfirm = async () => {
    if (!action) {
      message.warning('请选择操作类型');
      return;
    }
    setConfirmLoading(true);
    try {
      const res = await batchProcess({
        application_ids: selectedIds,
        action,
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

  const previewColumns = [
    { title: '申请编号', dataIndex: 'application_no', key: 'application_no', width: 140 },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (v: string) => <Tag color={STATUS_COLORS[v as keyof typeof STATUS_COLORS]}>{STATUS_LABELS[v as keyof typeof STATUS_LABELS] || v}</Tag>,
    },
    {
      title: '版本',
      dataIndex: 'version',
      key: 'version',
      width: 80,
      render: (v: number) => `v${v}`,
    },
    {
      title: '已确认',
      dataIndex: 'confirmed',
      key: 'confirmed',
      width: 80,
      render: (v: boolean) => v ? <Tag color="green">是</Tag> : <Tag>否</Tag>,
    },
  ];

  const resultColumns = [
    { title: '申请编号', dataIndex: 'application_no', key: 'application_no', width: 140 },
    {
      title: '结果',
      dataIndex: 'success',
      key: 'success',
      width: 100,
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
  ];

  return (
    <>
      <Modal
        title={`批量处理（${selectedIds.length} 条）`}
        open={open}
        onOk={handleConfirm}
        onCancel={() => { onClose(); setAction(''); }}
        confirmLoading={confirmLoading}
        width={600}
        okText="执行批量操作"
      >
        <Space direction="vertical" style={{ width: '100%' }} size={16}>
          <div>
            <div style={{ marginBottom: 8 }}>选择操作类型：</div>
            <Radio.Group value={action} onChange={(e) => setAction(e.target.value)}>
              {availableActions.map((a) => (
                <Radio.Button key={a.value} value={a.value}>{a.label}</Radio.Button>
              ))}
            </Radio.Group>
          </div>
          <div>
            <div style={{ marginBottom: 8 }}>申请预览：</div>
            <Table
              rowKey="id"
              dataSource={selectedRecords}
              columns={previewColumns}
              pagination={false}
              size="small"
              scroll={{ y: 200 }}
            />
          </div>
          <div style={{ color: '#666', fontSize: 12 }}>
            提示：批量操作将逐条校验，失败的申请会给出具体原因，不影响其他申请的处理。
          </div>
        </Space>
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
          columns={resultColumns}
          scroll={{ y: 400 }}
        />
      </Modal>
    </>
  );
};

export default BatchProcess;
