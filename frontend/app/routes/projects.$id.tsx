import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import {
  api,
  TrainingProjectDetail,
  ExceptionRecordItem,
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

const DEADLINE_LABEL: Record<string, string> = { normal: '正常', near: '临期', overdue: '逾期' }

const EXCEPTION_COLORS: Record<string, string> = {
  missing_evidence: 'bg-orange-50 border-orange-300 text-orange-800',
  overdue: 'bg-red-50 border-red-300 text-red-800',
  status_conflict: 'bg-purple-50 border-purple-300 text-purple-800',
  version_conflict: 'bg-pink-50 border-pink-300 text-pink-800',
  permission_denied: 'bg-rose-50 border-rose-300 text-rose-800',
  duplicate_submit: 'bg-amber-50 border-amber-300 text-amber-800',
}

const EXCEPTION_ICONS: Record<string, string> = {
  missing_evidence: '📎',
  overdue: '⏰',
  status_conflict: '🔀',
  version_conflict: '🔢',
  permission_denied: '🚫',
  duplicate_submit: '♻️',
}

const STAGE_REQUIRED_CATEGORIES = {
  demand: ['demand'],
  plan: ['demand', 'plan'],
  contract: ['demand', 'plan', 'contract'],
}

function ProjectDetail() {
  const { id } = Route.useParams()
  const pid = Number(id)
  const nav = useNavigate()
  const user = getUser()

  const [project, setProject] = useState<TrainingProjectDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [msg, setMsg] = useState('')

  const [editing, setEditing] = useState(false)
  const [editData, setEditData] = useState<any>({})
  const [saving, setSaving] = useState(false)

  const [actionRemark, setActionRemark] = useState('')
  const [showRejectDialog, setShowRejectDialog] = useState<string | null>(null)
  const [rejectRemark, setRejectRemark] = useState('')
  const [actionLoading, setActionLoading] = useState(false)

  const [tab, setTab] = useState<'info' | 'supplement' | 'attachments' | 'records' | 'exceptions' | 'audit'>('info')
  const [newAtt, setNewAtt] = useState<AttachmentCreate>({
    file_name: '',
    file_type: 'pdf',
    file_size: 1024,
    file_path: '',
    category: 'demand',
    is_required: false,
  })
  const [attLoading, setAttLoading] = useState(false)

  const load = () => {
    setLoading(true)
    setErr('')
    api.getProject(pid).then((p) => {
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
    }).catch((e) => setErr(e.message)).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [pid])

  useEffect(() => {
    if (project?.supplement?.is_supplement_needed && tab === 'info') {
      setTab('supplement')
    }
  }, [project])

  const canEdit =
    user?.role === 'registrar' &&
    (project?.status === 'draft' || project?.status === 'audit_rejected')

  const handleEditSubmit = async () => {
    if (!project) return
    setSaving(true); setErr(''); setMsg('')
    try {
      const data = {
        ...editData,
        expected_start_date: editData.expected_start_date ? new Date(editData.expected_start_date).toISOString() : null,
        expected_end_date: editData.expected_end_date ? new Date(editData.expected_end_date).toISOString() : null,
        contract_date: editData.contract_date ? new Date(editData.contract_date).toISOString() : null,
        deadline: editData.deadline ? new Date(editData.deadline + 'T23:59:59').toISOString() : null,
        training_count: Number(editData.training_count) || 0,
        quotation_amount: Number(editData.quotation_amount) || 0,
      }
      const res = await api.updateProject(project.id, data)
      setProject(res); setMsg('修改成功'); setEditing(false)
    } catch (e: any) { setErr(e.message || '修改失败') }
    finally { setSaving(false) }
  }

  const doAction = async (action: string, remark = '') => {
    if (!project) return
    setActionLoading(true); setErr(''); setMsg('')
    try {
      const req: ProcessActionRequest = { action, remark: remark || undefined, version: project.version }
      const res = await api.doAction(project.id, req)
      setProject(res); setMsg(`操作成功：${ACTION_LABELS[action] || action}`)
      setActionRemark(''); setShowRejectDialog(null); setRejectRemark('')
    } catch (e: any) {
      setErr(e.message || '操作失败，该异常已进入审计备注用于追溯')
    } finally { setActionLoading(false) }
  }

  const addAttachment = async () => {
    if (!project || !newAtt.file_name) { setErr('请填写文件名'); return }
    setAttLoading(true); setErr('')
    try {
      const fn = newAtt.file_name
      const data: AttachmentCreate = { ...newAtt, file_path: `/uploads/${project.project_no}/${fn}` }
      await api.addAttachment(project.id, data)
      setNewAtt({ file_name: '', file_type: 'pdf', file_size: 1024, file_path: '', category: 'demand', is_required: false })
      load(); setMsg('附件添加成功')
    } catch (e: any) { setErr(e.message || '添加附件失败') }
    finally { setAttLoading(false) }
  }

  const removeAttachment = async (aid: number) => {
    if (!project) return
    if (!confirm('确认删除该附件？')) return
    try { await api.deleteAttachment(project.id, aid); load() }
    catch (e: any) { setErr(e.message) }
  }

  const dlStatus = project?.deadline_status || 'normal'
  const supp = project?.supplement
  const exceptions = project?.exceptions || []
  const missingCount = supp?.missing_items?.length || 0
  const unresolvedExc = exceptions.filter(e => !e.resolved).length

  const quickAddAtt = (cat: string, required: boolean) => {
    setNewAtt(prev => ({
      ...prev,
      category: cat,
      is_required: required,
      file_name: prev.file_name || `${project?.project_no}_补充材料_${cat}.pdf`,
    }))
    setTab('attachments')
  }

  const field = (key: string, label: string, type = 'text', opts?: string[]) => {
    const readonly = !editing
    return (
      <div key={key}>
        <label className="label">{label}</label>
        {readonly ? (
          <div className="px-3 py-2 bg-gray-50 rounded border border-gray-200 text-sm text-gray-800 min-h-[38px]">
            {key === 'stage'
              ? { demand: '培训需求', plan: '方案报价', contract: '合同确认' }[editData[key] as string] || '-'
              : (editData[key] !== undefined && editData[key] !== null && editData[key] !== '' ? String(editData[key]) : '-')}
          </div>
        ) : opts ? (
          <select className="input" value={editData[key]} onChange={(e) => setEditData({ ...editData, [key]: e.target.value })}>
            {opts.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        ) : (
          <input type={type} className="input" value={editData[key] ?? ''}
            onChange={(e) => setEditData({ ...editData, [key]: type === 'number' ? e.target.value : e.target.value })} />
        )}
      </div>
    )
  }

  if (loading && !project) return <div className="card p-10 text-center text-gray-400">加载中...</div>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <button onClick={() => nav({ to: '/projects' })} className="btn">← 返回列表</button>
          <div>
            <h1 className="text-xl font-bold text-gray-800">
              项目单详情
              <span className="ml-3 text-sm font-mono text-primary-700">{project?.project_no}</span>
              {unresolvedExc > 0 && (
                <span className="ml-3 badge bg-red-50 text-red-700 border-red-300">
                  ⚠️ {unresolvedExc} 条未处理异常
                </span>
              )}
            </h1>
            <div className="text-xs text-gray-500 mt-0.5">版本 v{project?.version} · 连续办理：培训需求 → 方案报价 → 合同确认</div>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="btn">🔄 刷新</button>
          {canEdit && (editing ? (
            <>
              <button className="btn btn-success" onClick={handleEditSubmit} disabled={saving}>
                {saving ? '保存中...' : '💾 保存修改'}
              </button>
              <button className="btn" onClick={() => setEditing(false)} disabled={saving}>取消</button>
            </>
          ) : (
            <button className="btn btn-primary" onClick={() => setEditing(true)}>✏️ 编辑</button>
          ))}
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
          <span className="ml-2 text-xs text-red-500">（异常已同步至【异常追溯】Tab，便于追溯）</span>
        </div>
      )}

      {project && (
        <>
          {/* 顶部信息卡片 */}
          <div className="card p-5">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4 text-sm">
              {[
                { t: '阶段', v: project.stage_name, c: `badge ${STAGE_COLORS[project.stage] || ''}` },
                { t: '状态', v: project.status_name, c: `badge ${STATUS_COLORS[project.status] || ''}` },
                { t: '到期', v: `${DEADLINE_LABEL[dlStatus]}${project.overdue_days ? (dlStatus === 'overdue' ? ` · 逾期${project.overdue_days}天` : ` · 剩${project.overdue_days}天`) : ''}`, c: `badge ${DEADLINE_COLORS[dlStatus] || ''}` },
                { t: '当前处理人', v: (project.current_handler?.full_name || (project.current_handler_role ? '按角色待领取' : '—')), c: '', plain: true },
                { t: '截止日期', v: (project.deadline ? dayjs(project.deadline).format('YYYY-MM-DD') : '未设置'), c: '', plain: true },
              ].map((x, i) => (
                <div key={i} className="p-3 rounded bg-gray-50 border border-gray-200">
                  <div className="text-xs text-gray-500">{x.t}</div>
                  <div className="mt-1.5">
                    {x.c ? <span className={x.c}>{x.v}</span> : <div className="font-medium text-gray-800">{x.v}</div>}
                  </div>
                </div>
              ))}
            </div>

            {/* 可用操作区 */}
            {project.allowed_actions && project.allowed_actions.length > 0 && (
              <div className="mt-5 p-4 rounded bg-primary-50/40 border border-primary-200">
                <div className="text-sm font-semibold text-primary-800 mb-3">
                  🎯 当前角色可执行操作（共 {project.allowed_actions.length} 项）
                </div>
                <div className="flex flex-wrap gap-2">
                  {project.allowed_actions.map((a) => {
                    const isReject = a === 'audit_reject' || a === 'review_reject'
                    const missingBlocked = ['submit', 'audit_pass', 'review_pass', 'supplement', 'advance_stage'].includes(a) && missingCount > 0
                    return (
                      <div key={a} className="relative">
                        <button className={`${ACTION_STYLE[a] || 'btn'} !py-2`}
                          disabled={actionLoading}
                          onClick={() => {
                            if (isReject) { setShowRejectDialog(a); setRejectRemark('') }
                            else doAction(a, actionRemark)
                          }}
                        >
                          {ACTION_LABELS[a] || a}
                        </button>
                        {missingBlocked && (
                          <div className="absolute -top-1 -right-1 badge bg-amber-500 text-white text-[10px] !py-0 !px-1 border-0">
                            ⚠缺{missingCount}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
                {project.allowed_actions.some(a => !['audit_reject', 'review_reject'].includes(a)) && (
                  <div className="mt-3">
                    <label className="label">操作备注（可选）</label>
                    <textarea className="input" rows={2}
                      placeholder="填写备注信息，将记录到审计备注中"
                      value={actionRemark} onChange={(e) => setActionRemark(e.target.value)} />
                  </div>
                )}
                {missingCount > 0 && (
                  <div className="mt-3 p-2 rounded bg-amber-50 border border-amber-200 text-xs text-amber-700">
                    ⚠️ 检测到 {missingCount} 项缺失材料/内容，提交前请在「补正办理」Tab 完成补正，否则后端将执行强制拦截。
                  </div>
                )}
              </div>
            )}

            {showRejectDialog && (
              <div className="mt-4 p-4 rounded bg-amber-50 border border-amber-200">
                <div className="text-sm font-semibold text-amber-800 mb-2">
                  ⚠️ 请填写{showRejectDialog === 'audit_reject' ? '退回补正' : '复核退回'}原因（强制必填）
                </div>
                <textarea className="input" rows={3}
                  placeholder="退回原因必填，用于审计追溯和课程顾问补正参考。请列出需补正的具体项..."
                  value={rejectRemark} onChange={(e) => setRejectRemark(e.target.value)} />
                {!rejectRemark.trim() && (
                  <div className="mt-1 text-xs text-red-600">❌ 请填写退回原因后再提交</div>
                )}
                <div className="flex gap-2 mt-3">
                  <button className="btn btn-warning" disabled={!rejectRemark.trim() || actionLoading}
                    onClick={() => doAction(showRejectDialog, rejectRemark)}>
                    确认退回
                  </button>
                  <button className="btn" onClick={() => setShowRejectDialog(null)}>取消</button>
                </div>
              </div>
            )}
          </div>

          {/* Tab 栏 */}
          <div className="card">
            <div className="flex border-b border-gray-200 flex-wrap">
              {([
                ['info', '📋 基本信息', 0],
                ['supplement', `🔧 补正办理${supp?.is_supplement_needed ? ' (需补正)' : ''}`, missingCount + (supp?.reject_reasons?.length || 0)],
                ['attachments', `📎 附件材料 (${project.attachments.length})`, 0],
                ['records', `📝 处理记录 (${project.processing_records.length})`, 0],
                ['exceptions', `⚠️ 异常追溯${unresolvedExc > 0 ? ` (${unresolvedExc}未处理)` : ''}`, exceptions.length],
                ['audit', `🔍 审计备注 (${project.audit_notes.length})`, 0],
              ] as const).map(([k, l, count]) => (
                <button key={k} onClick={() => setTab(k as any)}
                  className={`px-4 py-3 text-sm font-medium transition-colors border-b-2 -mb-px relative ${
                    tab === k ? 'text-primary-700 border-primary-500' : 'text-gray-600 border-transparent hover:text-gray-900'
                  }`}
                >
                  {l}
                  {typeof count === 'number' && count > 0 && (
                    <span className={`ml-1.5 inline-flex items-center justify-center min-w-[18px] h-[18px] text-[10px] px-1.5 rounded-full ${
                      (k === 'supplement' && (missingCount > 0 || supp?.is_supplement_needed)) || (k === 'exceptions' && unresolvedExc > 0)
                        ? 'bg-red-500 text-white'
                        : 'bg-gray-200 text-gray-700'
                    }`}>
                      {count}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Tab: 基本信息 */}
            {tab === 'info' && (
              <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                {field('project_name', '项目名称')}
                {field('client_company', '客户公司')}
                {field('contact_person', '联系人')}
                {field('contact_phone', '联系电话')}
                {field('training_type', '培训类型', 'text', ['通用类', '管理类', '销售类', '技术类', '服务类', '其他'])}
                {field('training_count', '预计培训人数', 'number')}
                {field('expected_start_date', '预计开始日期', 'date')}
                {field('expected_end_date', '预计结束日期', 'date')}
                {field('stage', '当前办理阶段', 'text', ['demand', 'plan', 'contract'])}
                {field('deadline', '办理截止日期', 'date')}
                {field('contract_no', '合同编号')}
                {field('contract_date', '合同签订日期', 'date')}
                {field('quotation_amount', '报价金额 (元)', 'number')}
                <div className="md:col-span-2">
                  <label className="label">培训需求描述 {project.stage === 'demand' && <span className="text-red-500 text-xs ml-1">（需求阶段必备）</span>}</label>
                  {!editing ? (
                    <div className="px-3 py-2 bg-gray-50 rounded border border-gray-200 text-sm text-gray-800 whitespace-pre-wrap min-h-[80px]">
                      {project.demand_description || '—'}
                    </div>
                  ) : (
                    <textarea className="input" rows={4} value={editData.demand_description}
                      onChange={(e) => setEditData({ ...editData, demand_description: e.target.value })} />
                  )}
                </div>
                <div className="md:col-span-2">
                  <label className="label">方案内容与报价说明 {project.stage !== 'demand' && <span className="text-red-500 text-xs ml-1">（方案阶段必备）</span>}</label>
                  {!editing ? (
                    <div className="px-3 py-2 bg-gray-50 rounded border border-gray-200 text-sm text-gray-800 whitespace-pre-wrap min-h-[80px]">
                      {project.plan_content || '—'}
                    </div>
                  ) : (
                    <textarea className="input" rows={4} value={editData.plan_content}
                      onChange={(e) => setEditData({ ...editData, plan_content: e.target.value })} />
                  )}
                </div>
                <div className="md:col-span-2 grid grid-cols-2 gap-4 text-xs text-gray-500 pt-3 border-t border-gray-100">
                  <div>创建人：{project.created_by?.full_name || '-'} · {dayjs(project.created_at).format('YYYY-MM-DD HH:mm')}</div>
                  <div>最近更新：{dayjs(project.updated_at).format('YYYY-MM-DD HH:mm')} · 版本 v{project.version}</div>
                </div>
              </div>
            )}

            {/* Tab: 补正办理 */}
            {tab === 'supplement' && (
              <div className="p-5 space-y-5">
                {!supp?.is_supplement_needed && missingCount === 0 ? (
                  <div className="p-6 rounded bg-green-50 border border-green-200 text-center text-green-700">
                    ✅ 当前项目无待补正项，材料齐全
                  </div>
                ) : (
                  <>
                    {supp?.is_supplement_needed && supp.reject_reasons.length > 0 && (
                      <div>
                        <div className="text-sm font-semibold text-red-700 mb-2 flex items-center gap-2">
                          📌 退回原因（来自审核/复核岗位）
                        </div>
                        <div className="space-y-2">
                          {supp.reject_reasons.map((r, i) => (
                            <div key={r.id} className="p-3 rounded border border-red-200 bg-red-50/40 text-sm">
                              <div className="flex justify-between text-xs text-red-600 mb-1">
                                <span>第 {supp!.reject_reasons.length - i} 次退回 · {r.created_by?.full_name || '—'}</span>
                                <span>{dayjs(r.created_at).format('YYYY-MM-DD HH:mm')}</span>
                              </div>
                              <div className="text-gray-800 whitespace-pre-wrap">{r.note_content}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {missingCount > 0 && (
                      <div>
                        <div className="text-sm font-semibold text-orange-700 mb-2">
                          📋 待补正清单（{missingCount} 项，后端校验未通过则拦截）
                        </div>
                        <div className="space-y-2">
                          {supp.missing_items.map((m, i) => {
                            const needAttDemand = m.includes('需求')
                            const needAttPlan = m.includes('方案')
                            const needAttContract = m.includes('合同')
                            const needPlan = m.includes('方案内容') || m.includes('方案阶段')
                            const needQuotation = m.includes('报价')
                            const needDesc = m.includes('需求描述')
                            const needContract = m.includes('合同编号')
                            return (
                              <div key={i} className="p-3 rounded border border-orange-200 bg-orange-50/40 text-sm flex items-start justify-between gap-3">
                                <div className="flex items-start gap-2">
                                  <span className="text-orange-500 mt-0.5">❌</span>
                                  <div className="text-gray-800">{m}</div>
                                </div>
                                <div className="flex gap-1 flex-shrink-0">
                                  {(needAttDemand || needDesc) && (
                                    <button className="btn !py-1 !px-2 text-xs" onClick={() => needDesc ? (setTab('info'), setEditing(true)) : quickAddAtt('demand', true)}>
                                      {needDesc ? '填写需求描述' : '+ 需求材料'}
                                    </button>
                                  )}
                                  {(needAttPlan || needPlan || needQuotation) && (
                                    <button className="btn !py-1 !px-2 text-xs"
                                      onClick={() => (needPlan || needQuotation) ? (setTab('info'), setEditing(true)) : quickAddAtt('plan', true)}>
                                      {needPlan || needQuotation ? '填写方案/报价' : '+ 方案材料'}
                                    </button>
                                  )}
                                  {(needAttContract || needContract) && (
                                    <button className="btn !py-1 !px-2 text-xs" onClick={() => needContract ? (setTab('info'), setEditing(true)) : quickAddAtt('contract', true)}>
                                      {needContract ? '填写合同编号' : '+ 合同材料'}
                                    </button>
                                  )}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}

                    <div className="p-4 rounded bg-primary-50/30 border border-primary-200">
                      <div className="text-sm font-semibold text-primary-800 mb-2">
                        🚀 一键办理补正
                      </div>
                      <div className="flex flex-wrap gap-2 text-sm">
                        {project.allowed_actions.includes('supplement') && (
                          <button className="btn btn-primary" disabled={missingCount > 0 || actionLoading}
                            onClick={() => doAction('supplement', actionRemark)}>
                            ✅ 补正完成，重新提交审核
                          </button>
                        )}
                        {missingCount === 0 && !supp?.is_supplement_needed && (
                          <span className="text-green-700 self-center">当前材料已齐全</span>
                        )}
                        {missingCount > 0 && (
                          <span className="text-orange-600 self-center">请先完成 {missingCount} 项待补正</span>
                        )}
                      </div>
                      <div className="mt-3">
                        <label className="label">本次补正说明（必填建议）</label>
                        <textarea className="input" rows={2}
                          placeholder="说明本次补正完成了哪些项，便于后续核对"
                          value={actionRemark} onChange={(e) => setActionRemark(e.target.value)} />
                      </div>
                      <div className="mt-3 text-xs text-gray-500">
                        提示：补正提交时，后端会统一校验角色={user?.role_name}、处理人、版本 v{project.version}、阶段必备证据；
                        若逾期会追加节点超时异常到责任岗位。
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Tab: 附件材料 */}
            {tab === 'attachments' && (
              <div className="p-5 space-y-5">
                {(supp?.is_supplement_needed || canEdit || editing) && (
                  <div className="p-4 rounded bg-blue-50 border border-blue-200">
                    <div className="text-sm font-semibold text-blue-800 mb-3">
                      ➕ 上传附件（模拟）· 当前阶段：
                      <span className="ml-1 badge bg-blue-100 text-blue-800 border-blue-200">{supp?.current_stage_label || project.stage_name}</span>
                      <span className="ml-3 text-xs text-blue-600 font-normal">
                        建议：按阶段请求类型分类上传，勾选「必备证据」表示该附件为该阶段必填校验件
                      </span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-3 text-sm">
                      <div className="md:col-span-4">
                        <label className="label">文件名称</label>
                        <input className="input" placeholder="文件名称（例如：需求说明-xxx.docx）"
                          value={newAtt.file_name} onChange={(e) => setNewAtt({ ...newAtt, file_name: e.target.value })} />
                      </div>
                      <div className="md:col-span-2">
                        <label className="label">类型</label>
                        <select className="input" value={newAtt.file_type}
                          onChange={(e) => setNewAtt({ ...newAtt, file_type: e.target.value })}>
                          <option value="pdf">PDF</option>
                          <option value="docx">Word</option>
                          <option value="xlsx">Excel</option>
                          <option value="pptx">PPT</option>
                          <option value="jpg">图片</option>
                        </select>
                      </div>
                      <div className="md:col-span-3">
                        <label className="label">请求类型/阶段</label>
                        <select className="input" value={newAtt.category}
                          onChange={(e) => setNewAtt({ ...newAtt, category: e.target.value })}>
                          <option value="demand">📋 培训需求阶段请求</option>
                          <option value="plan">📊 方案报价阶段请求</option>
                          <option value="contract">📑 合同确认阶段请求</option>
                          <option value="other">📎 通用补充材料</option>
                        </select>
                      </div>
                      <div className="md:col-span-1 flex items-end">
                        <label className="flex items-center gap-2 text-sm cursor-pointer select-none mb-2">
                          <input type="checkbox" checked={newAtt.is_required}
                            onChange={(e) => setNewAtt({ ...newAtt, is_required: e.target.checked })} />
                          必备证据
                        </label>
                      </div>
                      <div className="md:col-span-2 flex items-end gap-2">
                        <button className="btn btn-primary w-full" onClick={addAttachment} disabled={attLoading}>
                          {attLoading ? '添加中...' : '➕ 添加附件'}
                        </button>
                      </div>
                    </div>
                    <div className="mt-3 flex gap-2 text-xs flex-wrap">
                      {(STAGE_REQUIRED_CATEGORIES as any)[project.stage]?.map((cat: string) => {
                        const label = cat === 'demand' ? '需求' : cat === 'plan' ? '方案' : '合同'
                        const have = project.attachments.some(a => a.category === cat)
                        return (
                          <div key={cat} className={`px-2 py-1 rounded border ${have ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                            {have ? '✅' : '❌'} {label}材料{have ? '齐全' : '缺失'}
                            {!have && (
                              <button className="ml-2 underline" onClick={() => quickAddAtt(cat, true)}>立即上传</button>
                            )}
                          </div>
                        )
                      })}
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
                          <th className="th w-12">#</th>
                          <th className="th">文件名</th>
                          <th className="th w-32">分类</th>
                          <th className="th w-40">请求类型/阶段</th>
                          <th className="th w-20">必备</th>
                          <th className="th w-20">大小</th>
                          <th className="th w-32">上传人</th>
                          <th className="th w-32">上传时间</th>
                          {(canEdit || editing) && <th className="th w-20">操作</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {project.attachments.map((a, i) => (
                          <tr key={a.id} className="hover:bg-gray-50">
                            <td className="td text-gray-400">{i + 1}</td>
                            <td className="td font-medium text-gray-800">{a.file_name}</td>
                            <td className="td"><span className="badge bg-gray-100 text-gray-700 border-gray-300">{a.category_label}</span></td>
                            <td className="td">
                              <span className={`badge ${
                                a.category === 'demand' ? 'bg-sky-50 text-sky-700 border-sky-200' :
                                a.category === 'plan' ? 'bg-purple-50 text-purple-700 border-purple-200' :
                                a.category === 'contract' ? 'bg-teal-50 text-teal-700 border-teal-200' :
                                'bg-gray-100 text-gray-700 border-gray-300'
                              }`}>
                                {a.request_stage_label}
                              </span>
                            </td>
                            <td className="td">
                              {a.is_required ? (
                                <span className="badge bg-red-50 text-red-700 border-red-200">🔴 必备证据</span>
                              ) : (
                                <span className="text-xs text-gray-400">普通</span>
                              )}
                            </td>
                            <td className="td text-xs text-gray-500">{a.file_size ? `${(a.file_size / 1024).toFixed(1)} KB` : '-'}</td>
                            <td className="td text-xs text-gray-600">{a.uploaded_by?.full_name || '-'}</td>
                            <td className="td text-xs text-gray-500">{dayjs(a.uploaded_at).format('MM-DD HH:mm')}</td>
                            {(canEdit || editing) && (
                              <td className="td">
                                <button className="btn btn-danger !py-1 !px-2 text-xs" onClick={() => removeAttachment(a.id)}>删除</button>
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

            {/* Tab: 处理记录 */}
            {tab === 'records' && (
              <div className="p-5">
                {project.processing_records.length === 0 ? (
                  <div className="text-center text-gray-400 py-10">暂无处理记录</div>
                ) : (
                  <ol className="relative border-l-2 border-gray-200 ml-3 space-y-5">
                    {project.processing_records.map((r, i) => (
                      <li key={r.id} className="ml-5">
                        <div className={`absolute -left-[9px] mt-1.5 w-4 h-4 rounded-full border-2 border-white shadow ${
                          i === 0 ? 'bg-primary-500' : i === project.processing_records.length - 1 ? 'bg-gray-400' : 'bg-sky-500'
                        }`} />
                        <div className="card p-4">
                          <div className="flex flex-wrap items-center justify-between mb-2 gap-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold text-primary-700">{r.action_name}</span>
                              <span className="badge bg-gray-100 text-gray-600 border-gray-200">v{r.version_at_action}</span>
                              {r.operator_role_label && (
                                <span className="text-xs text-gray-500 bg-gray-50 px-2 py-0.5 rounded">
                                  责任岗位：{r.operator_role_label}
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-gray-500">
                              {r.operator?.full_name || '-'} · {dayjs(r.processed_at).format('YYYY-MM-DD HH:mm:ss')}
                            </div>
                          </div>
                          {(r.from_status || r.to_status || r.from_stage || r.to_stage) && (
                            <div className="text-xs text-gray-600 mb-2 flex flex-wrap gap-3">
                              {r.from_status && r.to_status && (
                                <span>
                                  状态：<span className="badge mr-1" style={{ background: '#f3f4f6' }}>{
                                    { draft: '草稿', pending_audit: '待审核', audit_rejected: '退回补正', audit_passed: '审核通过', pending_review: '待复核', review_rejected: '复核退回', synced: '已同步', archived: '已归档' }[r.from_status] || r.from_status
                                  }</span>
                                  →
                                  <span className="badge ml-1" style={{ background: '#f3f4f6' }}>{
                                    { draft: '草稿', pending_audit: '待审核', audit_rejected: '退回补正', audit_passed: '审核通过', pending_review: '待复核', review_rejected: '复核退回', synced: '已同步', archived: '已归档' }[r.to_status] || r.to_status
                                  }</span>
                                </span>
                              )}
                              {r.from_stage && r.to_stage && r.from_stage !== r.to_stage && (
                                <span>
                                  阶段：<span className="badge mx-1" style={{ background: '#f3f4f6' }}>
                                    {{ demand: '培训需求', plan: '方案报价', contract: '合同确认' }[r.from_stage]}
                                  </span>→<span className="badge ml-1" style={{ background: '#f3f4f6' }}>
                                    {{ demand: '培训需求', plan: '方案报价', contract: '合同确认' }[r.to_stage]}
                                  </span>
                                </span>
                              )}
                            </div>
                          )}
                          {r.remark && (
                            <div className="text-sm text-gray-700 bg-gray-50 rounded p-2 border border-gray-100">💬 {r.remark}</div>
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

            {/* Tab: 异常追溯 */}
            {tab === 'exceptions' && (
              <div className="p-5 space-y-3">
                <div className="p-3 rounded bg-gray-50 border border-gray-200 text-xs text-gray-600 mb-2">
                  异常记录由后端在校验时自动写入，包含类型、原因、责任岗位和责任人；用于月底追溯和责任认定。
                </div>
                {exceptions.length === 0 ? (
                  <div className="text-center text-gray-400 py-10">暂无异常记录（✅ 正常）</div>
                ) : (
                  exceptions.map((e) => (
                    <div key={e.id} className={`p-4 rounded border text-sm ${EXCEPTION_COLORS[e.exception_type] || 'bg-gray-50 border-gray-300 text-gray-700'}`}>
                      <div className="flex flex-wrap items-start justify-between gap-3 mb-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xl">{EXCEPTION_ICONS[e.exception_type] || '⚠️'}</span>
                          <span className="font-semibold">{e.exception_type_label || e.exception_type}</span>
                          {e.exception_code && (
                            <span className="text-xs opacity-80">编码：{e.exception_code}</span>
                          )}
                          <span className={`badge ${e.resolved ? 'bg-green-100 text-green-700 border-green-200' : 'bg-red-100 text-red-700 border-red-200'}`}>
                            {e.resolved ? '已处理' : '未处理'}
                          </span>
                        </div>
                        <span className="text-xs opacity-80">{dayjs(e.created_at).format('YYYY-MM-DD HH:mm:ss')}</span>
                      </div>
                      <div className="mb-2 whitespace-pre-wrap font-medium">异常原因：{e.exception_message}</div>
                      <div className="flex flex-wrap gap-4 text-xs">
                        <div>
                          👤 责任岗位：
                          <span className="font-medium">{e.responsible_role_label || '-'}</span>
                        </div>
                        {e.responsible_user && (
                          <div>
                            🧑‍💼 责任人：<span className="font-medium">{e.responsible_user.full_name}</span>
                            <span className="opacity-70">（{e.responsible_user.role_name}）</span>
                          </div>
                        )}
                        {e.resolution && (
                          <div>📝 处理方案：<span className="font-medium">{e.resolution}</span></div>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Tab: 审计备注 */}
            {tab === 'audit' && (
              <div className="p-5 space-y-3">
                {project.audit_notes.length === 0 ? (
                  <div className="text-center text-gray-400 py-10">暂无审计备注</div>
                ) : (
                  project.audit_notes.map((n) => {
                    const isExc = n.note_type === 'exception'
                    const isSup = n.note_type === 'supplement'
                    return (
                      <div key={n.id} className={`p-3 rounded border text-sm ${
                        isExc ? 'bg-red-50 border-red-200' :
                        isSup ? 'bg-amber-50 border-amber-200' :
                        'bg-blue-50 border-blue-200'
                      }`}>
                        <div className="flex items-center justify-between mb-1">
                          <span className={`badge ${
                            isExc ? 'bg-red-100 text-red-700 border-red-200' :
                            isSup ? 'bg-amber-100 text-amber-700 border-amber-200' :
                            'bg-blue-100 text-blue-700 border-blue-200'
                          }`}>
                            {n.note_type_label || n.note_type}
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
      )}
    </div>
  )
}
