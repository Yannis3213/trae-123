import React, { useState, useEffect } from 'react';
import { api, type User, type DictItem, type OrderDetail as IOrderDetail } from '../lib/api';

interface Props {
  orderId: string;
  user: User;
  dict: {
    roles: DictItem[];
    statuses: DictItem[];
    abnormalTypes: DictItem[];
    warningLevels: DictItem[];
    transitions: Record<string, string[]>;
  } | null;
  onClose: () => void;
  onMessage: (type: string, text: string) => void;
}

const formatTime = (iso: string) => {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString('zh-CN', { hour12: false });
};

const EVIDENCE_LABEL: Record<string, string> = {
  prescription: '处方单',
  id_card: '身份证明',
  sign_off: '签收确认',
  other: '其他'
};

const CreateOrderModal: React.FC<{ user: User; onClose: () => void; onCreated: (o: any) => void }> = ({ user, onClose, onCreated }) => {
  const [form, setForm] = useState({
    patient_name: '',
    patient_id_card: '',
    drugs_count: 1,
    total_amount: 0,
    due_hours: 72,
    attachments: [] as any[]
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleAddAtt = () => {
    setForm(f => ({
      ...f,
      attachments: [...f.attachments, { file_name: '处方单.jpg', file_type: 'image/jpeg', file_url: '#', evidence_type: 'prescription' }]
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.patient_name.trim()) { setError('请填写患者姓名'); return; }
    setSubmitting(true);
    setError('');
    const due = new Date(Date.now() + Number(form.due_hours) * 3600 * 1000).toISOString();
    const r = await api.createOrder({
      patient_name: form.patient_name.trim(),
      patient_id_card: form.patient_id_card.trim() || undefined,
      drugs_count: Number(form.drugs_count),
      total_amount: Number(form.total_amount),
      due_at: due,
      attachments: form.attachments
    });
    setSubmitting(false);
    if (r.code === 0 && r.data) {
      onCreated(r.data);
    } else {
      setError(r.message || '创建失败');
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal small" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>新建处方订单</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="alert info">
              创建人：<b>{user.name}</b>（{user.roleName}），门店已根据账号自动关联，提交后订单将流转至该门店执业药师
            </div>
            {error && <div className="alert error">{error}</div>}
            <div className="form-row">
              <div className="form-group">
                <label><span className="required">*</span>患者姓名</label>
                <input value={form.patient_name} onChange={e => setForm({ ...form, patient_name: e.target.value })} placeholder="请输入患者姓名" />
              </div>
              <div className="form-group">
                <label>身份证号</label>
                <input value={form.patient_id_card} onChange={e => setForm({ ...form, patient_id_card: e.target.value })} placeholder="可选" />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>药品数量</label>
                <input type="number" min={0} value={form.drugs_count} onChange={e => setForm({ ...form, drugs_count: Number(e.target.value) })} />
              </div>
              <div className="form-group">
                <label>总金额（元）</label>
                <input type="number" min={0} step={0.01} value={form.total_amount} onChange={e => setForm({ ...form, total_amount: Number(e.target.value) })} />
              </div>
            </div>
            <div className="form-group">
              <label>到期（小时后）</label>
              <input type="number" min={1} value={form.due_hours} onChange={e => setForm({ ...form, due_hours: Number(e.target.value) })} />
            </div>
            <div className="form-group">
              <label>附件证据（模拟上传）</label>
              <div className="evidence-list">
                {form.attachments.map((a, idx) => (
                  <div key={idx} className="evidence-item">
                    <span>
                      <span className="evidence-type">{EVIDENCE_LABEL[a.evidence_type] || a.evidence_type}</span>
                      {a.file_name}
                    </span>
                    <button type="button" className="link-btn" onClick={() => setForm(f => ({ ...f, attachments: f.attachments.filter((_, i) => i !== idx) })}>
                      删除
                    </button>
                  </div>
                ))}
              </div>
              <button type="button" className="btn secondary" style={{ marginTop: 8 }} onClick={handleAddAtt}>
                ＋ 添加处方证据
              </button>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn secondary" onClick={onClose}>取消</button>
            <button type="submit" className="btn" disabled={submitting}>{submitting ? '提交中...' : '提交建单'}</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateOrderModal;
