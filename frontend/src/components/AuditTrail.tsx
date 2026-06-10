import React from 'react';
import { Timeline, Tag, Space } from 'antd';
import { VersionOutlined, CheckCircleOutlined, CloseCircleOutlined, UserOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { ROLE_LABELS, STATUS_LABELS, ACTION_LABELS } from '../constants';
import type { AuditLog } from '../types';

interface AuditTrailProps {
  records: AuditLog[];
}

const AuditTrail: React.FC<AuditTrailProps> = ({ records }) => {
  if (!records || records.length === 0) {
    return <div style={{ color: '#999', textAlign: 'center', padding: 20 }}>暂无审计记录</div>;
  }

  return (
    <Timeline
      items={records.map((record) => {
        const isFailed = !!record.failure_reason;
        const isBatch = record.action.startsWith('batch_');

        return {
          color: isFailed ? 'red' : isBatch ? 'blue' : 'green',
          dot: isFailed ? <CloseCircleOutlined style={{ color: '#ff4d4f' }} /> : <CheckCircleOutlined style={{ color: '#52c41a' }} />,
          children: (
            <div style={{ padding: '4px 0 12px' }}>
              <Space direction="vertical" size={4} style={{ width: '100%' }}>
                <Space wrap size={8}>
                  <span style={{ fontWeight: 500 }}>
                    <UserOutlined style={{ marginRight: 4 }} />
                    {record.operator_name}（{ROLE_LABELS[record.operator_role] || record.operator_role}）
                  </span>
                  <Tag color={isFailed ? 'red' : 'blue'}>
                    {ACTION_LABELS[record.action.replace('batch_', '')] || record.action}
                    {isBatch && '（批量）'}
                  </Tag>
                  {record.version > 0 && (
                    <Tag color="cyan" icon={<VersionOutlined />}>v{record.version}</Tag>
                  )}
                </Space>
                <div style={{ color: '#555' }}>
                  <Tag color="default">{STATUS_LABELS[record.before_status] || record.before_status || '-'}</Tag>
                  <span style={{ margin: '0 6px' }}>→</span>
                  <Tag color={isFailed ? 'red' : 'green'}>
                    {STATUS_LABELS[record.after_status] || record.after_status || '-'}
                  </Tag>
                </div>
                {record.detail && (
                  <div style={{ color: '#666', fontSize: 13, background: '#fafafa', padding: '6px 10px', borderRadius: 4 }}>
                    {record.detail}
                  </div>
                )}
                {record.failure_reason && (
                  <div>
                    <Tag color="red" icon={<CloseCircleOutlined />}>
                      异常/失败原因：{record.failure_reason}
                    </Tag>
                  </div>
                )}
                <div style={{ color: '#aaa', fontSize: 12 }}>
                  {dayjs(record.created_at).format('YYYY-MM-DD HH:mm:ss')}
                </div>
              </Space>
            </div>
          ),
        };
      })}
    />
  );
};

export default AuditTrail;
