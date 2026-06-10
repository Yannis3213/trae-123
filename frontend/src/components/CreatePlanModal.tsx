import { useState } from 'react';
import { X, Loader2, Paperclip, Plus, Upload } from 'lucide-react';
import { createPlan, uploadAttachment } from '../lib/api';

interface CreatePlanModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

type FileType = 'vehicle_schedule' | 'driver_checkin' | 'dispatch_confirm';

const ATTACHMENT_CONFIG: Record<FileType, { label: string; placeholder: string }> = {
  vehicle_schedule: { label: '车辆排班表', placeholder: '例: 1路车辆排班表.pdf' },
  driver_checkin: { label: '司机签收单', placeholder: '例: 司机签收单-1路.pdf' },
  dispatch_confirm: { label: '发车确认单', placeholder: '例: 发车确认单-20240101.pdf' },
};

export default function CreatePlanModal({ open, onClose, onSuccess }: CreatePlanModalProps) {
  const [routeName, setRouteName] = useState('');
  const [planDate, setPlanDate] = useState('');
  const [vehicleId, setVehicleId] = useState('');
  const [driverId, setDriverId] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [vehicleScheduleFiles, setVehicleScheduleFiles] = useState<string[]>([]);
  const [driverCheckinFiles, setDriverCheckinFiles] = useState<string[]>([]);
  const [dispatchConfirmFiles, setDispatchConfirmFiles] = useState<string[]>([]);

  const [newVehicleSchedule, setNewVehicleSchedule] = useState('');
  const [newDriverCheckin, setNewDriverCheckin] = useState('');
  const [newDispatchConfirm, setNewDispatchConfirm] = useState('');

  if (!open) return null;

  function addFile(type: FileType) {
    if (type === 'vehicle_schedule' && newVehicleSchedule.trim()) {
      setVehicleScheduleFiles([...vehicleScheduleFiles, newVehicleSchedule.trim()]);
      setNewVehicleSchedule('');
    } else if (type === 'driver_checkin' && newDriverCheckin.trim()) {
      setDriverCheckinFiles([...driverCheckinFiles, newDriverCheckin.trim()]);
      setNewDriverCheckin('');
    } else if (type === 'dispatch_confirm' && newDispatchConfirm.trim()) {
      setDispatchConfirmFiles([...dispatchConfirmFiles, newDispatchConfirm.trim()]);
      setNewDispatchConfirm('');
    }
  }

  function removeFile(type: FileType, index: number) {
    if (type === 'vehicle_schedule') {
      setVehicleScheduleFiles(vehicleScheduleFiles.filter((_, i) => i !== index));
    } else if (type === 'driver_checkin') {
      setDriverCheckinFiles(driverCheckinFiles.filter((_, i) => i !== index));
    } else if (type === 'dispatch_confirm') {
      setDispatchConfirmFiles(dispatchConfirmFiles.filter((_, i) => i !== index));
    }
  }

  function getFilesByType(type: FileType): string[] {
    switch (type) {
      case 'vehicle_schedule': return vehicleScheduleFiles;
      case 'driver_checkin': return driverCheckinFiles;
      case 'dispatch_confirm': return dispatchConfirmFiles;
    }
  }

  function getNewFileName(type: FileType): string {
    switch (type) {
      case 'vehicle_schedule': return newVehicleSchedule;
      case 'driver_checkin': return newDriverCheckin;
      case 'dispatch_confirm': return newDispatchConfirm;
    }
  }

  function setNewFileName(type: FileType, value: string) {
    if (type === 'vehicle_schedule') setNewVehicleSchedule(value);
    else if (type === 'driver_checkin') setNewDriverCheckin(value);
    else if (type === 'dispatch_confirm') setNewDispatchConfirm(value);
  }

  function renderAttachmentSection(type: FileType) {
    const config = ATTACHMENT_CONFIG[type];
    const files = getFilesByType(type);
    const newFileName = getNewFileName(type);

    return (
      <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50">
        <div className="flex items-center gap-2 mb-3">
          <Paperclip className="w-4 h-4 text-brand-accent" />
          <span className="text-sm font-medium text-slate-700">{config.label}</span>
        </div>
        {files.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-3">
            {files.map((fileName, idx) => (
              <span
                key={idx}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white border border-slate-200 text-slate-700 rounded-lg text-xs"
              >
                <Paperclip className="w-3 h-3 text-slate-400" />
                {fileName}
                <button
                  type="button"
                  onClick={() => removeFile(type, idx)}
                  className="ml-1 text-slate-400 hover:text-red-500 transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          <input
            type="text"
            value={newFileName}
            onChange={(e) => setNewFileName(type, e.target.value)}
            placeholder={config.placeholder}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addFile(type))}
            className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-accent/30 bg-white"
          />
          <button
            type="button"
            onClick={() => addFile(type)}
            disabled={!newFileName.trim()}
            className="inline-flex items-center gap-1 px-3 py-2 bg-slate-100 text-slate-600 text-sm rounded-lg hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Plus className="w-4 h-4" />
            添加
          </button>
        </div>
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const planNumber = `DP-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 9999)).padStart(3, '0')}`;
      const plan = await createPlan({ planNumber, routeName, planDate, vehicleId, driverId, dueDate, notes: notes || undefined });

      const allAttachments: { fileType: FileType; fileName: string }[] = [];
      vehicleScheduleFiles.forEach(f => allAttachments.push({ fileType: 'vehicle_schedule', fileName: f }));
      driverCheckinFiles.forEach(f => allAttachments.push({ fileType: 'driver_checkin', fileName: f }));
      dispatchConfirmFiles.forEach(f => allAttachments.push({ fileType: 'dispatch_confirm', fileName: f }));

      for (const att of allAttachments) {
        await uploadAttachment(plan.id, att);
      }

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
    setVehicleScheduleFiles([]);
    setDriverCheckinFiles([]);
    setDispatchConfirmFiles([]);
    setNewVehicleSchedule('');
    setNewDriverCheckin('');
    setNewDispatchConfirm('');
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 sticky top-0 bg-white rounded-t-2xl">
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

          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Upload className="w-4 h-4 text-slate-500" />
              <span className="text-sm font-medium text-slate-700">证据上传</span>
              <span className="text-xs text-slate-400">（演示模式：输入文件名即可）</span>
            </div>
            {renderAttachmentSection('vehicle_schedule')}
            {renderAttachmentSection('driver_checkin')}
            {renderAttachmentSection('dispatch_confirm')}
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
