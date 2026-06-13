'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { evidenceTypeLabels, EvidenceType, NearExpiryOrder } from '@/lib/types';

interface Props {
  order: NearExpiryOrder;
  onUploaded: () => void;
}

export default function EvidenceUploadPanel({ order, onUploaded }: Props) {
  const { user } = useAuth();
  const [evidenceType, setEvidenceType] = useState<EvidenceType>('inspection');
  const [fileName, setFileName] = useState('');
  const [remark, setRemark] = useState('');
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);

  if (!user) return null;

  const isClosed = order.status === 'closed';
  const isSameStore = user.store === order.store_name;
  const isHandler = user.id === order.current_handler;
  const isCreator = user.id === order.created_by;
  const isHandlerOrCreator = isHandler || isCreator;

  let canUploadAny = false;
  let allowedTypes: EvidenceType[] = [];
  let denyReason = '';

  if (isClosed) {
    denyReason = '处理单已关闭，无法上传';
  } else if (user.role === 'area_manager') {
    denyReason = '区域经理无上传权限';
  } else if (!isSameStore) {
    denyReason = '非同门店，无法上传';
  } else if (!isHandlerOrCreator) {
    denyReason = '非创建人或当前处理人，无法上传（虽同门店但非责任人）';
  } else if (user.role === 'shop_clerk') {
    allowedTypes = ['inspection'];
    canUploadAny = true;
  } else if (user.role === 'pharmacist') {
    allowedTypes = ['transfer', 'removal'];
    canUploadAny = true;
  }

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fileName.trim()) return;

    setLoading(true);
    try {
      await api.uploadAttachment(order.id, {
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

  if (!canUploadAny) {
    return (
      <div className="pt-4 border-t border-gray-100">
        <p className="text-xs text-gray-400">{denyReason || '当前状态下无上传权限'}</p>
      </div>
    );
  }

  return (
    <div className="pt-4 border-t border-gray-100">
      {!showForm ? (
        <button
          onClick={() => {
            setEvidenceType(allowedTypes[0]);
            setShowForm(true);
          }}
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
              {allowedTypes.map(t => (
                <option key={t} value={t}>{evidenceTypeLabels[t]}</option>
              ))}
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
