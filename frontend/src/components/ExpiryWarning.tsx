import React, { useEffect, useState, useCallback } from 'react';
import { Tabs, Table, Tag, Button, Modal, message } from 'antd';
import { CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { getExpiryWarnings, batchProcess } from '../api/application';
import { STATUS_LABELS, STATUS_COLORS, ROLE_LABELS } from '../constants';
import type { Application, ExpiryStatus, BatchResult, BatchProcessResultData } from '../types';

const TAB_CONFIG: { key: ExpiryStatus; label: string; color: string }[] = [
  { key: 'normal', label: '正常', color: 'green' },
  { key: 'expiring_soon', label: '临期', color: 'orange' },
  { key: 'overdue', label: '逾期', color: 'red' },
];

interface ExpiryWarningProps {
  onRefresh?: () => void;
}

const ExpiryWarning: React.FC<ExpiryWarningProps> = ({ onRefresh }) => {
  const [activeTab, setActiveTab] = useState<ExpiryStatus>('normal');
  const [data, setData] = useState<Application[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [resultOpen, setResultOpen] = useState(false);
  const [results, setResults] = useState<BatchResult[]>([]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getExpiryWarnings({ expiry_status: activeTab });
      setData(res || []);
      setTotal((res || []).length);
    } catch {
      setData([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    setPage(1);
    setSelectedRowKeys([]);
  }, [activeTab]);

  const handleBatchPush = async () => {
    if (selectedRowKeys.length === 0) return;
    try {
      const items = data
        .filter((r) => selectedRowKeys.includes(r.id as React.Key))
        .map((r) => ({ id: r.id, version: r.version }));
      const res: BatchProcessResultData = await batchProcess({
        application_items: items,
        action: 'verify_pass',
      });
      setResults(res?.results || []);
      setResultOpen(true);
      setSelectedRowKeys([]);
      fetchData();
      onRefresh?.();
    } catch {
      message.error('批量推进失败');
    }
  };

  const columns = [
    { title: '申请编号', dataIndex: 'application_no', key: 'application_no', width: 150 },
    { title: '租客姓名', dataIndex: 'tenant_name', key: 'tenant_name', width: 100 },
    { title: '房间号', dataIndex: 'room_number', key: 'room_number', width: 100 },
    { title: '楼栋', dataIndex: 'building_name', key: 'building_name', width: 120 },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => <Tag color={STATUS_COLORS[status]}>{STATUS_LABELS[status]}</Tag>,
    },
    { title: '签约结束日期', dataIndex: 'lease_end_date', key: 'lease_end_date', width: 130 },
    {
      title: '逾期天数',
      dataIndex: 'overdue_days',
      key: 'overdue_days',
      width: 100,
      render: (v: number) => v > 0 ? <span style={{ color: 'red' }}>{v}天</span> : '-',
    },
    {
      title: '当前处理人',
      key: 'handler',
      width: 150,
      render: (_: unknown, record: Application) =>
        `${record.current_handler_name}（${ROLE_LABELS[record.current_handler_role] || record.current_handler_role}）`,
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 170,
      render: (v: string) => dayjs(v).format('YYYY-MM-DD HH:mm:ss'),
    },
  ];

  const successCount = results.filter((r) => r.success).length;
  const failCount = results.filter((r) => !r.success).length;

  return (
    <div>
      <Tabs
        activeKey={activeTab}
        onChange={(key) => setActiveTab(key as ExpiryStatus)}
        items={TAB_CONFIG.map((tab) => ({
          key: tab.key,
          label: <span style={{ color: tab.color, fontWeight: 500 }}>{tab.label}</span>,
        }))}
      />

      {activeTab === 'overdue' && selectedRowKeys.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <Button type="primary" onClick={handleBatchPush}>
            批量推进（已选 {selectedRowKeys.length} 条）
          </Button>
        </div>
      )}

      <Table
        rowKey="id"
        columns={columns}
        dataSource={data}
        loading={loading}
        rowSelection={
          activeTab === 'overdue'
            ? { selectedRowKeys, onChange: setSelectedRowKeys }
            : undefined
        }
        pagination={{
          current: page,
          pageSize: 10,
          total,
          showTotal: (t) => `共 ${t} 条`,
          onChange: (p) => setPage(p),
        }}
        scroll={{ x: 1100 }}
      />

      <Modal
        title="批量推进结果"
        open={resultOpen}
        onCancel={() => setResultOpen(false)}
        footer={null}
        width={700}
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
                v ? <Tag color="green" icon={<CheckCircleOutlined />}>成功</Tag> : <Tag color="red" icon={<CloseCircleOutlined />}>失败</Tag>,
            },
            { title: '原因', dataIndex: 'reason', key: 'reason', render: (v: string) => v || '-' },
          ]}
        />
      </Modal>
    </div>
  );
};

export default ExpiryWarning;
