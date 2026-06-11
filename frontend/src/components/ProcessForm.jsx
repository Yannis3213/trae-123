import { useState } from 'react'
import { getErrorMessage } from '../api/client'

export default function ProcessForm({ onSubmit, status, version }) {
  const [evaluationResult, setEvaluationResult] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (!evaluationResult.trim()) {
      setError('请填写评估结果')
      return
    }
    setLoading(true)
    try {
      await onSubmit({ evaluation_result: evaluationResult, status, version })
    } catch (e) {
      setError(getErrorMessage(e))
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      {error && <div className="error-message">{error}</div>}
      <div className="form-group">
        <label>评估结果 *</label>
        <textarea
          value={evaluationResult}
          onChange={(e) => setEvaluationResult(e.target.value)}
          placeholder="请填写评估结果"
        />
      </div>
      <div className="action-bar">
        <button type="submit" className="btn-primary" disabled={loading}>
          {loading ? '提交中...' : '处理提交'}
        </button>
      </div>
    </form>
  )
}
