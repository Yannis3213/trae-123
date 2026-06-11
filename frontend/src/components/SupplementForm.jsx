import { useState } from 'react'
import { getErrorMessage } from '../api/client'

export default function SupplementForm({ onSubmit, status, version }) {
  const [form, setForm] = useState({
    supplement_remark: '',
    has_listing_evidence: null,
    missing_evidence_reason: '',
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await onSubmit({ ...form, status, version })
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
        <label>补正说明</label>
        <textarea
          value={form.supplement_remark}
          onChange={(e) => setForm((p) => ({ ...p, supplement_remark: e.target.value }))}
          placeholder="请填写补正说明"
        />
      </div>
      <div className="form-group">
        <label style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          是否已补齐挂牌确认证据
          <label className="toggle-switch" style={{ display: 'inline-block', marginBottom: 0 }}>
            <input
              type="checkbox"
              checked={form.has_listing_evidence === true}
              onChange={(e) => setForm((p) => ({ ...p, has_listing_evidence: e.target.checked ? true : null }))}
            />
            <span className="toggle-slider" />
          </label>
          <span style={{ fontWeight: 400 }}>{form.has_listing_evidence === true ? '是' : '未更新'}</span>
        </label>
      </div>
      <div className="action-bar">
        <button type="submit" className="btn-primary" disabled={loading}>
          {loading ? '提交中...' : '补正提交'}
        </button>
      </div>
    </form>
  )
}
