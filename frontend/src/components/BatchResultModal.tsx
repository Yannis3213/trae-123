import type { BatchProcessResponse } from '../types';

interface Props {
  data: BatchProcessResponse;
  onClose: () => void;
}

export default function BatchResultModal({ data, onClose }: Props) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <span>批量处理结果</span>
          <span className="modal-close" onClick={onClose}>✕</span>
        </div>
        <div className="modal-body">
          <div style={{
            display: 'flex',
            gap: 16,
            padding: 16,
            background: '#f5f7fa',
            borderRadius: 6,
            marginBottom: 20,
          }}>
            <div style={{ flex: 1, textAlign: 'center' }}>
              <div style={{ fontSize: 13, color: '#909399', marginBottom: 4 }}>总数</div>
              <div style={{ fontSize: 24, fontWeight: 600, color: '#303133' }}>{data.total}</div>
            </div>
            <div style={{ flex: 1, textAlign: 'center' }}>
              <div style={{ fontSize: 13, color: '#909399', marginBottom: 4 }}>成功</div>
              <div style={{ fontSize: 24, fontWeight: 600, color: '#67c23a' }}>{data.success_count}</div>
            </div>
            <div style={{ flex: 1, textAlign: 'center' }}>
              <div style={{ fontSize: 13, color: '#909399', marginBottom: 4 }}>失败</div>
              <div style={{ fontSize: 24, fontWeight: 600, color: '#f56c6c' }}>{data.fail_count}</div>
            </div>
          </div>

          <div className="form-label" style={{ marginBottom: 12 }}>详细结果：</div>
          <div style={{ maxHeight: 300, overflowY: 'auto' }}>
            {data.results.map((r) => (
              <div key={r.appointment_id} className={`batch-result-item ${r.success ? 'success' : 'fail'}`}>
                <div className="batch-result-info">
                  <div className="order-no">{r.order_no}</div>
                  <div className="message">{r.message}</div>
                </div>
                <span className={`batch-result-status ${r.success ? 'success' : 'fail'}`}>
                  {r.success ? '成功' : '失败'}
                </span>
              </div>
            ))}
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-primary" onClick={onClose}>知道了</button>
        </div>
      </div>
    </div>
  );
}
