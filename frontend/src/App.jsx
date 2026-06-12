import { useEffect } from 'preact/hooks'
import Router from 'preact-router'
import { createHashHistory } from 'history'
import { useSignalEffect } from '@preact/signals'
import {
  currentUser,
  currentRole,
  currentModule,
  stats,
  roleName,
  moduleName,
  initUser,
  switchRole,
  setModule,
  loadStats,
} from './store.js'
import ApplicationList from './pages/ApplicationList.jsx'
import ApplicationDetail from './pages/ApplicationDetail.jsx'

function Sidebar() {
  const handleRoleChange = (e) => {
    switchRole(e.target.value)
  }

  const handleModuleClick = (module) => (e) => {
    e.preventDefault()
    setModule(module)
    window.location.hash = '/'
  }

  return (
    <aside className="sidebar">
      <div className="logo">商标申请单管理系统</div>
      <div className="user-info">
        <div>当前用户：{currentUser.value?.name || '加载中...'}</div>
        <div className="role-selector">
          <select value={currentRole.value} onChange={handleRoleChange}>
            <option value="registrar">商标申请登记员</option>
            <option value="agent">商标申请审核主管</option>
            <option value="director">知识产权代理所复核负责人</option>
          </select>
        </div>
      </div>
      <nav>
        <ul className="sidebar-nav">
          <li>
            <a
              href="#/"
              className={currentModule.value === 'application' ? 'active' : ''}
              onClick={handleModuleClick('application')}
            >
              商标申请
              {stats.value && (
                <span className="module-stats">({stats.value.total_application})</span>
              )}
            </a>
          </li>
          <li>
            <a
              href="#/corrections"
              className={currentModule.value === 'correction' ? 'active' : ''}
              onClick={handleModuleClick('correction')}
            >
              材料补正
              {stats.value && (
                <span className="module-stats">({stats.value.total_correction})</span>
              )}
            </a>
          </li>
          <li>
            <a
              href="#/notifications"
              className={currentModule.value === 'notification' ? 'active' : ''}
              onClick={handleModuleClick('notification')}
            >
              递交通知
              {stats.value && (
                <span className="module-stats">({stats.value.total_notification})</span>
              )}
            </a>
          </li>
        </ul>
      </nav>
    </aside>
  )
}

function App() {
  useEffect(() => {
    initUser().then(loadStats)
  }, [])

  useSignalEffect(() => {
    if (currentRole.value) {
      loadStats()
    }
  })

  return (
    <div className="app-container">
      <Sidebar />
      <main className="main-content">
        <Router history={createHashHistory()}>
          <ApplicationList path="/" />
          <ApplicationList path="/corrections" />
          <ApplicationList path="/notifications" />
          <ApplicationDetail path="/application/:id" />
        </Router>
      </main>
    </div>
  )
}

export default App
