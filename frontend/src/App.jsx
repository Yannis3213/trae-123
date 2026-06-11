import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import Layout from './components/Layout'
import LoginPage from './pages/LoginPage'
import ListingListPage from './pages/ListingListPage'
import ListingDetailPage from './pages/ListingDetailPage'

function ProtectedRoute({ children }) {
  const { currentUser, loading } = useAuth()
  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: '#6b7280' }}>加载中...</div>
  if (!currentUser) return <Navigate to="/login" replace />
  return children
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
          <Route index element={<Navigate to="/listings" replace />} />
          <Route path="listings" element={<ListingListPage />} />
          <Route path="listings/:id" element={<ListingDetailPage />} />
        </Route>
      </Routes>
    </AuthProvider>
  )
}
