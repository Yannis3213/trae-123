import React from 'react';
import { Timeline, Tag } from 'antd';
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
      items={records.map((record) => ({
        color: record.failure_reason ? 'red' : 'green',
        children: (
          <div>
            <div style={{ marginBottom: 4 }}>
              <span style={{ fontWeight: 500 }}>
                {record.operator_name}（{ROLE_LABELS[record.operator_role] || record.operator_role}）
              </span>
              <span style={{ margin: '0 8px' }}>{ACTION_LABELS[record.action] || record.action}</span>
              <span>
                {STATUS_LABELS[record.before_status] || record.before_status}
                {' → '}
                {STATUS_LABELS[record.after_status] || record.after_status}
              </span>
            </div>
            {record.detail && <div style={{ color: '#666' }}>{record.detail}</div>}
            {record.failure_reason && (
              <Tag color="red" style={{ marginTop: 4 }}>
                失败原因：{record.failure_reason}
              </Tag>
            )}
            <div style={{ color: '#999', fontSize: 12, marginTop: 4 }}>
              {dayjs(record.created_at).format('YYYY-MM-DD HH:mm:ss')}
            </div>
          </div>
        ),
      }))}
    />
  );
};

export default AuditTrail;
