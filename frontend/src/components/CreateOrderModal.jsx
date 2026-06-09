import React, { useState } from 'react'
import api from '../api.js'

export default function CreateOrderModal({ onClose, onSuccess }) {
  const [form, setForm] = useState({
    customer_name: '',
    customer_phone: '',
    business_area: '东城区业务区',
    optometry_record: {
      left_sphere: null, left_cylinder: null, left_axis: null, left_visual_acuity: '',
      right_sphere: null, right_cylinder: null, right_axis: null, right_visual_acuity: '',
      pd: null, exam_notes: ''
    },
    lens_order: {
      left_lens_type: '', left_lens_brand: '', left_lens_price: null,
      right_lens_type: '', right_lens_brand: '', right_lens_price: null,
      frame_brand: '', frame_model: '', frame_price: null, total_price: null, supplier: ''
    },
    registration: {
      sales_person: '', registered_at: new Date().toISOString().slice(0, 16),
      payment_method: '现金', deposit_amount: null, delivery_method: '门店自取',
      expected_delivery: null, notes: ''
    }
  })
  const [loading, setLoading] = useState(false)

  const update = (key, value) => setForm({ ...form, [key]: value })
  const updateOpt = (k, v) => setForm({ ...form, optometry_record: { ...form.optometry_record, [k]: v } })
  const updateLens = (k, v) => setForm({ ...form, lens_order: { ...form.lens_order, [k]: v } })
  const updateReg = (k, v) => setForm({ ...form, registration: { ...form.registration, [k]: v } })

  const submit = async () => {
    if (!form.customer_name || !form.customer_phone) {
      alert('请填写客户姓名和联系电话')
      return
    }
    setLoading(true)
    try {
      await api.post('/orders', form)
      onSuccess()
    } catch (e) {
      alert('创建失败：' + (e.response?.data?.detail || e.message))
    } finally {
      setLoading(false)
    }
  }

  const inputNum = (v) => {
    if (v === '' || v === null || v === undefined) return null
    const n = parseFloat(v)
    return isNaN(n) ? null : n
  }

  return (
    <div className="modal-mask" onClick={onClose}>
      <div className="modal large" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>新建配镜订单</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
          <div className="form-section">
            <h4>📋 订单登记</h4>
            <div className="form-row">
              <div className="form-group">
                <label>客户姓名 *</label>
                <input value={form.customer_name} onChange={(e) => update('customer_name', e.target.value)} />
              </div>
              <div className="form-group">
                <label>联系电话 *</label>
                <input value={form.customer_phone} onChange={(e) => update('customer_phone', e.target.value)} />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>业务区</label>
                <select value={form.business_area} onChange={(e) => update('business_area', e.target.value)}>
                  <option>东城区业务区</option>
                  <option>西城区业务区</option>
                  <option>南城区业务区</option>
                </select>
              </div>
              <div className="form-group">
                <label>业务人员</label>
                <input value={form.registration.sales_person}
                  onChange={(e) => updateReg('sales_person', e.target.value)} />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>收款方式</label>
                <select value={form.registration.payment_method}
                  onChange={(e) => updateReg('payment_method', e.target.value)}>
                  <option>现金</option><option>微信</option><option>支付宝</option>
                  <option>银行卡</option>
                </select>
              </div>
              <div className="form-group">
                <label>订金（元）</label>
                <input type="number" value={form.registration.deposit_amount ?? ''}
                  onChange={(e) => updateReg('deposit_amount', inputNum(e.target.value))} />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>交付方式</label>
                <select value={form.registration.delivery_method}
                  onChange={(e) => updateReg('delivery_method', e.target.value)}>
                  <option>门店自取</option><option>快递包邮</option><option>快递到付</option>
                </select>
              </div>
              <div className="form-group">
                <label>预计交货日期</label>
                <input type="date" value={form.registration.expected_delivery ?? ''}
                  onChange={(e) => updateReg('expected_delivery', e.target.value || null)} />
              </div>
            </div>
            <div className="form-group">
              <label>备注</label>
              <textarea value={form.registration.notes}
                onChange={(e) => updateReg('notes', e.target.value)} />
            </div>
          </div>

          <div className="form-section">
            <h4>🔬 验光档案</h4>
            <div className="form-row">
              <div className="form-group">
                <label>左眼 球镜 (S)</label>
                <input type="number" step="0.25" value={form.optometry_record.left_sphere ?? ''}
                  onChange={(e) => updateOpt('left_sphere', inputNum(e.target.value))} />
              </div>
              <div className="form-group">
                <label>左眼 柱镜 (C)</label>
                <input type="number" step="0.25" value={form.optometry_record.left_cylinder ?? ''}
                  onChange={(e) => updateOpt('left_cylinder', inputNum(e.target.value))} />
              </div>
              <div className="form-group">
                <label>左眼 轴位 (A)</label>
                <input type="number" value={form.optometry_record.left_axis ?? ''}
                  onChange={(e) => updateOpt('left_axis', e.target.value ? parseInt(e.target.value) : null)} />
              </div>
              <div className="form-group">
                <label>左眼 矫正视力</label>
                <input value={form.optometry_record.left_visual_acuity}
                  onChange={(e) => updateOpt('left_visual_acuity', e.target.value)} />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>右眼 球镜 (S)</label>
                <input type="number" step="0.25" value={form.optometry_record.right_sphere ?? ''}
                  onChange={(e) => updateOpt('right_sphere', inputNum(e.target.value))} />
              </div>
              <div className="form-group">
                <label>右眼 柱镜 (C)</label>
                <input type="number" step="0.25" value={form.optometry_record.right_cylinder ?? ''}
                  onChange={(e) => updateOpt('right_cylinder', inputNum(e.target.value))} />
              </div>
              <div className="form-group">
                <label>右眼 轴位 (A)</label>
                <input type="number" value={form.optometry_record.right_axis ?? ''}
                  onChange={(e) => updateOpt('right_axis', e.target.value ? parseInt(e.target.value) : null)} />
              </div>
              <div className="form-group">
                <label>右眼 矫正视力</label>
                <input value={form.optometry_record.right_visual_acuity}
                  onChange={(e) => updateOpt('right_visual_acuity', e.target.value)} />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>瞳距 PD (mm)</label>
                <input type="number" step="0.5" value={form.optometry_record.pd ?? ''}
                  onChange={(e) => updateOpt('pd', inputNum(e.target.value))} />
              </div>
              <div className="form-group" style={{ gridColumn: 'span 1' }}>
                <label>验光备注</label>
                <input value={form.optometry_record.exam_notes}
                  onChange={(e) => updateOpt('exam_notes', e.target.value)} />
              </div>
            </div>
          </div>

          <div className="form-section">
            <h4>🔍 镜片订购</h4>
            <div className="form-row">
              <div className="form-group">
                <label>左眼镜片类型</label>
                <input value={form.lens_order.left_lens_type}
                  onChange={(e) => updateLens('left_lens_type', e.target.value)} />
              </div>
              <div className="form-group">
                <label>左眼镜片品牌</label>
                <input value={form.lens_order.left_lens_brand}
                  onChange={(e) => updateLens('left_lens_brand', e.target.value)} />
              </div>
              <div className="form-group">
                <label>左眼镜片价格</label>
                <input type="number" value={form.lens_order.left_lens_price ?? ''}
                  onChange={(e) => updateLens('left_lens_price', inputNum(e.target.value))} />
              </div>
              <div className="form-group">
                <label>右眼镜片类型</label>
                <input value={form.lens_order.right_lens_type}
                  onChange={(e) => updateLens('right_lens_type', e.target.value)} />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>右眼镜片品牌</label>
                <input value={form.lens_order.right_lens_brand}
                  onChange={(e) => updateLens('right_lens_brand', e.target.value)} />
              </div>
              <div className="form-group">
                <label>右眼镜片价格</label>
                <input type="number" value={form.lens_order.right_lens_price ?? ''}
                  onChange={(e) => updateLens('right_lens_price', inputNum(e.target.value))} />
              </div>
              <div className="form-group">
                <label>镜架品牌</label>
                <input value={form.lens_order.frame_brand}
                  onChange={(e) => updateLens('frame_brand', e.target.value)} />
              </div>
              <div className="form-group">
                <label>镜架型号</label>
                <input value={form.lens_order.frame_model}
                  onChange={(e) => updateLens('frame_model', e.target.value)} />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>镜架价格</label>
                <input type="number" value={form.lens_order.frame_price ?? ''}
                  onChange={(e) => updateLens('frame_price', inputNum(e.target.value))} />
              </div>
              <div className="form-group">
                <label>总价（元）</label>
                <input type="number" value={form.lens_order.total_price ?? ''}
                  onChange={(e) => updateLens('total_price', inputNum(e.target.value))} />
              </div>
              <div className="form-group">
                <label>供应商</label>
                <input value={form.lens_order.supplier}
                  onChange={(e) => updateLens('supplier', e.target.value)} />
              </div>
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-default" onClick={onClose} disabled={loading}>取消</button>
          <button className="btn btn-primary" onClick={submit} disabled={loading}>
            {loading ? '提交中...' : '提交订单'}
          </button>
        </div>
      </div>
    </div>
  )
}
