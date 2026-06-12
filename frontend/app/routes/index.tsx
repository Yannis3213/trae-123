import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { api, DashboardStats, getUser, STATUS_COLORS, STAGE_COLORS } from '~/app/api'
import dayjs from 'dayjs'

export const Route = createFileRoute('/')({
  component: Dashboard,
})

function StatCard({ title, value, color, extra }: { title: string; value: number; color?: string; extra?: React.ReactNode }) {
  return (
    <div className={`card p-4 ${color || ''}`}>
      <div className="text-sm text-gray-500">{title}</div>
      <div className="text-3xl font-bold mt-2 text-gray-800">{value}</div>
      {extra}
    </div>
  )
}

function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [err, setErr] = useState('')
  const user = getUser()

  useEffect(() => {
    api.dashboard().then(setStats).catch((e) => setErr(e.message))
  }, [])

  if (!user) {
    return (
      <div className="text-center py-20">
        <Link to="/login" className="btn btn-primary text-lg px-6 py-3">
          请先登录系统
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {err && <div className="text-red-600 bg-red-50 p-3 rounded border border-red-200">{err}</div>}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">工作台</h1>
          <div className="text-sm text-gray-500 mt-1">
            今日：{dayjs().format('YYYY年MM月DD日')} · 当前角色：
            <span className="font-semibold text-primary-700">{user.role_name}</span>
          </div>
        </div>
        <div className="flex gap-2">
          <Link to="/projects" className="btn btn-primary">📝 进入项目单列表</Link>
          <Link to="/projects/new" className="btn">➕ 新建项目单</Link>
        </div>
      </div>

      {stats && (
        <>
          <div>
            <h2 className="text-lg font-semibold text-gray-700 mb-3">📈 整体统计</h2>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <StatCard title="项目单总数" value={stats.total_count} />
              <StatCard title="草稿" value={stats.draft_count} />
              <StatCard title="待审核/待补正" value={stats.pending_audit_count} />
              <StatCard title="待项目经理复核" value={stats.pending_review_count} />
              <StatCard title="已同步/已归档" value={stats.synced_count} />
            </div>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-gray-700 mb-3">⏰ 到期预警分布</h2>
            <div className="grid grid-cols-3 gap-4">
              <StatCard
                title="✅ 正常（截止3天以上）"
                value={stats.normal_deadline_count}
                color="border-emerald-200 bg-emerald-50/30"
              />
              <StatCard
                title="⚠️ 临期（3天内到期）"
                value={stats.near_deadline_count}
                color="border-amber-200 bg-amber-50/30"
              />
              <StatCard
                title="❌ 逾期（已过期）"
                value={stats.overdue_count}
                color="border-red-200 bg-red-50/30"
              />
            </div>
            <div className="mt-2">
              <Link to="/deadline" className="text-sm text-primary-600 hover:underline">
                → 查看完整到期预警看板
              </Link>
            </div>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-gray-700 mb-3">🔀 阶段分布（培训需求→方案报价→合同确认）</h2>
            <div className="grid grid-cols-3 gap-4">
              <StatCard
                title="培训需求"
                value={stats.stage_demand_count}
                color="border-sky-200 bg-sky-50/30"
              />
              <StatCard
                title="方案报价"
                value={stats.stage_plan_count}
                color="border-purple-200 bg-purple-50/30"
              />
              <StatCard
                title="合同确认"
                value={stats.stage_contract_count}
                color="border-teal-200 bg-teal-50/30"
              />
            </div>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-gray-700 mb-3">👥 各角色待办数量</h2>
            <div className="grid grid-cols-3 gap-4">
              {Object.entries(stats.role_counts).map(([k, v]) => (
                <StatCard key={k} title={k} value={v} />
              ))}
            </div>
          </div>

          <div className="card p-5">
            <h2 className="text-lg font-semibold text-gray-700 mb-3">📖 责任链说明</h2>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div className="p-3 rounded bg-sky-50 border border-sky-200">
                <div className="font-semibold text-sky-800 mb-1">① 课程顾问（培训项目登记员）</div>
                <ul className="text-sky-700 space-y-1 list-disc pl-4">
                  <li>创建、维护项目单入口数据</li>
                  <li>提交审核 / 退回补正后重新提交</li>
                  <li>推进阶段（需求→方案→合同）</li>
                </ul>
              </div>
              <div className="p-3 rounded bg-purple-50 border border-purple-200">
                <div className="font-semibold text-purple-800 mb-1">② 讲师运营（培训项目审核主管）</div>
                <ul className="text-purple-700 space-y-1 list-disc pl-4">
                  <li>核对过程证据与材料</li>
                  <li>审核通过 / 退回补正</li>
                  <li>复核退回后的再次审核</li>
                </ul>
              </div>
              <div className="p-3 rounded bg-teal-50 border border-teal-200">
                <div className="font-semibold text-teal-800 mb-1">③ 项目经理（复核负责人）</div>
                <ul className="text-teal-700 space-y-1 list-disc pl-4">
                  <li>确认最终结果</li>
                  <li>复核通过并同步 / 复核退回</li>
                  <li>同步后归档</li>
                </ul>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
