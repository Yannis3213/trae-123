import React, { useState, useEffect, useRef } from 'react';
import {
  visitsApi, attachmentsApi, auditApi, authApi
} from '../lib/api';
import {
  STATUS_LABELS, PRIORITY_LABELS, EXCEPTION_LABELS, CATEGORY_LABELS,
  formatDate, getDeadlineStatus, priorityStyle, statusStyle, hasRole
} from '../lib/auth';
import ActionModal from './ActionModal';
import { attachmentsApi as attachApi } from '../lib/api';

export default function VisitDetail({ id }) {
  const [data, setData] = useState(null);
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionModal, setActionModal] = useState(null);
  const [toast, setToast] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [editData, setEditData] = useState({});
  const [auditContent, setAuditContent] = useState('');
  const fileRef = useRef(null);
  const [attachCategory, setAttachCategory] = useState('pet_profile');

  const loadData = async () => {
    setLoading(true);
    try {
      const [res, docsRes] = await Promise.all([
        visitsApi.get(id),
        authApi.getDoctors()
      ]);
      if (res.success) {
        setData(res.data);
        setEditData({
          diagnosis: res.data.diagnosis || '',
          treatment: res.data.treatment || '',
          follow_up_result: res.data.follow_up_result || '',
          chief_complaint: res.data.chief_complaint || '',
          pet_breed: res.data.pet_breed || '',
          pet_age: res.data.pet_age || '',
          owner_phone: res.data.owner_phone || '',
          deadline: res.data.deadline ? res.data.deadline.slice(0, 16) : ''
        });
      }
      if (docsRes.success) setDoctors(docsRes.users || []);
    } catch (err) {
      showToast(err.message || '加载失败', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [id]);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2500);
  };

  const handleAction = async (actionKey, payload) => {
    try {
      const res = await visitsApi.transition(id, {
        action: actionKey,
        version: data.version,
        ...payload
      });
      if (res.success) {
        showToast(res.message);
        setActionModal(null);
        loadData();
      } else {
        showToast(res.message, 'error');
      }
    } catch (err) {
      showToast(err.message || '操作失败', 'error');
    }
  };

  const handleSaveEdit = async () => {
    try {
      const res = await visitsApi.update(id, editData);
      if (res.success) {
        showToast('保存成功');
        setEditMode(false);
        loadData();
      } else {
        showToast(res.message, 'error');
      }
    } catch (err) {
      showToast(err.message || '保存失败', 'error');
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('visit_order_id', id);
      fd.append('category', attachCategory);
      const res = await attachmentsApi.upload(fd);
      if (res.success) {
        showToast('附件上传成功');
        fileRef.current.value = '';
        loadData();
      }
    } catch (err) {
      showToast(err.message || '上传失败', 'error');
    }
  };

  const handleRemoveAttach = async (aid) => {
    if (!confirm('确定删除该附件？')) return;
    try {
      await attachmentsApi.remove(aid);
      showToast('附件已删除');
      loadData();
    } catch (err) {
      showToast(err.message || '删除失败', 'error');
    }
  };

  const handleAddAudit = async () => {
    if (!auditContent.trim()) return;
    try {
      const res = await auditApi.add(id, auditContent);
      if (res.success) {
        setAuditContent('');
        showToast('审计备注已添加');
        loadData();
      }
    } catch (err) {
      showToast(err.message || '添加失败', 'error');
    }
  };

  if (loading) return <div className="card"><div className="empty">加载中...</div></div>;
  if (!data) return <div className="card"><div className="empty">就诊单不存在或您无权查看</div></div>;

  const dl = getDeadlineStatus(data.deadline);
  const ps = priorityStyle(data.priority);
  const ss = statusStyle(data.status);

  const canEdit = hasRole('nurse', 'director') ||
    (hasRole('doctor') && (data.assignee_id === null || data.assignee?.id === (getUserLocal()?.id)));

  function getUserLocal() {
    try { return JSON.parse(localStorage.getItem('pet_hospital_auth')); } catch { return null; }
  }

  return (
    <div>
      {toast && (
        <div className={toast.type === 'error' ? 'error-box' : 'success-box'}>{toast.msg}</div>
      )}

      <div className="card">
        <div className="card-title">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 18, fontWeight: 600 }}>{data.order_no}</span>
            <span className="badge" style={{ background: ss.bg, color: ss.color }}>
              {STATUS_LABELS[data.status]}
            </span>
            <span className="badge" style={{ background: ps.bg, color: ps.color }}>
              {ps.label}
            </span>
            <span className="badge" style={{ background: `${dl.color}20`, color: dl.color }}>
              {dl.label}
            </span>
            {data.exception_type && (
              <span className="exception-tag">{EXCEPTION_LABELS[data.exception_type]}</span>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {canEdit && !editMode && (
              <button className="btn" onClick={() => setEditMode(true)}>✏️ 编辑</button>
            )}
            {editMode && (
              <>
                <button className="btn" onClick={() => { setEditMode(false); loadData(); }}>取消</button>
                <button className="btn btn-primary" onClick={handleSaveEdit}>💾 保存</button>
              </>
            )}
            <a className="btn" href="/">← 返回列表</a>
          </div>
        </div>

        {data.exception_reason && (
          <div className="error-box" style={{ marginBottom: 16 }}>
            ⚠️ 异常原因：{data.exception_reason}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
          {(data.allowedActions || []).map(act => (
            <button
              key={act.action}
              className="btn btn-primary btn-sm"
              onClick={() => setActionModal(act)}
            >
              {act.label}
            </button>
          ))}
          {(!data.allowedActions || data.allowedActions.length === 0) && (
            <span style={{ color: '#64748b', fontSize: 13 }}>当前状态下暂无可用操作</span>
          )}
        </div>

        <div className="section-title">🐾 宠物建档信息</div>
        <div className="detail-grid">
          <div className="detail-item">
            <span className="label">宠物名称</span>
            {editMode
              ? <input value={editData.pet_name || data.pet_name} onChange={e => setEditData({ ...editData, pet_name: e.target.value })} />
              : <span className="value">{data.pet_name}</span>
            }
          </div>
          <div className="detail-item">
            <span className="label">宠物类型</span>
            <span className="value">{data.pet_type}</span>
          </div>
          <div className="detail-item">
            <span className="label">品种</span>
            {editMode
              ? <input value={editData.pet_breed} onChange={e => setEditData({ ...editData, pet_breed: e.target.value })} />
              : <span className="value">{data.pet_breed || '-'}</span>
            }
          </div>
          <div className="detail-item">
            <span className="label">年龄</span>
            {editMode
              ? <input type="number" value={editData.pet_age} onChange={e => setEditData({ ...editData, pet_age: e.target.value })} />
              : <span className="value">{data.pet_age ? `${data.pet_age} 岁` : '-'}</span>
            }
          </div>
          <div className="detail-item">
            <span className="label">性别</span>
            <span className="value">{data.pet_gender || '-'}</span>
          </div>
          <div className="detail-item">
            <span className="label">创建人</span>
            <span className="value">{data.creator?.name || '-'}</span>
          </div>
        </div>

        <div className="section-title">👤 主人及预约信息</div>
        <div className="detail-grid">
          <div className="detail-item">
            <span className="label">主人姓名</span>
            <span className="value">{data.owner_name}</span>
          </div>
          <div className="detail-item">
            <span className="label">联系电话</span>
            {editMode
              ? <input value={editData.owner_phone} onChange={e => setEditData({ ...editData, owner_phone: e.target.value })} />
              : <span className="value">{data.owner_phone}</span>
            }
          </div>
          <div className="detail-item">
            <span className="label">预约时间</span>
            <span className="value">{formatDate(data.appointment_time) || '-'}</span>
          </div>
          <div className="detail-item">
            <span className="label">就诊时间</span>
            <span className="value">{formatDate(data.visit_time) || '-'}</span>
          </div>
          <div className="detail-item">
            <span className="label">回访时间</span>
            <span className="value">{formatDate(data.follow_up_time) || '-'}</span>
          </div>
          <div className="detail-item">
            <span className="label">截止时间</span>
            {editMode
              ? <input type="datetime-local" value={editData.deadline} onChange={e => setEditData({ ...editData, deadline: e.target.value })} />
              : <span className="value" style={{ color: dl.color }}>{formatDate(data.deadline)}</span>
            }
          </div>
        </div>

        <div className="section-title">📋 就诊详情（可核验/可编辑）</div>
        <div className="detail-grid">
          <div className="detail-item" style={{ gridColumn: 'span 3' }}>
            <span className="label">主诉</span>
            {editMode
              ? <textarea value={editData.chief_complaint} onChange={e => setEditData({ ...editData, chief_complaint: e.target.value })} />
              : <span className="value">{data.chief_complaint || '-'}</span>
            }
          </div>
          <div className="detail-item" style={{ gridColumn: 'span 3' }}>
            <span className="label">诊断结果</span>
            {editMode
              ? <textarea value={editData.diagnosis} onChange={e => setEditData({ ...editData, diagnosis: e.target.value })} />
              : <span className="value">{data.diagnosis || '-'}</span>
            }
          </div>
          <div className="detail-item" style={{ gridColumn: 'span 3' }}>
            <span className="label">治疗方案</span>
            {editMode
              ? <textarea value={editData.treatment} onChange={e => setEditData({ ...editData, treatment: e.target.value })} />
              : <span className="value">{data.treatment || '-'}</span>
            }
          </div>
          <div className="detail-item" style={{ gridColumn: 'span 3' }}>
            <span className="label">诊后回访结果</span>
            {editMode
              ? <textarea value={editData.follow_up_result} onChange={e => setEditData({ ...editData, follow_up_result: e.target.value })} />
              : <span className="value">{data.follow_up_result || '-'}</span>
            }
          </div>
        </div>

        <div className="section-title">👥 责任分配</div>
        <div className="detail-grid">
          <div className="detail-item">
            <span className="label">分派兽医师</span>
            <span className="value">{data.assignee?.name || '-'}</span>
          </div>
          <div className="detail-item">
            <span className="label">接诊兽医师</span>
            <span className="value">{data.handler?.name || '-'}</span>
          </div>
          <div className="detail-item">
            <span className="label">复核院长</span>
            <span className="value">{data.reviewer?.name || '-'}</span>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-title">
          <span>📎 附件（{data.attachments.length}）</span>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <select value={attachCategory} onChange={e => setAttachCategory(e.target.value)} style={{ width: 140 }}>
              {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
            <button className="btn btn-sm btn-primary" onClick={() => fileRef.current?.click()}>
              ⬆️ 上传附件
            </button>
            <input type="file" ref={fileRef} style={{ display: 'none' }} onChange={handleFileUpload} />
          </div>
        </div>
        {data.attachments.length === 0 ? (
          <div className="empty">暂无附件</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>分类</th>
                <th>文件名</th>
                <th>上传人</th>
                <th>上传时间</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {data.attachments.map(a => (
                <tr key={a.id}>
                  <td><span className="tag">{CATEGORY_LABELS[a.category]}</span></td>
                  <td>
                    <a href={attachApi.download(a.id)} target="_blank">{a.original_name}</a>
                  </td>
                  <td>{a.uploader_name || '-'}</td>
                  <td style={{ fontSize: 12 }}>{formatDate(a.created_at)}</td>
                  <td>
                    {hasRole('nurse', 'director') && (
                      <button className="btn btn-sm btn-danger" onClick={() => handleRemoveAttach(a.id)}>删除</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {hasRole('nurse', 'director') && (
        <div className="card">
          <div className="card-title"><span>📓 审计备注</span></div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <textarea
              value={auditContent}
              onChange={e => setAuditContent(e.target.value)}
              placeholder="添加审计备注..."
              style={{ flex: 1, minHeight: 60 }}
            />
            <button className="btn btn-primary" onClick={handleAddAudit} style={{ alignSelf: 'flex-start' }}>
              添加
            </button>
          </div>
          {data.auditNotes.length === 0 ? (
            <div className="empty">暂无审计备注</div>
          ) : (
            <div className="timeline">
              {data.auditNotes.map(n => (
                <div key={n.id} className="timeline-item">
                  <div className="time">{formatDate(n.created_at)} · {n.operator_name}</div>
                  <div style={{ marginTop: 4 }}>{n.content}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="card">
        <div className="card-title"><span>📝 处理记录与状态流转</span></div>
        {data.records.length === 0 ? (
          <div className="empty">暂无处理记录</div>
        ) : (
          <div className="timeline">
            {data.records.map(r => (
              <div key={r.id} className="timeline-item">
                <div className="time">{formatDate(r.created_at)}</div>
                <div className="meta">
                  <span className="badge" style={{ background: '#eff6ff', color: '#2563eb' }}>
                    {r.operator_name} · {r.operatorRoleLabel}
                  </span>
                  {r.from_status && (
                    <span style={{ color: '#64748b' }}>
                      {r.fromStatusLabel} → <strong>{r.toStatusLabel}</strong>
                    </span>
                  )}
                  {!r.from_status && <span style={{ color: '#64748b' }}>创建</span>}
                  {r.exceptionTypeLabel && (
                    <span className="exception-tag">{r.exceptionTypeLabel}</span>
                  )}
                </div>
                <div>{r.comment}</div>
                {(r.evidence_required || r.evidence_provided) && (
                  <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
                    {r.evidence_required && <span>需提供：{r.evidence_required}</span>}
                    {r.evidence_required && r.evidence_provided && ' | '}
                    {r.evidence_provided && <span>已提供：{r.evidence_provided}</span>}
                  </div>
                )}
                {r.exception_reason && (
                  <div style={{ fontSize: 12, color: '#dc2626', marginTop: 4 }}>异常：{r.exception_reason}</div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {actionModal && (
        <ActionModal
          action={actionModal}
          doctors={doctors}
          onClose={() => setActionModal(null)}
          onSubmit={handleAction}
        />
      )}
    </div>
  );
}
