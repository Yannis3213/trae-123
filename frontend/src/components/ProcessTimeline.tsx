import { Component } from 'solid-js';
import type { ProcessRecord } from '../types';
import { ACTION_LABELS, STATUS_LABELS } from '../utils/status';
import { getRoleLabel } from '../utils/role';
import dayjs from 'dayjs';

interface ProcessTimelineProps {
  records: ProcessRecord[];
}

const ProcessTimeline: Component<ProcessTimelineProps> = (props) => {
  const sortedRecords = () =>
    [...props.records].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

  return (
    <div class="timeline">
      {sortedRecords().length === 0 ? (
        <div style={{ color: '#999', 'font-size': '14px', padding: '16px 0' }}>
          暂无处理记录
        </div>
      ) : (
        sortedRecords().map((record) => (
          <div class="timeline-item">
            <div class="timeline-time">
              {dayjs(record.created_at).format('YYYY-MM-DD HH:mm:ss')}
              <span style={{ marginLeft: '12px', color: '#bbb', 'font-size': '12px' }}>
                v{record.version}
              </span>
            </div>
            <div class="timeline-content">
              <span class="timeline-operator">
                {record.operator_name}（{getRoleLabel(record.operator_role)}）
              </span>
              <span style={{ margin: '0 8px', color: '#666' }}>执行了</span>
              <strong>{ACTION_LABELS[record.action]}</strong>
              操作
              {record.from_status && record.to_status && (
                <span style={{ marginLeft: '8px', color: '#999', 'font-size': '13px' }}>
                  （{STATUS_LABELS[record.from_status]} →{' '}
                  {STATUS_LABELS[record.to_status]}）
                </span>
              )}
              {record.comment && (
                <div
                  style={{
                    marginTop: '8px',
                    padding: '8px 12px',
                    background: '#fafafa',
                    'border-radius': '4px',
                    color: '#666',
                    'font-size': '13px',
                  }}
                >
                  备注：{record.comment}
                </div>
              )}
            </div>
          </div>
        ))
      )}
    </div>
  );
};

export default ProcessTimeline;
