import { useState, useEffect, useCallback } from 'react';
import { Plus, Loader2 } from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import { getPlans, getExpiryStats, getEvidenceSummary } from '../lib/api';
import RoleSwitcher from './RoleSwitcher';
import ExpiryPanel from './ExpiryPanel';
import EvidenceSummary from './EvidenceSummary';
import PlanQueue from './PlanQueue';
import BatchProcessor from './BatchProcessor';
import CreatePlanModal from './CreatePlanModal';

interface Plan {
  id: string;
  planNumber: string;
  routeName: string;
  planDate: string;
  vehicleId: string;
  driverId: string;
  status: string;
  expiryStatus: 'normal' | 'approaching' | 'overdue';
  currentRole: string;
  currentHandler: string;
  version: number;
  dueDate: string;
  notes: string;
  [key: string]: any;
}

export default function QueueApp() {
  const { currentUser, isLoggedIn, switchRole } = useAuthStore();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [expiryStats, setExpiryStats] = useState({ normal: 0, approaching: 0, overdue: 0 });
  const [evidenceSummary, setEvidenceSummary] = useState({ vehicleSchedule: 0, driverCheckin: 0, dispatchConfirm: 0 });
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expiryFilter, setExpiryFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params: Record<string, string> = {};
      if (currentUser?.role) params.role = currentUser.role;
      if (statusFilter) params.status = statusFilter;
      if (expiryFilter) params.expiry = expiryFilter;

      const [plansRes, statsRes, evidenceRes] = await Promise.all([
        getPlans(Object.keys(params).length > 0 ? params : undefined),
        getExpiryStats(),
        getEvidenceSummary(),
      ]);
      setPlans(plansRes.plans || []);
      setExpiryStats(statsRes || { normal: 0, approaching: 0, overdue: 0 });
      setEvidenceSummary(evidenceRes || { vehicleSchedule: 0, driverCheckin: 0, dispatchConfirm: 0 });
    } catch (err: any) {
      setError(err.message || '加载数据失败');
      setPlans([]);
    } finally {
      setLoading(false);
    }
  }, [currentUser?.role, statusFilter, expiryFilter]);

  useEffect(() => {
    if (!isLoggedIn) {
      switchRole('dispatcher').then(() => loadData()).catch(() => loadData());
    } else {
      loadData();
    }
  }, [isLoggedIn, currentUser?.role]);

  function handlePlanClick(id: string) {
    window.location.href = `/plan/${id}`;
  }

  function handleBatchSelect(ids: string[]) {
    setSelectedIds(ids);
  }

  function handleBatchComplete() {
    setSelectedIds([]);
    loadData();
  }

  function handleFilterByExpiry(status: string) {
    setExpiryFilter(expiryFilter === status ? '' : status);
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <div className="px-6 py-4 flex items-center justify-between border-b border-slate-200 bg-white">
        <h1 className="text-xl font-bold text-slate-800">发车计划队列</h1>
        <div className="flex items-center gap-3">
          {currentUser?.role === 'dispatcher' && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-brand-accent text-white text-sm font-medium rounded-lg hover:bg-orange-600 transition-colors"
            >
              <Plus className="w-4 h-4" />
              新建计划
            </button>
          )}
          <RoleSwitcher />
        </div>
      </div>

      {error && (
        <div className="mx-6 mt-4 px-4 py-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-brand-accent" />
          <span className="ml-3 text-slate-500">加载中...</span>
        </div>
      ) : (
        <div className="p-6 flex gap-6">
          <div className="flex-1 min-w-0">
            <PlanQueue
              plans={plans}
              onPlanClick={handlePlanClick}
              onBatchSelect={handleBatchSelect}
              currentRole={currentUser?.role || ''}
              statusFilter={statusFilter}
              onStatusFilterChange={setStatusFilter}
            />
            <BatchProcessor
              selectedIds={selectedIds}
              currentRole={currentUser?.role || ''}
              onBatchComplete={handleBatchComplete}
              plans={plans}
            />
          </div>
          <div className="w-72 shrink-0 space-y-6">
            <ExpiryPanel stats={expiryStats} onFilterByExpiry={handleFilterByExpiry} activeFilter={expiryFilter} />
            <EvidenceSummary summary={evidenceSummary} />
          </div>
        </div>
      )}

      <CreatePlanModal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={() => {
          setShowCreateModal(false);
          loadData();
        }}
      />
    </div>
  );
}
