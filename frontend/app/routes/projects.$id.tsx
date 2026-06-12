import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import {
  api,
  TrainingProjectDetail,
  STATUS_COLORS,
  STAGE_COLORS,
  DEADLINE_COLORS,
  ACTION_LABELS,
  getUser,
  ProcessActionRequest,
  AttachmentCreate,
} from '~/app/api'
import dayjs from 'dayjs'

export const Route = createFileRoute('/projects/$id')({
  component: ProjectDetail,
})

const ATTACHMENT_CATEGORY_LABEL: Record<string, string> = {
  demand: '需求材料',
  plan: '方案材料',
  contract: '合同材料',
  other: '其他材料',
}

const NOTE_TYPE_LABEL: Record<string, string> = {
  status_change: '状态变更',
  exception: '异常记录',
  supplement: '补正记录',
  deadline: '到期提醒',
}

const ACTION_STYLE: Record<string, string> = {
  submit: 'btn-primary',
  audit_pass: 'btn-success',
  audit_reject: 'btn-warning',
  review_pass: 'btn-success',
  review_reject: 'btn-warning',
  supplement: 'btn-primary',
  advance_stage: 'btn-primary',
  archive: 'btn',
}

const DEADLINE_LABEL: Record<string, string> = {
  normal: '正常',
  near: '临期',
  overdue: '逾期',
}

function ProjectDetail() {
  const { id } = Route.useParams()
  const pid = Number(id)
  const nav = useNavigate()
  const user = getUser()

  const [project, setProject] = useState<TrainingProjectDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')

  const [editing, setEditing] = useState(false)
  const [editData, setEditData] = useState<any>({})
  const [saving, setSaving] = useState(false)

  const [actionRemark, setActionRemark] = useState('')
  const [showRejectDialog, setShowRejectDialog] = useState<string | null>(null)
  const [rejectRemark, setRejectRemark] = useState('')
  const [actionLoading, setActionLoading] = useState(false)

  const [tab, setTab] = useState<'info' | 'attachments' | 'records' | 'audit'>('info')
  const [newAtt, setNewAtt] = useState<AttachmentCreate>({
    file_name: '',
    file_type: 'pdf',
    file_size: 1024,
    file_path: '',
    category: 'demand',
    is_required: false,
  })
  const [attLoading, setAttLoading] = useState(false)

  const [msg, setMsg] = useState('')

  const load = () => {
    setLoading(true)
    setErr('')
    api
      .getProject(pid)
      .then((p) => {
        setProject(p)
        setEditData({
          project_name: p.project_name,
          client_company: p.client_company,
          contact_person: p.contact_person || '',
          contact_phone: p.contact_phone || '',
          training_type: p.training_type || '',
          training_count: p.training_count,
          expected_start_date: p.expected_start_date ? dayjs(p.expected_start_date).format('YYYY-MM-DD') : '',
          expected_end_date: p.expected_end_date ? dayjs(p.expected_end_date).format('YYYY-MM-DD') : '',
          demand_description: p.demand_description || '',
          plan_content: p.plan_content || '',
          quotation_amount: p.quotation_amount,
          contract_no: p.contract_no || '',
          contract_date: p.contract_date ? dayjs(p.contract_date).format('YYYY-MM-DD') : '',
          deadline: p.deadline ? dayjs(p.deadline).format('YYYY-MM-DD') : '',
          stage: p.stage,
          version: p.version,
        })
      })
      .catch((e) => setErr(e.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
  }, [pid])

  const canEdit =
    user?.role === 'registrar' &&
    (project?.status === 'draft' || project?.status === 'audit_rejected') &&
    (project?.created_by?.id === user.id || true)

  const handleEditSubmit = async () => {
    if (!project) return
    setSaving(true)
    setErr('')
    setMsg('')
    try {
      const data = {
        ...editData,
        expected_start_date: editData.expected_start_date
          ? new Date(editData.expected_start_date).toISOString()
          : null,
        expected_end_date: editData.expected_end_date
          ? new Date(editData.expected_end_date).toISOString()
          : null,
        contract_date: editData.contract_date ? new Date(editData.contract_date).toISOString() : null,
        deadline: editData.deadline
          ? new Date(editData.deadline + 'T23:59:59').toISOString()
          : null,
        training_count: Number(editData.training_count) || 0,
        quotation_amount: Number(editData.quotation_amount) || 0,
      }
      const res = await api.updateProject(project.id, data)
      setProject(res)
      setMsg('修改成功')
      setEditing(false)
    } catch (e: any) {
      setErr(e.message || '修改失败')
    } finally {
      setSaving(false)
    }
  }

  const doAction = async (action: string, remark = '') => {
    if (!project) return
    setActionLoading(true)
    setErr('')
    setMsg('')
    try {
      const req: ProcessActionRequest = {
        action,
        remark: remark || undefined,
        version: project.version,
      }
      const res = await api.doAction(project.id, req)
      setProject(res)
      setMsg(`操作成功：${ACTION_LABELS[action] || action}`)
      setActionRemark('')
      setShowRejectDialog(null)
      setRejectRemark('')
    } catch (e: any) {
      setErr(e.message || '操作失败，该异常已进入审计备注用于追溯')
    } finally {
      setActionLoading(false)
    }
  }

  const addAttachment = async () => {
    if (!project || !newAtt.file_name) {
      setErr('请填写文件名')
      return
    }
    setAttLoading(true)
    setErr('')
    try {
      const fn = newAtt.file_name
      const data: AttachmentCreate = {
        ...newAtt,
        file_path: `/uploads/${project.project_no}/${fn}`,
      }
      await api.addAttachment(project.id, data)
      setNewAtt({ file_name: '', file_type: 'pdf', file_size: 1024, file_path: '', category: 'demand', is_required: false })
      load()
      setMsg('附件添加成功')
    } catch (e: any) {
      setErr(e.message || '添加附件失败')
    } finally {
      setAttLoading(false)
    }
  }

  const removeAttachment = async (aid: number) => {
    if (!project) return
    if (!confirm('确认删除该附件？')) return
    try {
      await api.deleteAttachment(project.id, aid)
      load()
    } catch (e: any) {
      setErr(e.message)
    }
  }

  const dlStatus = project?.deadline_status || 'normal'

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => nav({ to: '/projects' })} className="btn">← 返回列表</button>
          <div>
            <h1 className="text-xl font-bold text-gray-800">
              项目单详情
              {project && <span className="ml-3 text-sm font-mono text-primary-700">{project.project_no}</span>}
            </h1>
            <div className="text-xs text-gray-500 mt-0.5">
              版本号：{project?.version} · 连续办理：培训需求 → 方案报价 → 合同确认
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="btn">🔄 刷新</button>
          {canEdit && (
            editing ? (
              <>
                <button className="btn btn-success" onClick={handleEditSubmit} disabled={saving}>
                  {saving ? '保存中...' : '💾 保存修改'}
                </button>
                <button className="btn" onClick={() => setEditing(false)} disabled={saving}>取消</button>
              </>
            ) : (
              <button className="btn btn-primary" onClick={() => setEditing(true)}>✏️ 编辑</button>
            )
          )}
        </div>
      </div>

      {msg && (
        <div className="p-3 rounded bg-green-50 text-green-700 border border-green-200 text-sm flex items-center justify-between">
          <span>✅ {msg}</span>
          <button onClick={() => setMsg('')} className="text-xs underline">关闭</button>
        </div>
      )}
      {err && (
        <div className="p-3 rounded bg-red-50 text-red-700 border border-red-200 text-sm">
          ❌ {err}
          <span className="ml-2 text-xs text-red-500">（该异常已同步至审计备注，便于追溯）</span>
        </div>
      )}

      {loading && !project ? (
        <div className="card p-10 text-center text-gray-400">加载中...</div>
      ) : project ? (
        <>
          <div className="card p-5">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4 text-sm">
              <div className="p-3 rounded bg-gray-50 border border-gray-200">
                <div className="text-xs text-gray-500">阶段</div>
                <div className="mt-1"><span className={`badge ${STAGE_COLORS[project.stage] || ''}`}>{project.stage_name}</span></div>
              </div>
              <div className="p-3 rounded bg-gray-50 border border-gray-200">
                <div className="text-xs text-gray-500">状态</div>
                <div className="mt-1"><span className={`badge ${STATUS_COLORS[project.status] || ''}`}>{project.status_name}</span></div>
              </div>
              <div className="p-3 rounded bg-gray-50 border border-gray-200">
                <div className="text-xs text-gray-500">到期状态</div>
                <div className="mt-1">
                  <span className={`badge ${DEADLINE_COLORS[dlStatus] || ''}`}>
                    {DEADLINE_LABEL[dlStatus]}
                    {project.overdue_days && dlStatus === 'overdue' && ` · ${project.overdue_days}天`}
                  </span>
                </div>
              </div>
              <div className="p-3 rounded bg-gray-50 border border-gray-200">
                <div className="text-xs text-gray-500">当前处理人</div>
                <div className="mt-1 font-medium text-gray-800">
                  {project.current_handler?.full_name || (project.current_handler_role ? '未分配（按角色办理）' : '—')}
                </div>
              </div>
              <div className="p-3 rounded bg-gray-50 border border-gray-200">
                <div className="text-xs text-gray-500">截止日期</div>
                <div className="mt-1 font-medium text-gray-800">
                  {project.deadline ? dayjs(project.deadline).format('YYYY-MM-DD') : '未设置'}
                </div>
              </div>
            </div>

            {project.allowed_actions && project.allowed_actions.length > 0 && (
              <div className="mt-5 p-4 rounded bg-primary-50/40 border border-primary-200">
                <div className="text-sm font-semibold text-primary-800 mb-3">
                  🎯 当前角色可执行操作（共 {project.allowed_actions.length} 项）
                </div>
                <div className="flex flex-wrap gap-2">
                  {project.allowed_actions.map((a) => {
                    const isReject = a === 'audit_reject' || a === 'review_reject'
                    return (
                      <button
                        key={a}
                        className={`${ACTION_STYLE[a] || 'btn'} !py-2`}
                        disabled={actionLoading}
                        onClick={() => {
                          if (isReject) {
                            setShowRejectDialog(a)
                            setRejectRemark('')
                          } else {
                            doAction(a, actionRemark)
                          }
                        }}
                      >
                        {ACTION_LABELS[a] || a}
                      </button>
                    )
                  })}
                </div>
                {project.allowed_actions.some((a) => !['audit_reject', 'review_reject'].includes(a)) && (
                  <div className="mt-3">
                    <label className="label">操作备注（可选）</label>
                    <textarea
                      className="input"
                      rows={2}
                      placeholder="填写备注信息，将记录到审计备注中"
                      value={actionRemark}
                      onChange={(e) => setActionRemark(e.target.value)}
                    />
                  </div>
                )}
              </div>
            )}

            {showRejectDialog && (
              <div className="mt-4 p-4 rounded bg-amber-50 border border-amber-200">
                <div className="text-sm font-semibold text-amber-800 mb-2">
                  ⚠️ 请填写{showRejectDialog === 'audit_reject' ? '退回补正' : '复核退回'}原因
                </div>
                <textarea
                  className="input"
                  rows={3}
                  placeholder="退回原因必填，用于审计追溯和课程顾问补正参考"
                  value={rejectRemark}
                  onChange={(e) => setRejectRemark(e.target.value)}
                />
                <div className="flex gap-2 mt-3">
                  <button
                    className="btn btn-warning"
                    disabled={!rejectRemark.trim() || actionLoading}
                    onClick={() => doAction(showRejectDialog, rejectRemark)}
                  >
                    确认退回
                  </button>
                  <button className="btn" onClick={() => setShowRejectDialog(null)}>取消</button>
                </div>
              </div>
            )}
          </div>

          <div className="card">
            <div className="flex border-b border-gray-200">
              {([
                ['info', '📋 基本信息与办理'],
                ['attachments', `📎 附件材料（${project.attachments.length}）`],
                ['records', `📝 处理记录（${project.processing_records.length}）`],
                ['audit', `🔍 审计备注与异常（${project.audit_notes.length}）`],
              ] as const).map(([k, l]) => (
                <button
                  key={k}
                  onClick={() => setTab(k)}
                  className={`px-4 py-3 text-sm font-medium transition-colors border-b-2 -mb-px ${
                    tab === k
                      ? 'text-primary-700 border-primary-500'
                      : 'text-gray-600 border-transparent hover:text-gray-900'
                  }`}
                >
                  {l}
                </button>
              ))}
            </div>

            {tab === 'info' && (
              <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                {[
                  ['项目名称', 'project_name', 'text', !editing],
                  ['客户公司', 'client_company', 'text', !editing],
                  ['联系人', 'contact_person', 'text', !editing],
                  ['联系电话', 'contact_phone', 'text', !editing],
                  ['培训类型', 'training_type', 'text', !editing],
                  ['培训人数', 'training_count', 'number', !editing],
                  ['预计开始日期', 'expected_start_date', 'date', !editing],
                  ['预计结束日期', 'expected_end_date', 'date', !editing],
                  ['阶段', 'stage', 'select', !editing],
                  ['截止日期', 'deadline', 'date', !editing],
                  ['合同编号', 'contract_no', 'text', !editing],
                  ['合同签订日期', 'contract_date', 'date', !editing],
                  ['报价金额 (元)', 'quotation_amount', 'number', !editing],
                ].map(([label, key, type, readonly]) => (
                  <div key={key as string}>
                    <label className="label">{label as string}</label>
                    {readonly ? (
                      <div className="px-3 py-2 bg-gray-50 rounded border border-gray-200 text-sm text-gray-800 min-h-[38px]">
                        {key === 'stage'
                          ? { demand: '培训需求', plan: '方案报价', contract: '合同确认' }[
                              (editData as any)[key as string]
                            ] || '-'
                          : (editData as any)[key as string] !== undefined &&
                            (editData as any)[key as string] !== null &&
                            (editData as any)[key as string] !== ''
                          ? String((editData as any)[key as string])
                          : '-'}
                      </div>
                    ) : (type as string) === 'select' ? (
                      <select
                        className="input"
                        value={(editData as any)[key as string]}
                        onChange={(e) => setEditData({ ...editData, [key as string]: e.target.value })}
                      >
                        <option value="demand">培训需求</option>
                        <option value="plan">方案报价</option>
                        <option value="contract">合同确认</option>
                      </select>
                    ) : (
                      <input
                        type={type as string}
                        className="input"
                        value={(editData as any)[key as string] ?? ''}
                        onChange={(e) => setEditData({ ...editData, [key as string]: e.target.value })}
                      />
                    )}
                  </div>
                ))}
                <div className="md:col-span-2">
                  <label className="label">培训需求描述</label>
                  {!editing ? (
                    <div className="px-3 py-2 bg-gray-50 rounded border border-gray-200 text-sm text-gray-800 whitespace-pre-wrap min-h-[80px]">
                      {project.demand_description || '—'}
                    </div>
                  ) : (
                    <textarea
                      className="input"
                      rows={4}
                      value={editData.demand_description}
                      onChange={(e) => setEditData({ ...editData, demand_description: e.target.value })}
                    />
                  )}
                </div>
                <div className="md:col-span-2">
                  <label className="label">方案内容与报价说明</label>
                  {!editing ? (
                    <div className="px-3 py-2 bg-gray-50 rounded border border-gray-200 text-sm text-gray-800 whitespace-pre-wrap min-h-[80px]">
                      {project.plan_content || '—'}
                    </div>
                  ) : (
                    <textarea
                      className="input"
                      rows={4}
                      value={editData.plan_content}
                      onChange={(e) => setEditData({ ...editData, plan_content: e.target.value })}
                    />
                  )}
                </div>
                <div className="md:col-span-2 grid grid-cols-2 gap-4 text-xs text-gray-500 pt-3 border-t border-gray-100">
                  <div>创建人：{project.created_by?.full_name || '-'} · {dayjs(project.created_at).format('YYYY-MM-DD HH:mm')}</div>
                  <div>最近更新：{dayjs(project.updated_at).format('YYYY-MM-DD HH:mm')} · 版本 v{project.version}</div>
                </div>
              </div>
            )}

            {tab === 'attachments' && (
              <div className="p-5 space-y-5">
                {editing && (
                  <div className="p-4 rounded bg-blue-50 border border-blue-200">
                    <div className="text-sm font-semibold text-blue-800 mb-3">➕ 上传附件（模拟）</div>
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-3 text-sm">
                      <input
                        className="input md:col-span-2"
                        placeholder="文件名称（例如：需求说明-xxx.docx）"
                        value={newAtt.file_name}
                        onChange={(e) => setNewAtt({ ...newAtt, file_name: e.target.value })}
                      />
                      <select
                        className="input"
                        value={newAtt.category}
                        onChange={(e) => setNewAtt({ ...newAtt, category: e.target.value })}
                      >
                        <option value="demand">需求材料</option>
                        <option value="plan">方案材料</option>
                        <option value="contract">合同材料</option>
                        <option value="other">其他材料</option>
                      </select>
                      <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={newAtt.is_required}
                          onChange={(e) => setNewAtt({ ...newAtt, is_required: e.target.checked })}
                        />
                        作为必备证据
                      </label>
                      <button className="btn btn-primary" onClick={addAttachment} disabled={attLoading}>
                        {attLoading ? '添加中...' : '添加'}
                      </button>
                    </div>
                  </div>
                )}
                {project.attachments.length === 0 ? (
                  <div className="text-center text-gray-400 py-10">暂无附件</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr>
                          <th className="th w-16">#</th>
                          <th className="th">文件名</th>
                          <th className="th w-32">分类</th>
                          <th className="th w-24">必备</th>
                          <th className="th w-28">大小</th>
                          <th className="th w-36">上传人</th>
                          <th className="th w-36">上传时间</th>
                          {editing && <th className="th w-20">操作</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {project.attachments.map((a, i) => (
                          <tr key={a.id} className="hover:bg-gray-50">
                            <td className="td text-gray-400">{i + 1}</td>
                            <td className="td font-medium text-gray-800">{a.file_name}</td>
                            <td className="td">
                              <span className="badge bg-gray-100 text-gray-700 border-gray-300">
                                {ATTACHMENT_CATEGORY_LABEL[a.category] || a.category}
                              </span>
                            </td>
                            <td className="td">
                              {a.is_required ? (
                                <span className="badge bg-red-50 text-red-700 border-red-200">必备证据</span>
                              ) : (
                                <span className="text-xs text-gray-400">普通</span>
                              )}
                            </td>
                            <td className="td text-xs text-gray-500">
                              {a.file_size ? `${(a.file_size / 1024).toFixed(1)} KB` : '-'}
                            </td>
                            <td className="td text-xs text-gray-600">{a.uploaded_by?.full_name || '-'}</td>
                            <td className="td text-xs text-gray-500">{dayjs(a.uploaded_at).format('MM-DD HH:mm')}</td>
                            {editing && (
                              <td className="td">
                                <button className="btn btn-danger !py-1 !px-2 text-xs" onClick={() => removeAttachment(a.id)}>
                                  删除
                                </button>
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {tab === 'records' && (
              <div className="p-5">
                {project.processing_records.length === 0 ? (
                  <div className="text-center text-gray-400 py-10">暂无处理记录</div>
                ) : (
                  <ol className="relative border-l-2 border-gray-200 ml-3 space-y-5">
                    {project.processing_records.map((r) => (
                      <li key={r.id} className="ml-5">
                        <div className="absolute -left-[9px] mt-1.5 w-4 h-4 rounded-full bg-primary-500 border-2 border-white shadow"></div>
                        <div className="card p-4">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-primary-700">{r.action_name}</span>
                              <span className="badge bg-gray-100 text-gray-600 border-gray-200">v{r.version_at_action}</span>
                            </div>
                            <div className="text-xs text-gray-500">
                              {r.operator?.full_name || '-'} ({r.operator_role}) · {dayjs(r.processed_at).format('YYYY-MM-DD HH:mm:ss')}
                            </div>
                          </div>
                          {(r.from_status || r.to_status || r.from_stage || r.to_stage) && (
                            <div className="text-xs text-gray-600 mb-2 flex flex-wrap gap-3">
                              {r.from_status && r.to_status && (
                                <span>
                                  状态：
                                  <span className="badge mr-1" style={{ background: '#f3f4f6' }}>
                                    {
                                      {
                                        draft: '草稿',
                                        pending_audit: '待审核',
                                        audit_rejected: '退回补正',
                                        audit_passed: '审核通过',
                                        pending_review: '待复核',
                                        review_rejected: '复核退回',
                                        synced: '已同步',
                                        archived: '已归档',
                                      }[r.from_status] || r.from_status
                                    }
                                  </span>
                                  →
                                  <span className="badge ml-1" style={{ background: '#f3f4f6' }}>
                                    {
                                      {
                                        draft: '草稿',
                                        pending_audit: '待审核',
                                        audit_rejected: '退回补正',
                                        audit_passed: '审核通过',
                                        pending_review: '待复核',
                                        review_rejected: '复核退回',
                                        synced: '已同步',
                                        archived: '已归档',
                                      }[r.to_status] || r.to_status
                                    }
                                  </span>
                                </span>
                              )}
                              {r.from_stage && r.to_stage && r.from_stage !== r.to_stage && (
                                <span>
                                  阶段：
                                  <span className="badge mx-1" style={{ background: '#f3f4f6' }}>
                                    {{ demand: '培训需求', plan: '方案报价', contract: '合同确认' }[r.from_stage]}
                                  </span>
                                  →
                                  <span className="badge ml-1" style={{ background: '#f3f4f6' }}>
                                    {{ demand: '培训需求', plan: '方案报价', contract: '合同确认' }[r.to_stage]}
                                  </span>
                                </span>
                              )}
                            </div>
                          )}
                          {r.remark && (
                            <div className="text-sm text-gray-700 bg-gray-50 rounded p-2 border border-gray-100">
                              💬 {r.remark}
                            </div>
                          )}
                          {r.evidence_checked && (
                            <div className="mt-1.5 text-xs text-green-700 bg-green-50 rounded p-2 border border-green-100">
                              ✅ 证据核对：{r.evidence_checked}
                            </div>
                          )}
                        </div>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            )}

            {tab === 'audit' && (
              <div className="p-5 space-y-3">
                {project.audit_notes.length === 0 ? (
                  <div className="text-center text-gray-400 py-10">暂无审计备注</div>
                ) : (
                  project.audit_notes.map((n) => {
                    const isException = n.note_type === 'exception'
                    return (
                      <div
                        key={n.id}
                        className={`p-3 rounded border text-sm ${
                          isException
                            ? 'bg-red-50 border-red-200'
                            : n.note_type === 'supplement'
                            ? 'bg-amber-50 border-amber-200'
                            : 'bg-blue-50 border-blue-200'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span
                            className={`badge ${
                              isException
                                ? 'bg-red-100 text-red-700 border-red-200'
                                : n.note_type === 'supplement'
                                ? 'bg-amber-100 text-amber-700 border-amber-200'
                                : 'bg-blue-100 text-blue-700 border-blue-200'
                            }`}
                          >
                            {NOTE_TYPE_LABEL[n.note_type] || n.note_type}
                          </span>
                          <span className="text-xs text-gray-500">
                            {n.created_by?.full_name || '系统'} · {dayjs(n.created_at).format('MM-DD HH:mm:ss')}
                          </span>
                        </div>
                        <div className="text-gray-800 whitespace-pre-wrap">{n.note_content}</div>
                      </div>
                    )
                  })
                )}
              </div>
            )}
          </div>
        </>
      ) : (
        err && <div className="card p-6 text-red-600">加载失败：{err}</div>
      )}
    </div>
  )
}
