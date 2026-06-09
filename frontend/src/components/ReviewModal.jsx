import React, { useState } from 'react'
import api from '../api.js'

export default function ReviewModal({ order, action, onClose, onSuccess }) {
  const [opinion, setOpinion] = useState('')
  const [loading, setLoading] = useState(false)

  const actionLabel = {
    approve: '审核通过',
    return: '退回补正',
    sync: '同步订单'
  }[action]

  const endpoint = {
    approve: '/orders/review',
    return: '/orders/review',
    sync: '/orders/sync'
  }[action]

  const hintText = {
    approve: '审核通过后，订单状态将变为「审核通过」，流转至运营主管进行同步操作。',
    return: '退回后，订单状态将变为「退回补正」，需验光师补充材料后重新提交。',
    sync: '同步后，订单状态将变为「已同步」，完成整个流程。'
  }[action]

  const submit = async () => {
    if (action === 'return' && !opinion.trim()) {
      alert('退回补正请填写补正意见')
      return
    }
    setLoading(true)
    try {
      const payload = {
        order_id: order.id,
        version: order.version,
        action,
        opinion
      }
      const res = await api.post(endpoint, payload)
      if (!res.data.success) {
        alert('操作失败：' + res.data.message)
        setLoading(false)
        return
      }
      alert('操作成功：' + res.data.message)
      onSuccess()
    } catch (e) {
      const msg = e.response?.data?.detail || e.message
      alert('操作失败：' + msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-mask" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{actionLabel} - {order.order_no}</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <div className={`alert-box ${action === 'return' ? 'warning' : 'info'}`}>{hintText}</div>

          <div className="info-grid mb-16">
            <div className="info-item">
              <span className="label">当前状态</span>
              <span className="value"><span className={`status-tag ${order.status}`}>{order.status_display}</span></span>
            </div>
            <div className="info-item">
              <span className="label">当前版本</span>
              <span className="value">v{order.version}</span>
            </div>
            <div className="info-item">
              <span className="label">客户</span>
              <span className="value">{order.customer_name} ({order.customer_phone})</span>
            </div>
            <div className="info-item">
              <span className="label">预警状态</span>
              <span className="value"><span className={`urgency-tag ${order.urgency_status}`}>
                {{ normal: '正常', warning: '临期', overdue: '逾期' }[order.urgency_status]}
              </span></span>
            </div>
          </div>

          {order.has_defect && action !== 'return' && (
            <div className="alert-box warning mb-16">
              ⚠️ 当前订单存在缺项：{order.defect_description}
              <br />请确认是否仍要执行此操作。
            </div>
          )}

          <div className="form-group">
            <label>
              处理意见
              {action === 'return' && <span style={{ color: '#ff4d4f' }}> *</span>}
            </label>
            <textarea value={opinion} onChange={(e) => setOpinion(e.target.value)}
              placeholder={action === 'return'
                ? '请详细说明需要补正的内容（必填）...'
                : '可选：输入审核/同步意见...'} />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-default" onClick={onClose} disabled={loading}>取消</button>
          <button
            className={`btn ${action === 'return' ? 'btn-warning' : action === 'approve' ? 'btn-success' : 'btn-primary'}`}
            onClick={submit}
            disabled={loading}
          >
            {loading ? '处理中...' : `确认${actionLabel}`}
          </button>
        </div>
      </div>
    </div>
  )
}
