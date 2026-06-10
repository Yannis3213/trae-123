import type { User } from '../types'
import { ROLE_LABELS } from '../types'
import * as api from '../api'

interface HeaderProps {
  user: User
  onLogout: () => void
  onNavigate: (page: 'list' | 'detail' | 'stats') => void
  currentPage: string
}

export function Header({ user, onLogout, onNavigate, currentPage }: HeaderProps) {
  const handleLogout = async () => {
    try {
      await api.logout()
    } catch {}
    onLogout()
  }

  return (
    <header className="header">
      <div className="header-left">
        <h1>分包进场单系统</h1>
        <nav className="header-nav">
          <button
            className={currentPage === 'list' ? 'active' : ''}
            onClick={() => onNavigate('list')}
          >
            分包进场单
          </button>
          <button
            className={currentPage === 'stats' ? 'active' : ''}
            onClick={() => onNavigate('stats')}
          >
            统计概览
          </button>
        </nav>
      </div>
      <div className="header-right">
        <div className="user-info">
          <span>{user.name}</span>
          <span className="role-badge">{ROLE_LABELS[user.role]}</span>
        </div>
        <button className="btn btn-sm" style={{ background: 'rgba(255,255,255,0.15)', color: '#fff', border: 'none' }} onClick={handleLogout}>
          退出
        </button>
      </div>
    </header>
  )
}
