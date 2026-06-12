import { createFileRoute, useNavigate, Link } from '@tanstack/react-router'
import { useEffect, useState, useMemo } from 'react'
import {
  api,
  TrainingProjectSimple,
  STATUS_COLORS,
  DEADLINE_COLORS,
  STAGE_COLORS,
  BatchActionRequest,
  BatchActionResponse,
  getUser,
  ACTION_LABELS,
} from '~/app/api'
import dayjs from 'dayjs'

export const Route = createFileRoute('/projects')({
  component: ProjectList,
})

const FILTER_STATUS = [
  { v: '', label: '全部状态' },
  { v: 'draft', label: '草稿' },
  { v: 'pending_audit,review_rejected', label: '待审核（讲师运营）' },
  { v: 'audit_rejected', label: '退回补正（课程顾问）' },
  { v: 'audit_passed', label: '审核通过（待项目经理复核）' },
  { v: 'synced', label: '已同步' },
  { v: 'archived', label: '已归档' },
]

const FILTER_STAGE = [
  { v: '', label: '全部阶段' },
  { v: 'demand', label: '培训需求' },
  { v: 'plan', label: '方案报价' },
  { v: 'contract', label: '合同确认' },
]

const FILTER_DEADLINE = [
  { v: '', label: '全部到期' },
  { v: 'normal', label: '正常（3天以上）' },
  { v: 'near', label: '临期（3天内）' },
  { v: 'overdue', label: '逾期（已过期）' },
]

const DEADLINE_LABEL: Record<string, string> = {
  normal: '正常',
  near: '临期',
  overdue: '逾期',
}

function ProjectList() {
  const nav = useNavigate()
  const user = getUser()

  const [page, setPage] = useState(1)
  const [pageSize] = useState(15)
  const [status, setStatus] = useState('')
  const [stage, setStage] = useState('')
  const [deadline, setDeadline] = useState('')
  const [keyword, setKeyword] = useState('')
  const [handlerOnly, setHandlerOnly] = useState(false)

  const [items, setItems] = useState<TrainingProjectSimple[]>([])
  const [total, setTotal] = useState(0)
  const [listStats, setListStats] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')

  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [batchAction, setBatchAction] = useState('')
  const [batchRemark, setBatchRemark] = useState('')
  const [batchResult, setBatchResult] = useState<BatchActionResponse | null>(null)
  const [batchLoading, setBatchLoading] = useState(false)

  const load = () => {
    setLoading(true)
    setErr('')
    const params: any = { page, page_size: pageSize }
    if (status) params.status = status
    if (stage) params.stage = stage
    if (deadline) params.deadline_status = deadline
    if (keyword) params.keyword = keyword
    if (handlerOnly) params.handler_only = 'true'
    api
      .listProjects(params)
      .then((r) => {
        setItems(r.items)
        setTotal(r.total)
        setListStats(r.stats)
      })
      .catch((e) => setErr(e.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    if (!user) return
    load()
  }, [page, status, stage, deadline, handlerOnly, user])

  const pageCount = Math.max(1, Math.ceil(total / pageSize))

  const toggleSelect = (id: number) => {
    const s = new Set(selected)
    if (s.has(id)) s.delete(id)
    else s.add(id)
    setSelected(s)
  }
  const toggleAll = () => {
    if (selected.size === items.length) setSelected(new Set())
    else setSelected(new Set(items.map((i) => i.id)))
  }

  const canBatchByRole = useMemo(() => {
    const actions: { v: string; label: string }[] = []
    if (!user) return actions
    if (user.role === 'registrar') {
      actions.push({ v: 'submit', label: '批量提交审核' })
      actions.push({ v: 'supplement', label: '批量补正提交' })
      actions.push({ v: 'advance_stage', label: '批量推进阶段' })
    }
    if (user.role === 'auditor') {
      actions.push({ v: 'audit_pass', label: '批量审核通过' })
      actions.push({ v: 'audit_reject', label: '批量退回补正' })
    }
    if (user.role === 'reviewer') {
      actions.push({ v: 'review_pass', label: '批量复核通过并同步' })
      actions.push({ v: 'review_reject', label: '批量复核退回' })
      actions.push({ v: 'archive', label: '批量归档' })
    }
    return actions
  }, [user])

  const runBatch = async () => {
    if (selected.size === 0 || !batchAction) return
    setBatchLoading(true)
    setBatchResult(null)
    setErr('')
    try {
      const versions: Record<number, number> = {}
      items.forEach((i) => {
        if (selected.has(i.id)) versions[i.id] = i.version
      })
      const req: BatchActionRequest = {
        ids: Array.from(selected),
        action: batchAction,
        remark: batchRemark || undefined,
        versions,
      }
      const res = await api.batchAction(req)
      setBatchResult(res)
      setSelected(new Set())
      load()
    } catch (e: any) {
      setErr(e.message || '批量操作失败')
    } finally {
      setBatchLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">📝 培训项目单列表</h1>
          <div className="text-sm text-gray-500 mt-1">
            共 {total} 条 · 当前角色按权限自动筛选可见范围
          </div>
        </div>
        <div className="flex gap-2">
          {user?.role === 'registrar' && (
            <Link to="/projects/new" className="btn btn-primary">➕ 新建项目单</Link>
          )}
          <button onClick={load} className="btn">🔄 刷新</button>
        </div>
      </div>

      {listStats && (
        <div className="grid grid-cols-3 gap-4">
          <div className="card p-3 border-emerald-200 bg-emerald-50/40 text-sm">
            <span className="text-gray-600">正常：</span>
            <span className="font-bold text-emerald-700 ml-1">{listStats.normal_deadline}</span>
          </div>
          <div className="card p-3 border-amber-200 bg-amber-50/40 text-sm">
            <span className="text-gray-600">临期：</span>
            <span className="font-bold text-amber-700 ml-1">{listStats.near_deadline}</span>
          </div>
          <div className="card p-3 border-red-200 bg-red-50/40 text-sm">
            <span className="text-gray-600">逾期：</span>
            <span className="font-bold text-red-700 ml-1">{listStats.overdue}</span>
          </div>
        </div>
      )}

      <div className="card p-4">
        <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
          <div>
            <label className="label">状态筛选</label>
            <select className="input" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1) }}>
              {FILTER_STATUS.map((f) => <option key={f.v} value={f.v}>{f.label}</option>)}
            </select>
          </div>
          <div>
            <label className="label">阶段筛选</label>
            <select className="input" value={stage} onChange={(e) => { setStage(e.target.value); setPage(1) }}>
              {FILTER_STAGE.map((f) => <option key={f.v} value={f.v}>{f.label}</option>)}
            </select>
          </div>
          <div>
            <label className="label">到期情况</label>
            <select className="input" value={deadline} onChange={(e) => { setDeadline(e.target.value); setPage(1) }}>
              {FILTER_DEADLINE.map((f) => <option key={f.v} value={f.v}>{f.label}</option>)}
            </select>
          </div>
          <div>
            <label className="label">关键词</label>
            <input
              className="input"
              placeholder="编号/项目名/客户公司"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { setPage(1); load() } }}
            />
          </div>
          <div className="flex items-end">
            <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
              <input type="checkbox" checked={handlerOnly} onChange={(e) => { setHandlerOnly(e.target.checked); setPage(1) }} />
              仅看我办理/我创建的
            </label>
          </div>
          <div className="flex items-end gap-2">
            <button onClick={() => { setPage(1); load() }} className="btn btn-primary">🔍 搜索</button>
            <button
              onClick={() => { setStatus(''); setStage(''); setDeadline(''); setKeyword(''); setHandlerOnly(false); setPage(1) }}
              className="btn"
            >
              重置
            </button>
          </div>
        </div>
      </div>

      {selected.size > 0 && canBatchByRole.length > 0 && (
        <div className="card p-4 border-primary-300 bg-primary-50/30">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-center">
            <div className="text-sm font-medium text-primary-700">
              已选择 {selected.size} 条单据进行批量处理
            </div>
            <div>
              <select className="input" value={batchAction} onChange={(e) => setBatchAction(e.target.value)}>
                <option value="">请选择批量动作...</option>
                {canBatchByRole.map((a) => (
                  <option key={a.v} value={a.v}>{a.label}</option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2">
              <input
                className="input"
                placeholder="批量备注（退回时必填建议）"
                value={batchRemark}
                onChange={(e) => setBatchRemark(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={runBatch}
                disabled={!batchAction || batchLoading}
                className="btn btn-primary flex-1"
              >
                {batchLoading ? '处理中...' : '执行批量'}
              </button>
              <button onClick={() => setSelected(new Set())} className="btn">取消</button>
            </div>
          </div>
        </div>
      )}

      {batchResult && (
        <div className="card p-4 border-blue-200 bg-blue-50/30">
          <div className="flex items-center justify-between mb-3">
            <div className="font-semibold text-blue-800">
              批量处理结果：成功 {batchResult.success_count} / {batchResult.total}，失败 {batchResult.fail_count}
            </div>
            <button onClick={() => setBatchResult(null)} className="btn !py-1 !px-2 text-xs">关闭</button>
          </div>
          <div className="max-h-60 overflow-y-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-blue-100 text-blue-800">
                  <th className="text-left px-2 py-1.5 w-32">项目编号</th>
                  <th className="text-left px-2 py-1.5 w-20">结果</th>
                  <th className="text-left px-2 py-1.5">说明</th>
                  <th className="text-left px-2 py-1.5 w-32">新状态</th>
                </tr>
              </thead>
              <tbody>
                {batchResult.results.map((r) => (
                  <tr key={r.id} className="border-t border-blue-100">
                    <td className="px-2 py-1.5 font-mono text-xs">{r.project_no || '-'}</td>
                    <td className="px-2 py-1.5">
                      {r.success ? (
                        <span className="text-green-700 font-medium">✅ 成功</span>
                      ) : (
                        <span className="text-red-700 font-medium">❌ 失败</span>
                      )}
                    </td>
                    <td className="px-2 py-1.5 text-gray-700">{r.message}</td>
                    <td className="px-2 py-1.5">{r.new_status || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {err && <div className="p-3 rounded bg-red-50 text-red-700 border border-red-200 text-sm">{err}</div>}

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th className="th w-10">
                  <input type="checkbox" checked={items.length > 0 && selected.size === items.length} onChange={toggleAll} />
                </th>
                <th className="th w-36">项目编号</th>
                <th className="th">项目名称 / 客户公司</th>
                <th className="th w-24">阶段</th>
                <th className="th w-36">状态</th>
                <th className="th w-28">截止日期</th>
                <th className="th w-28">到期状态</th>
                <th className="th w-28">当前处理人</th>
                <th className="th w-20">版本</th>
                <th className="th w-36">更新时间</th>
                <th className="th w-24">操作</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={11} className="td text-center text-gray-400 py-10">加载中...</td>
                </tr>
              )}
              {!loading && items.length === 0 && (
                <tr>
                  <td colSpan={11} className="td text-center text-gray-400 py-10">暂无数据</td>
                </tr>
              )}
              {items.map((p) => {
                const dlStatus = p.deadline_status || 'normal'
                const rowBg =
                  dlStatus === 'overdue' ? 'bg-red-50/40' : dlStatus === 'near' ? 'bg-amber-50/30' : ''
                return (
                  <tr
                    key={p.id}
                    className={`row-hover ${rowBg}`}
                    onDoubleClick={() => nav({ to: `/projects/$id`, params: { id: String(p.id) } })}
                  >
                    <td className="td" onClick={(e) => e.stopPropagation()}>
                      <input type="checkbox" checked={selected.has(p.id)} onChange={() => toggleSelect(p.id)} />
                    </td>
                    <td className="td font-mono text-xs text-primary-700">{p.project_no}</td>
                    <td className="td">
                      <div className="font-medium text-gray-900">{p.project_name}</div>
                      <div className="text-xs text-gray-500 mt-0.5">
                        {p.client_company}
                        {p.contact_person && ` · ${p.contact_person}`}
                        {p.training_count > 0 && ` · ${p.training_count}人`}
                      </div>
                    </td>
                    <td className="td">
                      <span className={`badge ${STAGE_COLORS[p.stage] || ''}`}>{p.stage_name}</span>
                    </td>
                    <td className="td">
                      <span className={`badge ${STATUS_COLORS[p.status] || ''}`}>{p.status_name}</span>
                    </td>
                    <td className="td text-xs text-gray-600">
                      {p.deadline ? dayjs(p.deadline).format('YYYY-MM-DD') : '-'}
                    </td>
                    <td className="td">
                      <span className={`badge ${DEADLINE_COLORS[dlStatus] || ''}`}>
                        {DEADLINE_LABEL[dlStatus]}
                        {p.overdue_days && dlStatus === 'overdue' && ` ${p.overdue_days}天`}
                        {p.overdue_days !== undefined && dlStatus === 'near' && ` ${p.overdue_days}天`}
                      </span>
                    </td>
                    <td className="td text-xs text-gray-600">
                      {p.current_handler?.full_name || (p.current_handler_role ? '待分配' : '-')}
                    </td>
                    <td className="td text-xs text-gray-500">v{p.version}</td>
                    <td className="td text-xs text-gray-500">{dayjs(p.updated_at).format('MM-DD HH:mm')}</td>
                    <td className="td" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => nav({ to: `/projects/$id`, params: { id: String(p.id) } })}
                        className="btn btn-primary !py-1 !px-2 text-xs"
                      >
                        办理/详情
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-3 flex items-center justify-between border-t border-gray-100 text-sm">
          <div className="text-gray-500">
            第 {page} / {pageCount} 页 · 共 {total} 条
          </div>
          <div className="flex gap-1">
            <button className="btn !py-1 !px-2 text-xs" disabled={page <= 1} onClick={() => setPage(page - 1)}>
              上一页
            </button>
            {Array.from({ length: Math.min(5, pageCount) }, (_, i) => {
              const start = Math.max(1, page - 2)
              const n = Math.min(start + i, pageCount)
              return (
                <button
                  key={n}
                  onClick={() => setPage(n)}
                  className={`!py-1 !px-2 text-xs btn ${n === page ? 'btn-primary' : ''}`}
                >
                  {n}
                </button>
              )
            })}
            <button className="btn !py-1 !px-2 text-xs" disabled={page >= pageCount} onClick={() => setPage(page + 1)}>
              下一页
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
