import { useState, useEffect, useMemo, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useReactTable, flexRender } from '@tanstack/react-table'
import { useAuth } from '../contexts/AuthContext'
import { getListings } from '../api/listings'
import { exportListings } from '../api/export'
import { getExpiryWarnings } from '../api/audit'
import { getErrorMessage } from '../api/client'
import StatusBadge from '../components/StatusBadge'
import ExpiryIndicator from '../components/ExpiryIndicator'
import CreateListingModal from '../components/CreateListingModal'
import BatchProcessModal from '../components/BatchProcessModal'
import ExpiryWarningPanel from '../components/ExpiryWarningPanel'

const PAGE_SIZE = 20

export default function ListingListPage() {
  const { currentUser } = useAuth()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  const [data, setData] = useState({ count: 0, results: [] })
  const [warnings, setWarnings] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [showBatch, setShowBatch] = useState(false)
  const [rowSelection, setRowSelection] = useState({})

  const pageLabel = searchParams.get('page_label') || ''
  const expiryStatus = searchParams.get('expiry_status') || ''
  const storeName = searchParams.get('store_name') || ''
  const search = searchParams.get('search') || ''
  const page = Number(searchParams.get('page') || '1')
  const tab = searchParams.get('tab') || 'list'

  const setParam = useCallback((key, value) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      if (value) next.set(key, value)
      else next.delete(key)
      if (key !== 'page') next.delete('page')
      return next
    })
  }, [setSearchParams])

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const params = { page, page_size: PAGE_SIZE }
      if (pageLabel) params.page_label = pageLabel
      if (expiryStatus) params.expiry_status = expiryStatus
      if (storeName) params.store_name = storeName
      if (search) params.search = search
      const res = await getListings(params)
      setData(res.data)
    } catch (e) {
      setError(getErrorMessage(e))
    } finally {
      setLoading(false)
    }
  }, [page, pageLabel, expiryStatus, storeName, search])

  const fetchWarnings = useCallback(async () => {
    try {
      const res = await getExpiryWarnings()
      setWarnings(res.data)
    } catch {
      // ignore
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  useEffect(() => {
    if (tab === 'warnings') fetchWarnings()
  }, [tab, fetchWarnings])

  const stats = useMemo(() => {
    if (data.stats) {
      return {
        pending_supplement: data.stats.pending_supplement || 0,
        under_review: data.stats.under_review || 0,
        completed: data.stats.completed || 0,
      }
    }
    const results = data.results
    const labels = results.map((r) => r.page_label)
    return {
      pending_supplement: labels.filter((l) => l === '待补正').length,
      under_review: labels.filter((l) => l === '复核中').length,
      completed: labels.filter((l) => l === '办结').length,
    }
  }, [data])

  const handleExport = async () => {
    try {
      const params = {}
      if (pageLabel) params.page_label = pageLabel
      if (expiryStatus) params.expiry_status = expiryStatus
      if (storeName) params.store_name = storeName
      if (search) params.search = search
      const res = await exportListings(params)
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'text/csv;charset=utf-8-sig' }))
      const a = document.createElement('a')
      a.href = url
      a.download = `车源上架单导出_${new Date().toISOString().slice(0, 10)}.csv`
      a.click()
      window.URL.revokeObjectURL(url)
    } catch (e) {
      setError(getErrorMessage(e))
    }
  }

  const selectedItems = useMemo(() => {
    return data.results.filter((r) => rowSelection[r.id])
  }, [data.results, rowSelection])

  const columns = useMemo(() => [
    {
      id: 'select',
      header: ({ table }) => (
        <input
          type="checkbox"
          checked={table.getIsAllPageRowsSelected()}
          onChange={table.getToggleAllPageRowsSelectedHandler()}
        />
      ),
      cell: ({ row }) => (
        <input
          type="checkbox"
          checked={row.getIsSelected()}
          onChange={row.getToggleSelectedHandler()}
          onClick={(e) => e.stopPropagation()}
        />
      ),
      size: 40,
    },
    { accessorKey: 'application_no', header: '上架单号' },
    {
      id: 'brand_model',
      header: '品牌/型号',
      cell: ({ row }) => `${row.original.brand} ${row.original.model_name}`,
    },
    { accessorKey: 'license_plate', header: '车牌号' },
    {
      accessorKey: 'page_label',
      header: '页面标签',
      cell: ({ getValue }) => <StatusBadge label={getValue()} />,
    },
    {
      accessorKey: 'expiry_status',
      header: '超期状态',
      cell: ({ getValue }) => <ExpiryIndicator status={getValue()} />,
    },
    { accessorKey: 'responsible_person_display', header: '责任人' },
    {
      id: 'applicant_display',
      header: '提交人',
      cell: ({ row }) => row.original.applicant_display || '-',
    },
    {
      accessorKey: 'deadline',
      header: '截止时间',
      cell: ({ getValue }) => {
        const v = getValue()
        return v ? v.replace('T', ' ').slice(0, 16) : '-'
      },
    },
    {
      id: 'actions',
      header: '操作',
      cell: ({ row }) => (
        <button className="btn-outline btn-sm" onClick={(e) => { e.stopPropagation(); navigate(`/listings/${row.original.id}`) }}>
          查看
        </button>
      ),
    },
    {
      id: 'evidence_warn',
      header: '',
      cell: ({ row }) => {
        if (!row.original.has_listing_evidence && row.original.missing_evidence_reason) {
          return (
            <span className="tooltip-wrapper">
              <span className="warning-icon">⚠</span>
              <span className="tooltip-content">缺挂牌确认证据：{row.original.missing_evidence_reason}</span>
            </span>
          )
        }
        return null
      },
    },
  ], [navigate])

  const table = useReactTable({
    data: data.results,
    columns,
    state: { rowSelection },
    onRowSelectionChange: setRowSelection,
    getRowId: (row) => String(row.id),
    enableRowSelection: true,
    manualPagination: true,
    pageCount: Math.ceil(data.count / PAGE_SIZE),
  })

  const totalPages = Math.ceil(data.count / PAGE_SIZE)

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">车源上架单</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          {currentUser?.role === 'CONSULTANT' && (
            <button className="btn-primary" onClick={() => setShowCreate(true)}>创建上架单</button>
          )}
          <button className="btn-outline" onClick={() => setShowBatch(true)} disabled={selectedItems.length === 0}>
            批量处理{selectedItems.length > 0 ? `(${selectedItems.length})` : ''}
          </button>
          <button className="btn-outline" onClick={handleExport}>导出</button>
        </div>
      </div>

      {error && <div className="error-message">{error}</div>}

      <div className="filter-bar">
        <select value={pageLabel} onChange={(e) => setParam('page_label', e.target.value)}>
          <option value="">全部标签</option>
          <option value="待补正">待补正</option>
          <option value="复核中">复核中</option>
          <option value="办结">办结</option>
        </select>
        <select value={expiryStatus} onChange={(e) => setParam('expiry_status', e.target.value)}>
          <option value="">全部超期</option>
          <option value="normal">正常</option>
          <option value="near_expiry">临期</option>
          <option value="overdue">逾期</option>
        </select>
        <input
          placeholder="门店"
          value={storeName}
          onChange={(e) => setParam('store_name', e.target.value)}
        />
        <input
          className="search-input"
          placeholder="搜索上架单号/车架号/车牌号"
          value={search}
          onChange={(e) => setParam('search', e.target.value)}
        />
      </div>

      <div className="tab-bar">
        <button className={`tab ${tab === 'list' ? 'active' : ''}`} onClick={() => setParam('tab', 'list')}>
          列表
        </button>
        <button className={`tab ${tab === 'warnings' ? 'active' : ''}`} onClick={() => setParam('tab', 'warnings')}>
          到期预警
        </button>
      </div>

      {tab === 'list' && (
        <>
          <div className="stats-bar">
            <div
              className={`stat-item ${pageLabel === '待补正' ? 'active' : ''}`}
              onClick={() => setParam('page_label', pageLabel === '待补正' ? '' : '待补正')}
            >
              <div className="stat-label">待补正</div>
              <div className="stat-value stat-value-orange">{stats.pending_supplement}</div>
            </div>
            <div
              className={`stat-item ${pageLabel === '复核中' ? 'active' : ''}`}
              onClick={() => setParam('page_label', pageLabel === '复核中' ? '' : '复核中')}
            >
              <div className="stat-label">复核中</div>
              <div className="stat-value stat-value-blue">{stats.under_review}</div>
            </div>
            <div
              className={`stat-item ${pageLabel === '办结' ? 'active' : ''}`}
              onClick={() => setParam('page_label', pageLabel === '办结' ? '' : '办结')}
            >
              <div className="stat-label">办结</div>
              <div className="stat-value stat-value-green">{stats.completed}</div>
            </div>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#6b7280' }}>加载中...</div>
          ) : (
            <>
              <div className="table-wrapper">
                <table>
                  <thead>
                    {table.getHeaderGroups().map((headerGroup) => (
                      <tr key={headerGroup.id}>
                        {headerGroup.headers.map((header) => (
                          <th key={header.id} style={{ width: header.getSize() !== 150 ? header.getSize() : undefined }}>
                            {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                          </th>
                        ))}
                      </tr>
                    ))}
                  </thead>
                  <tbody>
                    {table.getRowModel().rows.length === 0 ? (
                      <tr><td colSpan={columns.length} style={{ textAlign: 'center', color: '#9ca3af', padding: 40 }}>暂无数据</td></tr>
                    ) : (
                      table.getRowModel().rows.map((row) => (
                        <tr
                          key={row.id}
                          className="row-clickable"
                          onClick={() => navigate(`/listings/${row.original.id}`)}
                        >
                          {row.getVisibleCells().map((cell) => (
                            <td key={cell.id} className={cell.column.id === 'select' ? 'checkbox-cell' : ''}>
                              {flexRender(cell.column.columnDef.cell, cell.getContext())}
                            </td>
                          ))}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div className="pagination">
                <span>共 {data.count} 条，第 {page}/{totalPages || 1} 页</span>
                <div className="pagination-buttons">
                  <button className="btn-outline btn-sm" disabled={page <= 1} onClick={() => setParam('page', String(page - 1))}>上一页</button>
                  <button className="btn-outline btn-sm" disabled={page >= totalPages} onClick={() => setParam('page', String(page + 1))}>下一页</button>
                </div>
              </div>
            </>
          )}
        </>
      )}

      {tab === 'warnings' && (
        <ExpiryWarningPanel warnings={warnings} />
      )}

      {showCreate && (
        <CreateListingModal onClose={() => setShowCreate(false)} onCreated={fetchData} />
      )}

      {showBatch && (
        <BatchProcessModal
          items={selectedItems}
          onClose={() => setShowBatch(false)}
          onSuccess={() => { setRowSelection({}); fetchData() }}
          currentRole={currentUser?.role}
        />
      )}
    </div>
  )
}
