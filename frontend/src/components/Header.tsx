import { Show } from 'solid-js'
import { currentUser, statistics } from '../store'

interface HeaderProps {
  onLogout: () => void
}

const roleLabels: Record<string, string> = {
  '客服专员': '客服专员',
  '师傅调度': '师傅调度',
  '服务经理': '服务经理'
}

function Header(props: HeaderProps) {
  const stats = () => statistics()

  return (
    <header class="app-header">
      <h1>维修服务平台 - 月底集中处理系统</h1>
      <div class="header-info">
        <Show when={stats()}>
          <div class="header-stats">
            <span class="header-stat">待接单 <span class="count">{stats()!.status_counts['待接单'] || 0}</span></span>
            <span class="header-stat">已接单 <span class="count">{stats()!.status_counts['已接单'] || 0}</span></span>
            <span class="header-stat">验收通过 <span class="count">{stats()!.status_counts['验收通过'] || 0}</span></span>
            <span class="header-stat">逾期 <span class="count" style={{ color: '#ef4444' }}>{stats()!.expiry_counts.overdue || 0}</span></span>
          </div>
        </Show>
        <div class="header-user">
          <span>{currentUser()?.name}</span>
          <span class="role-badge">{roleLabels[currentUser()?.role || ''] || currentUser()?.role}</span>
          <button class="btn btn-sm btn-ghost" onClick={props.onLogout} style={{ color: '#f8fafc', "border-color": 'rgba(255,255,255,0.3)' }}>
            退出
          </button>
        </div>
      </div>
    </header>
  )
}

export default Header
