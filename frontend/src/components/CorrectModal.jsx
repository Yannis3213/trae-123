import React, { useState } from 'react'
import api from '../api.js'

export default function CorrectModal({ order, onClose, onSuccess }) {
  const [opt, setOpt] = useState(order.optometry_record || {})
  const [lens, setLens] = useState(order.lens_order || {})
  const [reg, setReg] = useState(order.registration || {})
  const [opinion, setOpinion] = useState('')
  const [loading, setLoading] = useState(false)

  const updateOpt = (k, v) => setOpt({ ...opt, [k]: v })
  const updateLens = (k, v) => setLens({ ...lens, [k]: v })
  const updateReg = (k, v) => setReg({ ...reg, [k]: v })

  const inputNum = (v) => {
    if (v === '' || v === null || v === undefined) return null
    const n = parseFloat(v)
    return isNaN(n) ? null : n
  }

  const submit = async () => {
    if (!opinion.trim()) {
      alert('请填写补正说明')
      return
    }
    setLoading(true)
    try {
      const payload = {
        order_id: order.id,
        version: order.version,
        opinion
      }
      const nonEmptyOpt = Object.keys(opt).length > 0 ? {
        ...opt,
        left_sphere: typeof opt.left_sphere === 'number' ? opt.left_sphere : (opt.left_sphere ? parseFloat(opt.left_sphere) : null),
        left_cylinder: typeof opt.left_cylinder === 'number' ? opt.left_cylinder : (opt.left_cylinder ? parseFloat(opt.left_cylinder) : null),
        left_axis: opt.left_axis ? parseInt(opt.left_axis) : null,
        right_sphere: typeof opt.right_sphere === 'number' ? opt.right_sphere : (opt.right_sphere ? parseFloat(opt.right_sphere) : null),
        right_cylinder: typeof opt.right_cylinder === 'number' ? opt.right_cylinder : (opt.right_cylinder ? parseFloat(opt.right_cylinder) : null),
        right_axis: opt.right_axis ? parseInt(opt.right_axis) : null,
        pd: typeof opt.pd === 'number' ? opt.pd : (opt.pd ? parseFloat(opt.pd) : null),
      } : null
      if (nonEmptyOpt) payload.optometry_record = nonEmptyOpt

      const nonEmptyLens = Object.keys(lens).length > 0 ? {
        ...lens,
        left_lens_price: lens.left_lens_price ? parseFloat(lens.left_lens_price) : null,
        right_lens_price: lens.right_lens_price ? parseFloat(lens.right_lens_price) : null,
        frame_price: lens.frame_price ? parseFloat(lens.frame_price) : null,
        total_price: lens.total_price ? parseFloat(lens.total_price) : null,
      } : null
      if (nonEmptyLens) payload.lens_order = nonEmptyLens

      const nonEmptyReg = Object.keys(reg).length > 0 ? {
        ...reg,
        deposit_amount: reg.deposit_amount ? parseFloat(reg.deposit_amount) : null,
      } : null
      if (nonEmptyReg) payload.registration = nonEmptyReg

      const res = await api.post('/orders/correct', payload)
      if (!res.data.success) {
        alert('补正失败：' + res.data.message)
        setLoading(false)
        return
      }
      alert('补正成功：' + res.data.message)
      onSuccess()
    } catch (e) {
      alert('操作失败：' + (e.response?.data?.detail || e.message))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-mask" onClick={onClose}>
      <div className="modal large" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>补正资料（当前版本 v{order.version}）</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body" style={{ maxHeight: '65vh', overflowY: 'auto' }}>
          <div className="alert-box warning">
            补正后版本将递增，重新回到「待审核」状态。请核对数据后提交。
          </div>

          <div className="section-title">🔬 验光档案补正</div>
          <div className="form-row">
            <div className="form-group">
              <label>左眼 球镜 (S)</label>
              <input type="number" step="0.25" value={opt.left_sphere ?? ''}
                onChange={(e) => updateOpt('left_sphere', e.target.value)} />
            </div>
            <div className="form-group">
              <label>右眼 球镜 (S)</label>
              <input type="number" step="0.25" value={opt.right_sphere ?? ''}
                onChange={(e) => updateOpt('right_sphere', e.target.value)} />
            </div>
            <div className="form-group">
              <label>左眼 柱镜 (C)</label>
              <input type="number" step="0.25" value={opt.left_cylinder ?? ''}
                onChange={(e) => updateOpt('left_cylinder', e.target.value)} />
            </div>
            <div className="form-group">
              <label>右眼 柱镜 (C)</label>
              <input type="number" step="0.25" value={opt.right_cylinder ?? ''}
                onChange={(e) => updateOpt('right_cylinder', e.target.value)} />
            </div>
            <div className="form-group">
              <label>左眼 轴位 (A)</label>
              <input type="number" value={opt.left_axis ?? ''}
                onChange={(e) => updateOpt('left_axis', e.target.value)} />
            </div>
            <div className="form-group">
              <label>右眼 轴位 (A)</label>
              <input type="number" value={opt.right_axis ?? ''}
                onChange={(e) => updateOpt('right_axis', e.target.value)} />
            </div>
            <div className="form-group">
              <label>瞳距 PD</label>
              <input type="number" step="0.5" value={opt.pd ?? ''}
                onChange={(e) => updateOpt('pd', e.target.value)} />
            </div>
            <div className="form-group">
              <label>验光备注</label>
              <input value={opt.exam_notes || ''} onChange={(e) => updateOpt('exam_notes', e.target.value)} />
            </div>
          </div>

          <div className="section-title">🔍 镜片订购补正</div>
          <div className="form-row">
            <div className="form-group">
              <label>左眼镜片类型</label>
              <input value={lens.left_lens_type || ''} onChange={(e) => updateLens('left_lens_type', e.target.value)} />
            </div>
            <div className="form-group">
              <label>右眼镜片类型</label>
              <input value={lens.right_lens_type || ''} onChange={(e) => updateLens('right_lens_type', e.target.value)} />
            </div>
            <div className="form-group">
              <label>左眼镜片品牌</label>
              <input value={lens.left_lens_brand || ''} onChange={(e) => updateLens('left_lens_brand', e.target.value)} />
            </div>
            <div className="form-group">
              <label>右眼镜片品牌</label>
              <input value={lens.right_lens_brand || ''} onChange={(e) => updateLens('right_lens_brand', e.target.value)} />
            </div>
            <div className="form-group">
              <label>镜架品牌</label>
              <input value={lens.frame_brand || ''} onChange={(e) => updateLens('frame_brand', e.target.value)} />
            </div>
            <div className="form-group">
              <label>镜架型号</label>
              <input value={lens.frame_model || ''} onChange={(e) => updateLens('frame_model', e.target.value)} />
            </div>
            <div className="form-group">
              <label>订单总价</label>
              <input type="number" value={lens.total_price ?? ''}
                onChange={(e) => updateLens('total_price', e.target.value)} />
            </div>
            <div className="form-group">
              <label>供应商</label>
              <input value={lens.supplier || ''} onChange={(e) => updateLens('supplier', e.target.value)} />
            </div>
          </div>

          <div className="section-title">📋 订单登记补正</div>
          <div className="form-row">
            <div className="form-group">
              <label>业务人员</label>
              <input value={reg.sales_person || ''} onChange={(e) => updateReg('sales_person', e.target.value)} />
            </div>
            <div className="form-group">
              <label>订金</label>
              <input type="number" value={reg.deposit_amount ?? ''}
                onChange={(e) => updateReg('deposit_amount', e.target.value)} />
            </div>
            <div className="form-group">
              <label>预计交货日期</label>
              <input type="date" value={reg.expected_delivery || ''}
                onChange={(e) => updateReg('expected_delivery', e.target.value)} />
            </div>
            <div className="form-group">
              <label>交付方式</label>
              <select value={reg.delivery_method || '门店自取'}
                onChange={(e) => updateReg('delivery_method', e.target.value)}>
                <option>门店自取</option><option>快递包邮</option><option>快递到付</option>
              </select>
            </div>
          </div>

          <div className="form-group mt-16">
            <label>补正说明 <span style={{ color: '#ff4d4f' }}>*</span></label>
            <textarea value={opinion} onChange={(e) => setOpinion(e.target.value)}
              placeholder="请说明本次补正的具体内容，例如：已补充验光档案PD值、已上传镜片品牌确认单..." />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-default" onClick={onClose} disabled={loading}>取消</button>
          <button className="btn btn-primary" onClick={submit} disabled={loading}>
            {loading ? '提交中...' : '确认补正并重新提交'}
          </button>
        </div>
      </div>
    </div>
  )
}
