import { useState } from 'react';
import { api } from '../utils/api';
import { ROLE_CONFIG, ABNORMAL_ACTIONS } from '../constants';
import { StatusBadge } from './Badges';

export default function BatchModal({ selectedIds, records = [], onClose, onRefresh, moduleType, userRole }) {
  const [action, setAction] = useState('');
  const [remark, setRemark] = useState('');
  const [abnormalReason, setAbnormalReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  if (!selectedIds || selectedIds.length === 0) return null;

  const roleConf = ROLE_CONFIG[userRole];
  const options = roleConf ? roleConf.batchActions : [];
  const needsAbnormalReason = ABNORMAL_ACTIONS.includes(action);

  const handleSubmit = async () => {
    if (!action) {
      setError('请选择操作类型');
      return;
    }
    if (needsAbnormalReason && !abnormalReason.trim()) {
      setError('退回/缺料/逾期操作必须填写异常原因');
      return;
    }
    setError('');
    setSubmitting(true);
    setResult(null);
    try {
      const versions = {};
      selectedIds.forEach(id => {
        const rec = records.find(r => r.id === id);
        if (rec && rec.version !== undefined) {
          versions[id] = rec.version;
        }
      });

      const res = await api.sideRecords.batch(selectedIds, action, {
        remark,
        abnormalReason
      }, versions);
      setResult(res.data || res);
      if (res.success) onRefresh && onRefresh();
    } catch (e) {
      setResult({ message: '批量处理异常，请检查网络或后端服务' });
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

          {error && (
                <div className="mb-3 text-sm text-red-600 bg-red-50 p-2.5 rounded border border-red-200">{error}</div>
              )}

              {!result ? (
                <div className="space-y-3">
                  <div>
                    <label className="form-label">操作类型 *</label>
                    <select className="form-select" value={action} onChange={e => { setAction(e.target.value); setError(''); }}>
                      <option value="">请选择操作</option>
                      {options.map(o => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </div>
                  {needsAbnormalReason && (
                    <div>
                      <label className="form-label">异常原因 *</label>
                      <textarea
                        className="form-textarea"
                        rows={2}
                        value={abnormalReason}
                        onChange={e => { setAbnormalReason(e.target.value); setError(''); }}
                        placeholder="退回/缺料/逾期时必须填写原因..."
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
                    ⚠ 批量操作将逐条执行，每条单据会进行【角色、处理人、状态、版本、证据】五维校验，不符合条件的将被拦截并给出原因。
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
                          <th className="text-left p-2 font-medium whitespace-nowrap">记录单号</th>
                          <th className="text-left p-2 font-medium whitespace-nowrap">结果</th>
                          <th className="text-left p-2 font-medium whitespace-nowrap">新状态</th>
                          <th className="text-left p-2 font-medium whitespace-nowrap">新处理人</th>
                          <th className="text-left p-2 font-medium whitespace-nowrap">异常原因</th>
                          <th className="text-left p-2 font-medium whitespace-nowrap">版本</th>
                          <th className="text-left p-2 font-medium whitespace-nowrap">处理记录</th>
                          <th className="text-left p-2 font-medium">说明</th>
                        </tr>
                      </thead>
                      <tbody>
                        {result.details && result.details.map((d, i) => (
                          <tr key={i} className="border-t border-gray-100">
                            <td className="p-2 font-mono text-xs whitespace-nowrap">{d.recordNo}</td>
                            <td className="p-2 whitespace-nowrap">
                              <span className={d.success ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>
                                {d.success ? '✓ 成功' : '✗ 失败'}
                              </span>
                            </td>
                            <td className="p-2 whitespace-nowrap">
                              {d.newStatus && <StatusBadge status={d.newStatus} />}
                              {!d.newStatus && <span className="text-gray-400">—</span>}
                            </td>
                            <td className="p-2 whitespace-nowrap text-xs">
                              {d.newHandler || '—'}
                            </td>
                            <td className="p-2 whitespace-nowrap text-xs text-red-600 max-w-[160px] truncate" title={d.abnormalReason}>
                              {d.abnormalReason || '—'}
                            </td>
                            <td className="p-2 whitespace-nowrap text-xs font-mono">
                              {d.version ? `v${d.version}` : '—'}
                            </td>
                            <td className="p-2 whitespace-nowrap text-xs max-w-[180px]">
                              {d.processRecord ? (
                                <div title={`${d.processRecord.operatorName} 于 ${d.processRecord.processedAt} 执行${d.processRecord.actionName}${d.processRecord.remark ? '，备注：' + d.processRecord.remark : ''}`}>
                                  <div className="text-gray-700">{d.processRecord.actionName}</div>
                                  <div className="text-gray-400 text-[11px]">{d.processRecord.operatorName}</div>
                                </div>
                              ) : (
                                <span className="text-gray-400">—</span>
                              )}
                            </td>
                            <td className="p-2 text-gray-600 text-xs max-w-[200px]" title={d.message}>
                              {d.message}
                            </td>
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
