import { useState, useEffect } from 'preact/hooks';
import { fetchStores, getCurrentUser } from '../api/client.js';

export default function CreateOrderModal({ onClose, onSubmit }) {
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(false);
  const user = getCurrentUser();
  
  const [form, setForm] = useState({
    store_id: user?.store_id || '',
    order_date: new Date().toISOString().slice(0, 10),
    expected_arrival: '',
    items: [{
      material_name: '',
      spec: '',
      quantity: 1,
      unit: '箱',
      unit_price: 0
    }]
  });

  useEffect(() => {
    fetchStores().then(setStores).catch(() => {});
  }, []);

  const handleChange = (field, value) => {
    setForm({ ...form, [field]: value });
  };

  const handleItemChange = (idx, field, value) => {
    const items = [...form.items];
    items[idx] = { ...items[idx], [field]: value };
    setForm({ ...form, items });
  };

  const addItem = () => {
    setForm({
      ...form,
      items: [...form.items, { material_name: '', spec: '', quantity: 1, unit: '箱', unit_price: 0 }]
    });
  };

  const removeItem = (idx) => {
    if (form.items.length <= 1) return;
    const items = form.items.filter((_, i) => i !== idx);
    setForm({ ...form, items });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!form.store_id) {
      alert('请选择门店');
      return;
    }
    if (!form.order_date) {
      alert('请选择订货日期');
      return;
    }
    if (form.items.some(i => !i.material_name || i.quantity <= 0 || i.unit_price <= 0)) {
      alert('请填写完整的商品信息');
      return;
    }

    setLoading(true);
    try {
      await onSubmit(form);
    } catch (err) {
    } finally {
      setLoading(false);
    }
  };

  const totalAmount = form.items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);

  return (
    <div class="modal-overlay" onClick={onClose}>
      <div class="modal" style={{ width: '800px' }} onClick={e => e.stopPropagation()}>
        <div class="modal-header">
          <div class="modal-title">新增原料订货单</div>
          <button class="modal-close" onClick={onClose}>×</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div class="modal-body">
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">门店</label>
                <select
                  class="form-input"
                  value={form.store_id}
                  onChange={(e) => handleChange('store_id', e.target.value)}
                  required
                >
                  <option value="">请选择门店</option>
                  {stores.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">订货日期</label>
                <input
                  type="date"
                  class="form-input"
                  value={form.order_date}
                  onChange={(e) => handleChange('order_date', e.target.value)}
                  required
                />
              </div>
              <div class="form-group">
                <label class="form-label">预计到货日期</label>
                <input
                  type="date"
                  class="form-input"
                  value={form.expected_arrival}
                  onChange={(e) => handleChange('expected_arrival', e.target.value)}
                />
              </div>
            </div>

            <div class="form-group">
              <label class="form-label">
                订货明细
                <button
                  type="button"
                  class="btn btn-primary"
                  style={{ padding: '4px 12px', fontSize: '12px', marginLeft: '12px' }}
                  onClick={addItem}
                >
                  + 添加商品
                </button>
              </label>
              <table class="items-table">
                <thead>
                  <tr>
                    <th>原料名称</th>
                    <th>规格</th>
                    <th>数量</th>
                    <th>单位</th>
                    <th>单价</th>
                    <th>金额</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {form.items.map((item, idx) => (
                    <tr key={idx}>
                      <td>
                        <input
                          type="text"
                          class="form-input"
                          style={{ width: '120px', padding: '4px 8px', fontSize: '12px' }}
                          value={item.material_name}
                          onChange={(e) => handleItemChange(idx, 'material_name', e.target.value)}
                          placeholder="原料名称"
                          required
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          class="form-input"
                          style={{ width: '80px', padding: '4px 8px', fontSize: '12px' }}
                          value={item.spec}
                          onChange={(e) => handleItemChange(idx, 'spec', e.target.value)}
                          placeholder="规格"
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          class="form-input"
                          style={{ width: '60px', padding: '4px 8px', fontSize: '12px' }}
                          value={item.quantity}
                          onChange={(e) => handleItemChange(idx, 'quantity', parseFloat(e.target.value) || 0)}
                          min="0.01"
                          step="0.01"
                          required
                        />
                      </td>
                      <td>
                        <select
                          class="form-input"
                          style={{ width: '60px', padding: '4px 8px', fontSize: '12px' }}
                          value={item.unit}
                          onChange={(e) => handleItemChange(idx, 'unit', e.target.value)}
                        >
                          <option value="箱">箱</option>
                          <option value="袋">袋</option>
                          <option value="桶">桶</option>
                          <option value="盒">盒</option>
                          <option value="包">包</option>
                          <option value="个">个</option>
                          <option value="kg">kg</option>
                        </select>
                      </td>
                      <td>
                        <input
                          type="number"
                          class="form-input"
                          style={{ width: '70px', padding: '4px 8px', fontSize: '12px' }}
                          value={item.unit_price}
                          onChange={(e) => handleItemChange(idx, 'unit_price', parseFloat(e.target.value) || 0)}
                          min="0.01"
                          step="0.01"
                          required
                        />
                      </td>
                      <td style={{ fontWeight: '500' }}>
                        ¥{(item.quantity * item.unit_price).toFixed(2)}
                      </td>
                      <td>
                        <button
                          type="button"
                          class="link-btn"
                          style={{ color: '#ff4d4f' }}
                          onClick={() => removeItem(idx)}
                          disabled={form.items.length <= 1}
                        >
                          删除
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan="5" style={{ textAlign: 'right', fontWeight: '600', padding: '12px' }}>
                      合计金额:
                    </td>
                    <td style={{ fontWeight: '600', color: '#1890ff', fontSize: '16px' }}>
                      ¥{totalAmount.toFixed(2)}
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-default" onClick={onClose}>取消</button>
            <button type="submit" class="btn btn-primary" disabled={loading}>
              {loading && <span class="spinner" />}
              {loading ? '提交中...' : '创建订货单'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
