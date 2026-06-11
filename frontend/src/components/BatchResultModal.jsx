export default function BatchResultModal({ results, onClose }) {
  const successCount = results.filter(r => r.success).length;
  const failCount = results.filter(r => !r.success).length;

  return (
    <div class="modal-overlay" onClick={onClose}>
      <div class="modal" onClick={e => e.stopPropagation()}>
        <div class="modal-header">
          <div class="modal-title">批量处理结果</div>
          <button class="modal-close" onClick={onClose}>×</button>
        </div>
        <div class="modal-body">
          <div style={{ marginBottom: '16px', display: 'flex', gap: '16px' }}>
            <span class="alert alert-success" style={{ margin: 0 }}>
              成功: {successCount} 条
            </span>
            <span class="alert alert-error" style={{ margin: 0 }}>
              失败: {failCount} 条
            </span>
          </div>
          
          <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
            {results.map((result, idx) => (
              <div
                key={idx}
                class={`batch-result-item ${result.success ? 'batch-result-success' : 'batch-result-fail'}`}
              >
                <strong>{result.order_no || `#${result.id}`}</strong>
                {' - '}
                {result.success ? result.message : result.reason}
              </div>
            ))}
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-primary" onClick={onClose}>确定</button>
        </div>
      </div>
    </div>
  );
}
