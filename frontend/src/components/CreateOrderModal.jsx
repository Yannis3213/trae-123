import React, { useState } from 'react';
import { visitsApi } from '../lib/api';

const daysLater = (d) => {
  const t = new Date();
  t.setDate(t.getDate() + d);
  return t.toISOString().slice(0, 16);
};

export default function CreateOrderModal({ doctors, onClose, onSuccess }) {
  const [form, setForm] = useState({
    pet_name: '',
    pet_type: '犬',
    pet_breed: '',
    pet_age: '',
    pet_gender: '公',
    owner_name: '',
    owner_phone: '',
    appointment_time: daysLater(1),
    visit_time: daysLater(2),
    follow_up_time: daysLater(9),
    chief_complaint: '',
    priority: 'normal',
    deadline: daysLater(5)
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (k, v) => setForm({ ...form, [k]: v });

  const handleSubmit = async () => {
    if (!form.pet_name || !form.pet_type || !form.owner_name || !form.owner_phone || !form.deadline) {
      setError('请填写所有必填项');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await visitsApi.create({
        ...form,
        pet_age: form.pet_age ? Number(form.pet_age) : null
      });
      if (res.success) onSuccess();
      else setError(res.message || '创建失败');
    } catch (err) {
      setError(err.message || '创建失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-mask" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>➕ 新建宠物就诊单</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        {error && <div className="error-box">{error}</div>}

        <div className="section-title">🐾 宠物建档信息</div>
        <div className="form-row">
          <div className="form-group">
            <label className="required">宠物名称</label>
            <input value={form.pet_name} onChange={e => handleChange('pet_name', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="required">宠物类型</label>
            <select value={form.pet_type} onChange={e => handleChange('pet_type', e.target.value)}>
              <option>犬</option>
              <option>猫</option>
              <option>其他</option>
            </select>
          </div>
          <div className="form-group">
            <label>品种</label>
            <input value={form.pet_breed} onChange={e => handleChange('pet_breed', e.target.value)} />
          </div>
          <div className="form-group">
            <label>年龄（岁）</label>
            <input type="number" value={form.pet_age} onChange={e => handleChange('pet_age', e.target.value)} />
          </div>
          <div className="form-group">
            <label>性别</label>
            <select value={form.pet_gender} onChange={e => handleChange('pet_gender', e.target.value)}>
              <option>公</option>
              <option>母</option>
            </select>
          </div>
        </div>

        <div className="section-title">👤 主人及预约信息</div>
        <div className="form-row">
          <div className="form-group">
            <label className="required">主人姓名</label>
            <input value={form.owner_name} onChange={e => handleChange('owner_name', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="required">联系电话</label>
            <input value={form.owner_phone} onChange={e => handleChange('owner_phone', e.target.value)} />
          </div>
          <div className="form-group">
            <label>预约就诊时间</label>
            <input type="datetime-local" value={form.appointment_time} onChange={e => handleChange('appointment_time', e.target.value)} />
          </div>
          <div className="form-group">
            <label>实际就诊时间</label>
            <input type="datetime-local" value={form.visit_time} onChange={e => handleChange('visit_time', e.target.value)} />
          </div>
          <div className="form-group">
            <label>诊后回访时间</label>
            <input type="datetime-local" value={form.follow_up_time} onChange={e => handleChange('follow_up_time', e.target.value)} />
          </div>
        </div>

        <div className="section-title">📋 就诊及流程信息</div>
        <div className="form-row">
          <div className="form-group" style={{ flex: 2 }}>
            <label>主诉</label>
            <textarea value={form.chief_complaint} onChange={e => handleChange('chief_complaint', e.target.value)} placeholder="请描述宠物症状" />
          </div>
          <div className="form-group">
            <label>优先级</label>
            <select value={form.priority} onChange={e => handleChange('priority', e.target.value)}>
              <option value="urgent">紧急</option>
              <option value="high">高</option>
              <option value="normal">普通</option>
              <option value="low">低</option>
            </select>
          </div>
          <div className="form-group">
            <label className="required">处理截止时间</label>
            <input type="datetime-local" value={form.deadline} onChange={e => handleChange('deadline', e.target.value)} />
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn" onClick={onClose}>取消</button>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={loading}>
            {loading ? '创建中...' : '创建就诊单'}
          </button>
        </div>
      </div>
    </div>
  );
}
