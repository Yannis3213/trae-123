import { useState } from 'react';
import dayjs from 'dayjs';
import { api } from '../utils/api';

export default function CreateModal({ onClose, onSuccess }) {
  const [form, setForm] = useState({
    projectName: '',
    projectCode: '',
    location: '',
    workContent: '',
    sideRecordClue: '',
    weather: '晴',
    recordDate: dayjs().format('YYYY-MM-DD'),
    deadline: dayjs().add(7, 'day').format('YYYY-MM-DD'),
    sitePhoto: 'https://via.placeholder.com/400x300?text=现场照片',
    inspectionRecord: '',
    signatures: ''
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.projectName || !form.workContent) {
      setError('项目名称和工作内容不能为空');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const res = await api.sideRecords.create(form);
      if (res.success) {
        onSuccess && onSuccess(res.data);
      } else {
        setError(res.message || '创建失败');
      }
    } catch (e) {
      setError('创建异常');
    } finally {
      setSubmitting(false);
    }
  };

  const update = (k, v) => setForm({ ...form, [k]: v });

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 720 }}>
        <div className="modal-header">
          <h3 className="text-base font-semibold">登记旁站记录单</h3>
          <button className="text-gray-400 hover:text-gray-600 text-xl" onClick={onClose}>×</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body grid grid-cols-2 gap-x-4 gap-y-3">
            <div>
              <label className="form-label">项目名称 *</label>
              <input className="form-input" value={form.projectName} onChange={e => update('projectName', e.target.value)} />
            </div>
            <div>
              <label className="form-label">项目编号</label>
              <input className="form-input" value={form.projectCode} onChange={e => update('projectCode', e.target.value)} />
            </div>
            <div>
              <label className="form-label">旁站部位/地点</label>
              <input className="form-input" value={form.location} onChange={e => update('location', e.target.value)} />
            </div>
            <div>
              <label className="form-label">旁站记录线索</label>
              <input className="form-input" value={form.sideRecordClue} onChange={e => update('sideRecordClue', e.target.value)} placeholder="如 PZCL-YG-001" />
            </div>
            <div className="col-span-2">
              <label className="form-label">工作内容 *</label>
              <textarea className="form-textarea" rows={2} value={form.workContent} onChange={e => update('workContent', e.target.value)} />
            </div>
            <div>
              <label className="form-label">天气</label>
              <select className="form-select" value={form.weather} onChange={e => update('weather', e.target.value)}>
                <option value="晴">晴</option>
                <option value="多云">多云</option>
                <option value="阴">阴</option>
                <option value="小雨">小雨</option>
                <option value="大雨">大雨</option>
                <option value="雪">雪</option>
              </select>
            </div>
            <div>
              <label className="form-label">记录日期</label>
              <input type="date" className="form-input" value={form.recordDate} onChange={e => update('recordDate', e.target.value)} />
            </div>
            <div>
              <label className="form-label">截止日期</label>
              <input type="date" className="form-input" value={form.deadline} onChange={e => update('deadline', e.target.value)} />
            </div>
            <div />
            <div className="col-span-2">
              <div className="text-sm font-medium text-gray-700 mb-2">必填证据材料</div>
              <div className="grid grid-cols-1 gap-3 p-3 bg-gray-50 rounded">
                <div>
                  <label className="form-label">现场照片 URL</label>
                  <input className="form-input" value={form.sitePhoto} onChange={e => update('sitePhoto', e.target.value)} />
                </div>
                <div>
                  <label className="form-label">检查记录</label>
                  <textarea className="form-textarea" rows={2} value={form.inspectionRecord} onChange={e => update('inspectionRecord', e.target.value)} placeholder="请填写施工检查情况..." />
                </div>
                <div>
                  <label className="form-label">签字确认</label>
                  <input className="form-input" value={form.signatures} onChange={e => update('signatures', e.target.value)} placeholder="施工方签字：xxx；监理方签字：xxx" />
                </div>
              </div>
            </div>
            {error && (
              <div className="col-span-2 text-sm text-red-600 bg-red-50 p-2 rounded border border-red-200">{error}</div>
            )}
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-default" onClick={onClose}>取消</button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? '提交中...' : '创建并提交'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
