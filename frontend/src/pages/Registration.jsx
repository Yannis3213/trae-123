import { createSignal, For, Show } from 'solid-js'
import { api } from '../utils/api'
import { SourceModule } from '../utils/constants'

const Registration = (props) => {
  const [form, setForm] = createSignal({
    title: '',
    owner_name: '',
    owner_phone: '',
    address: '',
    repair_type: '其他',
    description: '',
    priority: 'normal',
    deadline: '',
  })
  const [error, setError] = createSignal('')
  const [submitting, setSubmitting] = createSignal(false)

  const submit = async () => {
    if (!form().title.trim()) {
      setError('请填写工单标题')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      await api.post('/api/orders', {
        ...form(),
        source_module: SourceModule.REGISTRATION,
      })
      alert('✅ 报修工单登记成功')
      props.onCreated && props.onCreated()
    } catch (e) {
      setError(e.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div>
      <a class="back-link" onClick={props.onCreated}>← 返回工单列表</a>
      <h2 class="page-title">📋 报修工单登记</h2>

      <Show when={error()}>
        <div class="banner-error">⚠️ {error()}</div>
      </Show>

      <div class="card">
        <h3 class="section-title">月底集中登记 - 补录报修工单</h3>
        <div class="detail-grid">
          <div class="detail-field">
            <label>工单标题 *</label>
            <input
              placeholder="工单标题"
              value={form().title}
              onInput={(e) => setForm({ ...form(), title: e.target.value })}
            />
          </div>
          <div class="detail-field">
            <label>工单类型</label>
            <select
              value={form().repair_type}
              onChange={(e) => setForm({ ...form(), repair_type: e.target.value })}
            >
              <option>水电维修</option>
              <option>公共设施</option>
              <option>公共照明</option>
              <option>安防系统</option>
              <option>门窗维修</option>
              <option>室内维修</option>
              <option>协调处理</option>
              <option>其他</option>
            </select>
          </div>
          <div class="detail-field">
            <label>业主/报修人</label>
            <input
              value={form().owner_name}
              onInput={(e) => setForm({ ...form(), owner_name: e.target.value })}
            />
          </div>
          <div class="detail-field">
            <label>联系电话</label>
            <input
              value={form().owner_phone}
              onInput={(e) => setForm({ ...form(), owner_phone: e.target.value })}
            />
          </div>
          <div class="detail-field">
            <label>报修地址</label>
            <input
              value={form().address}
              onInput={(e) => setForm({ ...form(), address: e.target.value })}
            />
          </div>
          <div class="detail-field">
            <label>优先级</label>
            <select
              value={form().priority}
              onChange={(e) => setForm({ ...form(), priority: e.target.value })}
            >
              <option value="low">低</option>
              <option value="normal">普通</option>
              <option value="high">高</option>
              <option value="urgent">紧急</option>
            </select>
          </div>
          <div class="detail-field">
            <label>原受理时间/截止时间</label>
            <input
              type="datetime-local"
              value={form().deadline}
              onInput={(e) => setForm({ ...form(), deadline: e.target.value.replace('T', ' ') + ':00' })}
            />
          </div>
          <div class="detail-field" style={{ gridColumn: '1 / -1' }}>
            <label>工单详情</label>
            <textarea
              rows={5}
              placeholder="请详细描述工单内容、处理过程、结果等..."
              value={form().description}
              onInput={(e) => setForm({ ...form(), description: e.target.value })}
            />
          </div>
        </div>
        <div style={{ marginTop: '20px', display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
          <button class="btn btn-secondary" onClick={props.onCreated}>取消</button>
          <button class="btn btn-primary" disabled={submitting()} onClick={submit}>
            {submitting() ? '提交中...' : '✅ 登记工单'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default Registration
