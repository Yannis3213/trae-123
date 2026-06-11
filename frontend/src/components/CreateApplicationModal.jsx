import { createSignal } from 'solid-js';
import { api } from '../api';

export default function CreateApplicationModal({ onClose, onSuccess }) {
  const [formData, setFormData] = createSignal({
    applicant_name: '',
    applicant_id_card: '',
    applicant_phone: '',
    community: '阳光社区',
    address: '',
    family_situation: '',
    difficulty_type: '',
    application_reason: '',
    apply_amount: '',
  });
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal('');

  const difficultyTypes = [
    '低保边缘', '单亲困难', '残疾人', '失业困难', '重病困难', '老年人', '其他'
  ];
  const communities = ['阳光社区', '幸福社区', '和平社区'];

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const data = {
        ...formData(),
        apply_amount: formData().apply_amount ? parseFloat(formData().apply_amount) : null,
      };
      await api.createApplication(data);
      onSuccess && onSuccess();
      onClose();
    } catch (err) {
      setError(err.error_message || '创建申请失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div class="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div class="modal">
        <div class="modal-header">
          <h3>新建帮扶申请</h3>
          <button class="close-btn" onClick={onClose}>&times;</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div class="modal-body">
            {error() && <div class="error-message">{error()}</div>}

            <div class="form-group">
              <label>申请人姓名 *</label>
              <input
                type="text"
                value={formData().applicant_name}
                onInput={(e) => handleChange('applicant_name', e.target.value)}
                placeholder="请输入申请人姓名"
                required
              />
            </div>

            <div class="detail-grid">
              <div class="form-group">
                <label>身份证号 *</label>
                <input
                  type="text"
                  value={formData().applicant_id_card}
                  onInput={(e) => handleChange('applicant_id_card', e.target.value)}
                  placeholder="请输入18位身份证号"
                  required
                  maxlength="18"
                />
              </div>
              <div class="form-group">
                <label>联系电话 *</label>
                <input
                  type="tel"
                  value={formData().applicant_phone}
                  onInput={(e) => handleChange('applicant_phone', e.target.value)}
                  placeholder="请输入联系电话"
                  required
                />
              </div>
            </div>

            <div class="detail-grid">
              <div class="form-group">
                <label>所属社区 *</label>
                <select
                  value={formData().community}
                  onChange={(e) => handleChange('community', e.target.value)}
                  required
                >
                  {communities.map((c) => (
                    <option value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div class="form-group">
                <label>困难类型 *</label>
                <select
                  value={formData().difficulty_type}
                  onChange={(e) => handleChange('difficulty_type', e.target.value)}
                  required
                >
                  <option value="">请选择困难类型</option>
                  {difficultyTypes.map((t) => (
                    <option value={t}>{t}</option>
                  ))}
                </select>
              </div>
            </div>

            <div class="form-group">
              <label>家庭住址 *</label>
              <input
                type="text"
                value={formData().address}
                onInput={(e) => handleChange('address', e.target.value)}
                placeholder="请输入详细住址"
                required
              />
            </div>

            <div class="form-group">
              <label>家庭情况 *</label>
              <textarea
                value={formData().family_situation}
                onInput={(e) => handleChange('family_situation', e.target.value)}
                placeholder="请详细描述家庭情况"
                required
              />
            </div>

            <div class="form-group">
              <label>申请理由 *</label>
              <textarea
                value={formData().application_reason}
                onInput={(e) => handleChange('application_reason', e.target.value)}
                placeholder="请说明申请理由"
                required
              />
            </div>

            <div class="form-group">
              <label>申请金额（元）</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={formData().apply_amount}
                onInput={(e) => handleChange('apply_amount', e.target.value)}
                placeholder="请输入申请金额，选填"
              />
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-default" onClick={onClose} disabled={loading()}>
              取消
            </button>
            <button type="submit" class="btn btn-primary" disabled={loading()}>
              {loading() ? '创建中...' : '创建申请'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
