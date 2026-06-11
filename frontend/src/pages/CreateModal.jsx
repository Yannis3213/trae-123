import { useState } from 'preact/hooks'
import { api } from '../api'
import { PRIORITY, PRIORITY_NAMES, ROLES } from '../types'

export default function CreateModal({ store, onClose }) {
  const { currentUser, showToast, refresh } = store
  const [form, setForm] = useState({
    title: '',
    description: '',
    location: '',
    priority: PRIORITY.MEDIUM,
    responsible: '',
    deadline: ''
  })
  const [submitting, setSubmitting] = useState(false)

  const canCreate = currentUser.role === ROLES.FIRE_CLERK

  const handleSubmit = async () => {
    if (!canCreate) {
      showToast('只有消防文员可以新建隐患单', 'error')
      return
    }
    if (!form.title.trim()) {
      showToast('请输入隐患标题', 'error')
      return
    }
    setSubmitting(true)
    try {
      const res = await api.createHazard(form)
      if (res.success) {
        showToast('隐患单创建成功，单号：' + res.data.hazard_no, 'success')
        refresh()
        onClose()
      } else {
        showToast(res.message || '创建失败', 'error')
      }
    } catch (e) {
      showToast(e.message || '创建失败', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="modal-mask" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <div className="modal-title">➕ 新建消防隐患单</div>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>
        <div className="modal-body">
          {!canCreate ? (
            <div style={{padding: '40px 20px', textAlign: 'center', color: '#dc2626'}}>
              ⚠️ 当前角色无权限新建隐患单，请切换到「消防文员」角色
            </div>
          ) : (
            <>
              <div className="form-group">
                <label className="form-label required">隐患标题</label>
                <input
                  type="text"
                  className="input"
                  placeholder="请简要描述消防隐患"
                  value={form.title}
                  onChange={e => setForm({...form, title: e.target.value})}
                />
              </div>
              <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px'}}>
                <div className="form-group">
                  <label className="form-label">隐患位置</label>
                  <input
                    type="text"
                    className="input"
                    placeholder="请输入具体位置"
                    value={form.location}
                    onChange={e => setForm({...form, location: e.target.value})}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">优先级</label>
                  <select
                    className="input"
                    value={form.priority}
                    onChange={e => setForm({...form, priority: e.target.value})}
                  >
                    {Object.entries(PRIORITY_NAMES).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px'}}>
                <div className="form-group">
                  <label className="form-label">责任人</label>
                  <input
                    type="text"
                    className="input"
                    placeholder="整改责任人"
                    value={form.responsible}
                    onChange={e => setForm({...form, responsible: e.target.value})}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">整改截止日期</label>
                  <input
                    type="date"
                    className="input"
                    value={form.deadline}
                    onChange={e => setForm({...form, deadline: e.target.value})}
                  />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">详细描述</label>
                <textarea
                  className="textarea"
                  placeholder="请详细描述消防隐患情况、发现过程等"
                  value={form.description}
                  onChange={e => setForm({...form, description: e.target.value})}
                />
              </div>
            </>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn" onClick={onClose} disabled={submitting}>取消</button>
          {canCreate && (
            <button className="btn btn-primary" onClick={handleSubmit} disabled={submitting}>
              {submitting ? '提交中...' : '创建隐患单'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
