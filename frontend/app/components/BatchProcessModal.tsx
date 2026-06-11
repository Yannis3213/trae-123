import { useState } from 'react'
import { batchProcess } from '../lib/batch'
import { getErrorMessage } from '../lib/apiClient'

interface BatchProcessModalProps {
  items: any[]
  onClose: () => void
  onSuccess?: (results?: any[]) => void
  currentRole: string
}

const ACTION_LABELS: Record<string, string> = {
  submit: '提交',
  supplement: '补正',
  process: '处理',
  review: '复核',
}

export default function BatchProcessModal({
  items,
  onClose,
  onSuccess,
  currentRole,
}: BatchProcessModalProps) {
  const [action, setAction] = useState('')
  const [remark, setRemark] = useState('')
  const [results, setResults] = useState<any[] | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const availableActions: { value: string; label: string }[] = []
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
    setResults(null)
    setLoading(true)

    const missingFields: string[] = []
    items.forEach((item) => {
      const problems: string[] = []
      if (!item.status) problems.push('状态')
      if (!item.version) problems.push('版本')
      if (problems.length > 0) {
        missingFields.push(`${item.application_no || item.id} 缺少${problems.join('、')}`)
      }
    })

    if (missingFields.length > 0) {
      setError(`以下条目缺少页面参数，无法提交：\n${missingFields.join('\n')}`)
      setLoading(false)
      return
    }

    try {
      const payload = items.map((item) => ({
        application_id: item.id,
        action,
        remark,
        status: item.status,
        version: item.version,
      }))
      const res = await batchProcess(payload)
      setResults(res.data)
      const hasAnySuccess = res.data.some((r: any) => r.success)
      if (hasAnySuccess) {
        onSuccess?.(res.data)
      }
    } catch (e) {
      setError(getErrorMessage(e))
    } finally {
      setLoading(false)
    }
  }

  const successCount = results
    ? results.filter((r) => r.success).length
    : 0
  const failCount = results ? results.filter((r) => !r.success).length : 0

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal"
        style={{ maxWidth: 700 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <span className="modal-title">批量处理车源上架单</span>
          <button className="modal-close" onClick={onClose}>
            &times;
          </button>
        </div>
        <div className="modal-body">
          {error && (
            <div className="error-message" style={{ whiteSpace: 'pre-wrap' }}>
              {error}
            </div>
          )}
          <p style={{ marginBottom: 16, color: '#6b7280' }}>
            已选择 <strong>{items.length}</strong> 条上架单
          </p>
          {(() => {
            const missing = items.filter(i => !i.status || !i.version)
            if (missing.length === 0) return null
            return (
              <div style={{
                marginBottom: 16,
                padding: '8px 12px',
                background: '#fef3c7',
                border: '1px solid #f59e0b',
                borderRadius: 4,
                color: '#92400e',
                fontSize: 13,
              }}>
                <strong>⚠ 提示：</strong>有 {missing.length} 条条目缺少页面状态或版本参数，
                提交时将直接返回失败。建议刷新列表后重新选择。
                <div style={{ marginTop: 6, fontSize: 12 }}>
                  {missing.map((m, i) => (
                    <div key={i}>· {m.application_no || m.id}</div>
                  ))}
                </div>
              </div>
            )
          })()}
          {loading && (
            <div>
              {items.map((item, i) => (
                <div
                  key={i}
                  className="batch-result-item batch-result-processing"
                >
                  <span className="processing-spinner">⏳</span>
                  <span>{item.application_no || item.id}</span>
                  <span className="batch-result-reason">处理中...</span>
                </div>
              ))}
            </div>
          )}
          {!loading && !results && (
            <>
              <div className="form-group">
                <label>操作类型 *</label>
                <select
                  value={action}
                  onChange={(e) => setAction(e.target.value)}
                >
                  <option value="">请选择</option>
                  {availableActions.map((a) => (
                    <option key={a.value} value={a.value}>
                      {a.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>备注（可选）</label>
                <textarea
                  value={remark}
                  onChange={(e) => setRemark(e.target.value)}
                />
              </div>
            </>
          )}
          {!loading && results && (
            <div>
              {results.map((r, i) => (
                <div
                  key={i}
                  className={`batch-result-item ${r.success ? 'batch-result-success' : 'batch-result-failure'}`}
                >
                  <span>{r.success ? '✓' : '✗'}</span>
                  <span>{r.application_no}</span>
                  {r.reason && (
                    <span className="batch-result-reason">{r.reason}</span>
                  )}
                </div>
              ))}
              <div className="batch-summary">
                成功{' '}
                <span style={{ color: '#16a34a' }}>{successCount}</span>{' '}
                条，失败{' '}
                <span style={{ color: '#dc2626' }}>{failCount}</span>{' '}
                条
              </div>
            </div>
          )}
        </div>
        <div className="modal-footer">
          {results && !loading ? (
            <button className="btn-primary" onClick={onClose}>
              关闭
            </button>
          ) : (
            <>
              <button
                className="btn-outline"
                onClick={onClose}
                disabled={loading}
              >
                取消
              </button>
              <button
                className="btn-primary"
                onClick={handleSubmit}
                disabled={!action || loading}
              >
                {loading ? '处理中...' : '确认处理'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
