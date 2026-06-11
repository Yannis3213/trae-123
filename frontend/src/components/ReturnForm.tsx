'use client';

import { useState } from 'react';
import { RotateCcw } from 'lucide-react';

interface Props {
  onSubmit: (returnReason: string, returnOpinion: string) => void;
  loading?: boolean;
}

export default function ReturnForm({ onSubmit, loading }: Props) {
  const [returnReason, setReturnReason] = useState('');
  const [returnOpinion, setReturnOpinion] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!returnReason.trim() || !returnOpinion.trim()) return;
    onSubmit(returnReason, returnOpinion);
  };

  return (
    <form onSubmit={handleSubmit} className="border border-red-200 rounded-lg p-4 bg-red-50">
      <div className="flex items-center gap-2 mb-3">
        <RotateCcw className="w-5 h-5 text-red-500" />
        <h4 className="font-medium text-red-700">退回工单</h4>
      </div>
      <div className="space-y-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">退回原因 <span className="text-red-500">*</span></label>
          <input
            value={returnReason}
            onChange={(e) => setReturnReason(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-primary focus:border-primary"
            placeholder="请输入退回原因"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">退回意见 <span className="text-red-500">*</span></label>
          <textarea
            value={returnOpinion}
            onChange={(e) => setReturnOpinion(e.target.value)}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-primary focus:border-primary"
            placeholder="请输入退回意见"
            required
          />
        </div>
        <button
          type="submit"
          disabled={loading || !returnReason.trim() || !returnOpinion.trim()}
          className="px-4 py-2 bg-red-500 text-white rounded-md text-sm hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          确认退回
        </button>
      </div>
    </form>
  );
}
