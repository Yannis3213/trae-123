import { useState, useRef } from 'react';
import { X, Upload, Loader2 } from 'lucide-react';
import { createPlan } from '../lib/api';

interface CreatePlanModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function CreatePlanModal({ open, onClose, onSuccess }: CreatePlanModalProps) {
  const [routeName, setRouteName] = useState('');
  const [planDate, setPlanDate] = useState('');
  const [vehicleId, setVehicleId] = useState('');
  const [driverId, setDriverId] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const planNumber = `DP-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 9999)).padStart(3, '0')}`;
      await createPlan({ planNumber, routeName, planDate, vehicleId, driverId, dueDate, notes: notes || undefined });
      resetForm();
      onSuccess();
    } catch (err: any) {
      setError(err.message || '创建失败');
    } finally {
      setLoading(false);
    }
  }

  function resetForm() {
    setRouteName('');
    setPlanDate('');
    setVehicleId('');
    setDriverId('');
    setDueDate('');
    setNotes('');
    setError('');
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h3 className="text-lg font-semibold text-slate-800">新建发车计划</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
          {error && (
            <div className="px-3 py-2 bg-red-50 text-red-700 text-sm rounded-lg">{error}</div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">线路名称 <span className="text-red-500">*</span></label>
            <input type="text" required value={routeName} onChange={(e) => setRouteName(e.target.value)} placeholder="例: 1路" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-accent/30" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">发车日期 <span className="text-red-500">*</span></label>
              <input type="date" required value={planDate} onChange={(e) => setPlanDate(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-accent/30" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">截止日期 <span className="text-red-500">*</span></label>
              <input type="date" required value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-accent/30" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">车辆编号</label>
              <input type="text" value={vehicleId} onChange={(e) => setVehicleId(e.target.value)} placeholder="例: 京A-33001" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-accent/30" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">司机</label>
              <input type="text" value={driverId} onChange={(e) => setDriverId(e.target.value)} placeholder="例: 张师傅" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-accent/30" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">备注</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="可选填写备注信息" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-accent/30 resize-none" />
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 transition-colors">取消</button>
            <button type="submit" disabled={loading} className="flex-1 px-4 py-2 bg-brand-accent text-white rounded-lg hover:bg-orange-600 disabled:opacity-50 transition-colors inline-flex items-center justify-center gap-2">
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              提交
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
