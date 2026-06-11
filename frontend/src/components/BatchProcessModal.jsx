import { useState } from 'react'
import { batchProcess } from '../api/batch'
import { getErrorMessage } from '../api/client'

const ACTION_LABELS = {
  submit: '提交',
  supplement: '补正',
  process: '处理',
  review: '复核',
}

export default function BatchProcessModal({ items, onClose, onSuccess, currentRole }) {
  const [action, setAction] = useState('')
  const [remark, setRemark] = useState('')
  const [results, setResults] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const availableActions = []
  if (currentRole === 'CONSULTANT') {
    availableActions.push({ value: 'submit', label: '提交' })
    availableActions.push({ value: 'supplement', label: '补正' })
  } else if (currentRole === 'EVALUATOR') {
    availableActions.push({ value: 'process', label: '处理' })
  } else if (currentRole === 'MANAGER') {
    availableActions.push({ value: 'review', label: '复核' })
  }

  const handleSubmit = async () => {
    if (!action) return
    setError('')
    setLoading(true)
    try {
      const payload = items.map((item) => ({
        application_id: item.id,
        action,
        remark,
      }))
      const res = await batchProcess(payload)
      setResults(res.data)
      if (res.data.every((r) => r.success)) {
        onSuccess?.()
      }
    } catch (e) {
      setError(getErrorMessage(e))
    } finally {
      setLoading(false)
    }
  }

  const successCount = results ? results.filter((r) => r.success).length : 0
  const failCount = results ? results.filter((r) => !r.success).length : 0

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 700 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">批量处理车源上架单</span>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>
        <div className="modal-body">
          {error && <div className="error-message">{error}</div>}
          <p style={{ marginBottom: 16, color: '#6b7280' }}>
            已选择 <strong>{items.length}</strong> 条上架单
          </p>
          {!results && (
            <>
              <div className="form-group">
                <label>操作类型 *</label>
                <select value={action} onChange={(e) => setAction(e.target.value)}>
                  <option value="">请选择</option>
                  {availableActions.map((a) => (
                    <option key={a.value} value={a.value}>{a.label}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>备注（可选）</label>
                <textarea value={remark} onChange={(e) => setRemark(e.target.value)} />
              </div>
            </>
          )}
          {results && (
            <div>
              {results.map((r, i) => (
                <div key={i} className={`batch-result-item ${r.success ? 'batch-result-success' : 'batch-result-failure'}`}>
                  <span>{r.success ? '✓' : '✗'}</span>
                  <span>{r.application_no}</span>
                  {r.reason && <span className="batch-result-reason">{r.reason}</span>}
                </div>
              ))}
              <div className="batch-summary">
                成功 <span style={{ color: '#16a34a' }}>{successCount}</span> 条，
                失败 <span style={{ color: '#dc2626' }}>{failCount}</span> 条
              </div>
            </div>
          )}
        </div>
        <div className="modal-footer">
          {results ? (
            <button className="btn-primary" onClick={onClose}>关闭</button>
          ) : (
            <>
              <button className="btn-outline" onClick={onClose}>取消</button>
              <button className="btn-primary" onClick={handleSubmit} disabled={!action || loading}>
                {loading ? '处理中...' : '确认处理'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
