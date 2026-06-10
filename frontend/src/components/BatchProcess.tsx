import React, { useState, useMemo } from 'react';
import { Modal, Table, Tag, message, Space, Radio, Input, Alert, Tooltip } from 'antd';
import { CheckCircleOutlined, CloseCircleOutlined, ExclamationCircleOutlined, VersionOutlined } from '@ant-design/icons';
import { batchProcess } from '../api/application';
import type { BatchProcessResultData } from '../api/application';
import { getUserInfo, STATUS_LABELS, STATUS_COLORS, ACTION_LABELS, ROLE_LABELS } from '../constants';
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
  const [resultData, setResultData] = useState<BatchProcessResultData | null>(null);
  const [resultOpen, setResultOpen] = useState(false);
  const [action, setAction] = useState<string>('');
  const [exceptionReason, setExceptionReason] = useState('');
  const [remark, setRemark] = useState('');

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
    if (!open) {
      setExceptionReason('');
      setRemark('');
    }
  }, [open, availableActions, action]);

  const stats = useMemo(() => {
    const withoutAttachment = selectedRecords.filter((r) => action === 'verify_pass' && (!r.attachments || r.attachments.length === 0)).length;
    const alreadyConfirmed = selectedRecords.filter((r) => action === 'confirm' && r.confirmed).length;
    const unmatchedRole = selectedRecords.filter((r) => {
      const expected = mapActionToExpectedRole(action);
      return expected && r.current_handler_role && r.current_handler_role !== expected;
    }).length;
    return { withoutAttachment, alreadyConfirmed, unmatchedRole };
  }, [selectedRecords, action]);

  const mapActionToExpectedRole = (act: string): Role | '' => {
    switch (act) {
      case 'correct': return 'lease_clerk';
      case 'verify_pass':
      case 'verify_fail': return 'maintenance_coordinator';
      case 'confirm': return 'store_manager';
      default: return '';
    }
  };

  const handleConfirm = async () => {
    if (!action) {
      message.warning('请选择操作类型');
      return;
    }
    if (action === 'verify_fail' && !exceptionReason.trim()) {
      message.warning('请填写批量异常原因');
      return;
    }
    setConfirmLoading(true);
    try {
      const application_items = selectedRecords.map((r) => ({ id: r.id, version: r.version }));
      const data: Parameters<typeof batchProcess>[0] = {
        application_items,
        action,
      };
      if (remark.trim()) data.remark = remark.trim();
      if (exceptionReason.trim()) data.exception_reason = exceptionReason.trim();
      const res = await batchProcess(data);
      setResultData(res);
      setResultOpen(true);
      onClose();
      onSuccess();
    } catch {
      message.error('批量操作失败');
    } finally {
      setConfirmLoading(false);
    }
  };

  const results: BatchResult[] = resultData?.results || [];
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
      title: '处理人',
      dataIndex: 'current_handler_name',
      key: 'handler',
      width: 140,
      render: (_v: string, r: Application) => {
        const name = r.current_handler_name;
        const role = r.current_handler_role;
        const mine = r.current_handler_id === userInfo.userId;
        if (!name && !role) return '-';
        return (
          <Space direction="vertical" size={0}>
            <span>{name || '-'}</span>
            <span style={{ fontSize: 12, color: '#888' }}>
              {role ? ROLE_LABELS[role] || role : ''}
              {mine && ' · 您负责'}
            </span>
          </Space>
        );
      },
    },
    {
      title: (
        <Space>
          <VersionOutlined />
          版本
        </Space>
      ),
      dataIndex: 'version',
      key: 'version',
      width: 80,
      render: (v: number, r: Application) => (
        <Tooltip title={`提交携带版本 v${v}，后端按此版本做乐观锁`}>
          <Tag color="blue">v{v}</Tag>
        </Tooltip>
      ),
    },
    {
      title: '附件',
      key: 'attachment',
      width: 80,
      render: (_v: unknown, r: Application) => {
        const count = r.attachments?.length || 0;
        if (action === 'verify_pass' && count === 0) {
          return <Tag color="orange" icon={<ExclamationCircleOutlined />}>无</Tag>;
        }
        return <Tag color={count > 0 ? 'green' : 'default'}>{count}份</Tag>;
      },
    },
    {
      title: '已确认',
      dataIndex: 'confirmed',
      key: 'confirmed',
      width: 80,
      render: (v: boolean) => v
        ? <Tag color="green" icon={<CheckCircleOutlined />}>是</Tag>
        : <Tag>否</Tag>,
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
        title={
          <Space>
            <span>批量处理</span>
            <Tag>{selectedIds.length} 条</Tag>
            <Tag color="blue">{ROLE_LABELS[currentRole]}</Tag>
          </Space>
        }
        open={open}
        onOk={handleConfirm}
        onCancel={() => { onClose(); setAction(''); setExceptionReason(''); setRemark(''); }}
        confirmLoading={confirmLoading}
        width={820}
        okText="执行批量操作"
      >
        <Space direction="vertical" style={{ width: '100%' }} size={12}>
          <Alert
            type="info"
            showIcon
            message="逐条提交并携带版本号"
            description={`每条申请独立携带当前版本号提交，后端按版本做乐观锁校验，成功/失败逐条记录，失败原因保存至 SQLite 批量失败明细表。`}
          />
          <div>
            <div style={{ marginBottom: 8 }}>选择操作类型：</div>
            <Radio.Group value={action} onChange={(e) => setAction(e.target.value)}>
              {availableActions.map((a) => (
                <Radio.Button key={a.value} value={a.value}>{a.label}</Radio.Button>
              ))}
            </Radio.Group>
          </div>
          {(stats.withoutAttachment > 0 || stats.alreadyConfirmed > 0 || stats.unmatchedRole > 0) && (
            <Alert
              type="warning"
              showIcon
              message="批量操作前注意"
              description={
                <ul style={{ margin: 0, paddingLeft: 18 }}>
                  {stats.withoutAttachment > 0 && <li>{stats.withoutAttachment} 条缺少核验证据附件，核验通过会拦截</li>}
                  {stats.alreadyConfirmed > 0 && <li>{stats.alreadyConfirmed} 条已由门店经理确认，再次确认会拦截</li>}
                  {stats.unmatchedRole > 0 && <li>{stats.unmatchedRole} 条处理角色不匹配，您无法操作</li>}
                </ul>
              }
            />
          )}
          {action === 'verify_fail' && (
            <div>
              <div style={{ marginBottom: 4, fontWeight: 500 }}>批量异常原因（必填）</div>
              <Input.TextArea
                rows={2}
                placeholder="例如：批量房间存在未处理维修项"
                value={exceptionReason}
                onChange={(e) => setExceptionReason(e.target.value)}
              />
            </div>
          )}
          <div>
            <div style={{ marginBottom: 4, fontWeight: 500 }}>备注（选填）</div>
            <Input.TextArea
              rows={2}
              placeholder="补充说明"
              value={remark}
              onChange={(e) => setRemark(e.target.value)}
            />
          </div>
          <div>
            <div style={{ marginBottom: 8 }}>申请预览（提交时逐条携带版本号）：</div>
            <Table
              rowKey="id"
              dataSource={selectedRecords}
              columns={previewColumns}
              pagination={false}
              size="small"
              scroll={{ y: 220 }}
            />
          </div>
          <div style={{ color: '#666', fontSize: 12 }}>
            提示：批量操作将逐条校验，失败的申请会给出具体原因，不影响其他申请的处理。所有失败记录会持久化到 SQLite。
          </div>
        </Space>
      </Modal>

      <Modal
        title={
          <Space>
            <span>批量处理结果</span>
            {resultData?.batch_id && <Tag color="default">批次号 {resultData.batch_id.slice(0, 12)}</Tag>}
            {resultData?.failures_saved && <Tag color="green">失败记录已保存</Tag>}
          </Space>
        }
        open={resultOpen}
        onOk={() => setResultOpen(false)}
        onCancel={() => setResultOpen(false)}
        width={780}
      >
        <div style={{ marginBottom: 16 }}>
          <Tag color="green" icon={<CheckCircleOutlined />}>成功 {successCount} 条</Tag>
          <Tag color="red" icon={<CloseCircleOutlined />}>失败 {failCount} 条</Tag>
          {resultData && <Tag style={{ marginLeft: 8 }}>共 {resultData.total} 条</Tag>}
        </div>
        <Table
          rowKey="application_id"
          dataSource={results}
          pagination={false}
          size="small"
          columns={resultColumns}
          scroll={{ y: 360 }}
        />
      </Modal>
    </>
  );
};

export default BatchProcess;
