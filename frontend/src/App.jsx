import { createSignal, onMount, For } from 'solid-js'
import { useAuth } from './stores/authStore'
import OrderList from './pages/OrderList.jsx'
import OrderDetail from './pages/OrderDetail.jsx'
import OwnerReport from './pages/OwnerReport.jsx'
import Dispatch from './pages/Dispatch.jsx'
import Registration from './pages/Registration.jsx'

const App = () => {
  const auth = useAuth()
  const [currentPage, setCurrentPage] = createSignal('orders')
  const [currentOrderId, setCurrentOrderId] = createSignal(null)

  const handleOrderClick = (id) => {
    setCurrentOrderId(id)
    setCurrentPage('detail')
  }

  const goBack = () => {
    setCurrentOrderId(null)
    setCurrentPage('orders')
  }

  const navItems = [
    { key: 'owner-report', label: '业主报修', icon: '📞', page: 'owner-report', module: true },
    { key: 'dispatch', label: '维修派单', icon: '🔧', page: 'dispatch', module: true },
    { key: 'registration', label: '报修工单登记', icon: '📋', page: 'registration', module: true },
    { key: 'orders', label: '报修工单列表', icon: '📑', page: 'orders' },
  ]

  const renderPage = () => {
    switch (currentPage()) {
      case 'orders':
        return <OrderList onOrderClick={handleOrderClick} />
      case 'detail':
        return <OrderDetail orderId={currentOrderId()} onBack={goBack} />
      case 'owner-report':
        return <OwnerReport onCreated={() => setCurrentPage('orders')} />
      case 'dispatch':
        return <Dispatch onCreated={() => setCurrentPage('orders')} />
      case 'registration':
        return <Registration onCreated={() => setCurrentPage('orders')} />
      default:
        return <OrderList onOrderClick={handleOrderClick} />
    }
  }

  return (
    <div class="app-layout">
      <header class="app-header">
        <h1>🏢 物业服务中心 - 月底集中处理报修工单系统</h1>
        <div class="user-info">
          <span>{auth.getResponsibility()}</span>
          <span class="user-name">{auth.user().name}</span>
          <select
            value={auth.user().role}
            onChange={(e) => auth.switchRole(e.target.value)}
          >
            <For each={auth.users()}>
              {(u) => (
                <option value={u.role}>
                  切换到: {u.name} ({u.role === 'registrar' ? '报修登记员' : u.role === 'supervisor' ? '报修审核主管' : '复核负责人'})
                </option>
              )}
            </For>
          </select>
        </div>
      </header>

      <div class="app-main">
        <aside class="sidebar">
          <div class="sidebar-section">业务区</div>
          <nav class="sidebar-nav">
            <For each={navItems.filter(n => n.module)}>
              {(item) => (
                <a
                  class={currentPage() === item.page ? 'active' : ''}
                  onClick={() => setCurrentPage(item.page)}
                >
                  {item.icon} {item.label}
                </a>
              )}
            </For>
          </nav>
          <div class="sidebar-section">工单中心</div>
          <nav class="sidebar-nav">
            <For each={navItems.filter(n => !n.module)}>
              {(item) => (
                <a
                  class={currentPage() === item.page || currentPage() === 'detail' ? 'active' : ''}
                  onClick={() => { setCurrentOrderId(null); setCurrentPage(item.page) }}
                >
                  {item.icon} {item.label}
                </a>
              )}
            </For>
          </nav>
        </aside>

        <main class="content-area">
          {renderPage()}
        </main>
      </div>
    </div>
  )
}

export default App
