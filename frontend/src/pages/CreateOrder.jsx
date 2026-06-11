import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import dayjs from 'dayjs'
import { http, INSURANCE_TYPES, EVIDENCE_CATEGORIES, ROLE_LABEL } from '../api.js'
import { useApp } from '../App.jsx'

export default function CreateOrder() {
  const nav = useNavigate()
  const { role, triggerRefresh } = useApp()

  const [form, setForm] = useState({
    customer_name: '',
    id_number: '',
    phone: '',
    insurance_type: INSURANCE_TYPES[0],
    insurance_amount: 100000,
    premium: 3000,
    insurance_period: '1年',
    start_date: dayjs().format('YYYY-MM-DD'),
    end_date: dayjs().add(1, 'year').format('YYYY-MM-DD'),
    deadline: dayjs().add(7, 'day').format('YYYY-MM-DD'),
    remark: '',
  })
  const [attachments, setAttachments] = useState([])
  const [fileName, setFileName] = useState('投保单.pdf')
  const [fileCat, setFileCat] = useState(EVIDENCE_CATEGORIES[0].value)
  const [fileEvidence, setFileEvidence] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  const update = (k, v) => setForm({ ...form, [k]: v })

  const addAttachment = () => {
    if (!fileName) return
    setAttachments([...attachments, {
      file_name: fileName,
      file_type: fileName.endsWith('.pdf') ? 'application/pdf' : fileName.endsWith('.jpg') ? 'image/jpeg' : 'application/octet-stream',
      file_size: 100000 + Math.floor(Math.random() * 500000),
      file_url: `https://placeholder.local/${encodeURIComponent(fileName)}`,
      category: fileCat,
      is_evidence: fileEvidence,
    }])
    setFileName('')
  }

  const handleSubmit = async () => {
    if (role !== 'customer_manager') {
      return alert('仅客户经理可创建投保申请，请切换角色为客户经理')
    }
    if (!form.customer_name.trim()) return alert('请填写客户姓名')
    if (!form.id_number.trim()) return alert('请填写证件号码')
    if (!form.insurance_type) return alert('请选择险种')
    if (form.insurance_amount <= 0) return alert('投保金额必须大于0')

    setSubmitting(true)
    try {
      const payload = {
        ...form,
        start_date: new Date(form.start_date).toISOString(),
        end_date: new Date(form.end_date).toISOString(),
        deadline: new Date(form.deadline).toISOString(),
        attachments: attachments,
      }
      const result = await http.post('/patrol-orders', payload)
      alert('创建成功！申请单号：' + result.order_no)
      triggerRefresh()
      nav(`/orders/${result.id}`)
    } catch (e) {
      alert('创建失败：' + (e.Message || e.message || '未知错误'))
    } finally {
      setSubmitting(false)
    }
  }

  if (role !== 'customer_manager') {
    return (
      <div>
        <div className="page-title">新建投保申请</div>
        <div className="card">
          <div className="alert alert-error">
            仅「客户经理」角色可创建投保申请。当前角色为：<b>{ROLE_LABEL[role]}</b>。
            请在右上角切换到「客户经理」角色。
          </div>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="page-title">
        <span>+ 新建投保申请</span>
        <div>
          <button className="btn" onClick={() => nav('/orders/register')}>返回列表</button>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={submitting}>
            {submitting ? '提交中...' : '✅ 提交投保申请'}
          </button>
        </div>
      </div>

      <div className="card">
        <div className="card-title">👤 客户信息</div>
        <div className="form-row">
          <div className="form-item">
            <label className="required">客户姓名</label>
            <input className="input" value={form.customer_name} onChange={(e) => update('customer_name', e.target.value)} />
          </div>
          <div className="form-item">
            <label className="required">身份证号</label>
            <input className="input" value={form.id_number} onChange={(e) => update('id_number', e.target.value)} placeholder="18位身份证号" />
          </div>
          <div className="form-item">
            <label>联系电话</label>
            <input className="input" value={form.phone} onChange={(e) => update('phone', e.target.value)} />
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-title">🛡️ 投保信息</div>
        <div className="form-row">
          <div className="form-item">
            <label className="required">险种</label>
            <select className="select" value={form.insurance_type} onChange={(e) => update('insurance_type', e.target.value)}>
              {INSURANCE_TYPES.map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div className="form-item">
            <label className="required">投保金额（元）</label>
            <input type="number" className="input" value={form.insurance_amount}
              onChange={(e) => update('insurance_amount', Number(e.target.value))} />
          </div>
          <div className="form-item">
            <label className="required">保费（元）</label>
            <input type="number" className="input" value={form.premium}
              onChange={(e) => update('premium', Number(e.target.value))} />
          </div>
          <div className="form-item">
            <label>保险期间</label>
            <input className="input" value={form.insurance_period} onChange={(e) => update('insurance_period', e.target.value)}
              placeholder="如：1年、20年、终身" />
          </div>
          <div className="form-item">
            <label>起保日期</label>
            <input type="date" className="input date-input" value={form.start_date} onChange={(e) => update('start_date', e.target.value)} />
          </div>
          <div className="form-item">
            <label>终保日期</label>
            <input type="date" className="input date-input" value={form.end_date} onChange={(e) => update('end_date', e.target.value)} />
          </div>
          <div className="form-item">
            <label className="required">办理截止日期</label>
            <input type="date" className="input date-input" value={form.deadline} onChange={(e) => update('deadline', e.target.value)} />
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-title">📎 投保资料上传（模拟）</div>
        <div className="filter-bar" style={{ marginBottom: 16 }}>
          <input className="input" placeholder="文件名，如：投保单.pdf" value={fileName}
            onChange={(e) => setFileName(e.target.value)} style={{ flex: 1, minWidth: 220 }} />
          <select className="select" value={fileCat} onChange={(e) => setFileCat(e.target.value)}>
            {EVIDENCE_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <input type="checkbox" className="checkbox" checked={fileEvidence} onChange={(e) => setFileEvidence(e.target.checked)} />
            作为必需证据
          </label>
          <button className="btn btn-primary" onClick={addAttachment}>+ 添加附件</button>
        </div>
        <div className="attachment-list">
          {attachments.length === 0 && <div style={{ color: '#9ca3af', fontSize: 13 }}>暂未添加附件（建议至少上传投保单、身份证明）</div>}
          {attachments.map((a, i) => (
            <div key={i} className={'attachment-item' + (a.is_evidence ? ' evidence' : '')}>
              📄 {a.file_name}
              <span className="attachment-category">{EVIDENCE_CATEGORIES.find(c => c.value === a.category)?.label || a.category}</span>
              <span style={{ fontSize: 11, color: '#9ca3af' }}>{Math.round(a.file_size / 1024)}KB</span>
              <button className="attachment-delete" onClick={() => setAttachments(attachments.filter((_, j) => j !== i))}>×</button>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="card-title">📝 备注</div>
        <textarea className="textarea" rows="3" value={form.remark} onChange={(e) => update('remark', e.target.value)}
          placeholder="特殊情况说明..." />
      </div>
    </div>
  )
}
