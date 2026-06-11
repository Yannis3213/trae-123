'use client';

import { useState } from 'react';
import { Send } from 'lucide-react';

interface Props {
  onSubmit: (correctionReason: string) => void;
  loading?: boolean;
}

export default function ResubmitForm({ onSubmit, loading }: Props) {
  const [correctionReason, setCorrectionReason] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!correctionReason.trim()) return;
    onSubmit(correctionReason);
  };

  return (
    <form onSubmit={handleSubmit} className="border border-blue-200 rounded-lg p-4 bg-blue-50">
      <div className="flex items-center gap-2 mb-3">
        <Send className="w-5 h-5 text-blue-500" />
        <h4 className="font-medium text-blue-700">重新提交</h4>
      </div>
      <div className="space-y-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">纠正原因 <span className="text-red-500">*</span></label>
          <textarea
            value={correctionReason}
            onChange={(e) => setCorrectionReason(e.target.value)}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-primary focus:border-primary"
            placeholder="请输入纠正原因"
            required
          />
        </div>
        <button
          type="submit"
          disabled={loading || !correctionReason.trim()}
          className="px-4 py-2 bg-blue-500 text-white rounded-md text-sm hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          确认重新提交
        </button>
      </div>
    </form>
  );
}
