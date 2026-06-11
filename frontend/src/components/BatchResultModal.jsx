import React from 'react'
import { STATUS_COLOR, EVIDENCE_CATEGORY_LABEL } from '../api.js'

export default function BatchResultModal({ data, onClose }) {
  const successRate = data.total > 0 ? Math.round(data.success_count / data.total * 100) : 0
  const errorTypeLabels = {
    not_found: '记录不存在',
    version_conflict: '版本冲突',
    handler_mismatch: '处理人不匹配',
    status_flow: '状态冲突',
    missing_evidence: '缺少证据',
    overdue: '逾期推进',
  }
  const errorTypeColors = {
    not_found: '#8c8c8c',
    version_conflict: '#722ed1',
    handler_mismatch: '#d4380d',
    status_flow: '#fa8c16',
    missing_evidence: '#cf1322',
    overdue: '#eb2f96',
  }
  return (
    <div className="modal-mask" onClick={onClose}>
      <div className="modal large" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">📊 批量处理结果 - 共 {data.total} 条</div>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <div className="stats-grid" style={{ marginBottom: 20 }}>
            <div className="stat-card success">
              <div className="stat-label">✅ 成功</div>
              <div className="stat-value">{data.success_count}</div>
            </div>
            <div className="stat-card danger">
              <div className="stat-label">❌ 失败</div>
              <div className="stat-value">{data.fail_count}</div>
            </div>
            <div className="stat-card info">
              <div className="stat-label">📈 成功率</div>
              <div className="stat-value">{successRate}%</div>
            </div>
          </div>
          <div className="progress-bar" style={{ marginBottom: 20 }}>
            <div className="progress-fill" style={{ width: successRate + '%' }}></div>
          </div>
          <div className="batch-result-list">
            {data.results.map(r => (
              <div key={r.id} className={'batch-result-item ' + (r.success ? 'success' : 'fail')}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: r.success ? 0 : 6 }}>
                  <span style={{ fontWeight: 600, minWidth: 120 }}>{r.order_no || `#${r.id}`}</span>
                  <span>{r.success ? '✅' : '❌'}</span>
                  <span style={{ flex: 1, fontSize: 13 }}>
                    {r.message}
                  </span>
                </div>
                {!r.success && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', marginTop: 4, paddingLeft: 130 }}>
                    {r.error_type && (
                      <span className="tag" style={{
                        background: (errorTypeColors[r.error_type] || '#cf1322') + '18',
                        color: errorTypeColors[r.error_type] || '#cf1322',
                        border: `1px solid ${errorTypeColors[r.error_type] || '#cf1322'}44`,
                        fontSize: 11, fontWeight: 600,
                      }}>{errorTypeLabels[r.error_type] || r.error_type}</span>
                    )}
                    {r.missing_evidence && r.missing_evidence.length > 0 && (
                      <span style={{ fontSize: 12, color: '#cf1322' }}>
                        缺：{r.missing_evidence.map(c => EVIDENCE_CATEGORY_LABEL[c] || c).join('、')}
                      </span>
                    )}
                    {r.overdue_reason && (
                      <span style={{ fontSize: 12, color: '#eb2f96' }}>⏰ {r.overdue_reason}</span>
                    )}
                    {r.current_handler && (
                      <span style={{ fontSize: 12, color: '#6b7280' }}>👤 {r.current_handler}</span>
                    )}
                    {r.version > 0 && (
                      <span style={{ fontSize: 12, color: '#8c8c8c' }}>v{r.version}</span>
                    )}
                  </div>
                )}
                {r.success && r.status && (
                  <span className="tag" style={{
                    marginLeft: 8,
                    background: STATUS_COLOR[r.status] + '22',
                    color: STATUS_COLOR[r.status],
                    border: `1px solid ${STATUS_COLOR[r.status]}55`,
                    fontSize: 12,
                  }}>{r.status}</span>
                )}
              </div>
            ))}
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-primary" onClick={onClose}>知道了</button>
        </div>
      </div>
    </div>
  )
}
