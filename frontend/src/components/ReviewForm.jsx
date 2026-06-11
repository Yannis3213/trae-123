import { useState } from 'react'
import { getErrorMessage } from '../api/client'

export default function ReviewForm({ onApprove, onReturn, status, version }) {
  const [reviewResult, setReviewResult] = useState('')
  const [rejectReason, setRejectReason] = useState('')
  const [showReject, setShowReject] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleApprove = async () => {
    setError('')
    setLoading(true)
    try {
      await onApprove({ review_result: reviewResult, action: 'approve', status, version })
    } catch (e) {
      setError(getErrorMessage(e))
    } finally {
      setLoading(false)
    }
  }

  const handleReturn = async () => {
    setError('')
    if (!rejectReason.trim()) {
      setError('退回时必须填写退回原因')
      return
    }
    setLoading(true)
    try {
      await onReturn({ review_result: reviewResult, action: 'return', reject_reason: rejectReason, status, version })
    } catch (e) {
      setError(getErrorMessage(e))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      {error && <div className="error-message">{error}</div>}
      <div className="form-group">
        <label>复核结果</label>
        <textarea
          value={reviewResult}
          onChange={(e) => setReviewResult(e.target.value)}
          placeholder="请填写复核结果"
        />
      </div>
      {!showReject ? (
        <div className="action-bar">
          <button className="btn-success" onClick={handleApprove} disabled={loading}>
            {loading ? '提交中...' : '复核通过'}
          </button>
          <button className="btn-danger" onClick={() => setShowReject(true)} disabled={loading}>
            退回补正
          </button>
        </div>
      ) : (
        <div>
          <div className="form-group">
            <label>退回原因 *</label>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="请填写退回原因"
            />
          </div>
          <div className="action-bar">
            <button className="btn-danger" onClick={handleReturn} disabled={loading}>
              {loading ? '提交中...' : '确认退回'}
            </button>
            <button className="btn-outline" onClick={() => setShowReject(false)}>取消</button>
          </div>
        </div>
      )}
    </div>
  )
}
