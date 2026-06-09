import React, { useState } from 'react'
import api from '../api.js'
import { useAuth } from '../App.jsx'

export default function BatchModal({ action, selectedOrders, onClose, onSuccess }) {
  const [opinion, setOpinion] = useState('')
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState(null)
  const { user } = useAuth()

  const actionLabel = {
    approve: '批量审核通过',
    return: '批量退回补正',
    sync: '批量同步'
  }[action]

  const execute = async () => {
    if (action === 'return' && !opinion.trim()) {
      alert('退回补正请填写补正意见')
      return
    }
    setLoading(true)
    setResults(null)
    try {
      const payload = {
        orders: selectedOrders.map(o => ({ order_id: o.id, version: o.version })),
        action,
        opinion
      }
      const res = await api.post('/orders/batch', payload)
      setResults(res.data)
    } catch (e) {
      alert('操作失败：' + (e.response?.data?.detail || e.message))
    } finally {
      setLoading(false)
    }
  }

  const hasSuccess = results?.some(r => r.success)
  const successCount = results?.filter(r => r.success).length || 0
  const failCount = results?.filter(r => !r.success).length || 0

  return (
    <div className="modal-mask" onClick={onClose}>
      <div className="modal large" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{actionLabel}</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <div className="alert-box info">
            将对以下 <strong>{selectedOrders.length}</strong> 条订单执行【{actionLabel}】，
            已携带每条订单的版本号进行乐观锁校验：
            <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {selectedOrders.map(o => (
                <span key={o.id} style={{
                  background: '#e6f7ff', padding: '4px 10px', borderRadius: 4, fontSize: 12,
                  border: '1px solid #91d5ff'
                }}>
                  <strong>{o.order_no}</strong> <span style={{ color: '#595959' }}>v{o.version}</span>
                </span>
              ))}
            </div>
          </div>

          {action === 'return' && (
            <div className="form-group">
              <label>补正意见 <span style={{ color: '#ff4d4f' }}>*</span></label>
              <textarea value={opinion} onChange={(e) => setOpinion(e.target.value)}
                placeholder="请说明需要补正的内容，如：验光档案缺PD值、缺少镜片品牌确认单..." />
            </div>
          )}
          {action !== 'return' && (
            <div className="form-group">
              <label>备注意见（可选）</label>
              <textarea value={opinion} onChange={(e) => setOpinion(e.target.value)}
                placeholder="批量处理备注，所有成功订单将记录此意见" />
            </div>
          )}

          {results && (
            <div className="mt-16">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <h4 style={{ margin: 0 }}>处理结果</h4>
                <div style={{ fontSize: 13 }}>
                  <span style={{ color: '#52c41a', marginRight: 12 }}>✅ 成功 {successCount}</span>
                  <span style={{ color: '#ff4d4f' }}>❌ 失败 {failCount}</span>
                </div>
              </div>
              <div className="batch-results">
                {results.map(r => (
                  <div key={r.order_id} className={`batch-result-item ${r.success ? 'success' : 'fail'}`}>
                    <span style={{ fontSize: 16 }}>{r.success ? '✅' : '❌'}</span>
                    <span className="order-no">
                      <strong>{r.order_no || `#${r.order_id}`}</strong>
                    </span>
                    <span className="msg">{r.message}</span>
                  </div>
                ))}
              </div>
              {failCount > 0 && (
                <div className="alert-box warning mt-16">
                  ⚠️ 失败订单的异常原因已自动写入 <strong>exception_reason</strong> 和 <strong>audit_note</strong>，
                  可进入订单详情追溯。
                </div>
              )}
            </div>
          )}
        </div>
        <div className="modal-footer">
          {results ? (
            <>
              <button className="btn btn-default" onClick={onClose}>关闭</button>
              {hasSuccess && (
                <button className="btn btn-primary" onClick={onSuccess}>完成并刷新列表</button>
              )}
            </>
          ) : (
            <>
              <button className="btn btn-default" onClick={onClose} disabled={loading}>取消</button>
              <button className="btn btn-primary" onClick={execute} disabled={loading}>
                {loading ? '逐条校验并处理中...' : `确认${actionLabel}`}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
