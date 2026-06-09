import { useState } from 'react';
import { api } from '../lib/api';
import type { User } from '../types';

interface Props {
  user: User;
  onClose: () => void;
  onCreated: () => void;
}

export default function ConsultationCreate({ user, onClose, onCreated }: Props) {
  const [form, setForm] = useState({
    patient_name: '',
    patient_id: '',
    age: 0,
    gender: '男',
    department: user.department || '',
    attending_physician: '',
    consultation_type: '科间会诊',
    consultation_reason: '',
    consultation_dept: '',
    requested_doctor: '',
    appointment_time: '',
    deadline: '',
    evidence_list: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const update = (k: string, v: any) => setForm(prev => ({ ...prev, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const body: any = { ...form };
      if (form.appointment_time) body.appointment_time = new Date(form.appointment_time).toISOString();
      else body.appointment_time = null;
      if (form.deadline) body.deadline = new Date(form.deadline).toISOString();
      else body.deadline = null;
      await api.createConsultation(body);
      onCreated();
    } catch (err: any) {
      setError(err.message || '创建失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card">
      <form onSubmit={handleSubmit}>
        <div className="section-title" style={{ marginTop: 0 }}>患者信息</div>
        <div className="form-row">
          <div className="form-item">
            <label>患者姓名 *</label>
            <input value={form.patient_name} onChange={(e) => update('patient_name', e.target.value)} required />
          </div>
          <div className="form-item">
            <label>病案号 *</label>
            <input value={form.patient_id} onChange={(e) => update('patient_id', e.target.value)} required />
          </div>
          <div className="form-item">
            <label>年龄</label>
            <input type="number" value={form.age} onChange={(e) => update('age', parseInt(e.target.value) || 0)} />
          </div>
          <div className="form-item">
            <label>性别</label>
            <select value={form.gender} onChange={(e) => update('gender', e.target.value)}>
              <option value="男">男</option>
              <option value="女">女</option>
            </select>
          </div>
          <div className="form-item">
            <label>申请科室</label>
            <input value={form.department} onChange={(e) => update('department', e.target.value)} />
          </div>
          <div className="form-item">
            <label>主治医师</label>
            <input value={form.attending_physician} onChange={(e) => update('attending_physician', e.target.value)} />
          </div>
        </div>

        <div className="section-title">会诊信息</div>
        <div className="form-row">
          <div className="form-item">
            <label>会诊类型</label>
            <select value={form.consultation_type} onChange={(e) => update('consultation_type', e.target.value)}>
              <option value="科间会诊">科间会诊</option>
              <option value="紧急会诊">紧急会诊</option>
              <option value="多学科会诊">多学科会诊</option>
              <option value="院外会诊">院外会诊</option>
            </select>
          </div>
          <div className="form-item">
            <label>拟会诊科室</label>
            <input value={form.consultation_dept} onChange={(e) => update('consultation_dept', e.target.value)} placeholder="多个科室用逗号分隔" />
          </div>
          <div className="form-item">
            <label>拟邀请医生</label>
            <input value={form.requested_doctor} onChange={(e) => update('requested_doctor', e.target.value)} placeholder="多位医生用逗号分隔" />
          </div>
          <div className="form-item">
            <label>预约时间</label>
            <input type="datetime-local" value={form.appointment_time} onChange={(e) => update('appointment_time', e.target.value)} />
          </div>
          <div className="form-item">
            <label>处理截止时间</label>
            <input type="datetime-local" value={form.deadline} onChange={(e) => update('deadline', e.target.value)} />
          </div>
        </div>

        <div className="form-row">
          <div className="form-item" style={{ gridColumn: '1 / -1' }}>
            <label>会诊申请原因 *</label>
            <textarea value={form.consultation_reason} onChange={(e) => update('consultation_reason', e.target.value)} required placeholder="请详细描述患者病情和会诊目的" />
          </div>
        </div>

        <div className="form-row">
          <div className="form-item" style={{ gridColumn: '1 / -1' }}>
            <label>证据材料登记（必须，用英文逗号分隔）*</label>
            <input value={form.evidence_list} onChange={(e) => update('evidence_list', e.target.value)} placeholder="如：病历,血常规,CT片,MRI报告" required />
            <small style={{ color: 'var(--text-secondary)', marginTop: 4, display: 'block' }}>
              提交处理动作时必须从已登记的证据中选择使用
            </small>
          </div>
        </div>

        {error && <div className="alert error">{error}</div>}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
          <button type="button" onClick={onClose}>取消</button>
          <button type="submit" className="primary" disabled={loading}>
            {loading ? '创建中...' : '创建并保存（待提交）'}
          </button>
        </div>
      </form>
    </div>
  );
}
