import { useState } from 'react'
import { createListing } from '../api/listings'
import { getErrorMessage } from '../api/client'

export default function CreateListingModal({ onClose, onCreated }) {
  const [form, setForm] = useState({
    brand: '', model_name: '', year: '', vin: '', license_plate: '',
    mileage: '', store_name: '', has_listing_evidence: true,
    missing_evidence_reason: '', deadline: '',
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const update = (key, val) => setForm((prev) => ({ ...prev, [key]: val }))

  const handleSubmit = async () => {
    setError('')
    if (!form.brand || !form.model_name || !form.year || !form.vin || !form.license_plate || !form.mileage) {
      setError('请填写所有必填字段')
      return
    }
    if (!form.has_listing_evidence && !form.missing_evidence_reason.trim()) {
      setError('缺挂牌确认证据时必须填写原因')
      return
    }
    setLoading(true)
    try {
      await createListing({
        ...form,
        year: Number(form.year),
        mileage: Number(form.mileage),
        deadline: form.deadline || null,
        missing_evidence_reason: form.has_listing_evidence ? '' : form.missing_evidence_reason,
      })
      onCreated()
      onClose()
    } catch (e) {
      setError(getErrorMessage(e))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">创建上架单</span>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>
        <div className="modal-body">
          {error && <div className="error-message">{error}</div>}
          <div className="form-row">
            <div className="form-group">
              <label>品牌 *</label>
              <input value={form.brand} onChange={(e) => update('brand', e.target.value)} />
            </div>
            <div className="form-group">
              <label>型号 *</label>
              <input value={form.model_name} onChange={(e) => update('model_name', e.target.value)} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>年份 *</label>
              <input type="number" value={form.year} onChange={(e) => update('year', e.target.value)} />
            </div>
            <div className="form-group">
              <label>里程(公里) *</label>
              <input type="number" value={form.mileage} onChange={(e) => update('mileage', e.target.value)} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>车架号 *</label>
              <input value={form.vin} onChange={(e) => update('vin', e.target.value)} maxLength={17} />
            </div>
            <div className="form-group">
              <label>车牌号 *</label>
              <input value={form.license_plate} onChange={(e) => update('license_plate', e.target.value)} />
            </div>
          </div>
          <div className="form-group">
            <label>门店</label>
            <input value={form.store_name} onChange={(e) => update('store_name', e.target.value)} />
          </div>
          <div className="form-group">
            <label style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              是否有挂牌确认证据
              <label className="toggle-switch" style={{ display: 'inline-block', marginBottom: 0 }}>
                <input
                  type="checkbox"
                  checked={form.has_listing_evidence}
                  onChange={(e) => update('has_listing_evidence', e.target.checked)}
                />
                <span className="toggle-slider" />
              </label>
              <span style={{ fontWeight: 400 }}>{form.has_listing_evidence ? '是' : '否'}</span>
            </label>
          </div>
          {!form.has_listing_evidence && (
            <div className="form-group">
              <label>缺证据原因 *</label>
              <textarea
                value={form.missing_evidence_reason}
                onChange={(e) => update('missing_evidence_reason', e.target.value)}
                placeholder="请填写缺挂牌确认证据的原因"
              />
            </div>
          )}
          <div className="form-group">
            <label>截止时间</label>
            <input type="datetime-local" value={form.deadline} onChange={(e) => update('deadline', e.target.value)} />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn-outline" onClick={onClose}>取消</button>
          <button className="btn-primary" onClick={handleSubmit} disabled={loading}>
            {loading ? '提交中...' : '创建'}
          </button>
        </div>
      </div>
    </div>
  )
}
