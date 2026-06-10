import { createSignal, For, Show } from 'solid-js'
import { api } from '../utils/api'
import { SourceModule } from '../utils/constants'

const Dispatch = (props) => {
  const [form, setForm] = createSignal({
    title: '',
    owner_name: '物业巡查',
    owner_phone: '4008000000',
    address: '',
    repair_type: '公共设施',
    description: '',
    priority: 'normal',
    deadline: '',
  })
  const [error, setError] = createSignal('')
  const [submitting, setSubmitting] = createSignal(false)

  const submit = async () => {
    if (!form().title.trim()) {
      setError('请填写派单标题')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      await api.post('/api/orders', {
        ...form(),
        source_module: SourceModule.DISPATCH,
      })
      alert('✅ 维修派单登记成功')
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
      <h2 class="page-title">🔧 维修派单</h2>

      <Show when={error()}>
        <div class="banner-error">⚠️ {error()}</div>
      </Show>

      <div class="card">
        <h3 class="section-title">录入维修派单信息</h3>
        <div class="detail-grid">
          <div class="detail-field">
            <label>派单标题 *</label>
            <input
              placeholder="如：2号楼5层走廊灯不亮"
              value={form().title}
              onInput={(e) => setForm({ ...form(), title: e.target.value })}
            />
          </div>
          <div class="detail-field">
            <label>维修类型</label>
            <select
              value={form().repair_type}
              onChange={(e) => setForm({ ...form(), repair_type: e.target.value })}
            >
              <option>公共设施</option>
              <option>公共照明</option>
              <option>水电维修</option>
              <option>安防系统</option>
              <option>绿化养护</option>
              <option>保洁服务</option>
              <option>其他</option>
            </select>
          </div>
          <div class="detail-field">
            <label>报修人/来源</label>
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
            <label>维修地点</label>
            <input
              placeholder="如：阳光花园2号楼5层走廊"
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
            <label>处理截止时间</label>
            <input
              type="datetime-local"
              value={form().deadline}
              onInput={(e) => setForm({ ...form(), deadline: e.target.value.replace('T', ' ') + ':00' })}
            />
          </div>
          <div class="detail-field" style={{ gridColumn: '1 / -1' }}>
            <label>派单说明</label>
            <textarea
              rows={4}
              placeholder="请详细描述维修任务..."
              value={form().description}
              onInput={(e) => setForm({ ...form(), description: e.target.value })}
            />
          </div>
        </div>
        <div style={{ marginTop: '20px', display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
          <button class="btn btn-secondary" onClick={props.onCreated}>取消</button>
          <button class="btn btn-primary" disabled={submitting()} onClick={submit}>
            {submitting() ? '提交中...' : '✅ 登记维修派单'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default Dispatch
