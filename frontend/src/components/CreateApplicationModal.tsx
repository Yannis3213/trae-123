import { useState } from 'react';
import { applicationApi } from '../api/client';
import type { Priority } from '../types';
import { PRIORITY_DISPLAY } from '../types';

interface CreateApplicationModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

export default function CreateApplicationModal({
  open,
  onClose,
  onCreated,
}: CreateApplicationModalProps) {
  const [storeId, setStoreId] = useState('');
  const [storeName, setStoreName] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<Priority>('medium');
  const [deadline, setDeadline] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (!open) return null;

  const reset = () => {
    setStoreId('');
    setStoreName('');
    setTitle('');
    setDescription('');
    setPriority('medium');
    setDeadline('');
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !storeId.trim() || !storeName.trim() || !deadline) {
      setError('请填写门店信息、标题和截止时间');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const dt = new Date(deadline);
      if (Number.isNaN(dt.getTime())) throw new Error('截止时间格式错误');
      await applicationApi.create({
        store_id: storeId.trim(),
        store_name: storeName.trim(),
        title: title.trim(),
        description: description.trim(),
        priority,
        deadline: dt.toISOString(),
      });
      reset();
      onCreated();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || '创建失败');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">📝 新建补货申请</div>
          <button className="modal-close" onClick={onClose}>
            ×
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-group">
              <label>门店编号 *</label>
              <input
                type="text"
                value={storeId}
                onChange={(e) => setStoreId(e.target.value)}
                placeholder="例如：store005"
              />
            </div>
            <div className="form-group">
              <label>门店名称 *</label>
              <input
                type="text"
                value={storeName}
                onChange={(e) => setStoreName(e.target.value)}
                placeholder="例如：丰台便利店"
              />
            </div>
            <div className="form-group">
              <label>申请标题 *</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="简述补货内容"
              />
            </div>
            <div className="form-group">
              <label>详细描述</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="详细说明补货需求..."
              />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="form-group">
                <label>优先级</label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as Priority)}
                  style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '6px' }}
                >
                  {(['low', 'medium', 'high', 'urgent'] as Priority[]).map((p) => (
                    <option key={p} value={p}>
                      {PRIORITY_DISPLAY[p]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>截止时间 *</label>
                <input
                  type="datetime-local"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                />
              </div>
            </div>
            {error && <div className="error-text">{error}</div>}
          </div>
          <div className="modal-footer">
            <button type="button" className="btn" onClick={onClose} disabled={submitting}>
              取消
            </button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? (
                <>
                  <span className="spinner" /> 创建中
                </>
              ) : (
                '创建申请'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
