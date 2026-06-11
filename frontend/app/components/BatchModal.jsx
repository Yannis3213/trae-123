import { useState } from 'react';
import { api } from '../utils/api';
import { ROLES } from '../constants';

export default function BatchModal({ selectedIds, onClose, onRefresh, moduleType, userRole }) {
  const [action, setAction] = useState('');
  const [remark, setRemark] = useState('');
  const [abnormalReason, setAbnormalReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);

  if (!selectedIds || selectedIds.length === 0) return null;

  const getOptions = () => {
    if (moduleType === 'registration' || userRole === ROLES.REGISTRAR) {
      return [{ value: 'submit', label: '批量提交/补正' }];
    }
    if (moduleType === 'verification' || userRole === ROLES.SUPERVISOR) {
      return [
        { value: 'pass', label: '批量审核通过' },
        { value: 'return', label: '批量退回补正' },
        { value: 'missing', label: '批量缺料退回' },
        { value: 'overdue', label: '批量标记逾期' }
      ];
    }
    if (moduleType === 'archiving' || userRole === ROLES.REVIEWER) {
      return [
        { value: 'sync', label: '批量同步归档' },
        { value: 'return', label: '批量退回补正' }
      ];
    }
    return [];
  };

  const options = getOptions();

  const handleSubmit = async () => {
    if (!action) return;
    setSubmitting(true);
    setResult(null);
    try {
      const res = await api.sideRecords.batch(selectedIds, action, {
        remark,
        abnormalReason
      });
      setResult(res.data || res);
      if (res.success) onRefresh && onRefresh();
    } catch (e) {
      setResult({ message: '批量处理异常' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 560 }}>
        <div className="modal-header">
          <h3 className="text-base font-semibold">批量处理</h3>
          <button className="text-gray-400 hover:text-gray-600 text-xl" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <div className="mb-4 text-sm text-gray-600">
            已选择 <span className="font-semibold text-blue-600">{selectedIds.length}</span> 条单据
          </div>

          {!result ? (
            <div className="space-y-3">
              <div>
                <label className="form-label">操作类型 *</label>
                <select className="form-select" value={action} onChange={e => setAction(e.target.value)}>
                  <option value="">请选择操作</option>
                  {options.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              {action && ['return', 'missing', 'overdue'].includes(action) && (
                <div>
                  <label className="form-label">异常原因</label>
                  <textarea
                    className="form-textarea"
                    rows={2}
                    value={abnormalReason}
                    onChange={e => setAbnormalReason(e.target.value)}
                    placeholder="退回/缺料/逾期时请填写原因..."
                  />
                </div>
              )}
              <div>
                <label className="form-label">备注</label>
                <textarea
                  className="form-textarea"
                  rows={2}
                  value={remark}
                  onChange={e => setRemark(e.target.value)}
                  placeholder="可选"
                />
              </div>
              <div className="bg-yellow-50 border border-yellow-200 text-yellow-700 text-sm p-2.5 rounded">
                ⚠ 批量操作将逐条执行，每条单据会进行角色、状态、版本、证据、处理人校验，不符合条件的将被拦截。
              </div>
            </div>
          ) : (
            <div>
              <div className="text-sm mb-2">
                总计 {result.total} 条，成功 <span className="text-green-600 font-medium">{result.successCount}</span> 条，
                失败 <span className="text-red-600 font-medium">{result.failCount}</span> 条
              </div>
              <div className="max-h-64 overflow-auto border border-gray-200 rounded">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="text-left p-2 font-medium">记录单号</th>
                      <th className="text-left p-2 font-medium">状态</th>
                      <th className="text-left p-2 font-medium">原因</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.details && result.details.map((d, i) => (
                      <tr key={i} className="border-t border-gray-100">
                        <td className="p-2">{d.recordNo}</td>
                        <td className="p-2">
                          <span className={d.success ? 'text-green-600' : 'text-red-600'}>
                            {d.success ? '✓ 成功' : '✗ 失败'}
                          </span>
                        </td>
                        <td className="p-2 text-gray-600">{d.message}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
        <div className="modal-footer">
          {!result ? (
            <>
              <button className="btn btn-default" onClick={onClose}>取消</button>
              <button className="btn btn-primary" onClick={handleSubmit} disabled={submitting || !action}>
                {submitting ? '处理中...' : '确认批量处理'}
              </button>
            </>
          ) : (
            <button className="btn btn-primary" onClick={onClose}>关闭</button>
          )}
        </div>
      </div>
    </div>
  );
}
