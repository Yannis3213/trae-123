import { createSignal, createEffect, For, Show, on } from 'solid-js'
import { getOrders } from '../api'
import { loadStatistics } from '../store'
import type { RepairOrder } from '../types'

const statusTabs = [
  { key: '', label: '全部' },
  { key: '待接单', label: '待接单' },
  { key: '已接单', label: '已接单' },
  { key: '施工中', label: '施工中' },
  { key: '待验收', label: '待验收' },
  { key: '验收通过', label: '验收通过' },
  { key: '退回补正', label: '退回补正' },
  { key: '已归档', label: '已归档' }
]

const expiryFilters = [
  { key: '', label: '全部' },
  { key: 'normal', label: '正常' },
  { key: 'approaching', label: '临期' },
  { key: 'overdue', label: '逾期' }
]

const expiryLabels: Record<string, string> = {
  normal: '正常',
  approaching: '临期',
  overdue: '逾期'
}

const statusColorMap: Record<string, string> = {
  '待接单': 'badge-pending',
  '已接单': 'badge-accepted',
  '施工中': 'badge-in-progress',
  '待验收': 'badge-awaiting',
  '验收通过': 'badge-approved',
  '退回补正': 'badge-returned',
  '已归档': 'badge-archived'
}

function StatusBadge(props: { status: string }) {
  return <span class={`badge ${statusColorMap[props.status] || ''}`}>{props.status}</span>
}

function ExpiryBadge(props: { expiry: string }) {
  return <span class={`badge badge-expiry-${props.expiry}`}>{expiryLabels[props.expiry] || props.expiry}</span>
}

function PriorityBadge(props: { priority: string }) {
  if (props.priority === 'urgent') {
    return <span class="badge badge-urgent">紧急</span>
  }
  return <span>普通</span>
}

function calcExpiryStatus(deadline: string, status: string): string {
  if (!deadline) return 'normal'
  if (status === '验收通过' || status === '已归档') return 'normal'
  const d = new Date(deadline)
  const now = new Date()
  if (d < now) return 'overdue'
  if (d <= new Date(now.getTime() + 3 * 24 * 3600 * 1000)) return 'approaching'
  return 'normal'
}

interface OrderListProps {
  onBatchNavigate: (orders: RepairOrder[]) => void
}

function OrderList(props: OrderListProps) {
  const [orders, setOrders] = createSignal<RepairOrder[]>([])
  const [total, setTotal] = createSignal(0)
  const [page, setPage] = createSignal(1)
  const [pageSize] = createSignal(20)
  const [statusFilter, setStatusFilter] = createSignal('')
  const [expiryFilter, setExpiryFilter] = createSignal('')
  const [selected, setSelected] = createSignal<Set<number>>(new Set())
  const [loading, setLoading] = createSignal(false)

  const totalPages = () => Math.ceil(total() / pageSize())

  const fetchOrders = async () => {
    setLoading(true)
    try {
      const res = await getOrders({
        status: statusFilter() || undefined,
        expiry_group: expiryFilter() || undefined,
        page: page(),
        page_size: pageSize()
      })
      if (res.code === 0) {
        setOrders(res.data.list || [])
        setTotal(res.data.total)
        if (res.data.status_counts) {
          loadStatistics()
        }
      }
    } catch {
    } finally {
      setLoading(false)
    }
  }

  createEffect(() => {
    fetchOrders()
  })

  createEffect(on(() => {
    const handler = () => {
      if (document.visibilityState === 'visible') {
        fetchOrders()
      }
    }
    document.addEventListener('visibilitychange', handler)
    return handler
  }, () => {}))

  const toggleSelect = (id: number) => {
    const next = new Set(selected())
    if (next.has(id)) {
      next.delete(id)
    } else {
      next.add(id)
    }
    setSelected(next)
  }

  const toggleAll = () => {
    if (selected().size === orders().length) {
      setSelected(new Set<number>())
    } else {
      setSelected(new Set(orders().map(o => o.id)))
    }
  }

  const handleBatchNavigate = () => {
    const selectedList = orders().filter(o => selected().has(o.id))
    props.onBatchNavigate(selectedList)
  }

  const formatDate = (d: string) => {
    if (!d) return '-'
    return new Date(d).toLocaleString('zh-CN')
  }

  return (
    <div>
      <div class="tabs">
        <For each={statusTabs}>
          {(tab) => (
            <button
              class={`tab ${statusFilter() === tab.key ? 'active' : ''}`}
              onClick={() => { setStatusFilter(tab.key); setPage(1); fetchOrders() }}
            >
              {tab.label}
            </button>
          )}
        </For>
      </div>

      <div class="sub-filters">
        <For each={expiryFilters}>
          {(f) => (
            <button
              class={`sub-filter-btn ${expiryFilter() === f.key ? 'active' : ''}`}
              onClick={() => { setExpiryFilter(f.key); setPage(1); fetchOrders() }}
            >
              {f.label}
            </button>
          )}
        </For>
      </div>

      <Show when={selected().size > 0}>
        <div style={{ "margin-bottom": '12px', display: 'flex', "align-items": 'center', gap: '8px' }}>
          <span style={{ "font-size": '14px', color: 'var(--text-secondary)' }}>
            已选 {selected().size} 项
          </span>
          <button class="btn btn-sm btn-primary" onClick={handleBatchNavigate}>
            批量处理
          </button>
        </div>
      </Show>

      <div class="card">
        <Show when={!loading()} fallback={<div class="loading">加载中...</div>}>
          <div class="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th class="checkbox-cell">
                    <input
                      type="checkbox"
                      checked={orders().length > 0 && selected().size === orders().length}
                      onChange={toggleAll}
                    />
                  </th>
                  <th>工单号</th>
                  <th>标题</th>
                  <th>状态</th>
                  <th>优先级</th>
                  <th>截止日期</th>
                  <th>到期状态</th>
                  <th>异常类型</th>
                  <th>创建时间</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                <For each={orders()}>
                  {(order) => {
                    const expiry = calcExpiryStatus(order.deadline, order.status)
                    return (
                      <tr>
                        <td class="checkbox-cell">
                          <input
                            type="checkbox"
                            checked={selected().has(order.id)}
                            onChange={() => toggleSelect(order.id)}
                          />
                        </td>
                        <td>{order.order_no}</td>
                        <td>{order.title}</td>
                        <td><StatusBadge status={order.status} /></td>
                        <td><PriorityBadge priority={order.priority} /></td>
                        <td>{formatDate(order.deadline)}</td>
                        <td><ExpiryBadge expiry={expiry} /></td>
                        <td>{order.exception_type || '-'}</td>
                        <td>{formatDate(order.created_at)}</td>
                        <td>
                          <button
                            class="btn btn-sm btn-ghost"
                            onClick={() => { window.location.hash = `#/order/${order.id}` }}
                          >
                            查看
                          </button>
                        </td>
                      </tr>
                    )
                  }}
                </For>
              </tbody>
            </table>
          </div>
        </Show>

        <div class="pagination">
          <span>共 {total()} 条，第 {page()}/{totalPages() || 1} 页</span>
          <div class="pagination-buttons">
            <button
              class="btn btn-sm btn-ghost"
              disabled={page() <= 1}
              onClick={() => { setPage(page() - 1); fetchOrders() }}
            >
              上一页
            </button>
            <button
              class="btn btn-sm btn-ghost"
              disabled={page() >= totalPages()}
              onClick={() => { setPage(page() + 1); fetchOrders() }}
            >
              下一页
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default OrderList
