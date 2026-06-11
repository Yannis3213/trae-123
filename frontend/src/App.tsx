import { createSignal, createEffect, Show } from 'solid-js'
import { isLoggedIn, loadUser, loadStatistics, logout } from './store'
import LoginPage from './components/LoginPage'
import Header from './components/Header'
import OrderList from './components/OrderList'
import OrderDetail from './components/OrderDetail'
import BatchProcess from './components/BatchProcess'
import type { RepairOrder } from './types'

function App() {
  const [route, setRoute] = createSignal(window.location.hash || '#/')
  const [routeOrderId, setRouteOrderId] = createSignal<number | null>(null)
  const [selectedOrders, setSelectedOrders] = createSignal<RepairOrder[]>([])

  createEffect(() => {
    if (isLoggedIn()) {
      loadUser()
      loadStatistics()
    }
  })

  createEffect(() => {
    const handler = () => {
      const hash = window.location.hash || '#/'
      setRoute(hash)
      const match = hash.match(/^#\/order\/(\d+)$/)
      if (match) {
        setRouteOrderId(Number(match[1]))
      } else {
        setRouteOrderId(null)
      }
    }
    window.addEventListener('hashchange', handler)
    return () => window.removeEventListener('hashchange', handler)
  })

  const handleLogout = async () => {
    await logout()
    window.location.hash = '#/'
  }

  return (
    <Show
      when={isLoggedIn()}
      fallback={<LoginPage />}
    >
      <Header onLogout={handleLogout} />
      <div class="main-content">
        <Show when={route() === '#/'}>
          <OrderList
            onBatchNavigate={(orders) => {
              setSelectedOrders(orders)
              window.location.hash = '#/batch'
            }}
          />
        </Show>
        <Show when={route().startsWith('#/order/')}>
          <OrderDetail orderId={routeOrderId()!} />
        </Show>
        <Show when={route() === '#/batch'}>
          <BatchProcess selectedOrders={selectedOrders()} />
        </Show>
      </div>
    </Show>
  )
}

export default App
