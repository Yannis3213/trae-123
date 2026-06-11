import { useState, useEffect } from 'preact/hooks';
import { useRoute } from 'preact-router';
import {
  fetchOrderDetail,
  submitMaterial,
  submitAcceptance,
  submitReview,
  uploadAttachment,
  addAuditNote,
  getCurrentUser
} from '../api/client.js';
import BusinessModules from './BusinessModules.jsx';

const exceptionTypeLabels = {
  missing_material: '缺材料',
  timeout: '超时',
  rejection: '退回补正',
  status_conflict: '状态冲突'
};

const uploadTypeLabels = {
  material: '原料订货凭证',
  acceptance: '到货验收凭证',
  inventory: '库存回写凭证',
  correction: '补正材料'
};

export default function OrderDetail() {
  const route = useRoute();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [activeModule, setActiveModule] = useState('material');
  const [toast, setToast] = useState(null);
  const [uploading, setUploading] = useState(false);
  const user = getCurrentUser();

  const [materialForm, setMaterialForm] = useState({
    has_invoice: false,
    invoice_no: '',
    material_complete: true,
    remark: ''
  });

  const [acceptanceForm, setAcceptanceForm] = useState({
    acceptance_passed: true,
    inspector: user?.name || '',
    check_date: new Date().toISOString().slice(0, 10),
    remark: '',
    items: []
  });

  const [reviewForm, setReviewForm] = useState({
    inventory_updated: true,
    warehouse: '中心仓A区',
    stock_date: new Date().toISOString().slice(0, 10),
    remark: '',
    action: 'approve'
  });

  const [auditNote, setAuditNote] = useState('');
  const [uploadType, setUploadType] = useState('material');
  const [selectedFiles, setSelectedFiles] = useState([]);

  const showToast = (message, type = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    loadOrder();
  }, [route.id]);

  useEffect(() => {
    if (order) {
      if (order.status === 'pending_acceptance' || order.status === 'recheck_pending') {
        setActiveModule('acceptance');
      } else if (order.status === 'pending_review') {
        setActiveModule('inventory');
      } else {
        setActiveModule('material');
      }
      
      if (order.items) {
        setAcceptanceForm(prev => ({
          ...prev,
          items: order.items.map(i => ({
            id: i.id,
            material_name: i.material_name,
            quantity: i.quantity,
            arrived_quantity: i.arrived_quantity || i.quantity,
            accepted_quantity: i.accepted_quantity || i.quantity
          }))
        }));
      }
    }
  }, [order]);

  const loadOrder = async () => {
    setLoading(true);
    try {
      const data = await fetchOrderDetail(route.id);
      setOrder(data);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitMaterial = async () => {
    if (!materialForm.has_invoice) {
      showToast('请上传采购发票作为必填证据', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const result = await submitMaterial(order.id, {
        version: order.version,
        evidence: {
          has_invoice: materialForm.has_invoice,
          invoice_no: materialForm.invoice_no,
          material_complete: materialForm.material_complete
        },
        remark: materialForm.remark
      });
      showToast(result.message, 'success');
      loadOrder();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitAcceptance = async () => {
    setSubmitting(true);
    try {
      const result = await submitAcceptance(order.id, {
        version: order.version,
        evidence: {
          acceptance_passed: acceptanceForm.acceptance_passed,
          inspector: acceptanceForm.inspector,
          check_date: acceptanceForm.check_date
        },
        remark: acceptanceForm.remark,
        passed: acceptanceForm.acceptance_passed,
        items: acceptanceForm.items
      });
      showToast(result.message, 'success');
      loadOrder();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitReview = async () => {
    if (!reviewForm.inventory_updated) {
      showToast('请上传库存回写凭证', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const result = await submitReview(order.id, {
        version: order.version,
        evidence: {
          inventory_updated: reviewForm.inventory_updated,
          warehouse: reviewForm.warehouse,
          stock_date: reviewForm.stock_date
        },
        remark: reviewForm.remark,
        action: reviewForm.action
      });
      showToast(result.message, 'success');
      loadOrder();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpload = async () => {
    if (selectedFiles.length === 0) {
      showToast('请选择要上传的文件', 'warning');
      return;
    }

    setUploading(true);
    try {
      await uploadAttachment(order.id, selectedFiles, uploadType);
      showToast('附件上传成功', 'success');
      setSelectedFiles([]);
      loadOrder();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setUploading(false);
    }
  };

  const handleAddNote = async () => {
    if (!auditNote.trim()) {
      showToast('请输入备注内容', 'warning');
      return;
    }

    try {
      await addAuditNote(order.id, auditNote);
      showToast('备注已添加', 'success');
      setAuditNote('');
      loadOrder();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const canHandleMaterial = () => {
    if (!order) return false;
    return (order.status === 'pending_material' || order.status === 'exception') &&
           user?.role === 'store_manager' &&
           user?.store_id === order.store_id;
  };

  const canHandleAcceptance = () => {
    if (!order) return false;
    return (order.status === 'pending_acceptance' || order.status === 'recheck_pending') &&
           user?.role === 'qc_specialist';
  };

  const canHandleReview = () => {
    if (!order) return false;
    return order.status === 'pending_review' && user?.role === 'operations_manager';
  };

  const getStatusStyle = (color) => ({
    background: color + '20',
    color: color
  });

  const getTimelineClass = (action) => {
    if (action.includes('通过') || action.includes('完成')) return 'success';
    if (action.includes('退回') || action.includes('不通过') || action.includes('拦截')) return 'danger';
    if (action.includes('异常') || action.includes('超时')) return 'warning';
    return '';
  };

  const formatEvidence = (evidence) => {
    if (!evidence) return '无';
    if (typeof evidence === 'string') return evidence;
    return Object.entries(evidence)
      .map(([k, v]) => `${k}: ${v}`)
      .join('; ');
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '80px' }}>
        <span class="spinner" /> 加载中...
      </div>
    );
  }

  if (!order) {
    return <div class="alert alert-error">订单不存在</div>;
  }

  const singleOrderArr = [order];

  return (
    <div>
      <div class="page-header">
        <div>
          <h1 class="page-title" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button class="btn btn-default" onClick={() => window.history.back()}>
              ← 返回
            </button>
            订货单详情
            <span style={{ fontFamily: 'monospace', fontSize: '18px', color: '#8c8c8c' }}>
              {order.order_no}
            </span>
            <span class="status-tag" style={getStatusStyle(order.status_color)}>
              {order.status_label}
            </span>
            <span class="version-tag">v{order.version}</span>
          </h1>
        </div>
      </div>

      {order.exception_reason && (
        <div class="exception-alert">
          <div class="exception-type">
            ⚠️ {exceptionTypeLabels[order.exception_type] || '异常'}: {order.exception_reason}
          </div>
          <div class="exception-desc">
            请按要求补正材料后重新提交。异常日志仅作为证据，详情页真实处理结果以提交为准。
          </div>
        </div>
      )}

      <BusinessModules 
        active={activeModule}
        onChange={setActiveModule}
        orders={singleOrderArr}
        onRefresh={loadOrder}
      />

      <div class="detail-container">
        <div class="detail-main">
          <div class="detail-card">
            <div class="detail-card-title">
              <span class="module-badge blue"></span>
              基本信息
            </div>
            <div class="detail-grid">
              <div class="detail-item">
                <span class="detail-label">门店:</span>
                <span class="detail-value">{order.store_name}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">门店地址:</span>
                <span class="detail-value">{order.store_address}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">订货日期:</span>
                <span class="detail-value">{order.order_date}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">预计到货:</span>
                <span class="detail-value">{order.expected_arrival || '-'}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">当前处理人:</span>
                <span class="detail-value">{order.current_role_label}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">截止时间:</span>
                <span class="detail-value">
                  <span class={`deadline-tag deadline-${order.deadline_status}`}>
                    {order.deadline || '-'}
                  </span>
                </span>
              </div>
              <div class="detail-item">
                <span class="detail-label">订单金额:</span>
                <span class="detail-value" style={{ fontWeight: '600', color: '#1890ff' }}>
                  ¥{order.total_amount?.toFixed(2)}
                </span>
              </div>
              <div class="detail-item">
                <span class="detail-label">创建时间:</span>
                <span class="detail-value">{order.created_at?.slice(0, 19)}</span>
              </div>
            </div>
          </div>

          {activeModule === 'material' && (
            <div class="detail-card">
              <div class="detail-card-title">
                <span class="module-badge blue"></span>
                原料订货模块
                {order.material_evidence && <span style={{ marginLeft: 'auto', color: '#52c41a', fontSize: '12px' }}>✓ 已提交</span>}
              </div>

              <div class="form-group">
                <label class="form-label">订货明细</label>
                <table class="items-table">
                  <thead>
                    <tr>
                      <th>原料名称</th>
                      <th>规格</th>
                      <th>订货数量</th>
                      <th>单位</th>
                      <th>单价</th>
                      <th>到货数量</th>
                      <th>验收数量</th>
                      <th>金额</th>
                    </tr>
                  </thead>
                  <tbody>
                    {order.items?.map(item => (
                      <tr key={item.id}>
                        <td>{item.material_name}</td>
                        <td>{item.spec || '-'}</td>
                        <td>{item.quantity}</td>
                        <td>{item.unit}</td>
                        <td>¥{item.unit_price.toFixed(2)}</td>
                        <td>{item.arrived_quantity || 0}</td>
                        <td>{item.accepted_quantity || 0}</td>
                        <td style={{ fontWeight: '500' }}>
                          ¥{(item.quantity * item.unit_price).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {order.material_evidence && (
                <div class="evidence-section">
                  <div class="evidence-label">提交的证据:</div>
                  <div class="evidence-value">{formatEvidence(order.material_evidence)}</div>
                </div>
              )}

              {canHandleMaterial() && (
                <div style={{ marginTop: '20px', paddingTop: '20px', borderTop: '1px solid #f0f0f0' }}>
                  <div class="form-group">
                    <label class="form-label">
                      <span style={{ color: '#f5222d' }}>*</span> 是否有采购发票
                    </label>
                    <label class="switch">
                      <input
                        type="checkbox"
                        checked={materialForm.has_invoice}
                        onChange={(e) => setMaterialForm({ ...materialForm, has_invoice: e.target.checked })}
                      />
                      {materialForm.has_invoice ? '已提供' : '未提供'}
                    </label>
                  </div>

                  {materialForm.has_invoice && (
                    <div class="form-group">
                      <label class="form-label">发票号</label>
                      <input
                        type="text"
                        class="form-input"
                        value={materialForm.invoice_no}
                        onChange={(e) => setMaterialForm({ ...materialForm, invoice_no: e.target.value })}
                        placeholder="请输入发票号"
                      />
                    </div>
                  )}

                  <div class="form-group">
                    <label class="form-label">
                      <span style={{ color: '#f5222d' }}>*</span> 材料是否齐全
                    </label>
                    <label class="switch">
                      <input
                        type="checkbox"
                        checked={materialForm.material_complete}
                        onChange={(e) => setMaterialForm({ ...materialForm, material_complete: e.target.checked })}
                      />
                      {materialForm.material_complete ? '齐全' : '不齐全'}
                    </label>
                  </div>

                  <div class="form-group">
                    <label class="form-label">备注</label>
                    <textarea
                      class="textarea"
                      value={materialForm.remark}
                      onChange={(e) => setMaterialForm({ ...materialForm, remark: e.target.value })}
                      placeholder="请输入备注说明（可选）"
                    />
                  </div>

                  <button
                    class="btn btn-primary btn-block"
                    onClick={handleSubmitMaterial}
                    disabled={submitting}
                  >
                    {submitting && <span class="spinner" />}
                    {submitting ? '提交中...' : '提交订货材料 → 进入验收'}
                  </button>
                </div>
              )}

              {!canHandleMaterial() && order.status !== 'completed' && order.status !== 'rejected' && (
                <div class="alert alert-warning" style={{ marginTop: '16px' }}>
                  当前角色: {user?.roleLabel}。原料订货需由门店店长处理。
                </div>
              )}
            </div>
          )}

          {activeModule === 'acceptance' && (
            <div class="detail-card">
              <div class="detail-card-title">
                <span class="module-badge green"></span>
                到货验收模块
                {order.acceptance_evidence && <span style={{ marginLeft: 'auto', color: '#52c41a', fontSize: '12px' }}>✓ 已验收</span>}
              </div>

              <div class="form-group">
                <label class="form-label">验收明细</label>
                <table class="items-table">
                  <thead>
                    <tr>
                      <th>原料名称</th>
                      <th>订货数量</th>
                      <th>到货数量</th>
                      <th>验收数量</th>
                      <th>差异</th>
                    </tr>
                  </thead>
                  <tbody>
                    {acceptanceForm.items.map(item => (
                      <tr key={item.id}>
                        <td>{item.material_name}</td>
                        <td>{item.quantity}</td>
                        <td>
                          {canHandleAcceptance() ? (
                            <input
                              type="number"
                              value={item.arrived_quantity}
                              onChange={(e) => {
                                const items = acceptanceForm.items.map(i =>
                                  i.id === item.id ? { ...i, arrived_quantity: parseFloat(e.target.value) || 0 } : i
                                );
                                setAcceptanceForm({ ...acceptanceForm, items });
                              }}
                            />
                          ) : (
                            item.arrived_quantity
                          )}
                        </td>
                        <td>
                          {canHandleAcceptance() ? (
                            <input
                              type="number"
                              value={item.accepted_quantity}
                              onChange={(e) => {
                                const items = acceptanceForm.items.map(i =>
                                  i.id === item.id ? { ...i, accepted_quantity: parseFloat(e.target.value) || 0 } : i
                                );
                                setAcceptanceForm({ ...acceptanceForm, items });
                              }}
                            />
                          ) : (
                            item.accepted_quantity
                          )}
                        </td>
                        <td style={{ color: (item.quantity - item.accepted_quantity) > 0 ? '#f5222d' : '#52c41a' }}>
                          {(item.quantity - item.accepted_quantity) > 0
                            ? `短缺 ${(item.quantity - item.accepted_quantity).toFixed(2)}`
                            : '相符'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {order.acceptance_evidence && (
                <div class="evidence-section">
                  <div class="evidence-label">验收证据:</div>
                  <div class="evidence-value">{formatEvidence(order.acceptance_evidence)}</div>
                </div>
              )}

              {canHandleAcceptance() && (
                <div style={{ marginTop: '20px', paddingTop: '20px', borderTop: '1px solid #f0f0f0' }}>
                  <div class="form-row">
                    <div class="form-group">
                      <label class="form-label">验收结果</label>
                      <select
                        class="form-input"
                        value={acceptanceForm.acceptance_passed ? 'pass' : 'fail'}
                        onChange={(e) => setAcceptanceForm({
                          ...acceptanceForm,
                          acceptance_passed: e.target.value === 'pass'
                        })}
                      >
                        <option value="pass">验收通过</option>
                        <option value="fail">验收不通过</option>
                      </select>
                    </div>
                    <div class="form-group">
                      <label class="form-label">验收人</label>
                      <input
                        type="text"
                        class="form-input"
                        value={acceptanceForm.inspector}
                        onChange={(e) => setAcceptanceForm({ ...acceptanceForm, inspector: e.target.value })}
                      />
                    </div>
                    <div class="form-group">
                      <label class="form-label">验收日期</label>
                      <input
                        type="date"
                        class="form-input"
                        value={acceptanceForm.check_date}
                        onChange={(e) => setAcceptanceForm({ ...acceptanceForm, check_date: e.target.value })}
                      />
                    </div>
                  </div>

                  <div class="form-group">
                    <label class="form-label">验收备注</label>
                    <textarea
                      class="textarea"
                      value={acceptanceForm.remark}
                      onChange={(e) => setAcceptanceForm({ ...acceptanceForm, remark: e.target.value })}
                      placeholder={acceptanceForm.acceptance_passed
                        ? '请输入验收情况说明（可选）'
                        : '请详细说明不通过原因及异常情况'}
                    />
                  </div>

                  <button
                    class="btn btn-success btn-block"
                    onClick={handleSubmitAcceptance}
                    disabled={submitting}
                  >
                    {submitting && <span class="spinner" />}
                    {submitting
                      ? '提交中...'
                      : acceptanceForm.acceptance_passed
                        ? '验收通过 → 进入复核'
                        : '标记验收不通过'
                    }
                  </button>
                </div>
              )}

              {!canHandleAcceptance() && order.status !== 'completed' && order.status !== 'rejected' && (
                <div class="alert alert-warning" style={{ marginTop: '16px' }}>
                  当前角色: {user?.roleLabel}。到货验收需由品控专员处理。
                </div>
              )}
            </div>
          )}

          {activeModule === 'inventory' && (
            <div class="detail-card">
              <div class="detail-card-title">
                <span class="module-badge purple"></span>
                库存回写模块
                {order.inventory_evidence && <span style={{ marginLeft: 'auto', color: '#52c41a', fontSize: '12px' }}>✓ 已完成</span>}
              </div>

              {order.inventory_evidence && (
                <div class="evidence-section">
                  <div class="evidence-label">库存回写证据:</div>
                  <div class="evidence-value">{formatEvidence(order.inventory_evidence)}</div>
                </div>
              )}

              {canHandleReview() && (
                <div style={{ marginTop: '20px', paddingTop: '20px', borderTop: '1px solid #f0f0f0' }}>
                  <div class="form-group">
                    <label class="form-label">
                      <span style={{ color: '#f5222d' }}>*</span> 库存已回写
                    </label>
                    <label class="switch">
                      <input
                        type="checkbox"
                        checked={reviewForm.inventory_updated}
                        onChange={(e) => setReviewForm({ ...reviewForm, inventory_updated: e.target.checked })}
                      />
                      {reviewForm.inventory_updated ? '已回写' : '未回写'}
                    </label>
                  </div>

                  <div class="form-row">
                    <div class="form-group">
                      <label class="form-label">仓库</label>
                      <input
                        type="text"
                        class="form-input"
                        value={reviewForm.warehouse}
                        onChange={(e) => setReviewForm({ ...reviewForm, warehouse: e.target.value })}
                        placeholder="请输入仓库位置"
                      />
                    </div>
                    <div class="form-group">
                      <label class="form-label">入库日期</label>
                      <input
                        type="date"
                        class="form-input"
                        value={reviewForm.stock_date}
                        onChange={(e) => setReviewForm({ ...reviewForm, stock_date: e.target.value })}
                      />
                    </div>
                  </div>

                  <div class="form-group">
                    <label class="form-label">处理方式</label>
                    <div style={{ display: 'flex', gap: '16px' }}>
                      <label class="switch">
                        <input
                          type="radio"
                          name="review-action"
                          checked={reviewForm.action === 'approve'}
                          onChange={() => setReviewForm({ ...reviewForm, action: 'approve' })}
                        />
                        复核通过，完成流程
                      </label>
                      <label class="switch">
                        <input
                          type="radio"
                          name="review-action"
                          checked={reviewForm.action === 'reject'}
                          onChange={() => setReviewForm({ ...reviewForm, action: 'reject' })}
                        />
                        退回补正，重新验收
                      </label>
                    </div>
                  </div>

                  <div class="form-group">
                    <label class="form-label">复核备注</label>
                    <textarea
                      class="textarea"
                      value={reviewForm.remark}
                      onChange={(e) => setReviewForm({ ...reviewForm, remark: e.target.value })}
                      placeholder={reviewForm.action === 'reject'
                        ? '请详细说明退回原因及补正要求'
                        : '请输入复核意见（可选）'}
                    />
                  </div>

                  <button
                    class={`btn ${reviewForm.action === 'reject' ? 'btn-danger' : 'btn-success'} btn-block`}
                    onClick={handleSubmitReview}
                    disabled={submitting}
                  >
                    {submitting && <span class="spinner" />}
                    {submitting
                      ? '提交中...'
                      : reviewForm.action === 'reject'
                        ? '退回品控重新验收'
                        : '确认库存回写 → 完成流程'
                    }
                  </button>
                </div>
              )}

              {!canHandleReview() && order.status !== 'completed' && order.status !== 'rejected' && (
                <div class="alert alert-warning" style={{ marginTop: '16px' }}>
                  当前角色: {user?.roleLabel}。库存回写复核需由营运经理处理。
                </div>
              )}
            </div>
          )}

          <div class="detail-card">
            <div class="detail-card-title">
              <span class="module-badge"></span>
              附件管理
            </div>

            <div style={{ marginBottom: '16px', display: 'flex', gap: '12px', alignItems: 'flex-end' }}>
              <div style={{ flex: 1 }}>
                <label class="form-label">附件类型</label>
                <select
                  class="form-input"
                  value={uploadType}
                  onChange={(e) => setUploadType(e.target.value)}
                >
                  <option value="material">原料订货凭证</option>
                  <option value="acceptance">到货验收凭证</option>
                  <option value="inventory">库存回写凭证</option>
                  <option value="correction">补正材料</option>
                </select>
              </div>
              <div style={{ flex: 2 }}>
                <label class="form-label">选择文件</label>
                <input
                  type="file"
                  class="form-input"
                  multiple
                  onChange={(e) => setSelectedFiles(Array.from(e.target.files))}
                />
              </div>
              <button
                class="btn btn-primary"
                onClick={handleUpload}
                disabled={uploading || selectedFiles.length === 0}
              >
                {uploading && <span class="spinner" />}
                上传
              </button>
            </div>

            {order.attachments?.length > 0 ? (
              <div>
                {Object.entries(uploadTypeLabels).map(([type, label]) => {
                  const files = order.attachments.filter(a => a.upload_type === type);
                  if (files.length === 0) return null;
                  return (
                    <div key={type} style={{ marginBottom: '12px' }}>
                      <div style={{ fontSize: '12px', color: '#8c8c8c', marginBottom: '4px' }}>{label}:</div>
                      <div class="attachment-list">
                        {files.map(att => (
                          <span key={att.id} class="attachment-item">
                            📎 {att.file_name}
                            <span style={{ color: '#8c8c8c', fontSize: '11px', marginLeft: '4px' }}>
                              ({att.uploader_name})
                            </span>
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{ color: '#8c8c8c', fontSize: '13px' }}>暂无附件</div>
            )}
          </div>

          <div class="detail-card">
            <div class="detail-card-title">
              <span class="module-badge orange"></span>
              审计备注
            </div>

            <div style={{ marginBottom: '16px', display: 'flex', gap: '8px' }}>
              <input
                type="text"
                class="form-input"
                value={auditNote}
                onChange={(e) => setAuditNote(e.target.value)}
                placeholder="添加审计备注..."
                onKeyPress={(e) => e.key === 'Enter' && handleAddNote()}
              />
              <button class="btn btn-default" onClick={handleAddNote}>添加</button>
            </div>

            {order.audit_notes?.length > 0 ? (
              order.audit_notes.map(note => (
                <div key={note.id} class="audit-note">
                  <div class="audit-note-content">{note.note}</div>
                  <div class="audit-note-meta">
                    {note.noted_by_name} · {note.created_at?.slice(0, 19)}
                  </div>
                </div>
              ))
            ) : (
              <div style={{ color: '#8c8c8c', fontSize: '13px' }}>暂无审计备注</div>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div class="detail-card">
            <div class="detail-card-title">
              <span class="module-badge"></span>
              异常原因记录
            </div>
            {order.exceptions?.length > 0 ? (
              order.exceptions.map(exc => (
                <div
                  key={exc.id}
                  style={{
                    padding: '12px',
                    background: exc.resolved ? '#f6ffed' : '#fff1f0',
                    border: `1px solid ${exc.resolved ? '#b7eb8f' : '#ffa39e'}`,
                    borderRadius: '4px',
                    marginBottom: '8px'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <strong style={{ color: exc.resolved ? '#389e0d' : '#cf1322', fontSize: '12px' }}>
                      {exceptionTypeLabels[exc.exception_type]}
                    </strong>
                    <span style={{ fontSize: '11px', color: '#8c8c8c' }}>
                      {exc.resolved ? '已解决' : '未解决'}
                    </span>
                  </div>
                  <div style={{ fontSize: '12px', color: '#595959' }}>{exc.description}</div>
                  <div style={{ fontSize: '11px', color: '#8c8c8c', marginTop: '4px' }}>
                    发现人: {exc.detected_by_name || '系统'} · {exc.detected_at?.slice(0, 19)}
                  </div>
                  {exc.resolved && (
                    <div style={{ fontSize: '11px', color: '#389e0d', marginTop: '4px' }}>
                      解决人: {exc.resolved_by_name} · {exc.resolution}
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div style={{ color: '#8c8c8c', fontSize: '13px' }}>暂无异常记录</div>
            )}
          </div>

          <div class="detail-card">
            <div class="detail-card-title">
              <span class="module-badge"></span>
              处理记录
            </div>
            <div class="timeline">
              {order.records?.map(record => (
                <div key={record.id} class={`timeline-item ${getTimelineClass(record.action)}`}>
                  <div class="timeline-title">{record.action}</div>
                  <div class="timeline-meta">
                    {record.operator_name} · {record.current_role_label || record.operator_role} · v{record.version}
                  </div>
                  <div class="timeline-meta">
                    {record.from_status && `${record.from_status} → ${record.to_status}`}
                  </div>
                  {record.remark && (
                    <div class="timeline-content">{record.remark}</div>
                  )}
                  {record.evidence && (
                    <div class="timeline-content" style={{ color: '#8c8c8c' }}>
                      证据: {formatEvidence(record.evidence)}
                    </div>
                  )}
                  <div class="timeline-meta" style={{ marginTop: '4px' }}>
                    {record.created_at?.slice(0, 19)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {toast && (
        <div class={`toast alert-${toast.type}`} style={{ background: toast.type === 'success' ? '#f6ffed' : toast.type === 'error' ? '#fff1f0' : '#e6f7ff' }}>
          {toast.message}
        </div>
      )}
    </div>
  );
}
