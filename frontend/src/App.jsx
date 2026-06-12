import { useState } from 'preact/hooks'
import Header from './components/Header'
import StatsBar from './components/StatsBar'
import HazardList from './pages/HazardList'
import HazardDetail from './pages/HazardDetail'
import CreateModal from './pages/CreateModal'
import BatchProcessModal from './pages/BatchProcessModal'
import { useStore } from './store'

export default function App() {
  const store = useStore()
  const [detailId, setDetailId] = useState(null)
  const [showCreate, setShowCreate] = useState(false)
  const [batchConfig, setBatchConfig] = useState(null)

  return (
    <div className="app-container">
      <Header store={store} />
      <StatsBar store={store} />
      <div className="main-content">
        <HazardList
          store={store}
          onViewDetail={setDetailId}
          onCreate={() => setShowCreate(true)}
          onBatchProcess={setBatchConfig}
        />
      </div>

      {detailId && (
        <HazardDetail
          id={detailId}
          store={store}
          onClose={() => setDetailId(null)}
        />
      )}

      {showCreate && (
        <CreateModal
          store={store}
          onClose={() => setShowCreate(false)}
        />
      )}

      {batchConfig && (
        <BatchProcessModal
          config={batchConfig}
          store={store}
          onClose={() => setBatchConfig(null)}
          onOpenDetail={(id) => { setBatchConfig(null); setDetailId(id) }}
        />
      )}

      {store.toast && (
        <div className={`toast ${store.toast.type}`}>
          {store.toast.message}
        </div>
      )}
    </div>
  )
}
