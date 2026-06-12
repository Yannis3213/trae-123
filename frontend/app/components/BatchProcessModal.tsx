import { useState, useEffect } from 'react'
import { batchProcess } from '../lib/batch'
import { getErrorMessage } from '../lib/apiClient'

interface ProcessItem {
  id: number | string
  application_no: string
  status?: string
  version?: number
  state: 'pending' | 'missing_fields' | 'processing' | 'success' | 'failure'
  missing?: string[]
  reason?: string
}

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
  const [itemStates, setItemStates] = useState<ProcessItem[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const initial: ProcessItem[] = items.map(item => {
      const missing: string[] = []
      if (!item.status) missing.push('状态')
      if (!item.version) missing.push('版本')
      return {
        id: item.id,
        application_no: item.application_no || String(item.id),
        status: item.status,
        version: item.version,
        state: missing.length > 0 ? 'missing_fields' : 'pending',
        missing,
      }
    })
    setItemStates(initial)
  }, [items])

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

    setItemStates(prev => prev.map(item => ({
      ...item,
      state: 'processing',
    })))
    setLoading(true)

    try {
      const validItems = itemStates.filter(i => i.state !== 'missing_fields')
      const missingItems = itemStates.filter(i => i.state === 'missing_fields')

      const payload = validItems.map((item) => ({
        application_id: item.id,
        action,
        remark,
        status: item.status,
        version: item.version,
      }))

      let backendResults: any[] = []
      if (validItems.length > 0) {
        const res = await batchProcess(payload)
        backendResults = res.data
      }

      const resultMap = new Map(backendResults.map((r: any) => [r.application_id, r]))

      const finalStates: ProcessItem[] = itemStates.map(item => {
        if (item.missing && item.missing.length > 0) {
          return {
            ...item,
            state: 'failure',
            reason: `${item.application_no} 缺少${item.missing?.join('、')}参数，无法执行批量操作`,
          }
        } else {
          const result = resultMap.get(item.id)
          if (result) {
            return {
              ...item,
              state: result.success ? 'success' : 'failure',
              reason: result.reason,
            } as ProcessItem
          }
          return { ...item, state: 'failure', reason: '未处理' } as ProcessItem
        }
      })

      setItemStates(finalStates)

      const hasAnySuccess = finalStates.some(s => s.state === 'success')
      if (hasAnySuccess) {
        const mergedResults = finalStates.map(s => ({
          application_id: s.id,
          application_no: s.application_no,
          success: s.state === 'success',
          reason: s.reason,
        }))
        onSuccess?.(mergedResults)
      }

    } catch (e) {
      setError(getErrorMessage(e))
      setItemStates(prev => prev.map(item => ({
        ...item,
        state: item.missing?.length ? 'missing_fields' : 'pending',
      })))
    } finally {
      setLoading(false)
    }
  }

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
          {(loading || itemStates.some(s => s.state === 'success' || s.state === 'failure')) && (
            <div>
              {itemStates.map((item, i) => (
                <div
                  key={i}
                  className={`batch-result-item ${
                    item.state === 'success' ? 'batch-result-success' :
                    item.state === 'failure' ? 'batch-result-failure' :
                    'batch-result-processing'
                  }`}
                >
                  <span>
                    {item.state === 'processing' ? (
                      <span className="processing-spinner">⏳</span>
                    ) : item.state === 'success' ? '✓' : 
                      item.state === 'missing_fields' ? '⚠' : '✗'}
                  </span>
                  <span>{item.application_no}</span>
                  {item.reason && (
                    <span className="batch-result-reason">{item.reason}</span>
                  )}
                  {!item.reason && item.state === 'processing' && (
                    <span className="batch-result-reason">处理中...</span>
                  )}
                </div>
              ))}
              {(itemStates.some(s => s.state === 'success' || s.state === 'failure') && !loading) && (
                <div className="batch-summary">
                  成功{' '}
                  <span style={{ color: '#16a34a' }}>
                    {itemStates.filter(s => s.state === 'success').length}
                  </span>{' '}
                  条，失败{' '}
                  <span style={{ color: '#dc2626' }}>
                    {itemStates.filter(s => s.state === 'failure').length}
                  </span>{' '}
                  条
                </div>
              )}
            </div>
          )}
          {!loading && !itemStates.some(s => s.state === 'success' || s.state === 'failure') && (
            <>
              {(() => {
                const missing = itemStates.filter(i => i.state === 'missing_fields')
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
                    将直接标记为失败。
                    <div style={{ marginTop: 6, fontSize: 12 }}>
                      {missing.map((m, i) => (
                        <div key={i}>· {m.application_no} 缺少{m.missing?.join('、')}</div>
                      ))}
                    </div>
                  </div>
                )
              })()}
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
        </div>
        <div className="modal-footer">
          {itemStates.some(s => s.state === 'success' || s.state === 'failure') && !loading ? (
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
