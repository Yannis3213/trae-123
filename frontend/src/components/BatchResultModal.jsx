import React from 'react'
import { STATUS_COLOR } from '../api.js'

export default function BatchResultModal({ data, onClose }) {
  const successRate = data.total > 0 ? Math.round(data.success_count / data.total * 100) : 0
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
                <span className="batch-id">单号 #{r.id}</span>
                <span>{r.success ? '✅' : '❌'}</span>
                <span style={{ flex: 1 }}>{r.message}</span>
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
