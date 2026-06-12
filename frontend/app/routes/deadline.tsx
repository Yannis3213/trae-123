import { createFileRoute, useNavigate, Link } from '@tanstack/react-router'
import { useEffect, useState, useMemo } from 'react'
import {
  api,
  TrainingProjectSimple,
  STATUS_COLORS,
  STAGE_COLORS,
  getUser,
  BatchActionRequest,
  BatchActionResponse,
  ACTION_LABELS,
} from '~/app/api'
import dayjs from 'dayjs'

export const Route = createFileRoute('/deadline')({
  component: DeadlineBoard,
})

function DeadlineBoard() {
  const nav = useNavigate()
  const user = getUser()

  const [items, setItems] = useState<TrainingProjectSimple[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [selectedTab, setSelectedTab] = useState<'overdue' | 'near' | 'normal'>('overdue')

  const [batchAction, setBatchAction] = useState('')
  const [batchRemark, setBatchRemark] = useState('')
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [batchLoading, setBatchLoading] = useState(false)
  const [batchResult, setBatchResult] = useState<BatchActionResponse | null>(null)
  const [msg, setMsg] = useState('')

  const load = async () => {
    setLoading(true)
    setErr('')
    try {
      const r = await api.listProjects({ page: 1, page_size: 200 })
      setItems(r.items)
    } catch (e: any) {
      setErr(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [user])

  const grouped = useMemo(() => {
    const result: Record<string, TrainingProjectSimple[]> = {
      overdue: [],
      near: [],
      normal: [],
    }
    items.forEach((it) => {
      const ds = it.deadline_status || 'normal'
      result[ds]?.push(it)
    })
    result.overdue.sort(
      (a, b) => (a.overdue_days || 0) - (b.overdue_days || 0) > 0 ? -1 : 1,
    )
    result.near.sort((a, b) => (a.overdue_days || 0) - (b.overdue_days || 0))
    return result
  }, [items])

  const currentList = grouped[selectedTab] || []

  const counts = {
    overdue: grouped.overdue.length,
    near: grouped.near.length,
    normal: grouped.normal.length,
  }

  const tabActions = useMemo(() => {
    const actions: { v: string; label: string }[] = []
    if (!user) return actions
    if (user.role === 'registrar') {
      actions.push({ v: 'supplement', label: '批量补正提交' })
      actions.push({ v: 'advance_stage', label: '批量推进阶段' })
    }
    if (user.role === 'auditor') {
      actions.push({ v: 'audit_pass', label: '批量审核通过' })
      actions.push({ v: 'audit_reject', label: '批量退回补正' })
    }
    if (user.role === 'reviewer') {
      actions.push({ v: 'review_pass', label: '批量复核通过并同步' })
    }
    return actions
  }, [user])

  const runBatch = async () => {
    if (selected.size === 0 || !batchAction) return
    setBatchLoading(true)
    setBatchResult(null)
    setErr('')
    setMsg('')
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
      setErr(e.message || '批量操作失败（后端会逐条拦截异常，如版本冲突、越权、缺证据、状态冲突等）')
    } finally {
      setBatchLoading(false)
    }
  }

  const toggleSelect = (id: number) => {
    const s = new Set(selected)
    if (s.has(id)) s.delete(id)
    else s.add(id)
    setSelected(s)
  }
  const toggleAll = () => {
    if (selected.size === currentList.length) setSelected(new Set())
    else setSelected(new Set(currentList.map((i) => i.id)))
  }

  if (!user) {
    return (
      <div className="text-center py-20">
        <Link to="/login" className="btn btn-primary">请先登录</Link>
      </div>
    )
  }

  const responsibleByRole = (p: TrainingProjectSimple) => {
    if (p.current_handler_role === 'registrar') return { color: 'sky', label: '课程顾问' }
    if (p.current_handler_role === 'auditor') return { color: 'purple', label: '讲师运营' }
    if (p.current_handler_role === 'reviewer') return { color: 'teal', label: '项目经理' }
    return { color: 'gray', label: '未分配' }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">⏰ 到期预警看板</h1>
          <div className="text-sm text-gray-500 mt-1">
            月底重点关注：正常、临期、逾期三队分离；逾期按责任归属到具体岗位，支持批量推进
          </div>
        </div>
        <div className="flex gap-2">
          <Link to="/projects" className="btn">📝 项目单列表</Link>
          <button onClick={load} className="btn btn-primary">🔄 刷新</button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <button
          onClick={() => setSelectedTab('normal')}
          className={`card p-5 text-left transition-all border-2 ${
            selectedTab === 'normal' ? 'border-emerald-400 shadow-md' : 'border-transparent'
          }`}
        >
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-emerald-600 font-medium">✅ 正常（截止 3 天以上）</div>
              <div className="text-4xl font-bold text-emerald-700 mt-2">{counts.normal}</div>
            </div>
            <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center text-2xl">
              📗
            </div>
          </div>
        </button>
        <button
          onClick={() => setSelectedTab('near')}
          className={`card p-5 text-left transition-all border-2 ${
            selectedTab === 'near' ? 'border-amber-400 shadow-md' : 'border-transparent'
          }`}
        >
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-amber-600 font-medium">⚠️ 临期（3 天内到期）</div>
              <div className="text-4xl font-bold text-amber-700 mt-2">{counts.near}</div>
            </div>
            <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center text-2xl">
              📙
            </div>
          </div>
        </button>
        <button
          onClick={() => setSelectedTab('overdue')}
          className={`card p-5 text-left transition-all border-2 ${
            selectedTab === 'overdue' ? 'border-red-400 shadow-md' : 'border-transparent'
          }`}
        >
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-red-600 font-medium">❌ 逾期（已过期，需追责）</div>
              <div className="text-4xl font-bold text-red-700 mt-2">{counts.overdue}</div>
            </div>
            <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center text-2xl">
              📕
            </div>
          </div>
        </button>
      </div>

      {selected.size > 0 && tabActions.length > 0 && (
        <div className="card p-4 border-primary-300 bg-primary-50/30">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-center">
            <div className="text-sm font-medium text-primary-700">
              已选 {selected.size} 条，执行批量处理（后端逐条校验，异常进入审计备注）
            </div>
            <div>
              <select className="input" value={batchAction} onChange={(e) => setBatchAction(e.target.value)}>
                <option value="">选择批量动作...</option>
                {tabActions.map((a) => (
                  <option key={a.v} value={a.v}>
                    {a.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2">
              <input
                className="input"
                placeholder="批量备注"
                value={batchRemark}
                onChange={(e) => setBatchRemark(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <button onClick={runBatch} disabled={!batchAction || batchLoading} className="btn btn-primary flex-1">
                {batchLoading ? '处理中...' : '执行批量'}
              </button>
              <button onClick={() => setSelected(new Set())} className="btn">取消</button>
            </div>
          </div>
        </div>
      )}

      {batchResult && (
        <div className="card p-4 border-blue-200 bg-blue-50/30">
          <div className="flex items-center justify-between mb-2">
            <div className="font-semibold text-blue-800">
              批量处理结果：成功 {batchResult.success_count}/{batchResult.total}，失败 {batchResult.fail_count}
            </div>
            <button onClick={() => setBatchResult(null)} className="btn !py-1 !px-2 text-xs">关闭</button>
          </div>
          <div className="max-h-64 overflow-y-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-blue-100 text-blue-800">
                  <th className="px-2 py-1.5 text-left">编号</th>
                  <th className="px-2 py-1.5 text-left">结果</th>
                  <th className="px-2 py-1.5 text-left">原因/说明</th>
                  <th className="px-2 py-1.5 text-left">新状态</th>
                </tr>
              </thead>
              <tbody>
                {batchResult.results.map((r) => (
                  <tr key={r.id} className="border-t border-blue-100">
                    <td className="px-2 py-1.5 font-mono">{r.project_no || r.id}</td>
                    <td className="px-2 py-1.5">{r.success ? '✅ 成功' : '❌ 失败'}</td>
                    <td className="px-2 py-1.5 text-gray-700">{r.message}</td>
                    <td className="px-2 py-1.5">{r.new_status || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {err && (
        <div className="p-3 rounded bg-red-50 text-red-700 border border-red-200 text-sm">
          ❌ {err}
          <span className="ml-2 text-xs text-red-500">（异常已记录审计备注）</span>
        </div>
      )}
      {msg && <div className="p-3 rounded bg-green-50 text-green-700 border border-green-200 text-sm">✅ {msg}</div>}

      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
          <div className="font-semibold text-gray-800">
            {selectedTab === 'normal' && '正常（3 天以上）项目单'}
            {selectedTab === 'near' && '临期（3 天内到期）项目单'}
            {selectedTab === 'overdue' && '逾期项目单（含责任归属）'}
          </div>
          <div className="text-xs text-gray-500">共 {currentList.length} 条</div>
        </div>
        <div className="overflow-x-auto">
          {loading ? (
            <div className="py-16 text-center text-gray-400">加载中...</div>
          ) : currentList.length === 0 ? (
            <div className="py-16 text-center text-gray-400">此队列暂无项目单</div>
          ) : (
            <table className="w-full">
              <thead>
                <tr>
                  <th className="th w-10">
                    <input
                      type="checkbox"
                      checked={selected.size === currentList.length && currentList.length > 0}
                      onChange={toggleAll}
                    />
                  </th>
                  <th className="th w-36">项目编号</th>
                  <th className="th">项目/客户</th>
                  <th className="th w-24">阶段</th>
                  <th className="th w-32">状态</th>
                  <th className="th w-28">截止日期</th>
                  <th className="th w-28">剩余/逾期</th>
                  <th className="th w-32">责任人</th>
                  <th className="th w-20">版本</th>
                  <th className="th w-24">操作</th>
                </tr>
              </thead>
              <tbody>
                {currentList.map((p) => {
                  const resp = responsibleByRole(p)
                  const rowCls =
                    selectedTab === 'overdue'
                      ? 'bg-red-50/40'
                      : selectedTab === 'near'
                      ? 'bg-amber-50/30'
                      : ''
                  return (
                    <tr key={p.id} className={`row-hover ${rowCls}`}>
                      <td className="td" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selected.has(p.id)}
                          onChange={() => toggleSelect(p.id)}
                        />
                      </td>
                      <td className="td font-mono text-xs text-primary-700">{p.project_no}</td>
                      <td className="td">
                        <div className="font-medium text-gray-900">{p.project_name}</div>
                        <div className="text-xs text-gray-500 mt-0.5">
                          {p.client_company} · {p.training_count}人
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
                        {selectedTab === 'overdue' ? (
                          <span className="text-red-700 font-semibold text-sm">已逾期 {p.overdue_days} 天</span>
                        ) : selectedTab === 'near' ? (
                          <span className="text-amber-700 font-semibold text-sm">剩余 {p.overdue_days} 天</span>
                        ) : (
                          <span className="text-emerald-700 text-sm">剩余 {p.overdue_days} 天以上</span>
                        )}
                      </td>
                      <td className="td">
                        <span
                          className={`badge ${
                            resp.color === 'sky'
                              ? 'bg-sky-50 text-sky-700 border-sky-200'
                              : resp.color === 'purple'
                              ? 'bg-purple-50 text-purple-700 border-purple-200'
                              : resp.color === 'teal'
                              ? 'bg-teal-50 text-teal-700 border-teal-200'
                              : 'bg-gray-100 text-gray-600 border-gray-200'
                          }`}
                        >
                          {resp.label}
                          {p.current_handler?.full_name && `: ${p.current_handler.full_name}`}
                        </span>
                      </td>
                      <td className="td text-xs text-gray-500">v{p.version}</td>
                      <td className="td" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => nav({ to: `/projects/$id`, params: { id: String(p.id) } })}
                          className="btn btn-primary !py-1 !px-2 text-xs"
                        >
                          办理
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
