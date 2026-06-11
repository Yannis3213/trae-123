import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Save } from 'lucide-react';
import { useAppStore } from '@/store';
import * as api from '@/api';

export default function NewOrder() {
  const navigate = useNavigate();
  const { createOrder, currentUser } = useAppStore();
  const [form, setForm] = useState({
    venueName: '',
    courtName: '',
    reservationDate: '',
    timeSlot: '',
    applicantName: '',
    applicantPhone: '',
    deadline: '',
  });
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.venueName || !form.courtName || !form.reservationDate || !form.timeSlot || !form.applicantName || !form.applicantPhone || !form.deadline) {
      setError('请填写所有必填字段');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const order = await createOrder(form);
      if (order) {
        if (file) {
          await api.uploadAttachment(order.id, file);
        }
        navigate('/orders');
      } else {
        setError('创建失败，请重试');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '创建失败');
    } finally {
      setSubmitting(false);
    }
  };

  if (currentUser?.role !== 'registrar') {
    return (
      <div className="text-center py-12">
        <p className="text-gray-400">仅场地登记员可创建订单</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h2 className="text-xl font-bold text-gray-900 mb-6">新增订单</h2>
      {error && <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm">{error}</div>}
      <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">场馆名称 <span className="text-red-500">*</span></label>
            <input type="text" value={form.venueName} onChange={(e) => handleChange('venueName', e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary" placeholder="请输入场馆名称" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">场地名称 <span className="text-red-500">*</span></label>
            <input type="text" value={form.courtName} onChange={(e) => handleChange('courtName', e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary" placeholder="请输入场地名称" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">预约日期 <span className="text-red-500">*</span></label>
            <input type="date" value={form.reservationDate} onChange={(e) => handleChange('reservationDate', e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">时段 <span className="text-red-500">*</span></label>
            <input type="text" value={form.timeSlot} onChange={(e) => handleChange('timeSlot', e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary" placeholder="如 09:00-11:00" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">申请人姓名 <span className="text-red-500">*</span></label>
            <input type="text" value={form.applicantName} onChange={(e) => handleChange('applicantName', e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary" placeholder="请输入申请人姓名" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">申请人电话 <span className="text-red-500">*</span></label>
            <input type="text" value={form.applicantPhone} onChange={(e) => handleChange('applicantPhone', e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary" placeholder="请输入联系电话" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">截止日期 <span className="text-red-500">*</span></label>
            <input type="date" value={form.deadline} onChange={(e) => handleChange('deadline', e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">附件</label>
            <input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm file:mr-3 file:py-1 file:px-3 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-primary/10 file:text-primary hover:file:bg-primary/20" />
          </div>
        </div>
        <div className="flex gap-3 pt-2">
          <button type="button" onClick={() => navigate('/orders')} className="px-6 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">取消</button>
          <button type="submit" disabled={submitting} className="px-6 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-light disabled:opacity-50 flex items-center gap-2">
            <Save size={14} />
            {submitting ? '提交中...' : '提交订单'}
          </button>
        </div>
      </form>
    </div>
  );
}
