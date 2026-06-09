import { Router, Routes, Route, Navigate } from '@solidjs/router';
import { AuthProvider } from '@/context/AuthContext';
import ProtectedRoute from '@/components/ProtectedRoute';
import MainLayout from '@/layouts/MainLayout';
import Login from '@/pages/Login';
import PlanList from '@/pages/PlanList';
import PlanDetail from '@/pages/PlanDetail';
import DueWarning from '@/pages/DueWarning';
import Statistics from '@/pages/Statistics';

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/plans"
            element={
              <ProtectedRoute>
                <MainLayout>
                  <PlanList />
                </MainLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/plans/:id"
            element={
              <ProtectedRoute>
                <MainLayout>
                  <PlanDetail />
                </MainLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/warning"
            element={
              <ProtectedRoute>
                <MainLayout>
                  <DueWarning />
                </MainLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/stats"
            element={
              <ProtectedRoute>
                <MainLayout>
                  <Statistics />
                </MainLayout>
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate href="/plans" />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}
