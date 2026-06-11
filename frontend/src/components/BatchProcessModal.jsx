import { createSignal, For } from 'solid-js';
import { api } from '../api';

const actionLabels = {
  accept: '接单',
  process: '处理流转',
  verify: '核实流转',
  return: '退回补正',
  approve: '审批通过',
  reject: '不予通过',
};

export default function BatchProcessModal({ applications, action, onClose, onSuccess }) {
  const [comment, setComment] = createSignal('');
  const [processing, setProcessing] = createSignal(false);
  const [results, setResults] = createSignal(null);
  const [error, setError] = createSignal('');

  const handleSubmit = async () => {
    setProcessing(true);
    setError('');
    setResults(null);

    try {
      const items = applications.map((app) => ({
        application_id: app.id,
        version: app.version,
        action: action,
        comment: comment(),
      }));

      const data = await api.batchProcess(items);
      setResults(data);
      onSuccess && onSuccess();
    } catch (err) {
      setError(err.error_message || '批量处理失败');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div class="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div class="modal">
        <div class="modal-header">
          <h3>批量{actionLabels[action] || action}</h3>
          <button class="close-btn" onClick={onClose}>&times;</button>
        </div>
        <div class="modal-body">
          {error() && <div class="error-message">{error()}</div>}

          <div class="detail-section">
            <h4>待处理申请（共 {applications.length} 条）</h4>
            <table class="table">
              <thead>
                <tr>
                  <th>申请编号</th>
                  <th>申请人</th>
                  <th>当前节点</th>
                  <th>当前状态</th>
                  <th>版本</th>
                </tr>
              </thead>
              <tbody>
                <For each={applications}>
                  {(app) => (
                    <tr>
                      <td>{app.application_no}</td>
                      <td>{app.applicant_name}</td>
                      <td>{app.current_node_name}</td>
                      <td>
                        <span class={`badge badge-${app.status}`}>{app.status_name}</span>
                      </td>
                      <td>v{app.version}</td>
                    </tr>
                  )}
                </For>
              </tbody>
            </table>
          </div>

          <div class="form-group">
            <label>处理意见（可选）</label>
            <textarea
              value={comment()}
              onInput={(e) => setComment(e.target.value)}
              placeholder="请输入统一处理意见"
            />
          </div>

          {results() && (
            <div class="batch-results">
              <h4 style={{ marginBottom: '12px' }}>
                处理结果：成功 {results().success_count} 条，失败 {results().failure_count} 条
              </h4>
              <For each={results().results}>
                {(result) => (
                  <div class={`batch-result-item ${result.success ? 'success' : 'failure'}`}>
                    <span>
                      <strong>{result.application_no}</strong>
                      {result.success ? ' - 处理成功' : ` - ${result.error_code}: ${result.error_message}`}
                    </span>
                    <span class={`badge badge-${result.success ? 'passed' : 'returned'}`}>
                      {result.success ? '成功' : '失败'}
                    </span>
                  </div>
                )}
              </For>
            </div>
          )}
        </div>
        <div class="modal-footer">
          {!results() && (
            <>
              <button class="btn btn-default" onClick={onClose} disabled={processing()}>
                取消
              </button>
              <button
                class="btn btn-primary"
                onClick={handleSubmit}
                disabled={processing()}
              >
                {processing() ? '处理中...' : `确认批量${actionLabels[action] || action}`}
              </button>
            </>
          )}
          {results() && (
            <button class="btn btn-primary" onClick={onClose}>
              关闭
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
