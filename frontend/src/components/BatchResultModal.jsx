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
                <span className="batch-id" style={{ fontWeight: 600 }}>{r.order_no || `#${r.id}`}</span>
                <span>{r.success ? '✅' : '❌'}</span>
                <span style={{ flex: 1 }}>
                  {r.message}
                  {r.missing_evidence && r.missing_evidence.length > 0 && (
                    <span style={{ marginLeft: 8, fontSize: 12, color: '#cf1322' }}>
                      （缺 {r.missing_evidence.map(c => EVIDENCE_CATEGORY_LABEL[c] || c).join('、')}）
                    </span>
                  )}
                </span>
                {r.error_type && (
                  <span className="tag" style={{
                    background: r.success ? '#f6ffed' : '#fff1f0',
                    color: r.success ? '#389e0d' : '#cf1322',
                    border: `1px solid ${r.success ? '#b7eb8f' : '#ffa39e'}`,
                    fontSize: 12,
                  }}>{errorTypeLabels[r.error_type] || r.error_type}</span>
                )}
                {r.status && (
                  <span className="tag" style={{
                    background: STATUS_COLOR[r.status] + '22',
                    color: STATUS_COLOR[r.status],
                    border: `1px solid ${STATUS_COLOR[r.status]}55`
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
