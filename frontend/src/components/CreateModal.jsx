import { h, useState, useEffect } from 'preact';
import api from '../api.js';

export default function CreateModal({ user, onClose, onSuccess, showToast }) {
  const [children, setChildren] = useState([]);
  const [form, setForm] = useState({
    child_id: '',
    check_date: new Date().toISOString().split('T')[0],
    temperature: 36.5,
    health_status: 'normal',
    abnormal_type: '',
    abnormal_reason: '',
    remark: ''
  });
  const [attachments, setAttachments] = useState([
    { type: 'registration', name: '晨检登记表', content: '' },
    { type: 'child_profile', name: '幼儿档案卡', content: '' }
  ]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.getChildren().then(setChildren).catch(err => showToast(err.message, 'error'));
  }, []);

  const addAbnormalAttachment = () => {
    setAttachments([...attachments, { type: 'abnormal_notice', name: '异常情况通知书', content: '' }]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.child_id) { setError('请选择幼儿'); return; }

    const validAttachments = attachments.filter(a => a.name && a.type);
    if (validAttachments.length === 0) { setError('请至少提供一份证据'); return; }

    setLoading(true);
    try {
      await api.createRecord({
        ...form,
        attachments: validAttachments
      });
      showToast('晨检记录创建成功', 'success');
      onSuccess();
    } catch (err) {
      setError(err.message || '创建失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div class="modal-mask" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div class="modal">
        <div class="modal-header">
          <h3>新增晨检记录</h3>
          <button class="close" onClick={onClose}>×</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div class="modal-body">
            <div class="form-row">
              <label>幼儿 <span class="required">*</span></label>
              <select value={form.child_id} onInput={(e) => setForm({ ...form, child_id: e.target.value })}>
                <option value="">请选择</option>
                {children.map(c => (
                  <option key={c.id} value={c.id}>{c.name}（{c.class_name}）</option>
                ))}
              </select>
            </div>
            <div class="form-row">
              <label>晨检日期 <span class="required">*</span></label>
              <input type="date" value={form.check_date} onInput={(e) => setForm({ ...form, check_date: e.target.value })} />
            </div>
            <div class="form-row">
              <label>体温（℃）</label>
              <input type="number" step="0.1" min="35" max="42" value={form.temperature}
                onInput={(e) => setForm({ ...form, temperature: parseFloat(e.target.value) || 0 })} />
            </div>
            <div class="form-row">
              <label>健康状态 <span class="required">*</span></label>
              <select value={form.health_status}
                onInput={(e) => {
                  const hs = e.target.value;
                  setForm({ ...form, health_status: hs });
                  if (hs === 'abnormal' && !attachments.some(a => a.type === 'abnormal_notice')) {
                    addAbnormalAttachment();
                  }
                }}>
                <option value="normal">正常</option>
                <option value="abnormal">异常</option>
              </select>
            </div>
            {form.health_status === 'abnormal' && (
              <>
                <div class="form-row">
                  <label>异常类型</label>
                  <select value={form.abnormal_type} onInput={(e) => setForm({ ...form, abnormal_type: e.target.value })}>
                    <option value="">请选择</option>
                    <option value="fever">发热</option>
                    <option value="cough">咳嗽</option>
                    <option value="rash">皮疹</option>
                    <option value="other">其他</option>
                  </select>
                </div>
                <div class="form-row">
                  <label>异常说明</label>
                  <textarea value={form.abnormal_reason} onInput={(e) => setForm({ ...form, abnormal_reason: e.target.value })}
                    placeholder="描述异常情况" />
                </div>
              </>
            )}
            <div class="form-row">
              <label>备注</label>
              <textarea value={form.remark} onInput={(e) => setForm({ ...form, remark: e.target.value })} />
            </div>

            <h4 style={{ fontSize: 13, marginTop: 12, marginBottom: 8 }}>证据附件（必填晨检登记表、幼儿档案）</h4>
            {attachments.map((a, idx) => (
              <div key={idx} style={{ padding: 8, marginBottom: 8, background: '#fafafa', borderRadius: 4 }}>
                <div style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
                  <select value={a.type} style={{ flex: 1, padding: 4 }}
                    onInput={(e) => {
                      const next = [...attachments];
                      next[idx] = { ...a, type: e.target.value };
                      setAttachments(next);
                    }}>
                    <option value="registration">晨检登记</option>
                    <option value="child_profile">幼儿档案</option>
                    <option value="abnormal_notice">异常通知</option>
                  </select>
                  <button type="button" class="btn btn-danger" style={{ padding: '4px 10px', fontSize: 12 }}
                    onClick={() => setAttachments(attachments.filter((_, i) => i !== idx))}>删除</button>
                </div>
                <input placeholder="证据名称" value={a.name} style={{ width: '100%', marginBottom: 4, padding: 4 }}
                  onInput={(e) => {
                    const next = [...attachments];
                    next[idx] = { ...a, name: e.target.value };
                    setAttachments(next);
                  }} />
                <textarea placeholder="证据内容描述" value={a.content} style={{ width: '100%', padding: 4, minHeight: 40 }}
                  onInput={(e) => {
                    const next = [...attachments];
                    next[idx] = { ...a, content: e.target.value };
                    setAttachments(next);
                  }} />
              </div>
            ))}
            <button type="button" class="btn" onClick={() => setAttachments([...attachments, { type: 'registration', name: '', content: '' }])}>
              + 添加附件
            </button>

            {error && <div style={{ color: '#f5222d', fontSize: 13, marginTop: 10 }}>{error}</div>}
          </div>
          <div class="modal-footer">
            <button type="button" class="btn" onClick={onClose} disabled={loading}>取消</button>
            <button type="submit" class="btn btn-primary" disabled={loading}>
              {loading ? '提交中...' : '提交'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
