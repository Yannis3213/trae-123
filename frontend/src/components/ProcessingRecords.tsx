import React, { useState, useEffect } from 'react';
import { Timeline, Card, Spin, message, Empty, Tag, Space } from 'antd';
import { 
  CheckCircleOutlined, 
  ClockCircleOutlined, 
  RollbackOutlined,
  SendOutlined,
  UserOutlined,
  EditOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { caseApi } from '../utils/api';
import { STATUS_MAP, STATUS_COLOR_MAP } from '../utils/constants';
import type { ProcessingRecord } from '../../types';

interface ProcessingRecordsProps {
  caseId: number;
}

const actionIconMap: Record<string, React.ReactNode> = {
  submit: <SendOutlined />,
  resubmit: <SendOutlined />,
  return: <RollbackOutlined />,
  complete: <CheckCircleOutlined />,
  create: <EditOutlined />,
  default: <ClockCircleOutlined />,
};

const actionColorMap: Record<string, string> = {
  submit: 'blue',
  resubmit: 'blue',
  return: 'red',
  complete: 'green',
  create: 'gray',
  default: 'gray',
};

export default function ProcessingRecords({ caseId }: ProcessingRecordsProps) {
  const [records, setRecords] = useState<ProcessingRecord[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (caseId) {
      fetchRecords();
    }
  }, [caseId]);

  const fetchRecords = async () => {
    setLoading(true);
    try {
      const result = await caseApi.getRecords(caseId);
      setRecords(result || []);
    } catch (error) {
      message.error('获取处理记录失败');
    } finally {
      setLoading(false);
    }
  };

  const getActionIcon = (action: string) => {
    return actionIconMap[action] || actionIconMap.default;
  };

  const getActionColor = (action: string) => {
    return actionColorMap[action] || actionColorMap.default;
  };

  const getStatusLabel = (status?: string | null) => {
    if (!status) return '-';
    return STATUS_MAP[status as keyof typeof STATUS_MAP] || status;
  };

  if (loading) {
    return (
      <Card title="处理记录">
        <div style={{ textAlign: 'center', padding: '20px 0' }}>
          <Spin />
        </div>
      </Card>
    );
  }

  return (
    <Card 
      title="处理记录" 
      extra={<span style={{ color: '#999' }}>共 {records.length} 条记录</span>}
    >
      {records.length === 0 ? (
        <Empty description="暂无处理记录" />
      ) : (
        <Timeline
          mode="left"
          items={records.map((record, index) => ({
            key: record.id,
            color: getActionColor(record.action),
            dot: getActionIcon(record.action),
            label: (
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontWeight: 500 }}>
                  {dayjs(record.created_at).format('YYYY-MM-DD')}
                </div>
                <div style={{ color: '#999', fontSize: 12 }}>
                  {dayjs(record.created_at).format('HH:mm:ss')}
                </div>
              </div>
            ),
            children: (
              <div style={{ paddingBottom: index === records.length - 1 ? 0 : 16 }}>
                <Space size={8} wrap>
                  <strong>{record.action}</strong>
                  {record.from_status && (
                    <span>
                      {getStatusLabel(record.from_status)} 
                      <span style={{ color: '#999', margin: '0 4px' }}>→</span> 
                      {getStatusLabel(record.to_status)}
                    </span>
                  )}
                </Space>
                <div style={{ marginTop: 4, color: '#666' }}>
                  <Space size={8}>
                    <UserOutlined />
                    <span>{record.operator_name || '系统'}</span>
                  </Space>
                </div>
                {record.remark && (
                  <div style={{ 
                    marginTop: 8, 
                    padding: 8, 
                    background: '#f5f5f5', 
                    borderRadius: 4,
                    fontSize: 13
                  }}>
                    <span style={{ color: '#999' }}>备注：</span>
                    {record.remark}
                  </div>
                )}
                {record.to_status && (
                  <Tag 
                    color={STATUS_COLOR_MAP[record.to_status as keyof typeof STATUS_COLOR_MAP] as any}
                    style={{ marginTop: 8 }}
                  >
                    {getStatusLabel(record.to_status)}
                  </Tag>
                )}
              </div>
            ),
          }))}
        />
      )}
    </Card>
  );
}
