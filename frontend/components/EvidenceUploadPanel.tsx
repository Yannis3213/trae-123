'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { evidenceTypeLabels, EvidenceType } from '@/lib/types';

interface Props {
  orderId: string;
  onUploaded: () => void;
}

export default function EvidenceUploadPanel({ orderId, onUploaded }: Props) {
  const { user } = useAuth();
  const [evidenceType, setEvidenceType] = useState<EvidenceType>('inspection');
  const [fileName, setFileName] = useState('');
  const [remark, setRemark] = useState('');
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const canUpload = user && (user.role === 'shop_clerk' || user.role === 'pharmacist');

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fileName.trim()) return;

    setLoading(true);
    try {
      await api.uploadAttachment(orderId, {
        evidence_type: evidenceType,
        file_name: fileName,
        remark: remark || undefined,
      });
      setFileName('');
      setRemark('');
      setShowForm(false);
      onUploaded();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!canUpload) {
    return null;
  }

  return (
    <div className="pt-4 border-t border-gray-100">
      {!showForm ? (
        <button
          onClick={() => setShowForm(true)}
          className="text-sm text-blue-600 hover:text-blue-800"
        >
          + 上传证据材料
        </button>
      ) : (
        <form onSubmit={handleUpload} className="space-y-3 p-3 bg-blue-50 rounded-lg">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">上传证据</span>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="text-gray-500 hover:text-gray-700 text-sm"
            >
              ✕
            </button>
          </div>

          <div>
            <label className="block text-xs text-gray-600 mb-1">证据类型</label>
            <select
              value={evidenceType}
              onChange={(e) => setEvidenceType(e.target.value as EvidenceType)}
              className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
            >
              <option value="inspection">{evidenceTypeLabels.inspection}</option>
              <option value="transfer">{evidenceTypeLabels.transfer}</option>
              <option value="removal">{evidenceTypeLabels.removal}</option>
            </select>
          </div>

          <div>
            <label className="block text-xs text-gray-600 mb-1">文件名</label>
            <input
              type="text"
              value={fileName}
              onChange={(e) => setFileName(e.target.value)}
              placeholder="如：巡检记录_药品名.pdf"
              className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
            />
          </div>

          <div>
            <label className="block text-xs text-gray-600 mb-1">备注</label>
            <input
              type="text"
              value={remark}
              onChange={(e) => setRemark(e.target.value)}
              placeholder="可选"
              className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
            />
          </div>

          <button
            type="submit"
            disabled={loading || !fileName.trim()}
            className="w-full px-3 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? '上传中...' : '确认上传'}
          </button>
        </form>
      )}
    </div>
  );
}
