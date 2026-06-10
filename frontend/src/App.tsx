import { useState, useEffect, useCallback } from 'react'
import type { User } from './types'
import { Login } from './components/Login'
import { Header } from './components/Header'
import { EntryList } from './components/EntryList'
import { EntryDetail } from './components/EntryDetail'
import { StatsPanel } from './components/StatsPanel'

type Page = 'list' | 'detail' | 'stats'

export default function App() {
  const [user, setUser] = useState<User | null>(null)
  const [page, setPage] = useState<Page>('list')
  const [selectedEntryId, setSelectedEntryId] = useState<number | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    const saved = localStorage.getItem('auth_user')
    const token = localStorage.getItem('auth_token')
    if (saved && token) {
      try {
        setUser(JSON.parse(saved))
      } catch {
        localStorage.removeItem('auth_token')
        localStorage.removeItem('auth_user')
      }
    }
  }, [])

  const handleLogin = (u: User) => {
    setUser(u)
    setPage('list')
  }

  const handleLogout = () => {
    setUser(null)
    setPage('list')
    setSelectedEntryId(null)
  }

  const handleEntryClick = (id: number) => {
    setSelectedEntryId(id)
    setPage('detail')
  }

  const handleBack = () => {
    setSelectedEntryId(null)
    setPage('list')
    setRefreshKey((k: number) => k + 1)
  }

  const refresh = useCallback(() => {
    setRefreshKey((k: number) => k + 1)
  }, [])

  if (!user) {
    return <Login onLogin={handleLogin} />
  }

  return (
    <div className="app">
      <Header user={user} onLogout={handleLogout} onNavigate={setPage} currentPage={page} />
      <main className="main-content">
        {page === 'list' && (
          <EntryList
            key={refreshKey}
            user={user}
            onEntryClick={handleEntryClick}
            onRefresh={refresh}
          />
        )}
        {page === 'detail' && selectedEntryId && (
          <EntryDetail
            entryId={selectedEntryId}
            user={user}
            onBack={handleBack}
            onRefresh={refresh}
          />
        )}
        {page === 'stats' && (
          <StatsPanel key={refreshKey} user={user} />
        )}
      </main>
    </div>
  )
}
