import { ROLES } from '../types'

export default function Header({ store }) {
  const { currentUser, switchRole } = store

  return (
    <header className="app-header">
      <div className="app-title">
        <h1>🚒 消防救援站 - 月底集中处理消防隐患单系统</h1>
        <span className="badge">实际岗位协作</span>
      </div>
      <div className="user-panel">
        <div className="role-switcher">
          <button
            className={`role-btn ${currentUser.role === ROLES.FIRE_CLERK ? 'active' : ''}`}
            onClick={() => switchRole(ROLES.FIRE_CLERK)}
          >
            消防文员
          </button>
          <button
            className={`role-btn ${currentUser.role === ROLES.FIRE_SUPERVISOR ? 'active' : ''}`}
            onClick={() => switchRole(ROLES.FIRE_SUPERVISOR)}
          >
            防火监督员
          </button>
          <button
            className={`role-btn ${currentUser.role === ROLES.STATION_CHIEF ? 'active' : ''}`}
            onClick={() => switchRole(ROLES.STATION_CHIEF)}
          >
            站点负责人
          </button>
        </div>
        <div className="user-info">
          当前用户：<strong>{currentUser.name}</strong>（{currentUser.roleName}）
        </div>
      </div>
    </header>
  )
}
