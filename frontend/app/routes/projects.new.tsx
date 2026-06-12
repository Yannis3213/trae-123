import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { api, TrainingProjectCreate, getUser } from '~/app/api'
import dayjs from 'dayjs'

export const Route = createFileRoute('/projects/new')({
  component: NewProject,
})

function NewProject() {
  const nav = useNavigate()
  const user = getUser()

  useEffect(() => {
    if (!user) {
      nav({ to: '/login' })
    } else if (user.role !== 'registrar') {
      alert('仅课程顾问角色可创建培训项目单')
      nav({ to: '/projects' })
    }
  }, [user, nav])

  const defaultDeadline = dayjs().add(15, 'day').format('YYYY-MM-DD')

  const [form, setForm] = useState<any>({
    project_name: '',
    client_company: '',
    contact_person: '',
    contact_phone: '',
    training_type: '通用类',
    training_count: 0,
    expected_start_date: '',
    expected_end_date: '',
    demand_description: '',
    plan_content: '',
    quotation_amount: 0,
    contract_no: '',
    contract_date: '',
    deadline: defaultDeadline,
    stage: 'demand',
  })

  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  const types = ['通用类', '管理类', '销售类', '技术类', '服务类', '其他']

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.project_name || !form.client_company) {
      setErr('项目名称和客户公司为必填项')
      return
    }
    setSaving(true)
    setErr('')
    try {
      const data: any = {
        ...form,
        expected_start_date: form.expected_start_date ? new Date(form.expected_start_date).toISOString() : null,
        expected_end_date: form.expected_end_date ? new Date(form.expected_end_date).toISOString() : null,
        contract_date: form.contract_date ? new Date(form.contract_date).toISOString() : null,
        deadline: form.deadline ? new Date(form.deadline + 'T23:59:59').toISOString() : null,
        training_count: Number(form.training_count) || 0,
        quotation_amount: Number(form.quotation_amount) || 0,
      }
      const res = await api.createProject(data)
      nav({ to: `/projects/$id`, params: { id: String(res.id) } })
    } catch (e: any) {
      setErr(e.message || '创建失败')
    } finally {
      setSaving(false)
    }
  }

  const field = (key: string, label: string, type = 'text', opts?: string[]) => (
    <div>
      <label className="label">{label}</label>
      {opts ? (
        <select className="input" value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })}>
          {opts.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      ) : (
        <input
          type={type}
          className="input"
          value={form[key] ?? ''}
          onChange={(e) =>
            setForm({ ...form, [key]: type === 'number' ? e.target.value : e.target.value })
          }
        />
      )}
    </div>
  )

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <button onClick={() => nav({ to: '/projects' })} className="btn mb-2">← 返回列表</button>
          <h1 className="text-xl font-bold text-gray-800">➕ 新建培训项目单</h1>
          <div className="text-sm text-gray-500 mt-1">课程顾问填写入口数据，可直接从「培训需求」开始，也可直接填写至「合同确认」</div>
        </div>
      </div>

      {err && <div className="p-3 rounded bg-red-50 text-red-700 border border-red-200 text-sm">❌ {err}</div>}

      <form onSubmit={submit} className="card p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
          {field('project_name', '项目名称 *')}
          {field('client_company', '客户公司 *')}
          {field('contact_person', '联系人')}
          {field('contact_phone', '联系电话')}
          {field('training_type', '培训类型', 'text', types)}
          {field('training_count', '预计培训人数', 'number')}
          {field('expected_start_date', '预计开始日期', 'date')}
          {field('expected_end_date', '预计结束日期', 'date')}
          {field('deadline', '办理截止日期（月底集中考核）*', 'date')}
          <div>
            <label className="label">当前办理阶段</label>
            <select className="input" value={form.stage} onChange={(e) => setForm({ ...form, stage: e.target.value })}>
              <option value="demand">培训需求</option>
              <option value="plan">方案报价</option>
              <option value="contract">合同确认</option>
            </select>
          </div>
        </div>

        <div>
          <label className="label">
            阶段说明
            <span className="ml-2 text-xs text-gray-400 font-normal">
              培训需求 → 方案报价 → 合同确认，建议由浅入深连续办理
            </span>
          </label>
          <div className="grid grid-cols-3 gap-3 text-sm">
            <div className={`p-3 rounded border ${form.stage === 'demand' ? 'bg-sky-50 border-sky-300' : 'bg-gray-50 border-gray-200'}`}>
              <div className="font-semibold mb-1">① 培训需求阶段</div>
              <div className="text-xs text-gray-600">填写需求描述、培训类型、人数、时间等</div>
            </div>
            <div className={`p-3 rounded border ${form.stage === 'plan' ? 'bg-purple-50 border-purple-300' : 'bg-gray-50 border-gray-200'}`}>
              <div className="font-semibold mb-1">② 方案报价阶段</div>
              <div className="text-xs text-gray-600">填写方案内容、报价金额、上传方案材料</div>
            </div>
            <div className={`p-3 rounded border ${form.stage === 'contract' ? 'bg-teal-50 border-teal-300' : 'bg-gray-50 border-gray-200'}`}>
              <div className="font-semibold mb-1">③ 合同确认阶段</div>
              <div className="text-xs text-gray-600">填写合同编号、签订日期、上传合同扫描件</div>
            </div>
          </div>
        </div>

        <div>
          <label className="label">培训需求描述（需求阶段必备）</label>
          <textarea
            className="input"
            rows={4}
            value={form.demand_description}
            onChange={(e) => setForm({ ...form, demand_description: e.target.value })}
            placeholder="请详细描述客户培训需求、培训目标、重点关注内容等..."
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
          {field('quotation_amount', '报价金额（元）', 'number')}
          {field('contract_no', '合同编号')}
        </div>

        <div>
          <label className="label">方案内容与报价说明（方案阶段必备）</label>
          <textarea
            className="input"
            rows={4}
            value={form.plan_content}
            onChange={(e) => setForm({ ...form, plan_content: e.target.value })}
            placeholder="请填写方案内容（课程体系、讲师安排、实施方式）和报价明细说明..."
          />
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
          <button type="button" className="btn" onClick={() => nav({ to: '/projects' })}>取消</button>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? '创建中...' : '创建项目单'}
          </button>
        </div>
      </form>
    </div>
  )
}
